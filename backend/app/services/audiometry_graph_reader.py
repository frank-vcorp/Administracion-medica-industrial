"""
Lector determinístico de audiogramas tonales (rejilla logarítmica + curvas OD roja / OI azul).

Evita errores de corrimiento horizontal del LLM visual sobre líneas punteadas de
media octava sin etiqueta numérica (p. ej. 3000 Hz y 6000 Hz) y distingue entre
audigramas con OI a la izquierda / OD a la derecha (Sibelmed/Amplivox) y DD65 V2.
"""
from __future__ import annotations

import math
import os
from collections import deque
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
from PIL import Image

AUDIOGRAM_RENDER_DPI = 200
ALL_AUDIOGRAM_FREQS: Tuple[int, ...] = (
    125,
    250,
    500,
    750,
    1000,
    1500,
    2000,
    3000,
    4000,
    6000,
    8000,
)
ANCHOR_OCTAVE_FREQS: Tuple[str, ...] = ("250", "500", "1000", "2000")
TABLE_ONLY_QUAD_FREQS = frozenset({"500", "1000", "2000", "3000"})

MIN_GRID_DY = 16.0
MAX_GRID_DY = 90.0
MIN_GRID_DX = 35.0
MAX_GRID_DX = 180.0
MAX_SNAP_RESIDUAL_DB = 2.5

_VERIFICATION_NOTE = (
    "Umbrales de vía aérea verificados geométricamente sobre la rejilla "
    "logarítmica del audiograma (OD y OI)."
)


def _find_horizontal_grid_candidates(
    sub_gray: np.ndarray,
) -> List[Tuple[float, int, int]]:
    """
    Detecta secuencias periódicas de líneas horizontales de dB HL y retorna candidatos
    ordenados de mayor número de líneas y menor error residual a menor: [(dy, y_first, y_last), ...].
    Usa división exacta (ys[j] - ys[i]) / k_span para evitar deriva acumulada por redondeo.
    """
    height = sub_gray.shape[0]
    pad = np.pad(sub_gray, ((2, 2), (0, 0)), mode="edge")
    h_edge = ((pad[:-4] + pad[4:]) / 2.0 - sub_gray) > 5.0
    h_score = h_edge.mean(axis=1)

    ys: List[int] = []
    for y in range(10, height - 10):
        if h_score[y] > 0.20 and h_score[y] == h_score[y - 3 : y + 4].max():
            if not ys or y - ys[-1] > 8:
                ys.append(y)

    candidates: List[Tuple[int, float, float, int, int]] = []
    seen_spans: List[Tuple[int, int]] = []

    for i in range(len(ys)):
        for j in range(i + 8, len(ys)):
            span_px = ys[j] - ys[i]
            for k_span in range(13, 8, -1):
                dy = span_px / float(k_span)
                if not (MIN_GRID_DY <= dy <= MAX_GRID_DY):
                    continue
                run: List[Tuple[int, int]] = []
                for k in range(k_span + 1):
                    target = ys[i] + k * dy
                    cands = [yy for yy in ys if abs(yy - target) <= 2.5]
                    if not cands:
                        break
                    run.append((k, min(cands, key=lambda yy: abs(yy - target))))
                if len(run) != k_span + 1:
                    continue

                ks = np.array([p[0] for p in run], dtype=float)
                yvs = np.array([p[1] for p in run], dtype=float)
                dy_fit, y0_fit = np.polyfit(ks, yvs, 1)
                if not (MIN_GRID_DY <= dy_fit <= MAX_GRID_DY):
                    continue
                residuals = np.abs(yvs - (y0_fit + ks * dy_fit))
                max_res = float(residuals.max())
                if max_res > 2.5:
                    continue

                y_first, y_last = int(yvs[0]), int(yvs[-1])
                if any(abs(y_first - a) < 12 and abs(y_last - b) < 12 for a, b in seen_spans):
                    continue
                seen_spans.append((y_first, y_last))
                mean_score = float(np.mean([h_score[p[1]] for p in run]))
                candidates.append((len(run), mean_score - float(residuals.mean()) * 0.1, float(dy_fit), y_first, y_last))

    candidates.sort(key=lambda item: (item[0], item[1]), reverse=True)
    return [(dy_fit, y_first, y_last) for _, _, dy_fit, y_first, y_last in candidates]


