"""
Criterio espirométrico AMI derivado (determinístico) para enriquecer prediagnóstico.

Fuentes normativas del proyecto (no inventar umbrales aquí):
- context/datos AMI/DETERMINAR EL PATRÓN ESPIROMÉTRICO.pptx (flujo AMI pasos 1–5)
- BR-20260824-01 / informacion para revision/criterios repetitibilidad-espirometria.png:
  repetibilidad FVC y FEV1 = diferencia entre los 2 valores más altos ≤ 150 ml
- BR-20260824-02 / IMPL-20260824-05: umbral AMI ≤ 150 ml prevalece sobre flag ATS/ERS
  impreso por Sibelmed cuando las maniobras cumplen ≤ 150 ml y las curvas son legibles
"""

from __future__ import annotations

import math
import re
from typing import Any, Dict, Iterable, List, Mapping, Optional, Sequence, Tuple

AMI_REPETIBILIDAD_UMBRAL_ML = 150.0
AMI_FVC_NORMAL_UMBRAL_PCT = 80.0
FALLBACK_RATIO_LIN_PCT = 70.0
FET100_ATS_ERS_MIN_S = 6.0

_FP_TOKEN_RE = re.compile(r"\bFP\b", re.IGNORECASE)
_INCONSISTENCY_FVC_RE = re.compile(
    r"SOSPECHA_INCONSISTENCIA_MEJOR_FVC|Mejor\s+FVC.*fila\s+est[aá]ndar\s+FVC",
    re.IGNORECASE,
)
_INCONSISTENCY_FEV1_RE = re.compile(
    r"SOSPECHA_INCONSISTENCIA_MEJOR_FEV1|Mejor\s+FEV1.*fila\s+est[aá]ndar\s+FEV1",
    re.IGNORECASE,
)


def _to_float(value: Any) -> Optional[float]:
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value) if math.isfinite(value) else None
    if isinstance(value, str):
        cleaned = value.strip().replace(",", ".")
        if not cleaned:
            return None
        try:
            num = float(cleaned)
            return num if math.isfinite(num) else None
        except ValueError:
            return None
    return None


def _ratio_or_pct_to_pct(value: Any) -> Optional[float]:
    num = _to_float(value)
    if num is None:
        return None
    if 0 < num <= 2.0:
        return round(num * 100.0, 2)
    return round(num, 2)


def _si_no_flag(value: Any) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, bool):
        return "SI" if value else "NO"
    text = str(value).strip().upper()
    if not text:
        return None
    if text in {"SI", "SÍ", "YES", "TRUE", "1", "ACEPTABLE", "CUMPLE"}:
        return "SI"
    if text in {"NO", "FALSE", "0", "NO CUMPLE"}:
        return "NO"
    return text


def _read_row_val(row: Mapping[str, Any], primary: str, alt: str) -> Optional[float]:
    val = _to_float(row.get(primary))
    if val is not None:
        return val
    return _to_float(row.get(alt))


def _row_maneuvers(row: Optional[Mapping[str, Any]]) -> List[float]:
    if not isinstance(row, Mapping):
        return []
    vals: List[float] = []
    for p, a in (("m1", "m1_value"), ("m2", "m2_value"), ("m3", "m3_value")):
        v = _read_row_val(row, p, a)
        if v is not None:
            vals.append(v)
    return vals


def _row_pcts(row: Optional[Mapping[str, Any]]) -> List[float]:
    if not isinstance(row, Mapping):
        return []
    vals: List[float] = []
    for key in ("m1_pct_ref", "m2_pct_ref", "m3_pct_ref"):
        v = _to_float(row.get(key))
        if v is not None:
            vals.append(v)
    return vals


