"""
IMPL-20260701-04: Orquestador de generacion de reportes masivos (Fase 4 EBOOK).
IMPL-20260630-03: Orquestador original.
ARCH-20260623-01: Modulo de Reportes Masivos.

Lee los datos reales del proyecto desde Prisma (worker, exam, verdict,
extractionSnapshots, aiPrediagnoses, doctorReviews, labs), genera XLSX y/o
EBOOK (Diagnóstico Situacional + expedientes individuales imprimibles y
navegables), los guarda en uploads/reports/{projectId}/{reportId}/ (+ S3
best-effort) y actualiza ProjectReport.
"""
from __future__ import annotations

import inspect
import logging
import os
import re
import unicodedata
from datetime import date, datetime
from typing import Any, Dict, List, Optional

from app.services.storage import image_fetcher

logger = logging.getLogger(__name__)


UPLOAD_DIR = os.getenv("UPLOAD_DIR") or "/uploads"
REPORTS_SUBDIR = "reports"

ALLOWED_FORMATS = {"XLSX", "EBOOK", "BOTH", "PDF"}


def _upload_dir() -> str:
    """Lee UPLOAD_DIR del env en cada llamada (permite tests con monkeypatch)."""
    return os.getenv("UPLOAD_DIR") or "/uploads"


def reports_dir() -> str:
    """Directorio base para reportes: {UPLOAD_DIR}/reports/."""
    base = os.path.join(_upload_dir(), REPORTS_SUBDIR)
    os.makedirs(base, exist_ok=True)
    return base


def report_storage_dir(project_id: str, report_id: str) -> str:
    """Directorio del reporte: uploads/reports/{projectId}/{reportId}/."""
    d = os.path.join(_upload_dir(), REPORTS_SUBDIR, project_id, report_id)
    os.makedirs(d, exist_ok=True)
    try:
        os.chmod(d, 0o755)
    except OSError:
        pass
    return d


def relative_path(project_id: str, report_id: str, filename: str) -> str:
    """Path relativo para guardar en DB: reports/{projectId}/{reportId}/{filename}."""
    return f"{REPORTS_SUBDIR}/{project_id}/{report_id}/{filename}"


# ---------------------------------------------------------------------------
# Helpers seguros para leer modelos Prisma, dicts JSON y MagicMocks en tests
# ---------------------------------------------------------------------------

def _is_mock(v: Any) -> bool:
    return type(v).__module__.startswith("unittest.mock")


def _as_dict(v: Any) -> Dict[str, Any]:
    return v if isinstance(v, dict) else {}


def _as_list(v: Any) -> List[Any]:
    return v if isinstance(v, list) else []


def _attr(obj: Any, name: str, default: Any = None) -> Any:
    if obj is None:
        return default
    if isinstance(obj, dict):
        return obj.get(name, default)
    # En MagicMock sin el atributo configurado, getattr crea otro MagicMock;
    # solo devolvemos valores explícitos si no son mocks o si están configurados
    # en __dict__.
    if _is_mock(obj):
        if name in getattr(obj, "__dict__", {}):
            val = getattr(obj, name)
            return default if val is None else val
        return default
    val = getattr(obj, name, default)
    return default if val is None else val


def _val(obj: Any, *keys: str, default: Any = None) -> Any:
    if obj is None:
        return default
    for k in keys:
        v = _attr(obj, k, None)
        if v is not None and not _is_mock(v):
            if isinstance(v, str) and not v.strip():
                continue
            return v
    return default


def _str_val(obj: Any, *keys: str, default: str = "") -> str:
    v = _val(obj, *keys, default=None)
    if v is None or _is_mock(v):
        return default
    if isinstance(v, (dict, list)):
        return default
    return str(v).strip()


def _num_val(obj: Any, *keys: str) -> Optional[float]:
    v = _val(obj, *keys, default=None)
    if v is None or _is_mock(v) or isinstance(v, bool):
        return None
    if isinstance(v, (int, float)):
        return float(v)
    if isinstance(v, str):
        m = re.search(r"-?\d+(?:\.\d+)?", v.replace(",", "."))
        if m:
            try:
                return float(m.group(0))
            except ValueError:
                return None
    return None


def _norm_text(s: str) -> str:
    if not s:
        return ""
    return (
        unicodedata.normalize("NFD", s)
        .encode("ascii", "ignore")
        .decode("ascii")
        .lower()
        .strip()
    )


def _clean_clinical_text(val: str) -> str:
    if not val:
        return ""
    cleaned = re.sub(
        r"^\s*IA\s+generada\s*\([^)]*\)\s*:\s*",
        "",
        val,
        flags=re.IGNORECASE,
    ).strip()
    return cleaned


def _calc_age(dob: Any) -> Optional[int]:
    if dob is None or _is_mock(dob):
        return None
    if isinstance(dob, datetime):
        born = dob.date()
    elif isinstance(dob, date):
        born = dob
    elif isinstance(dob, str) and len(dob) >= 10:
        try:
            born = date.fromisoformat(dob[:10])
        except ValueError:
            return None
    else:
        return None
    today = date.today()
    age = today.year - born.year - ((today.month, today.day) < (born.month, born.day))
    return age if 14 <= age <= 100 else None