def _find_octave_vertical_lines(
    sub_gray: np.ndarray,
    xa: int,
    y_first: int,
    y_last: int,
) -> Optional[Tuple[float, float, List[int]]]:
    """Detecta las 7 líneas sólidas de octava (125..8000 Hz) y retorna (x_125, dx_fit, octaves)."""
    band = sub_gray[y_first : y_last + 1, :]
    if band.size == 0:
        return None
    width = band.shape[1]
    vpad = np.pad(band, ((0, 0), (2, 2)), mode="edge")
    v_edge = ((vpad[:, :-4] + vpad[:, 4:]) / 2.0 - band) > 5.0
    v_score = v_edge.mean(axis=0)

    xs: List[int] = []
    for x in range(10, width - 10):
        if v_score[x] > 0.35 and v_score[x] == v_score[x - 3 : x + 4].max():
            gx = x + xa
            if not xs or gx - xs[-1] > 8:
                xs.append(gx)

    best: Optional[Tuple[float, List[int]]] = None
    for i in range(len(xs)):
        for j in range(i + 6, len(xs)):
            dx = (xs[j] - xs[i]) / 6.0
            if not (MIN_GRID_DX <= dx <= MAX_GRID_DX):
                continue
            run: List[int] = []
            ok = True
            for k in range(7):
                target = xs[i] + k * dx
                cands = [xx for xx in xs if abs(xx - target) <= 3.0]
                if not cands:
                    ok = False
                    break
                run.append(min(cands, key=lambda xx: abs(xx - target)))
            if ok:
                score_sum = float(sum(v_score[xx - xa] for xx in run))
                if best is None or score_sum > best[0]:
                    best = (score_sum, run)

    if best is None:
        return None
    octaves = best[1]
    dx_fit = (octaves[-1] - octaves[0]) / 6.0
    return float(octaves[0]), float(dx_fit), octaves


def _refine_y_neg10(
    gray: np.ndarray,
    x_left: int,
    x_right: int,
    y_first: int,
    dy_fit: float,
) -> Optional[float]:
    """Alinea la posición exacta de -10 dB HL maximizando el contraste de las 14 líneas (-10..120)."""
    height = gray.shape[0]
    inner_gray = gray[:, x_left : x_right + 1]
    if inner_gray.size == 0:
        return None
    ipad = np.pad(inner_gray, ((2, 2), (0, 0)), mode="edge")
    ih = (((ipad[:-4] + ipad[4:]) / 2.0 - inner_gray) > 4.0).mean(axis=1)

    start_y = max(5.0, y_first - 4.0 * dy_fit)
    end_y = min(height - 13.0 * dy_fit - 5.0, y_first + 3.0 * dy_fit)
    if end_y <= start_y:
        return None

    best_y0: Optional[float] = None
    best_hsum = -1.0
    for cand_y0 in np.arange(start_y, end_y, 0.5):
        total = float(sum(ih[int(round(cand_y0 + k * dy_fit))] for k in range(14)))
        if total > best_hsum:
            best_hsum = total
            best_y0 = float(cand_y0)
    return best_y0


def _strip_horizontal_reference_lines(mask: np.ndarray) -> None:
    """Elimina líneas horizontales de referencia que cruzan toda la gráfica (p. ej. 0 y 100 dB) preservando símbolos."""
    row_frac = mask.mean(axis=1)
    ref_rows = np.where(row_frac > 0.60)[0]
    if len(ref_rows) == 0:
        return

    bands: List[List[int]] = []
    for ry in ref_rows:
        ry_int = int(ry)
        if not bands or ry_int > bands[-1][1] + 2:
            bands.append([ry_int, ry_int])
        else:
            bands[-1][1] = ry_int

    mh, mw = mask.shape
    for b0, b1 in bands:
        e0 = max(0, b0 - 2)
        e1 = min(mh - 1, b1 + 2)
        for rx in range(mw):
            x_lo = max(0, rx - 2)
            x_hi = min(mw, rx + 3)
            above = mask[max(0, e0 - 5) : e0, x_lo:x_hi].any()
            below = mask[e1 + 1 : min(mh, e1 + 6), x_lo:x_hi].any()
            if not (above or below):
                mask[e0 : e1 + 1, rx] = False