def _find_row(
    parametros: Sequence[Mapping[str, Any]],
    *,
    exact_keys: Iterable[str],
    label_re: re.Pattern[str],
    exclude_mejor: bool = True,
) -> Optional[Mapping[str, Any]]:
    keys_set = {k.lower() for k in exact_keys}
    for row in parametros:
        rk = str(row.get("key") or "").strip().lower()
        rl = str(row.get("label") or "").strip().lower()
        if exclude_mejor and (rk.startswith("mejor_") or rl.startswith("mejor")):
            continue
        if rk in keys_set:
            return row
    for row in parametros:
        rk = str(row.get("key") or "").strip().lower()
        rl = str(row.get("label") or "").strip()
        if exclude_mejor and (rk.startswith("mejor_") or rl.lower().startswith("mejor")):
            continue
        if label_re.search(rl):
            return row
    return None


def _compute_top_two_diff_ml(vals: Sequence[float]) -> Optional[float]:
    if len(vals) < 2:
        return None
    top_two = sorted(vals, reverse=True)
    return round(abs(top_two[0] - top_two[1]) * 1000.0, 2)


def _detect_param_inconsistency(
    notas: str,
    param_name: str,
    std_row: Optional[Mapping[str, Any]],
    mejor_row: Optional[Mapping[str, Any]],
) -> bool:
    note_pattern = _INCONSISTENCY_FVC_RE if param_name == "FVC" else _INCONSISTENCY_FEV1_RE
    if notas and note_pattern.search(notas):
        return True
    if std_row and mejor_row:
        mejor_vals = _row_maneuvers(mejor_row)
        std_vals = _row_maneuvers(std_row)
        if mejor_vals and std_vals and max(mejor_vals) > max(std_vals) + 1e-9:
            return True
    return False


def _clasificar_severidad_fev1_ami(fev1_pct: Optional[float]) -> Optional[str]:
    """Escala AMI (diapositiva 2): 70-100 Leve, 60-69 Mod, 50-59 Mod Grave, 35-49 Grave, <35 Muy Grave."""
    if fev1_pct is None:
        return None
    if fev1_pct >= 70.0:
        return "LEVE"
    if fev1_pct >= 60.0:
        return "MODERADA"
    if fev1_pct >= 50.0:
        return "MODERADAMENTE GRAVE"
    if fev1_pct >= 35.0:
        return "GRAVE"
    return "MUY GRAVE"


def _clasificar_imc_oms(imc: Optional[float]) -> Optional[str]:
    if imc is None:
        return None
    if imc < 18.5:
        return "Bajo peso"
    if imc < 25.0:
        return "Normopeso"
    if imc < 30.0:
        return "Sobrepeso"
    if imc < 35.0:
        return "Obesidad grado I"
    if imc < 40.0:
        return "Obesidad grado II"
    return "Obesidad grado III"


def _derivar_grado_calidad_ats_ami(
    pruebas: Optional[int],
    fvc_ml: Optional[float],
    fev1_ml: Optional[float],
) -> Optional[str]:
    if pruebas is None:
        return None
    if pruebas <= 0:
        return "F"
    if pruebas == 1:
        return "E"
    if fvc_ml is None or fev1_ml is None:
        return None
    max_diff = max(fvc_ml, fev1_ml)
    if pruebas >= 3 and max_diff <= AMI_REPETIBILIDAD_UMBRAL_ML:
        return "A"
    if pruebas == 2 and max_diff <= AMI_REPETIBILIDAD_UMBRAL_ML:
        return "B"
    if max_diff <= 200.0:
        return "C"
    if max_diff <= 250.0:
        return "D"
    return "E"


def _extract_notas(data: Mapping[str, Any], calidad: Mapping[str, Any]) -> str:
    parts = [
        str(data.get("notas_calidad") or ""),
        str(calidad.get("notas_calidad") or ""),
    ]
    return " | ".join(p.strip() for p in parts if p and p.strip())