def _resolve_worker_sex(worker: Any, phys: Dict[str, Any], ch_data: Dict[str, Any]) -> str:
    m1 = _as_dict(phys.get("modulo1"))
    ant = _as_dict(phys.get("antecedentes_captured"))
    dp = _as_dict(phys.get("datos_personales")) or _as_dict(ant.get("datos_personales")) or _as_dict(ch_data.get("datos_personales"))
    ch_m1 = _as_dict(ch_data.get("modulo1"))

    raw = (
        _str_val(phys, "sexo", "genero")
        or _str_val(m1, "m1_sexo")
        or _str_val(dp, "sexo", "genero")
        or _str_val(ch_m1, "m1_sexo")
        or _str_val(worker, "sexo", "gender")
    )

    if not raw:
        uid = _str_val(worker, "universalId")
        parts = uid.split("-") if uid else []
        if len(parts) >= 3:
            g = parts[2].strip().upper()
            if g in ("M", "H"):
                raw = "MASCULINO"
            elif g == "F":
                raw = "FEMENINO"

    if not raw:
        nat = _str_val(worker, "nationalId")
        if len(nat) >= 11:
            ch = nat[10].upper()
            if ch == "H":
                raw = "MASCULINO"
            elif ch == "M":
                raw = "FEMENINO"

    up = raw.strip().upper()
    if up in ("M", "H") or up.startswith("MASC") or up == "HOMBRE":
        return "MASCULINO"
    if up == "F" or up.startswith("FEM") or up == "MUJER":
        return "FEMENINO"
    return up


def _resolve_worker_area_and_antiguedad(worker: Any, phys: Dict[str, Any], ch_data: Dict[str, Any]) -> tuple[str, str]:
    ant = _as_dict(phys.get("antecedentes_captured"))
    dp = _as_dict(phys.get("datos_personales")) or _as_dict(ant.get("datos_personales")) or _as_dict(ch_data.get("datos_personales"))
    hl = _as_dict(ant.get("historia_laboral")) or _as_dict(ch_data.get("historia_laboral"))
    jp = _attr(worker, "jobPosition", None)

    area = (
        _str_val(dp, "area_departamento", "area", "puesto_actual", "puesto", "puesto_trabajo")
        or _str_val(phys, "area_departamento", "area", "puesto_actual", "puesto")
        or _str_val(jp, "name")
        or _str_val(worker, "area", "puesto")
    )
    antiguedad = (
        _str_val(dp, "antiguedad")
        or _str_val(hl, "antiguedad")
        or _str_val(phys, "antiguedad")
        or _str_val(worker, "antiguedad")
    )
    return area, antiguedad


# ---------------------------------------------------------------------------
# Adaptadores EventTest / ExtractionSnapshot / DoctorReview / MedicalExam -> dicts
# ---------------------------------------------------------------------------

def _pick_latest_snapshot(et: Any) -> Optional[Any]:
    snaps = _as_list(_attr(et, "extractionSnapshots", None))
    if not snaps:
        return None
    active = [s for s in snaps if not _attr(s, "isSuperseded", False)]
    pool = active or snaps
    pool_sorted = sorted(pool, key=lambda s: _attr(s, "version", 0) or 0, reverse=True)
    return pool_sorted[0]


def _pick_latest_pred_and_review(snap: Any) -> tuple[Optional[Any], Optional[Any]]:
    if snap is None:
        return None, None
    preds = _as_list(_attr(snap, "aiPrediagnoses", None))
    if not preds:
        return None, None
    active = [p for p in preds if not _attr(p, "isSuperseded", False)]
    pool = active or preds
    pred = sorted(pool, key=lambda p: _attr(p, "version", 0) or 0, reverse=True)[0]
    reviews = _as_list(_attr(pred, "doctorReviews", None))
    rev = reviews[-1] if reviews else None
    return pred, rev


def _first_extracted(et: Any) -> tuple[Dict[str, Any], Dict[str, Any], Optional[Any], Optional[Any], Optional[str]]:
    """
    Extrae (extracted_data, prediagnosis_data, latest_review, source_file_url, study_type)
    combinando formato legacy (`extractedData`) y arquitectura actual (`extractionSnapshots`).
    """
    legacy_ed = _attr(et, "extractedData", None)
    snap = _pick_latest_snapshot(et)
    if snap is not None:
        sd = _as_dict(_attr(snap, "structuredData", None))
        ed = _as_dict(sd.get("extracted_data")) or sd
        if not ed and isinstance(legacy_ed, dict):
            ed = legacy_ed
        pred, rev = _pick_latest_pred_and_review(snap)
        pred_data = _as_dict(_attr(pred, "prediagnosisData", None))
        src_url = _str_val(snap, "sourceFileUrl") or _str_val(et, "fileUrl") or None
        stype = _str_val(snap, "studyType") or _str_val(sd, "study_type") or None
        return ed, pred_data, rev, src_url, stype

    ed = legacy_ed if isinstance(legacy_ed, dict) else {}
    return ed, {}, None, _str_val(et, "fileUrl") or None, None


def _validated_pdf(rev: Any, validated_pdf_by_review: Dict[str, str]) -> Optional[str]:
    if rev is None:
        return None
    direct = _str_val(rev, "validatedPdfUrl")
    if direct:
        return direct
    rid = _str_val(rev, "id")
    if rid and rid in validated_pdf_by_review:
        return validated_pdf_by_review[rid]
    return None


def _estimate_hbc_from_ptas(pta_od: Optional[float], pta_oi: Optional[float]) -> Optional[float]:
    """Estimación AMA / LFT simplificada cuando no viene precalculada."""
    if pta_od is None or pta_oi is None:
        return None
    mi_od = max(0.0, (pta_od - 25.0) * 1.5)
    mi_oi = max(0.0, (pta_oi - 25.0) * 1.5)
    better, worse = (mi_od, mi_oi) if mi_od <= mi_oi else (mi_oi, mi_od)
    return round((5.0 * better + worse) / 6.0, 2)


