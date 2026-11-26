"""Pruebas unitarias para criterios deterministas ECG, normalización de unidades e inyección en prediagnóstico."""

from copy import deepcopy
from unittest.mock import patch

from app.ecg_criteria import compute_ecg_clinical_criteria, enrich_ecg_extracted_data
from app.schemas.medical import ElectrocardiogramaData
from app.services.ai.extractor import ExtractorService
from app.services.ai.prediagnostic import PrediagnosticService


def test_compute_ecg_criteria_normal_y_bazett_desde_cuadricula():
    criteria = compute_ecg_clinical_criteria({
        "ritmo": "Sinusal",
        "ritmicidad": "rítmico",
        "frecuencia_bpm": 72,
        "duracion_p_ms": 80,
        "intervalo_pr_ms": 160,
        "duracion_qrs_ms": 80,
        "qt_ms": 360,
        "qtc_ms": None,
        "eje_electrico": "Normal",
        "eje_grados": 45,
        "segmento_st": "isoeléctrico, sin alteraciones significativas",
        "onda_t": "positiva en todas las derivaciones excepto en aVR",
        "onda_q_patologica": "No presencia de onda Q patológica",
        "calibracion_papel": "25 mm/s, 10 mm/mV",
        "derivaciones_visibles": ["I", "II", "III", "aVR", "aVL", "aVF", "V1", "V2", "V3", "V4", "V5", "V6"],
        "origen_mediciones": "cuadricula_visual",
    })

    dom = criteria["clasificacion_dominios"]
    med = criteria["parametros_medidos"]
    cal = criteria["calidad_y_fuente"]

    assert dom["frecuencia_cardiaca"] == "NORMAL"
    assert dom["onda_p"] == "NORMAL"
    assert dom["intervalo_pr"] == "NORMAL"
    assert dom["complejo_qrs"] == "NORMAL"
    assert dom["eje_electrico"] == "NORMAL"
    assert dom["segmento_st"] == "NORMAL"
    assert dom["onda_t"] == "NORMAL"
    assert dom["onda_q_patologica"] == "AUSENTE"
    assert med["qtc_ms_bazett_calculado"] == 394
    assert med["qtc_ms_efectivo"] == 394
    assert dom["repolarizacion_qtc"] == "NORMAL"
    assert cal["derivaciones_visibles_count"] == 12
    assert cal["requiere_verificacion_mediciones_cuadricula"] is True
    assert criteria["alertas_electricas"] == []


def test_compute_ecg_criteria_detecta_alertas_y_qtc_critico():
    criteria = compute_ecg_clinical_criteria({
        "ritmo": "Sinusal",
        "frecuencia_bpm": 46,
        "intervalo_pr_ms": 225,
        "duracion_qrs_ms": 132,
        "qtc_ms": 512,
        "eje_grados": -45,
        "segmento_st": "Supradesnivel del segmento ST en V2-V3",
        "onda_t": "Onda T invertida en V2-V4",
        "onda_q_patologica": "Presencia de onda Q patológica en DIII y aVF",
    })

    dom = criteria["clasificacion_dominios"]
    assert dom["frecuencia_cardiaca"] == "BRADICARDIA_MARCADA"
    assert dom["intervalo_pr"] == "PROLONGADO_SUGESTIVO_BAV_PRIMER_GRADO"
    assert dom["complejo_qrs"] == "ANCHO_TRASTORNO_CONDUCCION_INTRAVENTRICULAR"
    assert dom["eje_electrico"] == "DESVIACION_IZQUIERDA"
    assert dom["repolarizacion_qtc"] == "CRITICO_RIESGO_ARRITMICO"
    assert dom["segmento_st"] == "ALTERADO"
    assert dom["onda_t"] == "ALTERADA"
    assert dom["onda_q_patologica"] == "PRESENTE"
    assert len(criteria["alertas_electricas"]) >= 5


