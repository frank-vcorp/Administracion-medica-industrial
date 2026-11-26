"""Regresión criterio espirométrico AMI determinístico (PPT pasos 1-5 + BR-20260824-01)."""

from copy import deepcopy
from unittest.mock import patch

from app.espirometry_criteria import (
    _clasificar_severidad_fev1_ami,
    compute_espirometry_ami_criteria,
    enrich_espirometry_extracted_data,
)
from app.services.ai.prediagnostic import PrediagnosticService


def test_case1_live_sibelmed_restrictivo_con_fp_y_cumple_ami_150ml():
    """espiro_restrictiva.pdf (JUAREZ RAMOS): cumple repetibilidad AMI 0/10 ml aunque Sibelmed diga No/FP."""
    payload = {
        "fvc": 3.01,
        "fev1": 2.74,
        "fev1_fvc_ratio": 0.9103,
        "fvc_percent_predicho": 70,
        "fev1_percent_predicho": 79,
        "paciente_detalle": {
            "nombre_completo": "JUAREZ RAMOS RAUL ALBERTO",
            "sexo": "Hombre",
            "edad_anios": 38,
            "imc": 30.1,
            "fuma": "NO",
            "motivo": "ALMANCEM MP 5 MESES",
        },
        "calidad": {
            "repetibilidad_ats_ers_fvc": "No",
            "repetibilidad_ats_ers_fev1": "No",
            "notas_calidad": "Avisos ATS/ERS: M1: FP; M2: FP; M3: FP",
            "repetibilidad_fvc_ml": None,
            "repetibilidad_fev1_ml": None,
            "repetibilidad_fvc_menor_150": None,
            "repetibilidad_fev1_menor_150": None,
            "pruebas_aceptables": None,
            "criterios_para_dx": None,
            "calidad": None,
            "meseta": "SI",
            "pico_maximo": "SI",
            "forma_triangular": "SI",
            "libre_artefactos": "SI",
        },
        "parametros": [
            {"label": "Mejor FVC", "key": "mejor_fvc_l", "m1": 3.01, "m1_pct_ref": 70, "ref": 4.31, "lln": 3.56},
            {"label": "Mejor FEV1", "key": "mejor_fev1_l", "m1": 2.74, "m1_pct_ref": 79, "ref": 3.48, "lln": 2.84},
            {"label": "FEV1/FVC", "key": "fev1_fvc_pct", "m1": 91.03, "m1_pct_ref": 111, "ref": 81.72, "lln": 72.62},
            {"label": "FVC", "key": "fvc_l", "m1": 3.01, "m2": 3.01, "m3": 2.86, "m1_pct_ref": 70, "m2_pct_ref": 70, "m3_pct_ref": 66, "ref": 4.31, "lln": 3.56},
            {"label": "FEV1", "key": "fev1_l", "m1": 2.74, "m2": 2.73, "m3": 2.59, "m1_pct_ref": 79, "m2_pct_ref": 78, "m3_pct_ref": 74, "ref": 3.48, "lln": 2.84},
            {"label": "FET100%", "key": "fet100_s", "m1": 4.42, "m2": 4.34, "m3": 4.42},
            {"label": "Vext.", "key": "vext_l", "m1": 0.07, "m2": 0.06, "m3": 0.06},
            {"label": "Edad del pulmón", "key": None, "m1": 58.14, "m2": 58.36, "m3": 62.61},
        ],
    }

    criteria = compute_espirometry_ami_criteria(payload)
    rep = criteria["repetibilidad_ami"]
    cal = criteria["calidad_tecnica"]
    alg = criteria["algoritmo_ami"]
    ctx = criteria["contexto_clinico_complementario"]

    assert rep["fvc_ml"] == 0.0
    assert rep["fev1_ml"] == 10.0
    assert rep["fvc_menor_150"] == "SI"
    assert rep["fev1_menor_150"] == "SI"
    assert rep["pruebas_aceptables"] == 3
    assert rep["cumple_criterio_ami"] is True

    assert cal["fet100_max_s"] == 4.42
    assert cal["fet100_cumple_6s"] is False
    assert cal["vext_max_l"] == 0.07
    assert cal["vext_cumple"] is True
    assert cal["avisos_fp_detectados"] is True
    assert cal["sibelmed_repetibilidad_ats_ers_negativa"] is True
    assert cal["discrepancia_sibelmed_vs_ami"] is True
    assert cal["grado_calidad_derivado"] == "A"
    assert cal["criterios_para_dx_derivado"] == "SI"

    assert alg["paso_1_aceptable_repetible"] is True
    assert alg["fev1_fvc_bajo_lin"] is False
    assert alg["fvc_normal_ami"] is False
    assert alg["fvc_bajo_lln"] is True
    assert alg["patron_ami"] == "PATRON_ESPIROMETRICO_SUGESTIVO_DE_RESTRICCION"
    assert alg["requiere_confirmacion_restriccion_tlc"] is True
    assert alg["considerar_broncodilatador"] is False

    assert ctx["categoria_imc_oms"] == "Obesidad grado I"
    assert ctx["nota_imc_restriccion"] is not None
    assert ctx["brecha_edad_pulmon_anios"] == 20.1