def _audiometria(et: Any, validated_map: Dict[str, str]) -> Dict[str, Any]:
    ed, pred, rev, src_url, _ = _first_extracted(et)
    od = _as_dict(ed.get("oido_derecho"))
    oi = _as_dict(ed.get("oido_izquierdo"))
    res_oido = _as_dict(pred.get("resumen_por_oido"))
    res_bil = _as_dict(pred.get("resumen_bilateral"))
    perdida = _as_dict(ed.get("porcentaje_perdida_por_oido"))

    pta_od = _num_val(od, "pta", "pta_visible")
    pta_oi = _num_val(oi, "pta", "pta_visible")

    dx = _clean_clinical_text(
        _str_val(rev, "doctorDiagnosis")
        or _str_val(ed, "dx", "diagnostico")
        or _str_val(res_bil, "clasificacion", "diagnostico")
        or _str_val(pred, "summary")
        or _str_val(et, "resultNotes")
        or ""
    ) or "N/A"
    od_dx = (
        _str_val(ed, "oido_derecho_dx")
        or _str_val(res_oido, "od", "oido_derecho")
        or _str_val(od, "umbral", "diagnostico")
        or (f"PTA {pta_od:.1f} dB" if pta_od is not None else "N/A")
    )
    oi_dx = (
        _str_val(ed, "oido_izquierdo_dx")
        or _str_val(res_oido, "oi", "oido_izquierdo")
        or _str_val(oi, "umbral", "diagnostico")
        or (f"PTA {pta_oi:.1f} dB" if pta_oi is not None else "N/A")
    )
    hbc = _num_val(ed, "hbc_porcentaje", "hbc")
    if hbc is None:
        hbc = _num_val(res_bil, "hbc_porcentaje", "hbc")
    if hbc is None:
        p_od = _num_val(perdida, "od")
        p_oi = _num_val(perdida, "oi")
        if p_od is not None and p_oi is not None:
            better, worse = (p_od, p_oi) if p_od <= p_oi else (p_oi, p_od)
            hbc = round((7.0 * better + worse) / 8.0, 2)
    if hbc is None:
        hbc = _estimate_hbc_from_ptas(pta_od, pta_oi)
    return {
        "dx": dx,
        "oidoDerecho": od_dx,
        "oidoIzquierdo": oi_dx,
        "hbc": hbc,
        "fileUrl": src_url,
        "validatedPdfUrl": _validated_pdf(rev, validated_map),
    }


def _espirometria(et: Any, validated_map: Dict[str, str], default_tabaquismo: str = "N/A") -> Dict[str, Any]:
    ed, pred, rev, src_url, _ = _first_extracted(et)
    cal = _as_dict(ed.get("calidad"))
    pac = _as_dict(ed.get("paciente_detalle"))
    fvc_l = _num_val(ed, "fvc")
    fvc_pct = _num_val(ed, "fvc_percent_predicho")
    fev1_pct = _num_val(ed, "fev1_percent_predicho")
    ratio = _num_val(ed, "fev1_fvc_ratio")

    patron = _clean_clinical_text(
        _str_val(rev, "doctorDiagnosis")
        or _str_val(ed, "patron", "interpretacion")
        or _str_val(cal, "impresion_diagnostica_texto", "impresion_diagnostica")
        or _str_val(pred, "summary")
        or _str_val(et, "resultNotes")
    )
    if not patron and ratio is not None and (fvc_pct is not None or fvc_l is not None):
        ratio_pct = ratio * 100.0 if ratio <= 1.5 else ratio
        if ratio_pct < 70:
            patron = "PATRÓN ESPIROMÉTRICO OBSTRUCTIVO"
        elif (fvc_pct is not None and fvc_pct < 80) or (fev1_pct is not None and fev1_pct < 80):
            patron = "PATRÓN ESPIROMÉTRICO RESTRICTIVO"
        else:
            patron = "NORMAL"

    if fvc_l is not None and fvc_pct is not None and fvc_l <= 15.0 and fvc_pct > 15.0:
        fvc_val: Any = f"{fvc_l:.2f} L ({int(round(fvc_pct))}%)"
    elif fvc_l is not None:
        fvc_val = fvc_l
    else:
        fvc_val = fvc_pct

    return {
        "patron": patron or "N/A",
        "fvc": fvc_val,
        "tabaquismo": _str_val(ed, "tabaquismo") or _str_val(pac, "fuma") or default_tabaquismo,
        "fileUrl": src_url,
        "validatedPdfUrl": _validated_pdf(rev, validated_map),
    }


def _rx_columna(et: Any, validated_map: Dict[str, str]) -> Dict[str, Any]:
    ed, pred, rev, src_url, _ = _first_extracted(et)
    hallazgos = _as_list(ed.get("hallazgos"))
    hallazgos_txt = "; ".join(str(h) for h in hallazgos if h).strip()
    impresion = _clean_clinical_text(
        _str_val(rev, "doctorDiagnosis")
        or _str_val(ed, "impresion_diagnostica", "impresion")
        or hallazgos_txt
        or _str_val(pred, "summary")
        or _str_val(et, "resultNotes")
        or ""
    ) or "N/A"
    return {
        "escoliosis": _num_val(ed, "escoliosis_grados", "escoliosis"),
        "lordosis": _num_val(ed, "lordosis_grados", "lordosis"),
        "basculacion": _num_val(ed, "basculacion_pelvica_cm", "basculacion"),
        "valoracionPostural": _str_val(ed, "valoracion_postural", "postura") or "N/A",
        "impresion": impresion,
        "fileUrl": src_url,
        "fileUrlAP": _str_val(ed, "fileUrlAP") or src_url,
        "fileUrlLateral": _str_val(ed, "fileUrlLateral") or None,
        "validatedPdfUrl": _validated_pdf(rev, validated_map),
    }


def _rx_torax(et: Any, validated_map: Dict[str, str]) -> Dict[str, Any]:
    ed, pred, rev, src_url, _ = _first_extracted(et)
    hallazgos = _as_list(ed.get("hallazgos"))
    hallazgos_txt = "; ".join(str(h) for h in hallazgos if h).strip()
    impresion = _clean_clinical_text(
        _str_val(rev, "doctorDiagnosis")
        or _str_val(ed, "impresion_diagnostica", "impresion")
        or hallazgos_txt
        or _str_val(pred, "summary")
        or _str_val(et, "resultNotes")
        or ""
    ) or "N/A"
    return {
        "impresion": impresion,
        "fileUrl": src_url,
        "validatedPdfUrl": _validated_pdf(rev, validated_map),
    }


