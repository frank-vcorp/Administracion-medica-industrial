"""
Recomendaciones prácticas para reportes AMI (R-06 / AMI-SR F-017).

Texto orientado al entregable PDF / dictamen (vigilancia ocupacional, EPP,
seguimiento), distinto del campo clínico prudente `recommendation`.
"""

from __future__ import annotations

from typing import Any, Mapping, Optional


def _norm(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip().upper()


def _join_parts(parts: list[str]) -> str:
    return " ".join(p.strip() for p in parts if p and p.strip())


ESPIROMETRIA_PRACTICAL = {
    "normal": _join_parts([
        "USO ADECUADO DE EQUIPO DE PROTECCIÓN",
        "ESPIROMETRÍAS DE SEGUIMIENTO ANUAL",
    ]),
    "restrictivo": _join_parts([
        "INDICAR EJERCICIOS RESPIRATORIOS",
        "SE SUGIERE COMPLEMENTAR CON RADIOGRAFÍA DE TÓRAX",
        "USO ADECUADO DE EQUIPO DE PROTECCIÓN",
        "ESPIROMETRÍAS DE SEGUIMIENTO EN 12 SEMANAS",
    ]),
    "obstructivo": _join_parts([
        "INDICAR EJERCICIOS RESPIRATORIOS",
        "USO ADECUADO DE EQUIPO DE PROTECCIÓN RESPIRATORIA",
        "ESPIROMETRÍAS DE SEGUIMIENTO EN 12 SEMANAS",
    ]),
    "mixto": _join_parts([
        "INDICAR EJERCICIOS RESPIRATORIOS",
        "USO ADECUADO DE EQUIPO DE PROTECCIÓN RESPIRATORIA",
        "ESPIROMETRÍAS DE SEGUIMIENTO EN 12 SEMANAS",
    ]),
    "non_conclusive": "REPETIR ESPIROMETRÍA CON TÉCNICA ADECUADA ANTES DE INTERPRETAR",
}

AUDIOMETRIA_PRACTICAL = {
    "normal": "AUDIOMETRÍA DE SEGUIMIENTO ANUAL",
    "hipoacusia": _join_parts([
        "USO ADECUADO DE TAPONES AUDITIVOS",
        "AUDIOMETRÍA DE SEGUIMIENTO EN 12 SEMANAS",
        "POSTERIORMENTE CADA AÑO",
    ]),
    "non_conclusive": "REPETIR AUDIOMETRÍA CON CONDICIONES ADECUADAS DE CABINA Y TÉCNICA",
}


def _detect_espirometria_pattern(summary: str, extracted_data: Mapping[str, Any]) -> str:
    text = _norm(summary)
    for token, key in (
        ("MIXTO", "mixto"),
        ("OBSTRUCT", "obstructivo"),
        ("RESTRIC", "restrictivo"),
        ("NORMAL", "normal"),
    ):
        if token in text:
            return key

    patron = _norm(extracted_data.get("espirometria_patron") or extracted_data.get("patron"))
    if patron in {"RESTRICTIVO", "RESTRICCIÓN", "RESTRICCION"}:
        return "restrictivo"
    if patron in {"OBSTRUCTIVO", "OBSTRUCCION"}:
        return "obstructivo"
    if patron == "MIXTO":
        return "mixto"
    if patron == "NORMAL":
        return "normal"
    return "normal"


def _detect_audiometria_pattern(
    summary: str,
    predx_result: Mapping[str, Any],
) -> str:
    clinical_state = _norm(predx_result.get("clinical_state"))
    if clinical_state == "AI_NON_CONCLUSIVE":
        return "non_conclusive"

    clas = predx_result.get("clasificacion_hipoacusia")
    if isinstance(clas, dict):
        values = [
            _norm(clas.get("right")),
            _norm(clas.get("left")),
            _norm(clas.get("bilateral")),
        ]
        if any(v not in {"", "NO_APLICA", "NO APLICA", "NORMAL"} for v in values if v):
            return "hipoacusia"

    bilateral = predx_result.get("resumen_bilateral")
    if isinstance(bilateral, dict):
        status = _norm(bilateral.get("status"))
        if status and "NORMAL" not in status and "LIMITES_NORMALES" not in status:
            return "hipoacusia"

    text = _norm(summary)
    if any(token in text for token in ("HIPOACUS", "PÉRDIDA", "PERDIDA", "SORDER")):
        return "hipoacusia"
    if "NON_CONCLUSIVE" in text or "NO CONCLUY" in text:
        return "non_conclusive"
    return "normal"


def derive_practical_recommendation(
    study_type: str,
    extracted_data: Optional[Mapping[str, Any]],
    predx_result: Mapping[str, Any],
) -> Optional[str]:
    """
    Deriva recomendación práctica cuando el modelo no la aporta o viene vacía.
    """
    extracted = extracted_data if isinstance(extracted_data, Mapping) else {}
    summary = str(predx_result.get("summary") or "")
    clinical_state = _norm(predx_result.get("clinical_state"))

    if clinical_state == "AI_NON_CONCLUSIVE":
        if study_type == "Espirometria":
            return ESPIROMETRIA_PRACTICAL["non_conclusive"]
        if study_type == "Audiometria":
            return AUDIOMETRIA_PRACTICAL["non_conclusive"]
        return None

    if study_type == "Espirometria":
        pattern = _detect_espirometria_pattern(summary, extracted)
        return ESPIROMETRIA_PRACTICAL.get(pattern, ESPIROMETRIA_PRACTICAL["normal"])

    if study_type == "Audiometria":
        pattern = _detect_audiometria_pattern(summary, predx_result)
        return AUDIOMETRIA_PRACTICAL.get(pattern, AUDIOMETRIA_PRACTICAL["normal"])

    return None