def test_case2_rd2026_erika_rodriguez_calidad_a_restrictivo():
    """context/RD2026/ESPIROMETRIA.pdf (PEÑA PATRICIO MARBELLA): 30 ml / 40 ml, Calidad A, sugestivo restricción."""
    payload = {
        "calidad": {
            "repetibilidad_fvc_ml": 30.0,
            "repetibilidad_fev1_ml": 40.0,
            "pruebas_aceptables": 3,
            "criterios_para_dx": "SI",
            "calidad": "A",
            "pico_maximo": "SI",
            "forma_triangular": "SI",
            "libre_artefactos": "SI",
            "meseta": "SI",
            "tiempo": "SI",
            "repetibilidad_ats_ers_fvc": "No",
            "repetibilidad_ats_ers_fev1": "No",
        },
        "parametros": [
            {"label": "Mejor FVC", "key": "mejor_fvc_l", "m1": 2.33, "m1_pct_ref": 70, "ref": 3.32, "lln": 2.69},
            {"label": "Mejor FEV1", "key": "mejor_fev1_l", "m1": 2.15, "m1_pct_ref": 77, "ref": 2.77, "lln": 2.23},
            {"label": "MFev1/MFvc", "key": "mejor_fev1_fvc_pct", "m1": 92.13, "m1_pct_ref": 110, "ref": 83.67, "lln": 76.27},
            {"label": "FVC", "key": "fvc_l", "m1": 2.30, "m2": 2.33, "m3": 2.26, "m1_pct_ref": 69, "m2_pct_ref": 70, "m3_pct_ref": 68, "ref": 3.32, "lln": 2.69},
            {"label": "FEV1", "key": "fev1_l", "m1": 2.15, "m2": 2.11, "m3": 2.09, "m1_pct_ref": 77, "m2_pct_ref": 76, "m3_pct_ref": 75, "ref": 2.77, "lln": 2.23},
        ],
    }

    c = compute_espirometry_ami_criteria(payload)
    assert c["repetibilidad_ami"]["fvc_ml"] == 30.0
    assert c["repetibilidad_ami"]["fev1_ml"] == 40.0
    assert c["repetibilidad_ami"]["cumple_criterio_ami"] is True
    assert c["calidad_tecnica"]["grado_calidad_derivado"] == "A"
    assert c["algoritmo_ami"]["patron_ami"] == "PATRON_ESPIROMETRICO_SUGESTIVO_DE_RESTRICCION"