def _filter_connected_curve(mask: np.ndarray, dx_fit: float) -> np.ndarray:
    """Conserva únicamente componentes conexos con extensión horizontal >= 1.8 octavas."""
    mh, mw = mask.shape
    dil = mask.copy()
    for dy_s in (-2, -1, 0, 1, 2):
        for dx_s in (-2, -1, 0, 1, 2):
            ys_src = slice(max(0, -dy_s), mh - max(0, dy_s))
            xs_src = slice(max(0, -dx_s), mw - max(0, dx_s))
            ys_dst = slice(max(0, dy_s), mh - max(0, -dy_s))
            xs_dst = slice(max(0, dx_s), mw - max(0, -dx_s))
            dil[ys_dst, xs_dst] |= mask[ys_src, xs_src]

    visited = np.zeros_like(dil, dtype=bool)
    curve_mask = np.zeros_like(mask, dtype=bool)
    min_span = 1.8 * dx_fit

    for yy in range(mh):
        for xx in range(mw):
            if not dil[yy, xx] or visited[yy, xx]:
                continue
            queue: deque[Tuple[int, int]] = deque([(yy, xx)])
            visited[yy, xx] = True
            pts: List[Tuple[int, int]] = []
            minx = maxx = xx
            while queue:
                py, px = queue.popleft()
                pts.append((py, px))
                if px < minx:
                    minx = px
                if px > maxx:
                    maxx = px
                for ny, nx in ((py - 1, px), (py + 1, px), (py, px - 1), (py, px + 1)):
                    if 0 <= ny < mh and 0 <= nx < mw and dil[ny, nx] and not visited[ny, nx]:
                        visited[ny, nx] = True
                        queue.append((ny, nx))
            if (maxx - minx) >= min_span:
                for py, px in pts:
                    if mask[py, px]:
                        curve_mask[py, px] = True

    return curve_mask


def _dominant_y_cluster(ys: np.ndarray, dy_fit: float) -> np.ndarray:
    """Agrupa coordenadas Y cercanas (manteniendo símbolos huecos 'O') y elige el cluster mayor."""
    sorted_ys = np.sort(ys)
    gap_threshold = max(8, int(round(dy_fit * 0.85)))
    clusters: List[List[int]] = [[int(sorted_ys[0])]]
    for val in sorted_ys[1:]:
        val_int = int(val)
        if val_int - clusters[-1][-1] > gap_threshold:
            clusters.append([val_int])
        else:
            clusters[-1].append(val_int)
    largest = max(clusters, key=len)
    return np.array(largest, dtype=float)


def _sample_chart_thresholds(
    curve_mask: np.ndarray,
    cx0: int,
    cy0: int,
    x_125: float,
    dx_fit: float,
    y_neg10: float,
    dy_fit: float,
) -> Tuple[Dict[str, int], float]:
    """Muestrea umbrales en todas las frecuencias audiómetricas logarítmicas y retorna (va, max_residual)."""
    mw = curve_mask.shape[1]
    r_check = max(3, int(round(dy_fit * 0.18)))
    min_sym_span = max(6, int(round(dy_fit * 0.30)))

    va: Dict[str, int] = {}
    max_residual = 0.0

    for freq in ALL_AUDIOGRAM_FREQS:
        xf_global = x_125 + math.log2(freq / 125.0) * dx_fit
        xf = int(round(xf_global - cx0))
        if xf < r_check or xf >= mw - r_check:
            continue

        win = curve_mask[:, max(0, xf - 3) : min(mw, xf + 4)]
        ys_c = np.where(win)[0]
        if len(ys_c) == 0:
            continue

        col_spans: List[int] = []
        for dx_col in range(-r_check, r_check + 1):
            col_ys = np.where(curve_mask[:, xf + dx_col])[0]
            if len(col_ys) > 0:
                col_spans.append(int(col_ys.max() - col_ys.min()) + 1)
        max_col_span = max(col_spans) if col_spans else 0
        if max_col_span < min_sym_span:
            continue

        cluster = _dominant_y_cluster(ys_c, dy_fit)
        y_center = float(np.median(cluster)) + cy0
        db_exact = -10.0 + ((y_center - y_neg10) / dy_fit) * 10.0
        db_5 = int(round(db_exact / 5.0) * 5)
        residual = abs(db_exact - db_5)

        if -10 <= db_5 <= 120 and residual <= MAX_SNAP_RESIDUAL_DB:
            va[str(freq)] = db_5
            if residual > max_residual:
                max_residual = residual

    return va, max_residual