def compute_espirometry_ami_criteria(data: Mapping[str, Any]) -> Dict[str, Any]:
    """Calcula determinísticamente repetibilidad, calidad y árbol AMI para Espirometría."""
    calidad_raw = data.get("calidad")
    calidad: Mapping[str, Any] = calidad_raw if isinstance(calidad_raw, Mapping) else {}
    parametros_raw = data.get("parametros")
    parametros: List[Mapping[str, Any]] = (
        [r for r in parametros_raw if isinstance(r, Mapping)]
        if isinstance(parametros_raw, list)
        else []
    )
    notas_combinadas = _extract_notas(data, calidad)

    mejor_fvc_row = _find_row(
        parametros,
        exact_keys=("mejor_fvc_l", "mejor_fvc", "m_fvc"),
        label_re=re.compile(r"^mejor\s+fvc\b", re.IGNORECASE),
        exclude_mejor=False,
    )
    std_fvc_row = _find_row(
        parametros,
        exact_keys=("fvc_l", "fvc", "std_fvc"),
        label_re=re.compile(r"^fvc\b", re.IGNORECASE),
        exclude_mejor=True,
    )
    mejor_fev1_row = _find_row(
        parametros,
        exact_keys=("mejor_fev1_l", "mejor_fev1", "m_fev1"),
        label_re=re.compile(r"^mejor\s+fev1\b", re.IGNORECASE),
        exclude_mejor=False,
    )
    std_fev1_row = _find_row(
        parametros,
        exact_keys=("fev1_l", "fev1", "std_fev1"),
        label_re=re.compile(r"^fev1(?!/)\b", re.IGNORECASE),
        exclude_mejor=True,
    )
    mejor_ratio_row = _find_row(
        parametros,
        exact_keys=("mejor_fev1_fvc_pct", "mfev1_mfvc_pct", "mfev1_mfvc"),
        label_re=re.compile(r"mfev1\s*/\s*mfvc", re.IGNORECASE),
        exclude_mejor=False,
    )
    std_ratio_row = _find_row(
        parametros,
        exact_keys=("fev1_fvc_pct", "fev1_fvc", "fev1_fvc_ratio"),
        label_re=re.compile(r"^fev1\s*/\s*fvc\b", re.IGNORECASE),
        exclude_mejor=True,
    )
    fet_row = _find_row(
        parametros,
        exact_keys=("fet100_s", "fet100", "fet_s"),
        label_re=re.compile(r"^fet\s*100", re.IGNORECASE),
        exclude_mejor=False,
    )
    vext_row = _find_row(
        parametros,
        exact_keys=("vext_l", "vext"),
        label_re=re.compile(r"^vext\b", re.IGNORECASE),
        exclude_mejor=False,
    )
    fef2575_row = _find_row(
        parametros,
        exact_keys=("fef2575_l_s", "fef25_75_l_s", "fef25_75"),
        label_re=re.compile(r"fef\s*25.*75", re.IGNORECASE),
        exclude_mejor=False,
    )
    edad_pulmon_row = _find_row(
        parametros,
        exact_keys=("edad_pulmon_anios", "edad_pulmon"),
        label_re=re.compile(r"edad\s+del\s+pulm", re.IGNORECASE),
        exclude_mejor=False,
    )

    fvc_ref_row = mejor_fvc_row or std_fvc_row
    fev1_ref_row = mejor_fev1_row or std_fev1_row
    ratio_row = mejor_ratio_row or std_ratio_row

    std_fvc_vals = _row_maneuvers(std_fvc_row)
    std_fev1_vals = _row_maneuvers(std_fev1_row)
    mejor_fvc_vals = _row_maneuvers(mejor_fvc_row)
    mejor_fev1_vals = _row_maneuvers(mejor_fev1_row)

    fvc_l = _to_float(data.get("fvc"))
    if fvc_l is None:
        fvc_l = mejor_fvc_vals[0] if mejor_fvc_vals else (max(std_fvc_vals) if std_fvc_vals else None)
    fev1_l = _to_float(data.get("fev1"))
    if fev1_l is None:
        fev1_l = mejor_fev1_vals[0] if mejor_fev1_vals else (max(std_fev1_vals) if std_fev1_vals else None)

    fvc_pct = _to_float(data.get("fvc_percent_predicho"))
    if fvc_pct is None:
        pcts = _row_pcts(mejor_fvc_row) or _row_pcts(std_fvc_row)
        fvc_pct = max(pcts) if pcts else None
    fev1_pct = _to_float(data.get("fev1_percent_predicho"))
    if fev1_pct is None:
        pcts = _row_pcts(mejor_fev1_row) or _row_pcts(std_fev1_row)
        fev1_pct = max(pcts) if pcts else None

    fvc_ref_l = _read_row_val(fvc_ref_row, "ref", "ref_value") if fvc_ref_row else None
    fvc_lln_l = _read_row_val(fvc_ref_row, "lln", "lln_value") if fvc_ref_row else None
    fev1_ref_l = _read_row_val(fev1_ref_row, "ref", "ref_value") if fev1_ref_row else None
    fev1_lln_l = _read_row_val(fev1_ref_row, "lln", "lln_value") if fev1_ref_row else None

    fev1_fvc_pct: Optional[float] = None
    if ratio_row:
        ratio_vals = _row_maneuvers(ratio_row)
        if ratio_vals:
            fev1_fvc_pct = _ratio_or_pct_to_pct(ratio_vals[0])
    if fev1_fvc_pct is None:
        fev1_fvc_pct = _ratio_or_pct_to_pct(data.get("fev1_fvc_ratio"))
    if fev1_fvc_pct is None and fvc_l and fev1_l is not None and fvc_l > 0:
        fev1_fvc_pct = round((fev1_l / fvc_l) * 100.0, 2)

    ratio_lln_raw = None
    for candidate in (ratio_row, std_ratio_row):
        if candidate is not None:
            ratio_lln_raw = _read_row_val(candidate, "lln", "lln_value")
            if ratio_lln_raw is not None:
                break
    ratio_lln_pct = _ratio_or_pct_to_pct(ratio_lln_raw)
    lin_pct = ratio_lln_pct if ratio_lln_pct is not None else FALLBACK_RATIO_LIN_PCT
    lin_fuente = "tabla_lln" if ratio_lln_pct is not None else "fallback_70pct"

    fef25_75_pct = None
    if fef2575_row:
        fef_pcts = _row_pcts(fef2575_row)
        fef25_75_pct = max(fef_pcts) if fef_pcts else None

    # Repetibilidad AMI (BR-20260824-01) con guarda por inconsistencia tabular
    inc_fvc = _detect_param_inconsistency(notas_combinadas, "FVC", std_fvc_row, mejor_fvc_row)
    inc_fev1 = _detect_param_inconsistency(notas_combinadas, "FEV1", std_fev1_row, mejor_fev1_row)

    fvc_extracted_ml = _to_float(calidad.get("repetibilidad_fvc_ml"))
    fev1_extracted_ml = _to_float(calidad.get("repetibilidad_fev1_ml"))

    fvc_ml = (
        fvc_extracted_ml
        if fvc_extracted_ml is not None
        else (None if inc_fvc else _compute_top_two_diff_ml(std_fvc_vals))
    )
    fev1_ml = (
        fev1_extracted_ml
        if fev1_extracted_ml is not None
        else (None if inc_fev1 else _compute_top_two_diff_ml(std_fev1_vals))
    )

    fvc_menor_150 = (
        None
        if fvc_ml is None
        else ("SI" if fvc_ml <= AMI_REPETIBILIDAD_UMBRAL_ML + 1e-6 else "NO")
    )
    fev1_menor_150 = (
        None
        if fev1_ml is None
        else ("SI" if fev1_ml <= AMI_REPETIBILIDAD_UMBRAL_ML + 1e-6 else "NO")
    )

    pruebas_raw = _to_float(calidad.get("pruebas_aceptables"))
    if pruebas_raw is not None:
        pruebas_aceptables: Optional[int] = int(round(pruebas_raw))
    elif std_fvc_vals or std_fev1_vals:
        pruebas_aceptables = max(len(std_fvc_vals), len(std_fev1_vals))
    else:
        pruebas_aceptables = None

    has_inconsistency = inc_fvc or inc_fev1
    if has_inconsistency:
        cumple_ami: Optional[bool] = False
    elif fvc_menor_150 == "NO" or fev1_menor_150 == "NO":
        cumple_ami = False
    elif pruebas_aceptables is not None and pruebas_aceptables < 2:
        cumple_ami = False
    elif fvc_menor_150 == "SI" and fev1_menor_150 == "SI" and (pruebas_aceptables or 0) >= 2:
        cumple_ami = True
    else:
        cumple_ami = None

    # Calidad técnica adicional (FET100%, Vext, FP, grado A-F)
    fet_vals = _row_maneuvers(fet_row)
    fet_max = max(fet_vals) if fet_vals else None
    fet_cumple_6s = (fet_max >= FET100_ATS_ERS_MIN_S) if fet_max is not None else None

    vext_vals = _row_maneuvers(vext_row)
    vext_max = max(vext_vals) if vext_vals else None
    vext_cumple = (
        (vext_max <= max(0.15, 0.05 * fvc_l))
        if (vext_max is not None and fvc_l is not None and fvc_l > 0)
        else None
    )

    avisos_fp = bool(_FP_TOKEN_RE.search(notas_combinadas))
    sibelmed_ats_neg = (
        _si_no_flag(calidad.get("repetibilidad_ats_ers_fvc")) == "NO"
        or _si_no_flag(calidad.get("repetibilidad_ats_ers_fev1")) == "NO"
    )
    discrepancia_sibelmed = bool(cumple_ami is True and (sibelmed_ats_neg or avisos_fp))

    grado_calidad_doc = str(calidad.get("calidad") or "").strip().upper() or None
    grado_calidad_derivado = grado_calidad_doc or (
        None if has_inconsistency else _derivar_grado_calidad_ats_ami(pruebas_aceptables, fvc_ml, fev1_ml)
    )
    criterios_dx_doc = _si_no_flag(calidad.get("criterios_para_dx"))
    criterios_dx_derivado = criterios_dx_doc or (
        None
        if grado_calidad_derivado is None
        else ("SI" if grado_calidad_derivado in {"A", "B", "C"} else "NO")
    )

    # Algoritmo AMI (DETERMINAR EL PATRÓN ESPIROMÉTRICO.pptx pasos 1-5)
    if cumple_ami is False or criterios_dx_doc == "NO":
        paso_1_ok: Optional[bool] = False
    elif cumple_ami is True or criterios_dx_doc == "SI":
        paso_1_ok = True
    else:
        paso_1_ok = None

    fev1_fvc_bajo_lin: Optional[bool] = (
        (fev1_fvc_pct < lin_pct) if fev1_fvc_pct is not None else None
    )
    fvc_normal_ami: Optional[bool] = (
        (fvc_pct > AMI_FVC_NORMAL_UMBRAL_PCT) if fvc_pct is not None else None
    )
    fvc_bajo_lln: Optional[bool] = (
        (fvc_l < fvc_lln_l) if (fvc_l is not None and fvc_lln_l is not None) else None
    )
    fev1_bajo_lln: Optional[bool] = (
        (fev1_l < fev1_lln_l) if (fev1_l is not None and fev1_lln_l is not None) else None
    )

    if paso_1_ok is False:
        patron_ami = "CALIDAD_INSUFICIENTE_REPETIR"
    elif fev1_fvc_bajo_lin is True:
        if fvc_normal_ami is False or fvc_bajo_lln is True:
            patron_ami = "PATRON_OBSTRUCTIVO_CON_FVC_REDUCIDA_POSIBLE_MIXTO"
        else:
            patron_ami = "PATRON_ESPIROMETRICO_OBSTRUCTIVO"
    elif fev1_fvc_bajo_lin is False:
        if fvc_normal_ami is False or fvc_bajo_lln is True:
            patron_ami = "PATRON_ESPIROMETRICO_SUGESTIVO_DE_RESTRICCION"
        elif fvc_normal_ami is True:
            patron_ami = "PATRON_ESPIROMETRICO_NORMAL"
        else:
            patron_ami = "NO_CONCLUYENTE_DATOS_INCOMPLETOS"
    else:
        patron_ami = "NO_CONCLUYENTE_DATOS_INCOMPLETOS"

    is_obstructive = patron_ami in {
        "PATRON_ESPIROMETRICO_OBSTRUCTIVO",
        "PATRON_OBSTRUCTIVO_CON_FVC_REDUCIDA_POSIBLE_MIXTO",
    }
    is_abnormal = is_obstructive or patron_ami == "PATRON_ESPIROMETRICO_SUGESTIVO_DE_RESTRICCION"

    # Contexto demográfico / antropométrico complementario
    pd_raw = data.get("paciente_detalle")
    pd: Mapping[str, Any] = pd_raw if isinstance(pd_raw, Mapping) else {}
    edad_anios = _to_float(pd.get("edad_anios"))
    imc = _to_float(pd.get("imc"))
    categoria_imc = _clasificar_imc_oms(imc)
    nota_imc = (
        f"IMC {imc:.1f} kg/m² ({categoria_imc}); la obesidad puede reducir la FVC por componente restrictivo extraparenquimatoso."
        if imc is not None and imc >= 30.0 and (fvc_normal_ami is False or fvc_bajo_lln is True)
        else None
    )
    edad_pulmon_vals = _row_maneuvers(edad_pulmon_row)
    edad_pulmon_mejor = edad_pulmon_vals[0] if edad_pulmon_vals else None
    brecha_edad = (
        round(edad_pulmon_mejor - edad_anios, 1)
        if edad_pulmon_mejor is not None and edad_anios is not None
        else None
    )

    return {
        "fuentes_reglas": [
            "AMI-DETERMINAR-PATRON-PPT",
            "BR-20260824-01",
            "BR-20260824-02",
            "IMPL-20260824-05",
            "ATS-ERS-2022",
        ],
        "parametros_clave": {
            "fvc_l": fvc_l,
            "fvc_pct_predicho": fvc_pct,
            "fvc_ref_l": fvc_ref_l,
            "fvc_lln_l": fvc_lln_l,
            "fev1_l": fev1_l,
            "fev1_pct_predicho": fev1_pct,
            "fev1_ref_l": fev1_ref_l,
            "fev1_lln_l": fev1_lln_l,
            "fev1_fvc_pct": fev1_fvc_pct,
            "fev1_fvc_lin_pct": lin_pct,
            "fev1_fvc_lin_fuente": lin_fuente,
            "fef25_75_pct_predicho": fef25_75_pct,
        },
        "repetibilidad_ami": {
            "umbral_ml": AMI_REPETIBILIDAD_UMBRAL_ML,
            "fvc_ml": fvc_ml,
            "fev1_ml": fev1_ml,
            "fvc_menor_150": fvc_menor_150,
            "fev1_menor_150": fev1_menor_150,
            "pruebas_aceptables": pruebas_aceptables,
            "cumple_criterio_ami": cumple_ami,
            "inconsistencia_tabular_fvc": inc_fvc,
            "inconsistencia_tabular_fev1": inc_fev1,
        },
        "calidad_tecnica": {
            "fet100_maniobras_s": fet_vals,
            "fet100_max_s": fet_max,
            "fet100_cumple_6s": fet_cumple_6s,
            "vext_maniobras_l": vext_vals,
            "vext_max_l": vext_max,
            "vext_cumple": vext_cumple,
            "meseta": _si_no_flag(calidad.get("meseta")),
            "pico_maximo": _si_no_flag(calidad.get("pico_maximo")),
            "forma_triangular": _si_no_flag(calidad.get("forma_triangular")),
            "libre_artefactos": _si_no_flag(calidad.get("libre_artefactos")),
            "avisos_fp_detectados": avisos_fp,
            "sibelmed_repetibilidad_ats_ers_negativa": sibelmed_ats_neg,
            "discrepancia_sibelmed_vs_ami": discrepancia_sibelmed,
            "grado_calidad_derivado": grado_calidad_derivado,
            "criterios_para_dx_derivado": criterios_dx_derivado,
        },
        "algoritmo_ami": {
            "paso_1_aceptable_repetible": paso_1_ok,
            "fev1_fvc_bajo_lin": fev1_fvc_bajo_lin,
            "fvc_normal_ami": fvc_normal_ami,
            "fvc_bajo_lln": fvc_bajo_lln,
            "fev1_bajo_lln": fev1_bajo_lln,
            "patron_ami": patron_ami,
            "grado_obstruccion_ami": _clasificar_severidad_fev1_ami(fev1_pct) if is_obstructive else None,
            "grado_referencia_ats_ers_fev1_pct": _clasificar_severidad_fev1_ami(fev1_pct) if is_abnormal else None,
            "considerar_broncodilatador": is_obstructive,
            "requiere_confirmacion_restriccion_tlc": patron_ami in {
                "PATRON_ESPIROMETRICO_SUGESTIVO_DE_RESTRICCION",
                "PATRON_OBSTRUCTIVO_CON_FVC_REDUCIDA_POSIBLE_MIXTO",
            },
        },
        "contexto_clinico_complementario": {
            "edad_anios": int(edad_anios) if edad_anios is not None and float(edad_anios).is_integer() else edad_anios,
            "sexo": pd.get("sexo"),
            "imc": imc,
            "categoria_imc_oms": categoria_imc,
            "nota_imc_restriccion": nota_imc,
            "tabaquismo": pd.get("fuma"),
            "motivo": pd.get("motivo"),
            "edad_pulmon_valores": edad_pulmon_vals,
            "edad_pulmon_mejor": edad_pulmon_mejor,
            "brecha_edad_pulmon_anios": brecha_edad,
        },
        "nota": (
            "Los criterios AMI (umbral ≤150 ml entre los 2 mejores valores y árbol pasos 1–5) "
            "tienen precedencia sobre el texto 'Repetibilidad ATS/ERS: No' o avisos FP del Sibelmed "
            "cuando la repetibilidad numérica cumple ≤150 ml y las curvas son legibles; el tiempo espiratorio "
            "corto (FET100% <6 s) se reporta como limitación técnica sin ocultar el patrón hallado."
        ),
    }