def test_case3_espiro_ob_obstructivo_leve_con_bd_recomendada():
    """ESPIRO OB.png (VINIEGRA DIAZ LUIS EDUARDO): FEV1/FVC 71.08 < LLN 74.59, FVC 93%, FEV1 79% -> Obstructivo Leve."""
    payload = {
        "calidad": {"repetibilidad_ats_ers_fvc": "Si", "repetibilidad_ats_ers_fev1": "Si"},
        "parametros": [
            {"label": "Mejor FVC", "key": "mejor_fvc_l", "m1": 5.91, "m1_pct_ref": 93, "ref": 6.33, "lln": 5.28},
            {"label": "Mejor FEV1", "key": "mejor_fev1_l", "m1": 4.20, "m1_pct_ref": 79, "ref": 5.29, "lln": 4.40},
            {"label": "MFev1/MFvc", "key": "mfev1_mfvc_pct", "m1": 71.08, "m1_pct_ref": 85, "ref": 83.68, "lln": 74.59},
            {"label": "FVC", "key": "fvc_l", "m1": 5.91, "m2": 5.85, "m3": 5.90, "ref": 6.33, "lln": 5.28},
            {"label": "FEV1", "key": "fev1_l", "m1": 4.16, "m2": 4.20, "m3": 4.14, "ref": 5.29, "lln": 4.40},
            {"label": "FET100%", "key": "fet100_s", "m1": 8.82, "m2": 7.69, "m3": 10.11},
        ],
    }

    c = compute_espirometry_ami_criteria(payload)
    alg = c["algoritmo_ami"]
    assert c["repetibilidad_ami"]["fvc_ml"] == 10.0
    assert c["repetibilidad_ami"]["fev1_ml"] == 40.0
    assert c["calidad_tecnica"]["fet100_cumple_6s"] is True
    assert alg["paso_1_aceptable_repetible"] is True
    assert alg["fev1_fvc_bajo_lin"] is True
    assert alg["fvc_normal_ami"] is True
    assert alg["patron_ami"] == "PATRON_ESPIROMETRICO_OBSTRUCTIVO"
    assert alg["grado_obstruccion_ami"] == "LEVE"
    assert alg["considerar_broncodilatador"] is True
    assert alg["requiere_confirmacion_restriccion_tlc"] is False


def test_case4_escala_gravedad_obstruccion_ami():
    """Cubre los 5 grados del algoritmo AMI (diapositiva 2)."""
    assert _clasificar_severidad_fev1_ami(85.0) == "LEVE"
    assert _clasificar_severidad_fev1_ami(70.0) == "LEVE"
    assert _clasificar_severidad_fev1_ami(65.0) == "MODERADA"
    assert _clasificar_severidad_fev1_ami(55.0) == "MODERADAMENTE GRAVE"
    assert _clasificar_severidad_fev1_ami(40.0) == "GRAVE"
    assert _clasificar_severidad_fev1_ami(30.0) == "MUY GRAVE"


def test_case5_espirometria_normal():
    """FEV1/FVC >= LIN y FVC > 80% y >= LLN -> PATRON_ESPIROMETRICO_NORMAL."""
    payload = {
        "parametros": [
            {"label": "Mejor FVC", "key": "mejor_fvc_l", "m1": 4.50, "m1_pct_ref": 96, "ref": 4.68, "lln": 3.85},
            {"label": "Mejor FEV1", "key": "mejor_fev1_l", "m1": 3.70, "m1_pct_ref": 95, "ref": 3.90, "lln": 3.15},
            {"label": "FEV1/FVC", "key": "fev1_fvc_pct", "m1": 82.22, "ref": 83.0, "lln": 73.0},
            {"label": "FVC", "key": "fvc_l", "m1": 4.48, "m2": 4.50, "m3": 4.46},
            {"label": "FEV1", "key": "fev1_l", "m1": 3.68, "m2": 3.70, "m3": 3.66},
        ],
    }
    c = compute_espirometry_ami_criteria(payload)
    assert c["repetibilidad_ami"]["cumple_criterio_ami"] is True
    assert c["algoritmo_ami"]["patron_ami"] == "PATRON_ESPIROMETRICO_NORMAL"
    assert c["algoritmo_ami"]["grado_obstruccion_ami"] is None