def _analyze_single_chart(
    rgb: np.ndarray,
    gray: np.ndarray,
    xa: int,
    xb: int,
) -> Optional[Dict[str, Any]]:
    """Analiza una mitad de imagen (izquierda o derecha) buscando un audiograma completo."""
    height, width = gray.shape
    sub_gray = gray[:, xa:xb]
    h_candidates = _find_horizontal_grid_candidates(sub_gray)
    for dy_fit, y_first, y_last in h_candidates:
        v_grid = _find_octave_vertical_lines(sub_gray, xa, y_first, y_last)
        if v_grid is None:
            continue
        x_125, dx_fit, octaves = v_grid

        y_neg10 = _refine_y_neg10(gray, octaves[0], octaves[-1], y_first, dy_fit)
        if y_neg10 is None:
            continue

        cy0 = max(0, int(y_neg10 - 0.5 * dy_fit))
        cy1 = min(height, int(y_neg10 + 13.5 * dy_fit))
        cx0 = max(0, int(x_125 - 0.3 * dx_fit))
        cx1 = min(width, int(octaves[-1] + 0.3 * dx_fit))
        if cy1 <= cy0 or cx1 <= cx0:
            continue

        cr = rgb[cy0:cy1, cx0:cx1, 0].astype(int)
        cg = rgb[cy0:cy1, cx0:cx1, 1].astype(int)
        cb = rgb[cy0:cy1, cx0:cx1, 2].astype(int)

        red_mask = (cr - cg > 40) & (cr - cb > 40) & (cr > 130)
        blue_mask = (cb - cr > 35) & (cb - cg > 8) & (cb > 110)

        _strip_horizontal_reference_lines(red_mask)
        _strip_horizontal_reference_lines(blue_mask)

        red_count = int(red_mask.sum())
        blue_count = int(blue_mask.sum())
        if max(red_count, blue_count) < 50:
            continue

        if red_count > blue_count:
            ear_key = "oido_derecho"
            active_mask = red_mask
        else:
            ear_key = "oido_izquierdo"
            active_mask = blue_mask

        curve_mask = _filter_connected_curve(active_mask, dx_fit)
        if not curve_mask.any():
            continue

        va, max_residual = _sample_chart_thresholds(
            curve_mask=curve_mask,
            cx0=cx0,
            cy0=cy0,
            x_125=x_125,
            dx_fit=dx_fit,
            y_neg10=y_neg10,
            dy_fit=dy_fit,
        )
        if len(va) >= 5:
            return {
                "ear": ear_key,
                "va": va,
                "dy": dy_fit,
                "dx": dx_fit,
                "y0": y_neg10,
                "max_residual": max_residual,
            }

    return None


def extract_audiogram_curves_from_image(image: Image.Image) -> Optional[Dict[str, Any]]:
    """
    Extrae las curvas roja (OD) y azul (OI) desde una imagen de audiograma doble.
    Retorna None si no logra detectar ambos oídos con alta consistencia geométrica.
    """
    rgb = np.array(image.convert("RGB"))
    if rgb.ndim != 3 or rgb.shape[2] < 3:
        return None
    width = rgb.shape[1]
    gray = (
        0.299 * rgb[:, :, 0].astype(float)
        + 0.587 * rgb[:, :, 1].astype(float)
        + 0.114 * rgb[:, :, 2].astype(float)
    )

    left = _analyze_single_chart(rgb, gray, 0, int(width * 0.52))
    right = _analyze_single_chart(rgb, gray, int(width * 0.48), width)
    if left is None or right is None:
        return None

    if left["ear"] == right["ear"]:
        return None

    if (
        abs(left["dy"] - right["dy"]) > 2.0
        or abs(left["dx"] - right["dx"]) > 3.0
        or abs(left["y0"] - right["y0"]) > 4.0
    ):
        return None

    by_ear = {left["ear"]: left, right["ear"]: right}
    od = by_ear.get("oido_derecho")
    oi = by_ear.get("oido_izquierdo")
    if od is None or oi is None:
        return None

    return {
        "oido_derecho": od["va"],
        "oido_izquierdo": oi["va"],
        "meta": {
            "dy": round((od["dy"] + oi["dy"]) / 2.0, 2),
            "dx": round((od["dx"] + oi["dx"]) / 2.0, 2),
            "max_residual_db": round(max(od["max_residual"], oi["max_residual"]), 2),
        },
    }


def extract_audiogram_curves_from_file(file_path: str) -> Optional[Dict[str, Any]]:
    """
    Rasteriza (si es PDF) o abre (si es imagen) el estudio y ejecuta lectura geométrica.
    Nunca lanza excepciones al pipeline principal: ante cualquier falla retorna None.
    """
    if not file_path or not isinstance(file_path, str) or not os.path.isfile(file_path):
        return None

    try:
        if file_path.lower().endswith(".pdf"):
            from pdf2image import convert_from_path

            pages = convert_from_path(
                file_path,
                dpi=AUDIOGRAM_RENDER_DPI,
                first_page=1,
                last_page=1,
            )
            if not pages:
                return None
            return extract_audiogram_curves_from_image(pages[0])

        with Image.open(file_path) as img:
            return extract_audiogram_curves_from_image(img)
    except Exception:
        return None


