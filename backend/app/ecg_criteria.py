"""
Motor determinista de criterios electrocardiográficos para enriquecer el prediagnóstico IA.

Evalúa parámetros estándar de ECG de 12 derivaciones (frecuencia, ritmo, onda P, PR, QRS,
eje eléctrico, QT/QTc con fórmula de Bazett, segmento ST, onda T, ondas Q y cobertura técnica
de tiras térmicas pegadas en hoja carta cuando `origen_mediciones == "cuadricula_visual"`).
"""

from __future__ import annotations

import copy
import math
import re
from typing import Any, Dict, List, Mapping, Optional


_ALL_12_LEADS = ("I", "II", "III", "aVR", "aVL", "aVF", "V1", "V2", "V3", "V4", "V5", "V6")
_LEAD_LOOKUP = {lead.upper(): lead for lead in _ALL_12_LEADS}

_ST_ABNORMAL_RE = re.compile(
    r"elevaci[oó]n|supradesnivel|infradesnivel|depresi[oó]n|descenso|lesi[oó]n|corriente|desnivel",
    re.IGNORECASE,
)
_ST_NORMAL_RE = re.compile(r"isoel[eé]ctrico|sin\s+alteraciones|normal", re.IGNORECASE)

_T_ABNORMAL_RE = re.compile(
    r"invertid|negativ.*fuera|negativ.*(v[2-6]|d1|d2|avl|avf)|picud|aplanad|bif[aá]sic|isquemi|alterad",
    re.IGNORECASE,
)
_Q_PRESENT_RE = re.compile(r"presencia|patol[oó]gica\s+en|compatible\s+con\s+necrosis|ondas?\s+q\s+patol[oó]gicas?\s+(presente|en)", re.IGNORECASE)
_Q_ABSENT_RE = re.compile(r"\bno\s+presencia|\bsin\s+ondas?\s+q|\bausente|\bno\s+se\s+observa|\bno\b", re.IGNORECASE)


def _to_int(value: Any, *, allow_negative: bool = False) -> Optional[int]:
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        if not math.isfinite(value):
            return None
        num = int(round(float(value)))
        return num if (allow_negative or num > 0) else None
    if isinstance(value, str):
        match = re.search(r"[-+]?\d+(?:[.,]\d+)?", value.strip())
        if not match:
            return None
        try:
            parsed = float(match.group(0).replace(",", "."))
            if not math.isfinite(parsed):
                return None
            num = int(round(parsed))
            return num if (allow_negative or num > 0) else None
        except ValueError:
            return None
    return None


def _classify_hr(bpm: Optional[int]) -> Optional[str]:
    if bpm is None:
        return None
    if bpm < 50:
        return "BRADICARDIA_MARCADA"
    if bpm < 60:
        return "BRADICARDIA_LEVE"
    if bpm <= 100:
        return "NORMAL"
    if bpm <= 120:
        return "TAQUICARDIA_LEVE"
    return "TAQUICARDIA_SIGNIFICATIVA"


def _classify_p(p_ms: Optional[int]) -> Optional[str]:
    if p_ms is None:
        return None
    return "NORMAL" if p_ms < 120 else "PROLONGADA"


def _classify_pr(pr_ms: Optional[int]) -> Optional[str]:
    if pr_ms is None:
        return None
    if pr_ms < 120:
        return "CORTO_DESCARTAR_PREEXCITACION"
    if pr_ms <= 200:
        return "NORMAL"
    return "PROLONGADO_SUGESTIVO_BAV_PRIMER_GRADO"


def _classify_qrs(qrs_ms: Optional[int]) -> Optional[str]:
    if qrs_ms is None:
        return None
    if qrs_ms < 100:
        return "NORMAL"
    if qrs_ms < 120:
        return "LIMITROFE_ESTUDIO_CONDUCCION"
    return "ANCHO_TRASTORNO_CONDUCCION_INTRAVENTRICULAR"


def _classify_axis(eje_grados: Optional[int], eje_texto: Optional[str]) -> Optional[str]:
    if eje_grados is not None:
        if -30 <= eje_grados <= 90:
            return "NORMAL"
        if -90 <= eje_grados < -30:
            return "DESVIACION_IZQUIERDA"
        if 90 < eje_grados <= 180:
            return "DESVIACION_DERECHA"
        return "EXTREMO_O_INDETERMINADO"
    if isinstance(eje_texto, str) and eje_texto.strip():
        lowered = eje_texto.strip().lower()
        if "izquierd" in lowered:
            return "DESVIACION_IZQUIERDA"
        if "derech" in lowered:
            return "DESVIACION_DERECHA"
        if "normal" in lowered or "intermedio" in lowered:
            return "NORMAL"
        if "extremo" in lowered or "indeterminado" in lowered:
            return "EXTREMO_O_INDETERMINADO"
    return None