def test_case6_patron_mixto_obstructivo_con_fvc_reducida():
    """FEV1/FVC < LIN y FVC <= 80% -> PATRON_OBSTRUCTIVO_CON_FVC_REDUCIDA_POSIBLE_MIXTO."""
    payload = {
        "parametros": [
            {"label": "Mejor FVC", "key": "mejor_fvc_l", "m1": 2.90, "m1_pct_ref": 68, "ref": 4.26, "lln": 3.50},
            {"label": "Mejor FEV1", "key": "mejor_fev1_l", "m1": 1.75, "m1_pct_ref": 52, "ref": 3.36, "lln": 2.70},
            {"label": "FEV1/FVC", "key": "fev1_fvc_pct", "m1": 60.34, "ref": 79.0, "lln": 70.0},
            {"label": "FVC", "key": "fvc_l", "m1": 2.88, "m2": 2.90, "m3": 2.85},
            {"label": "FEV1", "key": "fev1_l", "m1": 1.72, "m2": 1.75, "m3": 1.70},
        ],
    }
    c = compute_espirometry_ami_criteria(payload)
    alg = c["algoritmo_ami"]
    assert alg["patron_ami"] == "PATRON_OBSTRUCTIVO_CON_FVC_REDUCIDA_POSIBLE_MIXTO"
    assert alg["grado_obstruccion_ami"] == "MODERADAMENTE GRAVE"
    assert alg["considerar_broncodilatador"] is True
    assert alg["requiere_confirmacion_restriccion_tlc"] is True


def test_case7_falla_repetibilidad_ami_mayor_150ml():
    """Cuando la diferencia real supera 150 ml -> CALIDAD_INSUFICIENTE_REPETIR."""
    payload = {
        "parametros": [
            {"label": "FVC", "key": "fvc_l", "m1": 4.10, "m2": 3.90, "m3": 3.70, "m1_pct_ref": 88, "lln": 3.50},
            {"label": "FEV1", "key": "fev1_l", "m1": 3.30, "m2": 3.25, "m3": 3.10, "m1_pct_ref": 86, "lln": 2.80},
            {"label": "FEV1/FVC", "key": "fev1_fvc_pct", "m1": 80.5, "lln": 72.0},
        ],
    }
    c = compute_espirometry_ami_criteria(payload)
    assert c["repetibilidad_ami"]["fvc_ml"] == 200.0
    assert c["repetibilidad_ami"]["fvc_menor_150"] == "NO"
    assert c["repetibilidad_ami"]["cumple_criterio_ami"] is False
    assert c["algoritmo_ami"]["paso_1_aceptable_repetible"] is False
    assert c["algoritmo_ami"]["patron_ami"] == "CALIDAD_INSUFICIENTE_REPETIR"


def test_case8_guarda_inconsistencia_tabular_invalida_repetibilidad():
    """Si Mejor FEV1 > max(FEV1 m1..m3) o nota SOSPECHA_INCONSISTENCIA_MEJOR_FEV1, invalida cálculo espurio."""
    payload = {
        "notas_calidad": "SOSPECHA_INCONSISTENCIA_MEJOR_FEV1: duplicación M2=M1",
        "calidad": {"repetibilidad_fvc_ml": None, "repetibilidad_fev1_ml": None},
        "parametros": [
            {"label": "Mejor FVC", "key": "mejor_fvc_l", "m1": 2.33},
            {"label": "FVC", "key": "fvc_l", "m1": 2.30, "m2": 2.33, "m3": 2.26},
            {"label": "Mejor FEV1", "key": "mejor_fev1_l", "m1": 2.15},
            {"label": "FEV1", "key": "fev1_l", "m1": 2.11, "m2": 2.11, "m3": 2.09},
            {"label": "FEV1/FVC", "key": "fev1_fvc_pct", "m1": 92.13, "lln": 76.27},
        ],
    }
    c = compute_espirometry_ami_criteria(payload)
    rep = c["repetibilidad_ami"]
    assert rep["inconsistencia_tabular_fev1"] is True
    assert rep["fev1_ml"] is None
    assert rep["fev1_menor_150"] is None
    assert rep["cumple_criterio_ami"] is False
    assert c["algoritmo_ami"]["paso_1_aceptable_repetible"] is False
    assert c["algoritmo_ami"]["patron_ami"] == "CALIDAD_INSUFICIENTE_REPETIR"