def _ecg(et: Any, validated_map: Dict[str, str]) -> Dict[str, Any]:
    ed, pred, rev, src_url, _ = _first_extracted(et)
    hallazgos = _as_list(ed.get("hallazgos"))
    hallazgos_txt = "; ".join(str(h) for h in hallazgos if h).strip()
    impresion = _clean_clinical_text(
        _str_val(rev, "doctorDiagnosis")
        or _str_val(ed, "impresion_diagnostica", "impresion", "interpretacion", "diagnostico")
        or hallazgos_txt
        or _str_val(pred, "summary")
        or _str_val(et, "resultNotes")
        or ""
    ) or "N/A"
    return {
        "impresion": impresion,
        "fileUrl": src_url,
        "validatedPdfUrl": _validated_pdf(rev, validated_map),
    }


def _campimetria(
    et: Any,
    validated_map: Dict[str, str],
    eye_acuity: Optional[Dict[str, Any]] = None,
    phys: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    ed, pred, rev, src_url, _ = _first_extracted(et)
    eye = _as_dict(eye_acuity)
    phys_d = _as_dict(phys)
    ag_res = _as_dict(ed.get("agudeza_resumen"))

    vl_od = _str_val(ed, "vision_lejana_od") or _str_val(eye, "vision_lejana_od")
    vl_oi = _str_val(ed, "vision_lejana_oi") or _str_val(eye, "vision_lejana_oi")
    vlc_od = _str_val(ed, "lejana_corregida_od") or _str_val(eye, "lejana_corregida_od")
    vlc_oi = _str_val(ed, "lejana_corregida_oi") or _str_val(eye, "lejana_corregida_oi")

    raw_ag = (
        _str_val(ed, "agudeza_visual", "agudezaVisual", "agudeza_resumen")
        or _str_val(ag_res, "resumen", "diagnostico")
        or _str_val(phys_d, "agudeza_visual_resumen")
    )
    if raw_ag.upper() in ("", "N/A", "NA", "PENDIENTE", "POR DEFINIR", "SIN DATO"):
        raw_ag = ""

    ag_av = raw_ag
    if not ag_av and (vl_od or vl_oi):
        ag_av = f"VL {vl_od or '—'} OD / {vl_oi or '—'} OI"
        if vlc_od or vlc_oi:
            ag_av += f" (Corregida {vlc_od or '—'} / {vlc_oi or '—'})"
    if not ag_av:
        ag_av = _str_val(ed, "agudeza_resumen") or "N/A"

    campos = _str_val(ed, "campos_visuales", "camposVisuales") or _str_val(eye, "campimetria")
    if not campos:
        c_od = _str_val(ed, "confrontacion_od")
        c_oi = _str_val(ed, "confrontacion_oi")
        if c_od or c_oi:
            campos = f"OD: {c_od or 'N/A'} / OI: {c_oi or 'N/A'}"

    color = (
        _str_val(ed, "discriminacion_color", "discriminacionColor", "ishihara_resultado")
        or _str_val(eye, "test_ishihara")
    )

    return {
        "agudezaVisual": ag_av or "N/A",
        "camposVisuales": campos or "N/A",
        "discriminacionColor": color or "N/A",
        "fileUrl": src_url,
        "validatedPdfUrl": _validated_pdf(rev, validated_map),
    }


def _laboratorio(et: Any, validated_map: Dict[str, str], worker_edad: Optional[int] = None) -> Dict[str, Any]:
    ed, pred, rev, src_url, _ = _first_extracted(et)
    edad_str = _str_val(ed, "edad") or (f"{worker_edad} A" if worker_edad is not None else "")
    return {
        "folioLab": _str_val(ed, "folio_lab", "folioLab"),
        "edad": edad_str,
        "bh": {
            "hb": _val(ed, "bh_hb"),
            "mchb": _val(ed, "bh_mchb"),
            "chgm": _val(ed, "bh_chgm"),
            "leu": _val(ed, "bh_leu"),
            "pla": _val(ed, "bh_pla"),
        },
        "qs6": {
            "gluc": _val(ed, "qs_glucosa"),
            "bun": _val(ed, "qs_bun"),
            "urea": _val(ed, "qs_urea"),
            "creat": _val(ed, "qs_creatinina"),
            "au": _val(ed, "qs_acido_urico"),
            "col": _val(ed, "qs_colesterol"),
            "trig": _val(ed, "qs_trigliceridos"),
        },
        "ego": {
            "glc": _val(ed, "ego_glucosa"),
            "prot": _val(ed, "ego_proteinas"),
            "blo": _val(ed, "ego_sangre"),
            "bac": _str_val(ed, "ego_bacterias") or "N/A",
            "cristales": _str_val(ed, "ego_cristales") or "N/A",
            "descripcion": _str_val(ed, "ego_descripcion", "resultado"),
        },
        "toxico": {
            "anfeta": _str_val(ed, "tox_anfetaminas") or "N/A",
            "coca": _str_val(ed, "tox_cocaina") or "N/A",
            "marihua": _str_val(ed, "tox_marihuana") or "N/A",
            "opiac": _str_val(ed, "tox_opiaceos") or "N/A",
            "metanf": _str_val(ed, "tox_metanfetaminas") or "N/A",
        },
        "fileUrl": src_url,
        "validatedPdfUrl": _validated_pdf(rev, validated_map),
    }


def _merge_study_dict(existing: Dict[str, Any], incoming: Dict[str, Any]) -> Dict[str, Any]:
    """Combina datos de múltiples EventTests del mismo tipo (ej. RX Columna + Torax)."""
    merged = dict(existing)
    for k, v in incoming.items():
        if v is None:
            continue
        if isinstance(v, dict):
            prev_sub = merged.get(k) if isinstance(merged.get(k), dict) else {}
            merged[k] = _merge_study_dict(prev_sub, v)
        elif isinstance(v, str):
            cur = merged.get(k)
            if (not cur or str(cur).strip().upper() in ("", "N/A", "NA")) and v.strip().upper() not in ("", "N/A", "NA"):
                merged[k] = v
        elif merged.get(k) is None:
            merged[k] = v
    return merged


def _build_examen_medico(event: Any, rev: Any = None, validated_map: Optional[Dict[str, str]] = None, src_url: Optional[str] = None) -> Dict[str, Any]:
    exam = _attr(event, "exam", None)
    verdict = _attr(event, "verdict", None)

    soma = _as_dict(_attr(exam, "somatometryData", None))
    vit = _as_dict(_attr(exam, "vitalSignsData", None))
    phys = _as_dict(_attr(exam, "physicalExamData", None))
    eye = _as_dict(_attr(exam, "eyeAcuityData", None))

    peso = _num_val(soma, "peso_kg", "peso") or _num_val(exam, "weight")
    talla_raw = _num_val(soma, "talla_m", "talla") or _num_val(exam, "height")
    talla_m = round(talla_raw / 100.0, 2) if (talla_raw is not None and talla_raw > 3.0) else talla_raw
    imc = _num_val(soma, "imc")
    if imc is None and peso and talla_m and talla_m > 0:
        imc = round(peso / (talla_m * talla_m), 1)

    ta_sis = _num_val(soma, "ta_sistolica") or _num_val(vit, "ta_sistolica")
    ta_dia = _num_val(soma, "ta_diastolica") or _num_val(vit, "ta_diastolica")
    bp_str = _str_val(exam, "bloodPressure")
    if not bp_str and ta_sis is not None and ta_dia is not None:
        bp_str = f"{int(ta_sis)}/{int(ta_dia)}"

    agudeza = _str_val(phys, "agudeza_visual_resumen")
    if not agudeza and eye:
        vl_od = _str_val(eye, "vision_lejana_od")
        vl_oi = _str_val(eye, "vision_lejana_oi")
        if vl_od or vl_oi:
            agudeza = f"{vl_od or '—'} OD / {vl_oi or '—'} OI"

    diagnostico = (
        _str_val(verdict, "finalDiagnosis")
        or _str_val(phys, "impresion_diagnostica", "diagnostico")
        or _str_val(rev, "doctorDiagnosis")
    )
    aptitud = _str_val(phys, "aptitud") or ("APTO" if verdict is not None and not _is_mock(verdict) and diagnostico else "")
    dictamen_pdf = _str_val(verdict, "pdfUrl") or None
    validated_exam_pdf = _validated_pdf(rev, validated_map or {}) if rev is not None else None

    return {
        "peso": peso,
        "talla": talla_m,
        "imc": imc,
        "taSistolica": int(ta_sis) if ta_sis is not None else None,
        "taDiastolica": int(ta_dia) if ta_dia is not None else None,
        "presionArterial": bp_str or "N/A",
        "dxPresion": _str_val(phys, "presion_arterial_resumen") or "N/A",
        "estadoNutricional": _str_val(phys, "estado_nutricional") or _str_val(soma, "complexion") or "N/A",
        "saludBucal": _str_val(phys, "salud_bucal") or _str_val(phys, "boca_estado") or "N/A",
        "agudezaVisual": agudeza or "N/A",
        "circulacionVenosa": _str_val(phys, "circulacion_venosa") or "N/A",
        "aptitud": aptitud or "N/A",
        "diagnostico": diagnostico,
        "recomendaciones": _str_val(verdict, "recommendations") or _str_val(phys, "recomendaciones_clinicas"),
        "dictamenPdfUrl": dictamen_pdf,
        "validatedPdfUrl": validated_exam_pdf,
        "fileUrl": src_url,
    }


def project_to_snapshot(
    project: Any,
    validated_pdf_by_review: Optional[Dict[str, str]] = None,
    mobile_unit_override: Optional[Dict[str, str]] = None,
) -> Dict[str, Any]:
    """
    Convierte un objeto Project de Prisma (incluyendo relaciones) en el
    payload "snapshot" que consumen los generadores XLSX/PDF.
    """
    validated_map = validated_pdf_by_review or {}
    trabajadores_raw = _as_list(_attr(project, "workers", None))
    company = _attr(project, "company", None)
    mobile_unit = mobile_unit_override or _attr(project, "mobileUnit", None)

    empresa = _str_val(company, "name")
    empresa_legal = _str_val(company, "legalName") or empresa

    start_dt = _attr(project, "startDate", None)
    end_dt = _attr(project, "endDate", None)
    fecha = (
        start_dt.strftime("%Y-%m-%d")
        if hasattr(start_dt, "strftime") and not _is_mock(start_dt)
        else str(start_dt or "")[:10]
    )
    fecha_fin = (
        end_dt.strftime("%Y-%m-%d")
        if hasattr(end_dt, "strftime") and not _is_mock(end_dt)
        else ""
    )

    unidad_movil = _str_val(mobile_unit, "name") or _str_val(project, "unitRef")
    unidad_placa = _str_val(mobile_unit, "plate")
    if unidad_movil and unidad_placa:
        unidad_movil = f"{unidad_movil} ({unidad_placa})"

    trabajadores = []
    for pw in trabajadores_raw:
        worker = _attr(pw, "worker", None)
        if worker is None:
            continue

        event = _attr(pw, "event", None)
        exam = _attr(event, "exam", None) if event is not None else None
        phys = _as_dict(_attr(exam, "physicalExamData", None)) if exam is not None else {}
        eye_acuity = _as_dict(_attr(exam, "eyeAcuityData", None)) if exam is not None else {}
        ch = _attr(worker, "clinicalHistory", None)
        ch_data = _as_dict(_attr(ch, "data", None)) if ch is not None else {}

        sexo = _resolve_worker_sex(worker, phys, ch_data)
        area, antiguedad = _resolve_worker_area_and_antiguedad(worker, phys, ch_data)
        edad_num = _calc_age(_attr(worker, "dob", None))

        ant_cap = _as_dict(phys.get("antecedentes_captured"))
        no_pat = _as_dict(ant_cap.get("no_patologicos")) or _as_dict(ch_data.get("no_patologicos"))
        tab_raw = _attr(no_pat, "tabaco", None)
        default_tab = (
            _str_val(tab_raw, "estado")
            if isinstance(tab_raw, dict)
            else (str(tab_raw).strip() if isinstance(tab_raw, str) and tab_raw.strip() else "N/A")
        )

        estudios: Dict[str, Any] = {}
        exam_rev = None
        exam_src_url = None
        doc_pdfs: List[Dict[str, str]] = []
        seen_doc_urls: set[str] = set()

        def _add_doc(title: str, url: Optional[str]) -> None:
            if not url or not isinstance(url, str):
                return
            clean = url.strip()
            if not clean or clean in seen_doc_urls:
                return
            seen_doc_urls.add(clean)
            doc_pdfs.append({"titulo": title, "url": clean})

        if event is not None:
            verdict = _attr(event, "verdict", None)
            verdict_pdf = _str_val(verdict, "pdfUrl") if verdict is not None else ""
            if verdict_pdf:
                _add_doc("Dictamen Médico de Aptitud", verdict_pdf)

            event_tests = _as_list(_attr(event, "eventTests", None))
            for et in event_tests:
                tn = _norm_text(_str_val(et, "testNameSnapshot") or _str_val(_attr(et, "test", None), "name"))
                _, _, rev_et, src_et, stype = _first_extracted(et)
                stype_norm = _norm_text(stype or "")

                if "audiometr" in tn or "audiometr" in stype_norm:
                    parsed_a = _audiometria(et, validated_map)
                    estudios["audiometria"] = _merge_study_dict(estudios.get("audiometria") or {}, parsed_a)
                    _add_doc("Audiometría (Reporte validado)", parsed_a.get("validatedPdfUrl"))
                    _add_doc("Audiometría (Archivo original)", parsed_a.get("fileUrl"))
                elif "espirometr" in tn or "espirometr" in stype_norm:
                    parsed_e = _espirometria(et, validated_map, default_tab)
                    estudios["espirometria"] = _merge_study_dict(estudios.get("espirometria") or {}, parsed_e)
                    _add_doc("Espirometría (Reporte validado)", parsed_e.get("validatedPdfUrl"))
                    _add_doc("Espirometría (Archivo original)", parsed_e.get("fileUrl"))
                elif "columna" in tn or "rx col" in tn or "escoliosis" in tn or ("rayos" in stype_norm and "torax" not in tn):
                    parsed_c = _rx_columna(et, validated_map)
                    estudios["rxColumna"] = _merge_study_dict(estudios.get("rxColumna") or {}, parsed_c)
                    _add_doc("Radiografía de Columna (Validada)", parsed_c.get("validatedPdfUrl"))
                    _add_doc("Radiografía de Columna (Archivo)", parsed_c.get("fileUrl"))
                elif "torax" in tn or ("tele" in tn and "torax" in tn):
                    parsed_t = _rx_torax(et, validated_map)
                    estudios["rxTorax"] = _merge_study_dict(estudios.get("rxTorax") or {}, parsed_t)
                    _add_doc("Radiografía de Tórax (Validada)", parsed_t.get("validatedPdfUrl"))
                    _add_doc("Radiografía de Tórax (Archivo)", parsed_t.get("fileUrl"))
                elif "ecg" in tn or "ekg" in tn or "electrocardio" in tn or "electro" in stype_norm:
                    parsed_ecg = _ecg(et, validated_map)
                    estudios["ecg"] = _merge_study_dict(estudios.get("ecg") or {}, parsed_ecg)
                    _add_doc("Electrocardiograma (Validado)", parsed_ecg.get("validatedPdfUrl"))
                    _add_doc("Electrocardiograma (Archivo)", parsed_ecg.get("fileUrl"))
                elif "campimetr" in tn or "agudeza" in tn or "visual" in tn or "campimetr" in stype_norm:
                    parsed_cam = _campimetria(et, validated_map, eye_acuity, phys)
                    estudios["campimetria"] = _merge_study_dict(estudios.get("campimetria") or {}, parsed_cam)
                    _add_doc("Campimetría / Visual (Validada)", parsed_cam.get("validatedPdfUrl"))
                    _add_doc("Campimetría / Visual (Archivo)", parsed_cam.get("fileUrl"))
                elif "laboratorio" in tn or "lab" in tn or "bh" in tn or "qs" in tn or "orina" in tn or "toxico" in tn or "laboratorio" in stype_norm:
                    parsed_lab = _laboratorio(et, validated_map, edad_num)
                    estudios["laboratorio"] = _merge_study_dict(estudios.get("laboratorio") or {}, parsed_lab)
                    _add_doc("Laboratorio Clínico (Validado)", parsed_lab.get("validatedPdfUrl"))
                    _add_doc("Laboratorio Clínico (Archivo)", parsed_lab.get("fileUrl"))
                elif "examen med" in tn or "certificado" in tn or "examenmedico" in stype_norm:
                    exam_rev = rev_et or exam_rev
                    exam_src_url = src_et or exam_src_url
                    _add_doc("Examen Médico / Certificado", _validated_pdf(rev_et, validated_map) or src_et)

            # Fallback a LabRecord si no hubo EventTest de laboratorio.
            for lr in _as_list(_attr(event, "labs", None)):
                lr_url = _str_val(lr, "fileUrl") or None
                lr_ed = _as_dict(_attr(lr, "extractedData", None))
                if lr_ed or lr_url:
                    estudios["laboratorio"] = _merge_study_dict(
                        estudios.get("laboratorio") or {},
                        _laboratorio(lr, validated_map, edad_num),
                    )
                    _add_doc("Laboratorio Clínico", lr_url)

            # Si existe eyeAcuityData en MedicalExam pero no hubo EventTest de campimetría, reflejar agudeza visual.
            if not estudios.get("campimetria") and eye_acuity:
                vl_od = _str_val(eye_acuity, "vision_lejana_od")
                vl_oi = _str_val(eye_acuity, "vision_lejana_oi")
                if vl_od or vl_oi:
                    estudios["campimetria"] = {
                        "agudezaVisual": f"VL {vl_od or '—'} OD / {vl_oi or '—'} OI",
                        "camposVisuales": _str_val(eye_acuity, "campimetria") or "N/A",
                        "discriminacionColor": _str_val(eye_acuity, "test_ishihara") or "N/A",
                    }

            if exam is not None or verdict is not None or exam_rev is not None:
                estudios["examenMedico"] = _build_examen_medico(event, exam_rev, validated_map, exam_src_url)

        last_name = _str_val(worker, "lastName")
        first_name = _str_val(worker, "firstName")
        nombre = f"{last_name} {first_name}".strip() or "Sin nombre"
        uid = _str_val(worker, "universalId") or _str_val(worker, "id")

        trabajadores.append(
            {
                "folio": uid[:24],
                "nombre": nombre,
                "sexo": sexo,
                "edad": edad_num,
                "area": area,
                "antiguedad": antiguedad,
                "campimetria": estudios.get("campimetria") or {},
                "audiometria": estudios.get("audiometria") or {},
                "espirometria": estudios.get("espirometria") or {},
                "rxColumna": estudios.get("rxColumna") or {},
                "rxTorax": estudios.get("rxTorax") or {},
                "ecg": estudios.get("ecg") or {},
                "laboratorio": estudios.get("laboratorio") or {},
                "examenMedico": estudios.get("examenMedico") or {},
                "documentosPdf": doc_pdfs,
            }
        )

    return {
        "id": _attr(project, "id", None),
        "nombreProyecto": _str_val(project, "name"),
        "empresa": empresa,
        "empresaLegal": empresa_legal,
        "unidadMovil": unidad_movil,
        "fecha": fecha,
        "fechaFin": fecha_fin,
        "trabajadores": trabajadores,
    }


def _empresa_slug(empresa: str) -> str:
    """Normaliza el nombre de empresa a un slug ASCII seguro para filename."""
    if not empresa:
        return "PROYECTO"
    texto = (
        unicodedata.normalize("NFD", empresa)
        .encode("ascii", "ignore")
        .decode("ascii")
        .upper()
    )
    texto = re.sub(r"[^A-Z0-9]+", "_", texto)
    return texto.strip("_") or "PROYECTO"


def _upload_report_to_s3_best_effort(local_path: str, rel_key: str) -> None:
    """Sube copia al bucket S3 si está habilitado para sobrevivir reinicios de contenedor."""
    try:
        from app.main import _upload_file_to_s3
        with open(local_path, "rb") as fh:
            data = fh.read()
        if data:
            _upload_file_to_s3(data, rel_key)
    except Exception:
        pass


def generar_reporte_masivo(
    snapshot: Dict[str, Any],
    project_id: str,
    report_id: str,
    format: str,
) -> Dict[str, Any]:
    """
    Genera el reporte en el formato pedido. Retorna dict con
    fileUrlXlsx / fileUrlPdf (relativos) o levanta excepcion.
    """
    if format not in ALLOWED_FORMATS:
        raise ValueError(
            f"Formato invalido: {format!r}. Permitidos: {sorted(ALLOWED_FORMATS)}"
        )

    storage_dir = report_storage_dir(project_id, report_id)
    out: Dict[str, Any] = {"fileUrlXlsx": None, "fileUrlPdf": None}

    if format in ("XLSX", "BOTH"):
        xlsx_path = os.path.join(storage_dir, "concentrado.xlsx")
        from app.services.reports.xlsx_writer import generar_xlsx as _gen_xlsx
        _gen_xlsx(snapshot, xlsx_path)
        rel_xlsx = relative_path(project_id, report_id, "concentrado.xlsx")
        _upload_report_to_s3_best_effort(xlsx_path, rel_xlsx)
        out["fileUrlXlsx"] = rel_xlsx

    if format in ("EBOOK", "BOTH", "PDF"):
        if format == "PDF":
            logger.warning(
                "generar_reporte_masivo: format='PDF' recibido pero deprecado "
                "(IMPL-20260701-04). Se usara EBOOK en su lugar."
            )

        from app.services.reports.pdf_ebook_writer import generar_ebook as _gen_ebook

        empresa_slug = _empresa_slug(snapshot.get("empresa") or "")
        fecha_str = snapshot.get("fecha") or datetime.utcnow().strftime("%Y-%m-%d")
        ebook_filename = f"EBOOK_{empresa_slug}_{fecha_str}.pdf"
        ebook_path = os.path.join(storage_dir, ebook_filename)

        _gen_ebook(snapshot, ebook_path, image_fetcher_instance=image_fetcher)
        rel_pdf = relative_path(project_id, report_id, ebook_filename)
        _upload_report_to_s3_best_effort(ebook_path, rel_pdf)
        out["fileUrlPdf"] = rel_pdf
        logger.info(
            "EBOOK generado para proyecto=%s report=%s -> %s",
            project_id, report_id, ebook_filename,
        )

    return out


async def _fetch_validated_pdfs_by_review(prisma_client: Any, review_ids: List[str]) -> Dict[str, str]:
    """
    Lee `validatedPdfUrl` de `doctor_study_reviews` (presente en el schema de producción
    aunque backend/prisma/schema.prisma sea un corte anterior).
    """
    if not review_ids or not hasattr(prisma_client, "query_raw"):
        return {}
    try:
        placeholders = ", ".join(f"${i + 1}" for i in range(len(review_ids)))
        sql = (
            'SELECT id, "validatedPdfUrl" '
            f'FROM doctor_study_reviews WHERE id IN ({placeholders}) '
            'AND "validatedPdfUrl" IS NOT NULL'
        )
        res = prisma_client.query_raw(sql, *review_ids)
        rows = await res if inspect.isawaitable(res) else res
        if not isinstance(rows, list):
            return {}
        out: Dict[str, str] = {}
        for r in rows:
            if isinstance(r, dict) and r.get("id") and r.get("validatedPdfUrl"):
                out[str(r["id"])] = str(r["validatedPdfUrl"])
        return out
    except Exception as exc:
        logger.debug("_fetch_validated_pdfs_by_review omitted: %s", exc)
        return {}


def _collect_review_ids(project: Any) -> List[str]:
    ids: List[str] = []
    for pw in _as_list(_attr(project, "workers", None)):
        ev = _attr(pw, "event", None)
        if ev is None:
            continue
        for et in _as_list(_attr(ev, "eventTests", None)):
            for snap in _as_list(_attr(et, "extractionSnapshots", None)):
                for pred in _as_list(_attr(snap, "aiPrediagnoses", None)):
                    for rev in _as_list(_attr(pred, "doctorReviews", None)):
                        rid = _str_val(rev, "id")
                        if rid:
                            ids.append(rid)
    return ids


async def _fetch_project_mobile_unit(prisma_client: Any, project_id: str) -> Optional[Dict[str, str]]:
    """
    backend/prisma/schema.prisma puede no declarar Project.mobileUnit; consulta por SQL crudo
    las columnas reales name y plate en mobile_units.
    """
    if not project_id or not hasattr(prisma_client, "query_raw"):
        return None
    try:
        res = prisma_client.query_raw(
            'SELECT mu.name, mu.plate FROM projects p LEFT JOIN mobile_units mu ON p."mobileUnitId" = mu.id WHERE p.id = $1',
            project_id,
        )
        rows = await res if inspect.isawaitable(res) else res
        if isinstance(rows, list) and rows:
            r = rows[0]
            if isinstance(r, dict) and r.get("name"):
                return {
                    "name": str(r.get("name") or ""),
                    "plate": str(r.get("plate") or ""),
                }
        return None
    except Exception as exc:
        logger.debug("_fetch_project_mobile_unit omitted: %s", exc)
        return None


async def run_generation_job(
    *,
    prisma_client: Any,
    project_id: str,
    report_id: str,
    format: str,
) -> None:
    """
    Job asincrono llamado desde FastAPI BackgroundTasks.
    Carga el proyecto completo, genera archivos y actualiza ProjectReport.
    Captura TODAS las excepciones y las persiste en ProjectReport.errorMessage
    con status=FAILED.
    """
    try:
        await prisma_client.projectreport.update(
            where={"id": report_id},
            data={"status": "PROCESSING"},
        )

        rich_include = {
            "company": True,
            "branch": True,
            "workers": {
                "include": {
                    "worker": {
                        "include": {
                            "jobPosition": True,
                            "clinicalHistory": True,
                        },
                    },
                    "event": {
                        "include": {
                            "exam": True,
                            "verdict": True,
                            "labs": True,
                            "studies": True,
                            "eventTests": {
                                "include": {
                                    "extractionSnapshots": {
                                        "include": {
                                            "aiPrediagnoses": {
                                                "include": {
                                                    "doctorReviews": True,
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        }

        try:
            project = await prisma_client.project.find_unique(
                where={"id": project_id},
                include=rich_include,
            )
        except Exception as exc:
            logger.warning("rich_include fallback para project=%s: %s", project_id, exc)
            project = await prisma_client.project.find_unique(
                where={"id": project_id},
                include={
                    "company": True,
                    "workers": {
                        "include": {
                            "worker": True,
                            "event": {
                                "include": {
                                    "exam": True,
                                    "verdict": True,
                                    "eventTests": True,
                                },
                            },
                        },
                    },
                },
            )

        if project is None:
            raise ValueError(f"Proyecto no encontrado: {project_id}")

        review_ids = _collect_review_ids(project)
        validated_map = await _fetch_validated_pdfs_by_review(prisma_client, review_ids)
        mobile_unit_override = await _fetch_project_mobile_unit(prisma_client, project_id)

        snapshot = project_to_snapshot(
            project,
            validated_pdf_by_review=validated_map,
            mobile_unit_override=mobile_unit_override,
        )
        paths = generar_reporte_masivo(snapshot, project_id, report_id, format)

        await prisma_client.projectreport.update(
            where={"id": report_id},
            data={
                "status": "READY",
                "fileUrlXlsx": paths["fileUrlXlsx"],
                "fileUrlPdf": paths["fileUrlPdf"],
                "completedAt": datetime.utcnow(),
                "errorMessage": None,
            },
        )
    except Exception as exc:
        logger.exception("run_generation_job failed report=%s", report_id)
        try:
            await prisma_client.projectreport.update(
                where={"id": report_id},
                data={
                    "status": "FAILED",
                    "errorMessage": (str(exc) or "unknown")[:500],
                    "completedAt": datetime.utcnow(),
                },
            )
        except Exception:
            pass