def enrich_espirometry_extracted_data(data: Dict[str, Any]) -> Dict[str, Any]:
    """Copia el payload espirométrico, completa calidad AMI calculable e inyecta `interpretacion_derivada_ami`."""
    if not isinstance(data, dict):
        return data

    enriched = dict(data)
    criteria = compute_espirometry_ami_criteria(enriched)
    rep = criteria["repetibilidad_ami"]
    cal = criteria["calidad_tecnica"]

    if isinstance(enriched.get("calidad"), dict):
        calidad_copy = dict(enriched["calidad"])
        backfill = {
            "repetibilidad_fvc_ml": rep["fvc_ml"],
            "repetibilidad_fev1_ml": rep["fev1_ml"],
            "repetibilidad_fvc_menor_150": rep["fvc_menor_150"],
            "repetibilidad_fev1_menor_150": rep["fev1_menor_150"],
            "pruebas_aceptables": rep["pruebas_aceptables"],
            "criterios_para_dx": cal["criterios_para_dx_derivado"],
            "calidad": cal["grado_calidad_derivado"],
        }
        for field, val in backfill.items():
            if calidad_copy.get(field) is None and val is not None:
                calidad_copy[field] = val
        enriched["calidad"] = calidad_copy

    enriched["interpretacion_derivada_ami"] = criteria
    return enriched