def _extract_va_dict(ear_val: Any) -> Dict[str, int]:
    if not isinstance(ear_val, dict):
        return {}
    va_raw = ear_val.get("va") if isinstance(ear_val.get("va"), dict) else ear_val
    out: Dict[str, int] = {}
    for k, v in va_raw.items():
        ks = str(k).strip()
        if ks.isdigit() and isinstance(v, (int, float)) and not isinstance(v, bool):
            out[ks] = int(round(v))
    return out


def _notes_text(notas_calidad: Any) -> str:
    if isinstance(notas_calidad, str):
        return notas_calidad
    if isinstance(notas_calidad, list):
        return " ".join(str(item) for item in notas_calidad)
    if isinstance(notas_calidad, dict):
        return str(notas_calidad.get("descripcion") or "")
    return ""


def _append_verification_note(result: Dict[str, Any]) -> None:
    existing = result.get("notas_calidad")
    if isinstance(existing, list):
        if _VERIFICATION_NOTE not in existing:
            existing.append(_VERIFICATION_NOTE)
        return
    if isinstance(existing, dict):
        desc = str(existing.get("descripcion") or "").strip()
        if _VERIFICATION_NOTE not in desc:
            existing["descripcion"] = f"{desc} | {_VERIFICATION_NOTE}" if desc else _VERIFICATION_NOTE
        return
    text = str(existing or "").strip()
    if _VERIFICATION_NOTE not in text:
        result["notas_calidad"] = f"{text} | {_VERIFICATION_NOTE}" if text else _VERIFICATION_NOTE


def merge_audiogram_graph_reading(
    normalized_result: Dict[str, Any],
    graph_reading: Optional[Dict[str, Any]],
) -> Tuple[Dict[str, Any], bool]:
    """
    Fusiona los umbrales verificados geométricamente en el dict normalizado de audiometría
    respetando tablas explícitas de 4 frecuencias y consistencia en el eje Y.
    """
    if not isinstance(normalized_result, dict) or not graph_reading:
        return normalized_result, False

    cv_od = graph_reading.get("oido_derecho")
    cv_oi = graph_reading.get("oido_izquierdo")
    if not isinstance(cv_od, dict) or not isinstance(cv_oi, dict):
        return normalized_result, False

    llm_od = _extract_va_dict(normalized_result.get("oido_derecho"))
    llm_oi = _extract_va_dict(normalized_result.get("oido_izquierdo"))

    # Respetar reportes explícitos de tabla con únicamente 4 frecuencias (500/1000/2000/3000).
    if (
        set(llm_od.keys()) == TABLE_ONLY_QUAD_FREQS
        and set(llm_oi.keys()) == TABLE_ONLY_QUAD_FREQS
        and "tabla" in _notes_text(normalized_result.get("notas_calidad")).lower()
    ):
        return normalized_result, False

    # Seguridad de alineación en eje Y usando frecuencias ancla de octava completa.
    signed_diffs: List[int] = []
    for llm_va, cv_va in ((llm_od, cv_od), (llm_oi, cv_oi)):
        for freq in ANCHOR_OCTAVE_FREQS:
            if freq in llm_va and freq in cv_va:
                signed_diffs.append(int(cv_va[freq]) - int(llm_va[freq]))

    if len(signed_diffs) >= 2:
        sorted_diffs = sorted(signed_diffs)
        median_signed = sorted_diffs[len(sorted_diffs) // 2]
        if abs(median_signed) > 5:
            return normalized_result, False

    cv_od_clean = {str(k): int(v) for k, v in cv_od.items()}
    cv_oi_clean = {str(k): int(v) for k, v in cv_oi.items()}
    changed = (cv_od_clean != llm_od) or (cv_oi_clean != llm_oi)

    for side_key, new_va in (("oido_derecho", cv_od_clean), ("oido_izquierdo", cv_oi_clean)):
        side_obj = normalized_result.get(side_key)
        if not isinstance(side_obj, dict):
            normalized_result[side_key] = {"va": dict(new_va)}
        else:
            side_obj["va"] = dict(new_va)

    all_freqs = sorted(
        set(cv_od_clean.keys()) | set(cv_oi_clean.keys()),
        key=lambda f: int(f),
    )
    normalized_result["frecuencias_detectadas"] = all_freqs

    freqs_per_ear = max(len(cv_od_clean), len(cv_oi_clean))
    if freqs_per_ear >= 6:
        normalized_result["completitud_documental"] = "suficiente"
    elif freqs_per_ear >= 3:
        normalized_result["completitud_documental"] = "parcial"
    else:
        normalized_result["completitud_documental"] = "no_concluyente"

    _append_verification_note(normalized_result)
    return normalized_result, changed