def _classify_qtc(qtc_ms: Optional[int]) -> Optional[str]:
    if qtc_ms is None:
        return None
    if qtc_ms <= 450:
        return "NORMAL"
    if qtc_ms <= 470:
        return "LIMITROFE"
    if qtc_ms < 500:
        return "PROLONGADO"
    return "CRITICO_RIESGO_ARRITMICO"


def _evaluate_st(st_text: Optional[str]) -> Optional[str]:
    if not isinstance(st_text, str) or not st_text.strip():
        return None
    t = st_text.strip()
    if _ST_ABNORMAL_RE.search(t) and "sin alteraciones" not in t.lower():
        return "ALTERADO"
    if _ST_NORMAL_RE.search(t):
        return "NORMAL"
    return "INDETERMINADO"


def _evaluate_t_wave(t_text: Optional[str]) -> Optional[str]:
    if not isinstance(t_text, str) or not t_text.strip():
        return None
    t = t_text.strip()
    if _T_ABNORMAL_RE.search(t) and "sin alteraciones" not in t.lower():
        return "ALTERADA"
    if "positiv" in t.lower() or "normal" in t.lower() or "concordant" in t.lower():
        return "NORMAL"
    return "INDETERMINADO"


def _evaluate_q_wave(q_text: Optional[str]) -> Optional[str]:
    if not isinstance(q_text, str) or not q_text.strip():
        return None
    t = q_text.strip()
    if _Q_ABSENT_RE.search(t):
        return "AUSENTE"
    if _Q_PRESENT_RE.search(t):
        return "PRESENTE"
    return "INDETERMINADO"


def _normalize_visible_leads(raw: Any) -> List[str]:
    if isinstance(raw, str):
        candidates = [x.strip() for x in re.split(r"[,;/\s]+", raw) if x.strip()]
    elif isinstance(raw, (list, tuple)):
        candidates = [str(x).strip() for x in raw if x is not None and str(x).strip()]
    else:
        return []
    out: List[str] = []
    seen = set()
    for c in candidates:
        canonical = _LEAD_LOOKUP.get(c.upper(), c)
        key = canonical.upper()
        if key not in seen:
            seen.add(key)
            out.append(canonical)
    return out