def test_extractor_normaliza_unidades_y_campos_extendidos_ecg():
    ext = ExtractorService(api_key="fake-gemini")
    raw = {
        "paciente": None,
        "fecha_estudio": "24/03/2026",
        "ritmicidad": "rítmico",
        "ritmo": "Sinusal",
        "frecuencia_bpm": "75 lpm",
        "duracion_p_ms": "80 mseg",
        "intervalo_pr_ms": "160 ms",
        "duracion_qrs_ms": "80 ms",
        "qt_ms": "360 ms",
        "qtc_ms": "402 ms",
        "eje_electrico": "Normal (+45°)",
        "eje_grados": "+45°",
        "segmento_st": "isoeléctrico, sin alteraciones significativas",
        "onda_t": "positiva en todas las derivaciones excepto en aVR",
        "onda_q_patologica": "No presencia de onda Q patológica",
        "origen_mediciones": "cuadricula_visual",
        "hallazgos": "Trazado regular en hoja con 3 tiras térmicas.",
        "derivaciones_visibles": "I, II, III, aVR, aVL, aVF, V1, V2, V3, V4, V5, V6",
    }

    with patch.object(
        ext,
        "_call_with_dispatch",
        return_value=(raw, "m3", None),
    ):
        parsed = ext.extract_by_type(
            "/fake/ecg.pdf",
            "Electrocardiograma",
            ai_calibration={
                "enabled": True,
                "extraction": {
                    "provider": "m3",
                    "prompt": "Extrae ECG en JSON.",
                    "version": "ecg-ami-strip-v2",
                },
            },
        )

    assert isinstance(parsed, ElectrocardiogramaData)
    assert parsed.paciente == ""
    assert parsed.frecuencia_bpm == 75
    assert parsed.duracion_p_ms == 80
    assert parsed.intervalo_pr_ms == 160
    assert parsed.duracion_qrs_ms == 80
    assert parsed.qtc_ms == 402
    assert parsed.eje_grados == 45
    assert parsed.origen_mediciones == "cuadricula_visual"
    assert len(parsed.derivaciones_visibles or []) == 12
    assert parsed.hallazgos == ["Trazado regular en hoja con 3 tiras térmicas."]


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
def test_prediagnostic_inyecta_interpretacion_derivada_ecg_sin_mutar(
    mock_chat, _mock_cfg, _mock_enabled
):
    mock_chat.return_value = {
        "summary": "Electrocardiograma en ritmo sinusal con FC 72 lpm y conducción conservada.",
        "confidence": 0.78,
        "clinical_state": "AI_PENDING_REVIEW",
        "justification": [
            "Ritmo sinusal regular con FC 72 lpm",
            "Onda P 80 ms y PR 160 ms dentro de rango",
            "QRS 80 ms y QTc 394 ms sin alteraciones ST-T",
        ],
        "clinical_basis": [
            {"principle": "AHA/ACC ECG", "applied_parameters": ["ritmo", "frecuencia_bpm", "qtc_ms"]}
        ],
        "citations": ["AHA-ECG-2022"],
        "limitations": ["Mediciones estimadas desde cuadrícula de tira térmica."],
        "red_flags": [],
        "recommendation": "Verificar mediciones editables y correlacionar con exploración física.",
        "non_conclusive_reason": None,
    }
    payload = {
        "ritmo": "Sinusal",
        "frecuencia_bpm": 72,
        "duracion_p_ms": 80,
        "intervalo_pr_ms": 160,
        "duracion_qrs_ms": 80,
        "qt_ms": 360,
        "eje_electrico": "Normal",
        "eje_grados": 45,
        "origen_mediciones": "cuadricula_visual",
    }
    snapshot_before = deepcopy(payload)

    svc = PrediagnosticService(api_key="fake-gemini")
    res = svc.generate_prediagnosis(
        study_type="Electrocardiograma",
        extracted_data=payload,
        ai_calibration={
            "enabled": True,
            "canonicalStudyType": "Electrocardiograma",
            "diagnosis": {
                "prompt": "Analiza ECG:\n{extracted_json}",
                "version": "predx-ecg-extended-v2",
            },
        },
    )

    assert payload == snapshot_before
    assert "interpretacion_derivada_ecg" not in payload
    assert res.clinical_state == "AI_PENDING_REVIEW"
    assert res.citations[0].source_id == "AHA-ECG-2022"
    assert "interpretacion_derivada_ecg" in (res.input_debug.rendered_prompt or "")
    assert enrich_ecg_extracted_data(payload)["interpretacion_derivada_ecg"]["parametros_medidos"]["qtc_ms_bazett_calculado"] == 394