@patch("app.services.ai.prediagnostic._medgemma_enabled", return_value=True)
@patch(
    "app.services.ai.prediagnostic._resolve_m3_clinical_config",
    return_value={
        "api_key": "fake-key",
        "base_url": "https://api.minimax.io/v1",
        "model": "MiniMax-M3.1-Flash",
        "key_source": "test",
        "warning": None,
    },
)
@patch.object(PrediagnosticService, "_call_m3_clinical_chat")
def test_case9_prediagnostic_service_inyecta_interpretacion_derivada_ami_sin_mutar(
    mock_chat, _mock_cfg, _mock_enabled
):
    """PrediagnosticService inyecta `interpretacion_derivada_ami` en rendered_prompt y no muta el input."""
    mock_chat.return_value = {
        "summary": "Patrón espirométrico sugestivo de restricción con FEV1/FVC 91.03%.",
        "confidence": 0.78,
        "clinical_state": "AI_PENDING_REVIEW",
        "justification": ["AMI Paso 1 cumple ≤ 150 ml", "AMI Paso 2 FVC 70% ≤ 80%"],
        "clinical_basis": [],
        "citations": [],
        "limitations": ["FET100% 4.42 s (< 6 s)."],
        "red_flags": [],
        "recommendation": "Confirmar con pletismografía/TLC y correlacionar con radiografía de tórax PA.",
        "non_conclusive_reason": None,
    }
    original_payload = {
        "fvc": 3.01,
        "fev1": 2.74,
        "fev1_fvc_ratio": 0.9103,
        "fvc_percent_predicho": 70,
        "fev1_percent_predicho": 79,
        "calidad": {
            "repetibilidad_fvc_ml": None,
            "repetibilidad_fev1_ml": None,
            "repetibilidad_fvc_menor_150": None,
            "repetibilidad_fev1_menor_150": None,
        },
        "parametros": [
            {"label": "FVC", "key": "fvc_l", "m1": 3.01, "m2": 3.01, "m3": 2.86, "m1_pct_ref": 70, "lln": 3.56},
            {"label": "FEV1", "key": "fev1_l", "m1": 2.74, "m2": 2.73, "m3": 2.59, "m1_pct_ref": 79, "lln": 2.84},
            {"label": "FEV1/FVC", "key": "fev1_fvc_pct", "m1": 91.03, "lln": 72.62},
        ],
    }
    snapshot_before = deepcopy(original_payload)

    svc = PrediagnosticService(api_key="fake-gemini-key")
    res = svc.generate_prediagnosis(
        study_type="Espirometria",
        extracted_data=original_payload,
        ai_calibration={
            "enabled": True,
            "canonicalStudyType": "Espirometria",
            "diagnosis": {
                "prompt": "Criterios AMI:\n{extracted_json}",
                "version": "espirometria-prediagnosis-v4",
            },
        },
    )

    assert original_payload == snapshot_before
    assert "interpretacion_derivada_ami" not in original_payload
    assert res.input_debug is not None
    rendered = res.input_debug.rendered_prompt or ""
    assert "interpretacion_derivada_ami" in rendered
    assert "PATRON_ESPIROMETRICO_SUGESTIVO_DE_RESTRICCION" in rendered
    assert enrich_espirometry_extracted_data(original_payload)["calidad"]["repetibilidad_fev1_ml"] == 10.0