def compute_ecg_clinical_criteria(data: Mapping[str, Any]) -> Dict[str, Any]:
    """Calcula clasificación determinista multi-dominio y alertas eléctricas de un ECG."""
    fc = _to_int(data.get("frecuencia_bpm"), allow_negative=False)
    p_ms = _to_int(data.get("duracion_p_ms"), allow_negative=False)
    pr_ms = _to_int(data.get("intervalo_pr_ms"), allow_negative=False)
    qrs_ms = _to_int(data.get("duracion_qrs_ms"), allow_negative=False)
    qt_ms = _to_int(data.get("qt_ms"), allow_negative=False)
    qtc_extracted = _to_int(data.get("qtc_ms"), allow_negative=False)
    eje_texto = str(data.get("eje_electrico")).strip() if isinstance(data.get("eje_electrico"), str) and str(data.get("eje_electrico")).strip() else None
    eje_grados = _to_int(data.get("eje_grados"), allow_negative=True)
    if eje_grados is None and eje_texto:
        eje_grados = _to_int(eje_texto, allow_negative=True)

    qtc_bazett_ms: Optional[int] = None
    if qt_ms and fc and fc > 0:
        rr_sec = 60.0 / float(fc)
        if rr_sec > 0:
            qtc_bazett_ms = int(round(float(qt_ms) / math.sqrt(rr_sec)))

    qtc_efectivo = qtc_extracted or qtc_bazett_ms

    clasif_fc = _classify_hr(fc)
    clasif_p = _classify_p(p_ms)
    clasif_pr = _classify_pr(pr_ms)
    clasif_qrs = _classify_qrs(qrs_ms)
    clasif_eje = _classify_axis(eje_grados, eje_texto)
    clasif_qtc = _classify_qtc(qtc_efectivo)

    estado_st = _evaluate_st(data.get("segmento_st") if isinstance(data.get("segmento_st"), str) else None)
    estado_t = _evaluate_t_wave(data.get("onda_t") if isinstance(data.get("onda_t"), str) else None)
    estado_q = _evaluate_q_wave(data.get("onda_q_patologica") if isinstance(data.get("onda_q_patologica"), str) else None)

    derivaciones = _normalize_visible_leads(data.get("derivaciones_visibles"))
    origen_raw = str(data.get("origen_mediciones") or "").strip().lower()
    if not origen_raw:
        origen_mediciones = "cuadricula_visual" if (fc is not None or pr_ms is not None or qrs_ms is not None) else "desconocido"
    else:
        origen_mediciones = origen_raw

    requiere_verificacion_cuadricula = origen_mediciones in {"cuadricula_visual", "mixto"}

    alertas: List[str] = []
    if clasif_fc == "BRADICARDIA_MARCADA":
        alertas.append(f"Bradicardia marcada ({fc} lpm): descartar disfunción sinusal o bloqueo AV.")
    elif clasif_fc == "TAQUICARDIA_SIGNIFICATIVA":
        alertas.append(f"Taquicardia significativa ({fc} lpm): evaluar causa secundaria o taquiarritmia.")

    if clasif_pr == "CORTO_DESCARTAR_PREEXCITACION":
        alertas.append(f"Intervalo PR corto ({pr_ms} ms): valorar vía accesoria / preexcitación.")
    elif clasif_pr == "PROLONGADO_SUGESTIVO_BAV_PRIMER_GRADO":
        alertas.append(f"Intervalo PR prolongado ({pr_ms} ms): sugestivo de bloqueo AV de 1er grado.")

    if clasif_qrs == "ANCHO_TRASTORNO_CONDUCCION_INTRAVENTRICULAR":
        alertas.append(f"QRS ancho ({qrs_ms} ms): valorar bloqueo de rama o trastorno de conducción intraventricular.")

    if clasif_qtc == "CRITICO_RIESGO_ARRITMICO":
        alertas.append(f"QTc críticamente prolongado ({qtc_efectivo} ms >= 500 ms): alto riesgo arrítmico, requiere valoración prioritaria.")
    elif clasif_qtc in {"PROLONGADO", "LIMITROFE"}:
        alertas.append(f"QTc {clasif_qtc.lower()} ({qtc_efectivo} ms): verificar fórmula, fármacos que prolongan QT y electrólitos.")

    if estado_st == "ALTERADO":
        alertas.append("Alteración del segmento ST reportada: requiere correlación clínica y descarte de isquemia.")
    if estado_t == "ALTERADA":
        alertas.append("Alteración de onda T fuera de patrón fisiológico: requiere correlación clínica.")
    if estado_q == "PRESENTE":
        alertas.append("Posible onda Q patológica: valorar antecedente isquémico o cicatriz miocárdica.")

    consideraciones_ocupacionales: List[str] = []
    if alertas:
        consideraciones_ocupacionales.append(
            "Alteraciones eléctricas o de conducción requieren validación médica directa antes de asignar puestos críticos (trabajos en altura, conducción o esfuerzo físico intenso)."
        )
    else:
        consideraciones_ocupacionales.append(
            "Sin hallazgos eléctricos críticos en parámetros extraídos; la aptitud laboral depende del criterio médico y exploración clínica integral."
        )

    return {
        "parametros_medidos": {
            "frecuencia_bpm": fc,
            "duracion_p_ms": p_ms,
            "intervalo_pr_ms": pr_ms,
            "duracion_qrs_ms": qrs_ms,
            "qt_ms": qt_ms,
            "qtc_ms_reportado": qtc_extracted,
            "qtc_ms_bazett_calculado": qtc_bazett_ms,
            "qtc_ms_efectivo": qtc_efectivo,
            "eje_grados": eje_grados,
            "eje_texto": eje_texto,
        },
        "clasificacion_dominios": {
            "frecuencia_cardiaca": clasif_fc,
            "onda_p": clasif_p,
            "intervalo_pr": clasif_pr,
            "complejo_qrs": clasif_qrs,
            "eje_electrico": clasif_eje,
            "repolarizacion_qtc": clasif_qtc,
            "segmento_st": estado_st,
            "onda_t": estado_t,
            "onda_q_patologica": estado_q,
        },
        "calidad_y_fuente": {
            "origen_mediciones": origen_mediciones,
            "requiere_verificacion_mediciones_cuadricula": requiere_verificacion_cuadricula,
            "derivaciones_visibles_count": len(derivaciones),
            "derivaciones_visibles": derivaciones,
            "calibracion_papel": data.get("calibracion_papel"),
        },
        "alertas_electricas": alertas,
        "consideraciones_ocupacionales": consideraciones_ocupacionales,
        "referencia_rangos_aha": {
            "fc_normal_lpm": "60-100",
            "onda_p_ms": "< 120",
            "pr_normal_ms": "120-200",
            "qrs_normal_ms": "< 100 (limitrofe 100-119)",
            "eje_normal_grados": "-30 a +90",
            "qtc_normal_ms": "<= 450 (H) / <= 460 (M); >= 500 critico",
        },
    }


def enrich_ecg_extracted_data(extracted_data: Mapping[str, Any]) -> Dict[str, Any]:
    """Devuelve copia enriquecida con `interpretacion_derivada_ecg` sin mutar el input."""
    enriched = copy.deepcopy(dict(extracted_data))
    enriched["interpretacion_derivada_ecg"] = compute_ecg_clinical_criteria(enriched)
    return enriched
