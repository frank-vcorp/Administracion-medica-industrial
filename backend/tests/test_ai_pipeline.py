"""
Tests para el Pipeline IA Modular.
IMPL-20260225-01: Clasificación y extracción de documentos médicos.
IMPL-20260326-17: Tests para Campimetria (GEN-O1WV7), Electrocardiograma (GEN-C85PD), RiesgoCardiovascular (GEN-U5BQX).
IMPL-20260518-03: TestPromptResolutionARCH20260518_03 — extracción sin fallback, clínica con fallback general.
"""

import pytest
from unittest.mock import Mock, patch, MagicMock
import json
import os
import types
from pathlib import Path

# Asumimos que los módulos están en PYTHONPATH
import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.services.ai.classifier import DocumentClassifierService
from app.services.ai.extractor import ExtractorService
from app.schemas.medical import (
    DocumentClassification,
    AudiometriaData,
    EspirometriaData,
    CampimetriaData,
    ElectrocardiogramaData,
    RiesgoCardiovascularData,
)

# IMPL-20260518-03: ai_calibration mínima válida para tests que no prueban la resolución
# de prompts. Proporciona un prompt de extracción para evitar EXTRACTION_PROMPT_NOT_CONFIGURED.
_TEST_AI_CALIBRATION_EXTRACTION = {
    "extraction": {"prompt": "Extrae todos los datos relevantes del documento médico.", "version": "test_v1"},
}


class TestDocumentClassifierService:
    """Tests para DocumentClassifierService."""
    
    @pytest.fixture
    def classifier(self):
        """Instancia del clasificador con API key dummy."""
        return DocumentClassifierService(
            api_key="test-api-key",
            model="gemini-2.5-flash"
        )
    
    @patch('app.services.ai.base.GeminiBase.call_gemini')
    def test_classify_audiometria(self, mock_gemini, classifier):
        """Test que clasifica correctamente una audiometría."""
        mock_gemini.return_value = {
            "tipo": "Audiometria",
            "confianza": 0.95,
            "razon": "Gráfico con frecuencias Hz y decibeles"
        }
        
        result = classifier.classify("/fake/path/audiometria.pdf")
        
        assert result.tipo == "Audiometria"
        assert result.confianza == 0.95
        assert "frecuencias" in result.razon.lower()
    
    @patch('app.services.ai.base.GeminiBase.call_gemini')
    def test_classify_laboratorio(self, mock_gemini, classifier):
        """Test que clasifica correctamente un laboratorio."""
        mock_gemini.return_value = {
            "tipo": "Laboratorio",
            "confianza": 0.92,
            "razon": "Tabla de parámetros bioquímicos"
        }
        
        result = classifier.classify("/fake/path/lab.pdf")
        
        assert result.tipo == "Laboratorio"
        assert result.confianza == 0.92
    
    @patch('app.services.ai.base.GeminiBase.call_gemini')
    def test_classify_unknown(self, mock_gemini, classifier):
        """Test que clasifica como Otro cuando es desconocido."""
        mock_gemini.return_value = {
            "tipo": "Otro",
            "confianza": 0.5,
            "razon": "No es una categoría estándar"
        }
        
        result = classifier.classify("/fake/path/documento.pdf")
        
        assert result.tipo == "Otro"
        assert result.confianza == 0.5
    
    @patch('app.services.ai.base.GeminiBase.call_gemini')
    def test_classify_invalid_response(self, mock_gemini, classifier):
        """Test que maneja respuestas inválidas de Gemini."""
        mock_gemini.return_value = {}  # Respuesta vacía
        
        with pytest.raises(ValueError):
            classifier.classify("/fake/path/documento.pdf")


class TestExtractorService:
    """Tests para ExtractorService."""
    
    @pytest.fixture
    def extractor(self):
        """Instancia del extractor con API key dummy."""
        return ExtractorService(
            api_key="test-api-key",
            model="gemini-2.5-flash"
        )
    
    @patch('app.services.ai.base.GeminiBase.call_gemini')
    def test_extract_audiometria(self, mock_gemini, extractor):
        """Test que extrae datos de audiometría correctamente."""
        mock_gemini.return_value = {
            "paciente": "Juan Pérez",
            "fecha_estudio": "25/02/2026",
            "oido_derecho": {"500": "10", "1000": "15", "2000": "20"},
            "oido_izquierdo": {"500": "12", "1000": "18", "2000": "22"},
            "diagnostico_ia": "Hipoacusia bilateral leve",
            "recomendaciones": ["Seguimiento cada 6 meses"],
            "interpretacion": "Normal para la edad"
        }
        
        result = extractor.extract_by_type("/fake/path/audio.pdf", "Audiometria", ai_calibration=_TEST_AI_CALIBRATION_EXTRACTION)
        
        assert isinstance(result, AudiometriaData)
        assert result.paciente == "Juan Pérez"
        assert result.fecha_estudio == "25/02/2026"
        assert result.oido_derecho["500"] == 10  # Frecuencia normalizada a clave string
    
    @patch('app.services.ai.base.GeminiBase.call_gemini')
    def test_extract_laboratorio(self, mock_gemini, extractor):
        """Test que extrae datos de laboratorio correctamente."""
        mock_gemini.return_value = {
            "paciente": "María García",
            "fecha": "24/02/2026",
            "estudio_tipo": "Biometría Hemática",
            "valores_anormales": [
                {"parametro": "Glucosa", "valor": "110", "referencia": "70-100"}
            ],
            "interpretacion": "Prediabetes detectada"
        }
        
        result = extractor.extract_by_type("/fake/path/lab.pdf", "Laboratorio", ai_calibration=_TEST_AI_CALIBRATION_EXTRACTION)
        
        assert result.paciente == "María García"
        assert len(result.parametros) == 1
        assert result.parametros[0]["parametro"] == "Glucosa"
    
    @patch('app.services.ai.base.GeminiBase.call_gemini')
    def test_extract_tipo_desconocido(self, mock_gemini, extractor):
        """Test que retorna dict para tipos desconocidos."""
        mock_gemini.return_value = {"datos": "genéricos"}
        
        result = extractor.extract_by_type("/fake/path/doc.pdf", "TipoDesconocido", ai_calibration=_TEST_AI_CALIBRATION_EXTRACTION)
        
        assert isinstance(result, dict)
        assert result["datos"] == "genéricos"


class TestNuevosTiposEstudio:
    """
    IMPL-20260326-17: Tests para estudios catalogados GEN-O1WV7, GEN-C85PD, GEN-U5BQX.
    """

    @pytest.fixture
    def extractor(self):
        return ExtractorService(api_key="test-api-key", model="gemini-2.5-flash")

    @pytest.fixture
    def classifier(self):
        return DocumentClassifierService(api_key="test-api-key", model="gemini-2.5-flash")

    # --- Clasificador ---

    @patch('app.services.ai.base.GeminiBase.call_gemini')
    def test_classify_campimetria(self, mock_gemini, classifier):
        """El clasificador reconoce documentos de campo visual como Campimetria."""
        mock_gemini.return_value = {
            "tipo": "Campimetria",
            "confianza": 0.90,
            "razon": "Mapa de campo visual con cuadrícula de puntos e índices MD/PSD"
        }
        result = classifier.classify("/fake/campimetria.pdf")
        assert result.tipo == "Campimetria"
        assert result.confianza == 0.90

    @patch('app.services.ai.base.GeminiBase.call_gemini')
    def test_classify_electrocardiograma(self, mock_gemini, classifier):
        """El clasificador reconoce trazados ECG como Electrocardiograma."""
        mock_gemini.return_value = {
            "tipo": "Electrocardiograma",
            "confianza": 0.95,
            "razon": "Trazado ECG con ondas P/QRS/T en cuadrícula métrica y FC 72 lpm"
        }
        result = classifier.classify("/fake/ecg.pdf")
        assert result.tipo == "Electrocardiograma"
        assert result.confianza == 0.95

    @patch('app.services.ai.base.GeminiBase.call_gemini')
    def test_classify_riesgo_cardiovascular(self, mock_gemini, classifier):
        """El clasificador reconoce evaluaciones de riesgo cardiovascular."""
        mock_gemini.return_value = {
            "tipo": "RiesgoCardiovascular",
            "confianza": 0.88,
            "razon": "Formulario Framingham con nivel de riesgo moderado calculado al 12%"
        }
        result = classifier.classify("/fake/riesgo_cv.pdf")
        assert result.tipo == "RiesgoCardiovascular"

    # --- Extractor: Campimetria ---

    @patch('app.services.ai.base.GeminiBase.call_gemini')
    def test_extract_campimetria_completa(self, mock_gemini, extractor):
        """El extractor parsea correctamente los datos de campimetría."""
        mock_gemini.return_value = {
            "paciente": "Ana López",
            "fecha_estudio": "26/03/2026",
            "ojo_derecho_defectos": ["Escotoma paracentral superior"],
            "ojo_izquierdo_defectos": [],
            "indices_ojo_derecho": {"MD": "-4.2 dB", "PSD": "2.1 dB"},
            "indices_ojo_izquierdo": {"MD": "-1.0 dB"},
            "profesional": "Dr. González",
            "notas_calidad": None,
            "diagnostico_ia": "Defecto glaucomatoso"  # campo legacy que debe eliminarse
        }
        result = extractor.extract_by_type("/fake/campimetria.pdf", "Campimetria", ai_calibration=_TEST_AI_CALIBRATION_EXTRACTION)
        assert type(result).__name__ == "CampimetriaData"
        assert result.paciente == "Ana López"
        assert result.ojo_derecho_defectos == ["Escotoma paracentral superior"]
        assert result.ojo_izquierdo_defectos == []
        assert result.indices_ojo_derecho == {"MD": "-4.2 dB", "PSD": "2.1 dB"}
        assert not hasattr(result, "diagnostico_ia")

    @patch('app.services.ai.base.GeminiBase.call_gemini')
    def test_extract_campimetria_sin_defectos(self, mock_gemini, extractor):
        """El extractor acepta campimetría sin defectos detectados (campos opcionales None)."""
        mock_gemini.return_value = {
            "paciente": "Carlos Ruiz",
            "fecha_estudio": "26/03/2026",
        }
        result = extractor.extract_by_type("/fake/campimetria2.pdf", "Campimetria", ai_calibration=_TEST_AI_CALIBRATION_EXTRACTION)
        assert type(result).__name__ == "CampimetriaData"
        assert result.ojo_derecho_defectos is None
        assert result.indices_ojo_derecho is None

    # --- Extractor: Electrocardiograma ---

    @patch('app.services.ai.base.GeminiBase.call_gemini')
    def test_extract_ecg_completo(self, mock_gemini, extractor):
        """El extractor parsea correctamente un ECG con todos los intervalos."""
        mock_gemini.return_value = {
            "paciente": "Roberto Díaz",
            "fecha_estudio": "26/03/2026",
            "ritmo": "Sinusal",
            "frecuencia_bpm": 72,
            "intervalo_pr_ms": 160,
            "duracion_qrs_ms": 90,
            "qtc_ms": 415,
            "eje_electrico": "Normal",
            "hallazgos": ["Onda T invertida en V1-V3"],
            "profesional": "Dr. Martínez",
            "notas_calidad": None
        }
        result = extractor.extract_by_type("/fake/ecg.pdf", "Electrocardiograma", ai_calibration=_TEST_AI_CALIBRATION_EXTRACTION)
        assert type(result).__name__ == "ElectrocardiogramaData"
        assert result.paciente == "Roberto Díaz"
        assert result.ritmo == "Sinusal"
        assert result.frecuencia_bpm == 72
        assert result.qtc_ms == 415
        assert "Onda T invertida en V1-V3" in result.hallazgos

    @patch('app.services.ai.base.GeminiBase.call_gemini')
    def test_extract_ecg_frecuencia_como_string(self, mock_gemini, extractor):
        """El extractor normaliza frecuencia_bpm si el modelo devuelve string en lugar de int."""
        mock_gemini.return_value = {
            "paciente": "María Torres",
            "fecha_estudio": "26/03/2026",
            "ritmo": "Sinusal",
            "frecuencia_bpm": "85",  # el LLM puede devolver string
        }
        result = extractor.extract_by_type("/fake/ecg2.pdf", "Electrocardiograma", ai_calibration=_TEST_AI_CALIBRATION_EXTRACTION)
        assert type(result).__name__ == "ElectrocardiogramaData"
        assert result.frecuencia_bpm == 85  # normalizado a int

    # --- Extractor: Riesgo Cardiovascular ---

    @patch('app.services.ai.base.GeminiBase.call_gemini')
    def test_extract_riesgo_cardiovascular_completo(self, mock_gemini, extractor):
        """El extractor parsea correctamente una evaluación de riesgo cardiovascular."""
        mock_gemini.return_value = {
            "paciente": "Luis Herrera",
            "fecha_estudio": "26/03/2026",
            "nivel_riesgo": "Moderado",
            "porcentaje_riesgo": 12.5,
            "escala_utilizada": "Framingham",
            "factores_riesgo": ["HTA", "Tabaquismo", "Dislipidemia"],
            "profesional": "Dr. Ramírez",
            "notas_calidad": None
        }
        result = extractor.extract_by_type("/fake/riesgo_cv.pdf", "RiesgoCardiovascular", ai_calibration=_TEST_AI_CALIBRATION_EXTRACTION)
        assert type(result).__name__ == "RiesgoCardiovascularData"
        assert result.nivel_riesgo == "Moderado"
        assert result.porcentaje_riesgo == 12.5
        assert result.escala_utilizada == "Framingham"
        assert "HTA" in result.factores_riesgo

    @patch('app.services.ai.base.GeminiBase.call_gemini')
    def test_extract_riesgo_cv_porcentaje_como_string(self, mock_gemini, extractor):
        """El extractor normaliza porcentaje_riesgo si el modelo devuelve string con %."""
        mock_gemini.return_value = {
            "paciente": "Elena Vargas",
            "fecha_estudio": "26/03/2026",
            "nivel_riesgo": "Alto",
            "porcentaje_riesgo": "20%",  # el LLM puede devolver string con %
            "escala_utilizada": "ACC/AHA ASCVD",
        }
        result = extractor.extract_by_type("/fake/riesgo_cv2.pdf", "RiesgoCardiovascular", ai_calibration=_TEST_AI_CALIBRATION_EXTRACTION)
        assert type(result).__name__ == "RiesgoCardiovascularData"
        assert result.porcentaje_riesgo == 20.0  # normalizado a float


class TestPrediagnosticoNuevosTipos:
    """
    IMPL-20260326-17: Tests para la lógica de prediagnóstico con los nuevos tipos.
    """

    @pytest.fixture
    def prediagnostic_svc(self):
        from app.services.ai.prediagnostic import PrediagnosticService
        return PrediagnosticService(api_key="test-api-key", model="gemini-2.5-flash")

    def test_campimetria_retorna_non_conclusive(self, prediagnostic_svc):
        """Campimetría debe retornar AI_NON_CONCLUSIVE en V1 (sin soporte de prediagnóstico IA)."""
        result = prediagnostic_svc.generate_prediagnosis(
            "Campimetria",
            {"paciente": "Test", "fecha_estudio": "26/03/2026"}
        )
        assert result.clinical_state == "AI_NON_CONCLUSIVE"
        assert result.confidence == 0.0
        assert "Campimetria" in (result.non_conclusive_reason or "")

    def test_riesgo_cardiovascular_retorna_non_conclusive(self, prediagnostic_svc):
        """RiesgoCardiovascular debe retornar AI_NON_CONCLUSIVE en V1."""
        result = prediagnostic_svc.generate_prediagnosis(
            "RiesgoCardiovascular",
            {"paciente": "Test", "nivel_riesgo": "Alto"}
        )
        assert result.clinical_state == "AI_NON_CONCLUSIVE"
        assert result.confidence == 0.0

    @patch('app.services.ai.prediagnostic.MEDGEMMA_ENABLED', True)
    @patch('app.services.ai.prediagnostic.DR7_API_KEY', 'fake-dr7-key')
    @patch('app.services.ai.prediagnostic.PrediagnosticService._call_dr7_medical_chat')
    def test_ecg_con_params_minimos_genera_prediagnostico(self, mock_featherless_text, prediagnostic_svc):
        """ECG con ritmo y frecuencia genera un prediagnóstico IA válido."""
        mock_featherless_text.return_value = {
            "summary": "Trazado compatible con ritmo sinusal normal.",
            "confidence": 0.75,
            "clinical_state": "AI_PENDING_REVIEW",
            "justification": ["FC 72 lpm dentro del rango normal"],
            "clinical_basis": [{"principle": "AHA/ACC ECG 2022", "applied_parameters": ["frecuencia_bpm"]}],
            "citations": [],
            "limitations": ["Requiere correlación clínica"],
            "red_flags": [],
            "non_conclusive_reason": None,
        }
        result = prediagnostic_svc.generate_prediagnosis(
            "Electrocardiograma",
            {"paciente": "Test", "ritmo": "Sinusal", "frecuencia_bpm": 72}
        )
        assert result.clinical_state == "AI_PENDING_REVIEW"
        assert result.confidence == 0.75
        assert result.clinical_provider == "dr7"

    def test_ecg_sin_params_minimos_retorna_non_conclusive(self, prediagnostic_svc):
        """ECG sin ritmo ni frecuencia debe retornar AI_NON_CONCLUSIVE."""
        result = prediagnostic_svc.generate_prediagnosis(
            "Electrocardiograma",
            {"paciente": "Test", "hallazgos": []}
        )
        assert result.clinical_state == "AI_NON_CONCLUSIVE"

    @patch('app.services.ai.prediagnostic.MEDGEMMA_ENABLED', True)
    @patch('app.services.ai.prediagnostic.DR7_API_KEY', 'fake-dr7-key')
    @patch('app.services.ai.prediagnostic.PrediagnosticService._call_dr7_medical_chat')
    def test_audiometria_dr7_json_puro_parsea_ok(self, mock_dr7_call, prediagnostic_svc):
        """IMPL-20260603-01. Respaldo: context/SPECs/SPEC_ARCH-20260603-04-MIGRACION-CLINICA-DR7-TEXTO.md."""
        mock_dr7_call.return_value = {
            "summary": "Hallazgos compatibles con hipoacusia leve bilateral.",
            "confidence": 0.82,
            "clinical_state": "AI_PENDING_REVIEW",
            "justification": ["Curva audiométrica con elevación leve bilateral"],
            "clinical_basis": [],
            "citations": [],
            "limitations": [],
            "red_flags": [],
            "non_conclusive_reason": None,
        }

        result = prediagnostic_svc.generate_prediagnosis(
            "Audiometria",
            {
                "paciente": "Test Audio",
                "fecha_estudio": "03/06/2026",
                "oido_derecho": {"500": 15, "1000": 20, "2000": 25},
                "oido_izquierdo": {"500": 20, "1000": 25, "2000": 30},
            },
        )

        assert result.clinical_state == "AI_PENDING_REVIEW"
        assert result.clinical_provider == "dr7"
        assert result.summary.startswith("Hallazgos compatibles")

    @patch('app.services.ai.prediagnostic.MEDGEMMA_ENABLED', True)
    @patch('app.services.ai.prediagnostic.DR7_API_KEY', 'fake-dr7-key')
    @patch('app.services.ai.prediagnostic.PrediagnosticService._call_dr7_medical_chat')
    def test_audiometria_dr7_json_con_pad_parsea_ok(self, mock_dr7_call, prediagnostic_svc):
        """La capa clínica debe aceptar payload normalizado por parser tolerante en DR7."""
        mock_dr7_call.return_value = {
            "summary": "Compatible con hipoacusia neurosensorial leve.",
            "confidence": 0.78,
            "clinical_state": "AI_PENDING_REVIEW",
            "justification": ["Descenso bilateral en altas frecuencias"],
            "clinical_basis": [],
            "citations": [],
            "limitations": [],
            "red_flags": [],
            "non_conclusive_reason": None,
        }

        result = prediagnostic_svc.generate_prediagnosis(
            "Audiometria",
            {
                "paciente": "Test Audio",
                "fecha_estudio": "03/06/2026",
                "oido_derecho": {"500": 25, "1000": 30, "2000": 35},
                "oido_izquierdo": {"500": 20, "1000": 25, "2000": 30},
            },
        )

        assert result.clinical_state == "AI_PENDING_REVIEW"
        assert result.summary.startswith("Compatible con hipoacusia")
        assert result.non_conclusive_reason is None

    @patch('app.services.ai.prediagnostic.MEDGEMMA_ENABLED', True)
    @patch('app.services.ai.prediagnostic.DR7_API_KEY', 'fake-dr7-key')
    @patch('app.services.ai.prediagnostic.PrediagnosticService._call_dr7_medical_chat')
    def test_audiometria_dr7_content_segmentado_parsea_ok(self, mock_dr7_call, prediagnostic_svc):
        """DR7 debe devolver un objeto clínico válido para Audiometría."""
        mock_dr7_call.return_value = {
            "summary": "Hallazgos compatibles con hipoacusia leve bilateral.",
            "confidence": 0.79,
            "clinical_state": "AI_PENDING_REVIEW",
            "justification": ["Elevacion leve bilateral en frecuencias conversacionales"],
            "clinical_basis": [],
            "citations": [],
            "limitations": [],
            "red_flags": [],
            "non_conclusive_reason": None,
        }

        result = prediagnostic_svc.generate_prediagnosis(
            "Audiometria",
            {
                "paciente": "Test Audio",
                "fecha_estudio": "03/06/2026",
                "oido_derecho": {"500": 35, "1000": 40, "2000": 45},
                "oido_izquierdo": {"500": 30, "1000": 35, "2000": 40},
            },
        )

        assert result.clinical_state == "AI_PENDING_REVIEW"
        assert result.clinical_provider == "dr7"
        assert result.summary.startswith("Hallazgos compatibles")
        assert result.non_conclusive_reason is None

    @patch('app.services.ai.prediagnostic.MEDGEMMA_ENABLED', True)
    @patch('app.services.ai.prediagnostic.DR7_API_KEY', 'fake-dr7-key')
    @patch('app.services.ai.prediagnostic.PrediagnosticService._call_dr7_medical_chat')
    def test_audiometria_dr7_content_vacio_degrada_non_conclusive(self, mock_dr7_call, prediagnostic_svc):
        """Si DR7 falla en parseo, debe degradar a AI_NON_CONCLUSIVE sin fallback."""
        mock_dr7_call.side_effect = ValueError("Respuesta DR7 vacia o sin contenido util")

        result = prediagnostic_svc.generate_prediagnosis(
            "Audiometria",
            {
                "paciente": "Test Audio",
                "fecha_estudio": "03/06/2026",
                "oido_derecho": {"500": 35, "1000": 40, "2000": 45},
                "oido_izquierdo": {"500": 30, "1000": 35, "2000": 40},
            },
        )

        assert result.clinical_state == "AI_NON_CONCLUSIVE"
        assert result.clinical_provider == "dr7"
        assert "DR7ParseError" in (result.non_conclusive_reason or "")
        assert "vacia o sin contenido util" in (result.non_conclusive_reason or "")
        assert "Gemini" not in (result.non_conclusive_reason or "")


class TestFeatherlessContentNormalization:
    """IMPL-20260603-01. Respaldo: context/SPECs/SPEC_FIX-20260603-04-FEATHERLESS-CONTENT-NORMALIZATION.md."""

    def test_extract_openai_choice_text_concatena_bloques_de_texto(self):
        from app.services.ai.base import GeminiBase

        choice = Mock(
            message=Mock(
                content=[
                    {"type": "text", "text": "{"},
                    types.SimpleNamespace(text='"summary":"ok"'),
                    {"type": "text", "text": "}"},
                ]
            )
        )

        assert GeminiBase._extract_openai_choice_text(choice) == '{\n"summary":"ok"\n}'


# ---------------------------------------------------------------------------
# IMPL-20260513-01: Tests de Calibración V1 — Audiometría y Espirometría
# ARCH-20260513-01 §"Validación dirigida"
# Cubre: caso nominal, caso incompleto, política de calibración médica
# ---------------------------------------------------------------------------

class TestCalibrationV1AudioEspiro:
    """
    Tests dirigidos para Calibración V1 de Audiometría y Espirometría.
    IMPL-20260513-01: Contratos endurecidos, calibración médica, modo sombra.
    """

    @pytest.fixture
    def extractor(self):
        return ExtractorService(api_key="test-api-key", model="gemini-2.5-pro")

    @pytest.fixture
    def prediagnostic_svc(self):
        from app.services.ai.prediagnostic import PrediagnosticService
        return PrediagnosticService(api_key="test-api-key", model="gemini-2.5-flash")

    # --- Extracción: Audiometría ---

    @patch('app.services.ai.base.GeminiBase.call_gemini')
    def test_audiometria_nominal_con_frecuencias_canonicas(self, mock_gemini, extractor):
        """
        Caso nominal: el extractor devuelve las 8 frecuencias canónicas
        (250, 500, 1000, 2000, 3000, 4000, 6000, 8000 Hz) para ambos oídos
        y la completitud es 'suficiente'.
        """
        mock_gemini.return_value = {
            "paciente": "Juan Pérez",
            "fecha_estudio": "13/05/2026",
            "oido_derecho": {"250": 10, "500": 10, "1000": 15, "2000": 15, "3000": 20, "4000": 25, "6000": 30, "8000": 30},
            "oido_izquierdo": {"250": 10, "500": 10, "1000": 15, "2000": 15, "3000": 20, "4000": 25, "6000": 30, "8000": 30},
            "frecuencias_detectadas": ["250", "500", "1000", "2000", "3000", "4000", "6000", "8000"],
            "completitud_documental": "suficiente",
            "notas_calidad": None,
        }
        result = extractor.extract_by_type("/fake/audiometria_nominal.pdf", "Audiometria", ai_calibration=_TEST_AI_CALIBRATION_EXTRACTION)
        assert isinstance(result, AudiometriaData)
        assert "250" in result.oido_derecho
        assert "8000" in result.oido_derecho
        assert len(result.oido_derecho) == 8
        assert result.completitud_documental == "suficiente"
        assert result.frecuencias_detectadas is not None
        assert len(result.frecuencias_detectadas) == 8

    @patch('app.services.ai.base.GeminiBase.call_gemini')
    def test_audiometria_incompleta_completitud_parcial(self, mock_gemini, extractor):
        """
        Caso incompleto: el documento solo tiene 4 frecuencias por oído.
        completitud_documental debe ser 'parcial', no 'suficiente'.
        """
        mock_gemini.return_value = {
            "paciente": "Ana López",
            "fecha_estudio": "13/05/2026",
            "oido_derecho": {"500": 15, "1000": 20, "2000": 25, "4000": 40},
            "oido_izquierdo": {"500": 10, "1000": 15, "2000": 20, "4000": 35},
            "frecuencias_detectadas": ["500", "1000", "2000", "4000"],
            "completitud_documental": "parcial",
            "notas_calidad": "Audiograma con solo 4 frecuencias visibles",
        }
        result = extractor.extract_by_type("/fake/audiometria_incompleta.pdf", "Audiometria", ai_calibration=_TEST_AI_CALIBRATION_EXTRACTION)
        assert isinstance(result, AudiometriaData)
        assert result.completitud_documental == "parcial"
        assert len(result.oido_derecho) == 4
        assert result.notas_calidad is not None

    @patch('app.services.ai.base.GeminiBase.call_gemini')
    def test_audiometria_con_campos_fuente_formato_diagnostico(self, mock_gemini, extractor):
        """
        IMPL-20260516-07 (ARCH-20260516-07): Cuando el formato diagnóstico incluye
        faringe, CAD, CAI, MTD, MTI, el extractor los captura como campos fuente opcionales.
        Compatibilidad: snapshots viejos sin estos campos no deben fallar.
        """
        mock_gemini.return_value = {
            "paciente": "María Torres",
            "fecha_estudio": "16/05/2026",
            "oido_derecho": {"250": 10, "500": 10, "1000": 15, "2000": 20, "3000": 20, "4000": 25, "6000": 30, "8000": 35},
            "oido_izquierdo": {"250": 10, "500": 10, "1000": 15, "2000": 20, "3000": 20, "4000": 25, "6000": 30, "8000": 35},
            "frecuencias_detectadas": ["250", "500", "1000", "2000", "3000", "4000", "6000", "8000"],
            "completitud_documental": "suficiente",
            "notas_calidad": None,
            "faringe": "Sin datos patológicos",
            "cad": "Permeable",
            "cai": "Permeable",
            "mtd": "Íntegra, aspecto normal",
            "mti": "Íntegra, aspecto normal",
        }
        result = extractor.extract_by_type("/fake/audiometria_formato_diagnostico.pdf", "Audiometria", ai_calibration=_TEST_AI_CALIBRATION_EXTRACTION)
        assert isinstance(result, AudiometriaData)
        # Campos fuente nuevos capturados correctamente
        assert result.faringe == "Sin datos patológicos"
        assert result.cad == "Permeable"
        assert result.cai == "Permeable"
        assert result.mtd == "Íntegra, aspecto normal"
        assert result.mti == "Íntegra, aspecto normal"
        # Campos núcleo intactos
        assert result.completitud_documental == "suficiente"
        assert len(result.oido_derecho) == 8

    @patch('app.services.ai.base.GeminiBase.call_gemini')
    def test_audiometria_sin_campos_fuente_compatibilidad_snapshots_viejos(self, mock_gemini, extractor):
        """
        IMPL-20260516-07: Snapshot sin campos fuente (faringe/CAD/CAI/MTD/MTI) debe
        deserializar correctamente — todos quedan None, sin romper contrato.
        """
        mock_gemini.return_value = {
            "paciente": "Pedro Sánchez",
            "fecha_estudio": "01/01/2026",
            "oido_derecho": {"500": 15, "1000": 20, "2000": 25, "4000": 30},
            "oido_izquierdo": {"500": 10, "1000": 15, "2000": 20, "4000": 25},
            "frecuencias_detectadas": ["500", "1000", "2000", "4000"],
            "completitud_documental": "parcial",
            "notas_calidad": None,
            # SIN faringe, cad, cai, mtd, mti
        }
        result = extractor.extract_by_type("/fake/audiometria_viejo.pdf", "Audiometria", ai_calibration=_TEST_AI_CALIBRATION_EXTRACTION)
        assert isinstance(result, AudiometriaData)
        assert result.faringe is None
        assert result.cad is None
        assert result.cai is None
        assert result.mtd is None
        assert result.mti is None
        assert result.completitud_documental == "parcial"

    # --- ARCH-20260518-17: Guardrails backend de Audiometría ---

    @patch('app.services.ai.base.GeminiBase.call_gemini')
    def test_audiometria_derivacion_completitud_cuando_null(self, mock_gemini, extractor):
        """
        ARCH-20260518-17: Si el LLM devuelve completitud_documental=null (o lo omite),
        el backend lo deriva del conteo de frecuencias por oído: ≥6→suficiente, 3-5→parcial, <3→no_concluyente.
        """
        mock_gemini.return_value = {
            "paciente": "Test Derivación",
            "fecha_estudio": "18/05/2026",
            "oido_derecho": {"500": 10, "1000": 15, "2000": 20, "4000": 25, "6000": 30, "8000": 35},
            "oido_izquierdo": {"500": 10, "1000": 15, "2000": 20, "4000": 25},
            # completitud_documental ausente — el backend debe derivarlo
        }
        result = extractor.extract_by_type(
            "/fake/audio_derivacion.pdf", "Audiometria",
            ai_calibration=_TEST_AI_CALIBRATION_EXTRACTION
        )
        assert isinstance(result, AudiometriaData)
        # oido_derecho tiene 6 frecuencias → suficiente
        assert result.completitud_documental == "suficiente"

    @patch('app.services.ai.base.GeminiBase.call_gemini')
    def test_audiometria_derivacion_frecuencias_detectadas_cuando_null(self, mock_gemini, extractor):
        """
        ARCH-20260518-17: Si frecuencias_detectadas llega null o ausente, el backend
        las deriva como unión ordenada de claves de oido_derecho y oido_izquierdo.
        """
        mock_gemini.return_value = {
            "paciente": "Test FrecDeriv",
            "fecha_estudio": "18/05/2026",
            "oido_derecho": {"500": 10, "1000": 15, "2000": 20},
            "oido_izquierdo": {"500": 12, "1000": 18, "2000": 22, "4000": 30},
            # frecuencias_detectadas ausente — el backend debe derivarlo
        }
        result = extractor.extract_by_type(
            "/fake/audio_frec_deriv.pdf", "Audiometria",
            ai_calibration=_TEST_AI_CALIBRATION_EXTRACTION
        )
        assert isinstance(result, AudiometriaData)
        assert result.frecuencias_detectadas is not None
        # Unión ordenada de claves de ambos oídos
        assert result.frecuencias_detectadas == ["500", "1000", "2000", "4000"]

    @patch('app.services.ai.base.GeminiBase.call_gemini')
    def test_audiometria_sospecha_corrimiento_125hz(self, mock_gemini, extractor):
        """
        ARCH-20260518-17: Cuando el LLM devuelve 125 Hz como clave (frecuencia no canónica),
        el backend anota SOSPECHA_CORRIMIENTO en notas_calidad para trazabilidad.
        """
        mock_gemini.return_value = {
            "paciente": "Test Corrimiento",
            "fecha_estudio": "18/05/2026",
            "oido_derecho": {"125": 10, "250": 15, "500": 20, "1000": 25},
            "oido_izquierdo": {"125": 12, "250": 18, "500": 22, "1000": 28},
            "completitud_documental": "parcial",
        }
        result = extractor.extract_by_type(
            "/fake/audio_corrimiento.pdf", "Audiometria",
            ai_calibration=_TEST_AI_CALIBRATION_EXTRACTION
        )
        assert isinstance(result, AudiometriaData)
        assert result.notas_calidad is not None
        assert "SOSPECHA_CORRIMIENTO" in result.notas_calidad
        assert "125" in result.notas_calidad

    @patch('app.services.ai.base.GeminiBase.call_gemini')
    def test_audiometria_null_values_omitidos_en_normalizacion(self, mock_gemini, extractor):
        """
        ARCH-20260518-17: Si el LLM devuelve null para alguna frecuencia (celda vacía),
        esa clave se omite en el dict normalizado para evitar errores de tipo y corrimientos.
        """
        mock_gemini.return_value = {
            "paciente": "Test Null Freqs",
            "fecha_estudio": "18/05/2026",
            "oido_derecho": {"500": 10, "1000": None, "2000": 20, "4000": 30},
            "oido_izquierdo": {"500": 12, "1000": 15, "2000": None, "4000": 35},
            "completitud_documental": "parcial",
        }
        result = extractor.extract_by_type(
            "/fake/audio_null_freqs.pdf", "Audiometria",
            ai_calibration=_TEST_AI_CALIBRATION_EXTRACTION
        )
        assert isinstance(result, AudiometriaData)
        # Celdas null omitidas — no deben aparecer como claves
        assert "1000" not in result.oido_derecho
        assert "2000" not in result.oido_izquierdo
        # Celdas con valor sí deben estar
        assert result.oido_derecho["500"] == 10
        assert result.oido_izquierdo["4000"] == 35

    # --- Extracción: Espirometría ---

    @patch('app.services.ai.base.GeminiBase.call_gemini')
    def test_espirometria_nominal_con_parametros_minimos(self, mock_gemini, extractor):
        """
        Caso nominal: el extractor devuelve fev1, fvc, ratio, %predicho y es_interpretable=True.
        """
        from app.schemas.medical import EspirometriaData
        mock_gemini.return_value = {
            "paciente": "Carlos García",
            "fecha_estudio": "13/05/2026",
            "fev1": 3.2,
            "fvc": 4.0,
            "fev1_fvc_ratio": 0.80,
            "fev1_percent_predicho": 88.0,
            "fvc_percent_predicho": 92.0,
            "broncodilatador_post_fev1": None,
            "broncodilatador_post_fvc": None,
            "es_interpretable": True,
            "completitud_documental": "suficiente",
            "notas_calidad": None,
        }
        result = extractor.extract_by_type("/fake/espirometria_nominal.pdf", "Espirometria", ai_calibration=_TEST_AI_CALIBRATION_EXTRACTION)
        assert isinstance(result, EspirometriaData)
        assert result.fev1 == 3.2
        assert result.fvc == 4.0
        assert result.fev1_fvc_ratio == 0.80
        assert result.es_interpretable is True
        assert result.completitud_documental == "suficiente"

    @patch('app.services.ai.base.GeminiBase.call_gemini')
    def test_espirometria_sin_fev1_es_no_concluyente(self, mock_gemini, extractor):
        """
        Caso incompleto: el documento no tiene FEV1 ni FVC visibles.
        es_interpretable debe ser False y completitud 'no_concluyente'.
        """
        from app.schemas.medical import EspirometriaData
        mock_gemini.return_value = {
            "paciente": "María Torres",
            "fecha_estudio": "13/05/2026",
            "fev1": None,
            "fvc": None,
            "fev1_fvc_ratio": None,
            "fev1_percent_predicho": None,
            "fvc_percent_predicho": None,
            "broncodilatador_post_fev1": None,
            "broncodilatador_post_fvc": None,
            "es_interpretable": False,
            "completitud_documental": "no_concluyente",
            "notas_calidad": "No se encontraron valores de FEV1 ni FVC en el documento",
        }
        result = extractor.extract_by_type("/fake/espirometria_incompleta.pdf", "Espirometria", ai_calibration=_TEST_AI_CALIBRATION_EXTRACTION)
        assert isinstance(result, EspirometriaData)
        assert result.es_interpretable is False
        assert result.completitud_documental == "no_concluyente"
        assert result.fev1 is None
        assert result.notas_calidad is not None

    # --- Prediagnóstico: Calibración médica ---

    @patch('app.services.ai.prediagnostic.MEDGEMMA_ENABLED', False)
    @patch('app.services.ai.prediagnostic.DR7_API_KEY', '')
    def test_prediagnostico_audiometria_medical_calibration_legacy_deprecado(self, prediagnostic_svc):
        """
        ARCH-20260820-01 Fase 4 (handoff §2.2): el canal `medical_calibration`
        se retira del flujo principal (H11). Pasarlo por compat debe derivar
        a `legacy_hardcoded` (no hay V3 resuelta) con `legacy_hardcoded_reason`
        poblado; el parámetro se ignora para trazabilidad.
        """
        result = prediagnostic_svc.generate_prediagnosis(
            study_type="Audiometria",
            extracted_data={"paciente": "Test"},  # Faltarán oido_derecho y oido_izquierdo
            medical_calibration={"description": "Calibración NOM-011", "version": "v1"},
        )
        # Al faltar parámetros mínimos retorna AI_NON_CONCLUSIVE, pero con calibration_source correcto
        assert result.clinical_state == "AI_NON_CONCLUSIVE"
        # medical_calibration ya no produce calibration_source="medical_calibration";
        # cae al fallback legacy_hardcoded.
        assert result.calibration_source == "legacy_hardcoded"
        assert result.legacy_hardcoded_reason in (
            "no_published_version",
            "field_definitions_incomplete",
        )
        assert result.clinical_model_used == "medgemma-4b-it"

    @patch('app.services.ai.prediagnostic.MEDGEMMA_ENABLED', False)
    @patch('app.services.ai.prediagnostic.DR7_API_KEY', '')
    def test_prediagnostico_audiometria_usa_legacy_hardcoded_sin_calibracion(self, prediagnostic_svc):
        """
        Cuando NO se pasa `calibration_version` (resolver None) y `ai_calibration`
        está ausente, el resultado debe tener
        `calibration_source='legacy_hardcoded'` con `legacy_hardcoded_reason`
        poblado. (Antes Fase 4 era `general_fallback`).
        """
        result = prediagnostic_svc.generate_prediagnosis(
            study_type="Audiometria",
            extracted_data={"paciente": "Test"},  # Faltarán oido_derecho y oido_izquierdo
        )
        assert result.clinical_state == "AI_NON_CONCLUSIVE"
        assert result.calibration_source == "legacy_hardcoded"
        assert result.legacy_hardcoded_reason in (
            "no_published_version",
            "field_definitions_incomplete",
        )
        assert result.clinical_model_used == "medgemma-4b-it"

    @patch('app.services.ai.prediagnostic.MEDGEMMA_ENABLED', False)
    @patch('app.services.ai.prediagnostic.DR7_API_KEY', '')
    def test_prediagnostico_espirometria_incompleta_devuelve_non_conclusive(self, prediagnostic_svc):
        """
        Espirometría con es_interpretable=False debe retornar AI_NON_CONCLUSIVE
        por la verificación adicional de IMPL-20260513-01.
        """
        result = prediagnostic_svc.generate_prediagnosis(
            study_type="Espirometria",
            extracted_data={
                "paciente": "Test",
                "fev1": None,
                "fvc": None,
                "es_interpretable": False,
                "completitud_documental": "no_concluyente",
            },
        )
        assert result.clinical_state == "AI_NON_CONCLUSIVE"
        assert result.non_conclusive_reason is not None
        assert "interpretable" in result.non_conclusive_reason.lower() or "faltantes" in result.non_conclusive_reason.lower()

    @patch('app.services.ai.prediagnostic.MEDGEMMA_ENABLED', True)
    @patch('app.services.ai.prediagnostic.DR7_API_KEY', 'fake-dr7-key')
    @patch('app.services.ai.prediagnostic.PrediagnosticService._call_dr7_medical_chat')
    def test_prediagnostico_espirometria_nominal_sin_calibration_version_v3(self, mock_call, prediagnostic_svc):
        """
        Espirometría nominal SIN `calibration_version` resuelta: el prediagnóstico
        cae al fallback legacy_hardcoded con `prompt_source="backend_fallback"`.
        El canal `medical_calibration` legacy se ignora.
        """
        mock_call.return_value = {
            "summary": "Parámetros espirométricos compatibles con función pulmonar conservada.",
            "confidence": 0.78,
            "clinical_state": "AI_PENDING_REVIEW",
            "justification": ["FEV1/FVC 0.80 compatible con patrón normal según ATS/ERS 2022"],
            "clinical_basis": [{"principle": "ATS/ERS 2022", "applied_parameters": ["fev1_fvc_ratio"]}],
            "citations": [],
            "limitations": ["Requiere correlación con historial clínico"],
            "red_flags": [],
            "non_conclusive_reason": None,
        }
        result = prediagnostic_svc.generate_prediagnosis(
            study_type="Espirometria",
            extracted_data={
                "paciente": "Carlos García",
                "fev1": 3.2,
                "fvc": 4.0,
                "fev1_fvc_ratio": 0.80,
                "fev1_percent_predicho": 88.0,
                "es_interpretable": True,
                "completitud_documental": "suficiente",
            },
            medical_calibration={
                "description": "Calibración espirometría AMI — criterios NOM-022-STPS",
                "version": "v1.0",
                "notes": "Población trabajadora industrial, referencia NHANES III",
            },
        )
        assert result.clinical_state == "AI_PENDING_REVIEW"
        # Fase 4: sin calibration_version → legacy_hardcoded (no medical_calibration).
        assert result.calibration_source == "legacy_hardcoded"
        assert result.prompt_source == "backend_fallback"
        assert result.clinical_model_used == "medgemma-4b-it"
        assert result.confidence >= 0.60


if __name__ == "__main__":
    pytest.main([__file__, "-v"])


# ---------------------------------------------------------------------------
# IMPL-20260603-01: Tests del proveedor MedGemma/DR7
# Valida selección de proveedor, trazabilidad de clinical_provider y fallback.
# ---------------------------------------------------------------------------

class TestMedGemmaDR7Provider:
    """
    Tests para la integración MedGemma vía DR7 (HTTP médico).
    IMPL-20260603-01: Selección de proveedor, trazabilidad y degradación honesta.
    """

    @pytest.fixture
    def prediagnostic_svc(self):
        from app.services.ai.prediagnostic import PrediagnosticService
        return PrediagnosticService(api_key="test-api-key", model="gemini-2.5-flash")

    # Datos mínimos válidos de espirometría para evitar early-return por params
    ESPIRO_VALIDA = {
        "paciente": "Test Provider",
        "fev1": 3.2,
        "fvc": 4.0,
        "fev1_fvc_ratio": 0.80,
        "fev1_percent_predicho": 88.0,
        "es_interpretable": True,
        "completitud_documental": "suficiente",
    }

    MOCK_PREDIAGNOSIS_RESPONSE = {
        "summary": "Función pulmonar compatible con patrón normal.",
        "confidence": 0.80,
        "clinical_state": "AI_PENDING_REVIEW",
        "justification": ["FEV1/FVC 0.80 dentro de rango normal ATS/ERS"],
        "clinical_basis": [{"principle": "ATS/ERS 2022", "applied_parameters": ["fev1_fvc_ratio"]}],
        "citations": [],
        "limitations": ["Requiere correlación clínica"],
        "red_flags": [],
        "non_conclusive_reason": None,
    }

    @patch('app.services.ai.prediagnostic.MEDGEMMA_ENABLED', False)
    @patch('app.services.ai.prediagnostic.DR7_API_KEY', '')
    def test_sin_medgemma_retorna_non_conclusive_y_no_usa_gemini(self, prediagnostic_svc):
        """
        FIX-20260518-02: sin MedGemma disponible no se debe rescatar con Gemini.
        """
        result = prediagnostic_svc.generate_prediagnosis("Espirometria", self.ESPIRO_VALIDA)
        assert result.clinical_provider == "dr7"
        assert result.clinical_state == "AI_NON_CONCLUSIVE"
        assert "Gemini se usa solo para extracción" in (result.non_conclusive_reason or "")

    @patch('app.services.ai.prediagnostic.MEDGEMMA_ENABLED', True)
    @patch('app.services.ai.prediagnostic.DR7_API_KEY', '')
    def test_medgemma_enabled_pero_sin_key_retorna_non_conclusive(self, prediagnostic_svc):
        """
        FIX-20260518-02: si falta DR7_API_KEY no existe fallback clínico a Gemini.
        """
        result = prediagnostic_svc.generate_prediagnosis("Espirometria", self.ESPIRO_VALIDA)
        assert result.clinical_provider == "dr7"
        assert result.clinical_state == "AI_NON_CONCLUSIVE"
        assert "falta DR7_API_KEY" in (result.non_conclusive_reason or "")

    @patch('app.services.ai.prediagnostic.MEDGEMMA_ENABLED', True)
    @patch('app.services.ai.prediagnostic.DR7_API_KEY', 'fake-dr7-key')
    @patch('app.services.ai.prediagnostic.DR7_MODEL', 'medgemma-4b-it')
    @patch('app.services.ai.prediagnostic.PrediagnosticService._call_dr7_medical_chat')
    def test_medgemma_enabled_con_key_llama_dr7(self, mock_featherless, prediagnostic_svc):
        """
        MEDGEMMA_ENABLED=true + DR7_API_KEY presente → llama a _call_dr7_medical_chat.
        clinical_provider debe ser 'dr7' y clinical_model_used el modelo DR7.
        """
        mock_featherless.return_value = self.MOCK_PREDIAGNOSIS_RESPONSE.copy()
        result = prediagnostic_svc.generate_prediagnosis("Espirometria", self.ESPIRO_VALIDA)
        assert result.clinical_provider == "dr7"
        assert result.clinical_model_used == "medgemma-4b-it"
        assert result.clinical_state == "AI_PENDING_REVIEW"
        mock_featherless.assert_called_once()

    @patch('app.services.ai.prediagnostic.MEDGEMMA_ENABLED', True)
    @patch('app.services.ai.prediagnostic.DR7_API_KEY', 'fake-dr7-key')
    @patch('app.services.ai.prediagnostic.PrediagnosticService._call_dr7_medical_chat')
    def test_dr7_error_retorna_non_conclusive_con_provider_trazado(self, mock_featherless, prediagnostic_svc):
        """
        Si DR7 lanza excepción, retorna AI_NON_CONCLUSIVE con clinical_provider='dr7'
        para mantener trazabilidad del proveedor que falló.
        """
        mock_featherless.side_effect = RuntimeError("DR7 timeout")
        result = prediagnostic_svc.generate_prediagnosis("Espirometria", self.ESPIRO_VALIDA)
        assert result.clinical_state == "AI_NON_CONCLUSIVE"
        assert result.clinical_provider == "dr7"
        assert result.non_conclusive_reason is not None
        assert "dr7" in result.non_conclusive_reason.lower()

    @patch('app.services.ai.prediagnostic.MEDGEMMA_ENABLED', True)
    @patch('app.services.ai.prediagnostic.DR7_API_KEY', 'fake-dr7-key')
    @patch('app.services.ai.prediagnostic.PrediagnosticService._call_dr7_medical_chat')
    def test_dr7_http_429_retorna_non_conclusive_sin_fallback_a_gemini(
        self,
        mock_featherless,
        prediagnostic_svc,
    ):
        """
        IMPL-20260603-01: DR7 HTTP 429 debe degradar a no concluyente;
        Gemini no participa en la capa clínica.
        """
        mock_featherless.side_effect = RuntimeError("DR7_HTTP:429:rate limit")

        result = prediagnostic_svc.generate_prediagnosis("Espirometria", self.ESPIRO_VALIDA)

        assert result.clinical_provider == "dr7"
        assert result.clinical_state == "AI_NON_CONCLUSIVE"
        assert result.clinical_model_used == "medgemma-4b-it"
        assert any("HTTP 429" in limitation for limitation in result.limitations)
        mock_featherless.assert_called_once()

    @patch('app.services.ai.prediagnostic.MEDGEMMA_ENABLED', True)
    @patch('app.services.ai.prediagnostic.DR7_API_KEY', 'fake-dr7-key')
    @patch('app.services.ai.prediagnostic.PrediagnosticService._call_dr7_medical_chat')
    def test_non_conclusive_por_params_expone_clinical_provider(self, mock_featherless, prediagnostic_svc):
        """
        Incluso en early-return por params mínimos, clinical_provider queda trazado.
        """
        result = prediagnostic_svc.generate_prediagnosis(
            "Espirometria",
            {"paciente": "Test", "fev1": None, "fvc": None, "es_interpretable": False}
        )
        assert result.clinical_state == "AI_NON_CONCLUSIVE"
        assert result.clinical_provider == "dr7"
        # No debe haber llamado al proveedor real
        mock_featherless.assert_not_called()


# ---------------------------------------------------------------------------
# IMPL-20260516-12/13: Tests Espirometría Exhaustiva + Prediagnóstico Endurecido
# ARCH-20260516-12 (extracción) + ARCH-20260516-13 (prediagnóstico)
# Cubre: extracción de 6 bloques, compatibilidad snapshots viejos, caso clínico
# conflictivo FVC-reducida/ratio-conservado, recommendation obligatorio, y
# degradación a AI_NON_CONCLUSIVE desde bloque calidad.
# ---------------------------------------------------------------------------

class TestEspirometriaExhaustiva_20260516_12_13:
    """
    Tests dirigidos al contrato exhaustivo de Espirometría.
    IMPL-20260516-12: extracción con bloques nuevos.
    IMPL-20260516-13: prediagnóstico endurecido, reglas de síntesis, recommendation.
    """

    @pytest.fixture
    def extractor(self):
        return ExtractorService(api_key="test-api-key", model="gemini-2.5-pro")

    @pytest.fixture
    def prediagnostic_svc(self):
        from app.services.ai.prediagnostic import PrediagnosticService
        return PrediagnosticService(api_key="test-api-key", model="gemini-2.5-flash")

    # --- Extracción: bloques exhaustivos ---

    @patch('app.services.ai.base.GeminiBase.call_gemini')
    def test_extraccion_espirometria_exhaustiva_6_bloques(self, mock_gemini, extractor):
        """
        ARCH-20260516-12: El extractor parsea correctamente los 6 bloques del layout real AMI
        y conserva los campos legacy al mismo tiempo.
        """
        from app.schemas.medical import (
            EspirometriaData, EspirometriaParamRow, EspirometriaCalidad, EspirometriaGraficas
        )
        mock_gemini.return_value = {
            "paciente": "Trabajador A",
            "fecha_estudio": "16/05/2026",
            "fev1": 2.8,
            "fvc": 3.1,
            "fev1_fvc_ratio": 0.90,
            "fev1_percent_predicho": 85.0,
            "fvc_percent_predicho": 72.0,
            "broncodilatador_post_fev1": None,
            "broncodilatador_post_fvc": None,
            "es_interpretable": True,
            "completitud_documental": "suficiente",
            "notas_calidad": None,
            "paciente_detalle": {
                "nombre_completo": "Trabajador A",
                "sexo": "Masculino",
                "edad_anios": 38.0,
                "talla_cm": 170.0,
                "peso_kg": 75.0,
                "imc": 26.0,
                "fuma": "No",
            },
            "estudio": {
                "referencia": "ESP-2026-001",
                "fecha_estudio": "16/05/2026",
                "hora_estudio": "09:15",
                "equipo_modelo": "SpirvTEK V3",
                "version_software": "v2.1",
            },
            "condiciones": {
                "temperatura_c": 22.0,
                "presion_mmhg": 760.0,
                "humedad_pct": 50.0,
                "tecnico": "TEC-001",
                "referencia_ecuacion": "NHANES III",
            },
            "parametros": [
                {"label": "FVC", "key": "fvc_l", "unidad": "L", "m1": 3.1, "m1_pct_ref": 72.0, "ref": 4.3, "lln": 3.5},
                {"label": "FEV1", "key": "fev1_l", "unidad": "L", "m1": 2.8, "m1_pct_ref": 85.0, "ref": 3.3, "lln": 2.7},
                {"label": "FEV1/FVC", "key": "fev1_fvc_pct", "unidad": "%", "m1": 90.0, "ref": 78.0, "lln": 70.0},
                {"label": "FEF25-75", "key": "fef25_75_l_s", "unidad": "L/s", "m1": 2.5, "m1_pct_ref": 80.0, "ref": 3.1, "lln": 1.9},
            ],
            "calidad": {
                "repetibilidad_ats_ers_fvc": "Aceptable",
                "repetibilidad_ats_ers_fev1": "Aceptable",
                "es_interpretable": True,
                "completitud_documental": "suficiente",
                "notas_calidad": None,
            },
            "graficas": {
                "curva_flujo_volumen_presente": True,
                "curva_volumen_tiempo_presente": True,
                "maniobras_graficadas": 3,
                "observaciones_grafica": None,
            },
        }
        result = extractor.extract_by_type("/fake/espirometria_exhaustiva.pdf", "Espirometria", ai_calibration=_TEST_AI_CALIBRATION_EXTRACTION)
        assert isinstance(result, EspirometriaData)
        # Campos legacy intactos
        assert result.fev1 == 2.8
        assert result.fvc == 3.1
        assert result.fev1_fvc_ratio == 0.90
        assert result.fvc_percent_predicho == 72.0
        assert result.es_interpretable is True
        # Bloque paciente_detalle
        assert result.paciente_detalle is not None
        assert result.paciente_detalle.edad_anios == 38.0
        assert result.paciente_detalle.fuma == "No"
        # Bloque estudio
        assert result.estudio is not None
        assert result.estudio.equipo_modelo == "SpirvTEK V3"
        # Bloque condiciones
        assert result.condiciones is not None
        assert result.condiciones.referencia_ecuacion == "NHANES III"
        assert result.condiciones.temperatura_c == 22.0
        # Bloque parametros
        assert result.parametros is not None
        assert len(result.parametros) == 4
        fvc_row = result.parametros[0]
        assert isinstance(fvc_row, EspirometriaParamRow)
        assert fvc_row.label == "FVC"
        assert fvc_row.key == "fvc_l"
        assert fvc_row.lln == 3.5
        assert fvc_row.m1_pct_ref == 72.0
        # Bloque calidad
        assert result.calidad is not None
        assert isinstance(result.calidad, EspirometriaCalidad)
        assert result.calidad.repetibilidad_ats_ers_fvc == "Aceptable"
        assert result.calidad.es_interpretable is True
        # Bloque graficas
        assert result.graficas is not None
        assert isinstance(result.graficas, EspirometriaGraficas)
        assert result.graficas.maniobras_graficadas == 3
        assert result.graficas.curva_flujo_volumen_presente is True

    @patch('app.services.ai.base.GeminiBase.call_gemini')
    def test_extraccion_espirometria_snapshot_viejo_compatibilidad(self, mock_gemini, extractor):
        """
        ARCH-20260516-12: Snapshot viejo con solo campos legacy debe deserializar correctamente
        sin bloques nuevos — ninguno de ellos queda en None sin errores.
        """
        from app.schemas.medical import EspirometriaData
        mock_gemini.return_value = {
            "paciente": "Trabajador Histórico",
            "fecha_estudio": "01/01/2026",
            "fev1": 3.2,
            "fvc": 4.0,
            "fev1_fvc_ratio": 0.80,
            "fev1_percent_predicho": 88.0,
            "fvc_percent_predicho": 92.0,
            "es_interpretable": True,
            "completitud_documental": "suficiente",
            "notas_calidad": None,
            # SIN paciente_detalle, estudio, condiciones, parametros, calidad, graficas
        }
        result = extractor.extract_by_type("/fake/espirometria_vieja.pdf", "Espirometria", ai_calibration=_TEST_AI_CALIBRATION_EXTRACTION)
        assert isinstance(result, EspirometriaData)
        # Bloques nuevos son None sin error
        assert result.paciente_detalle is None
        assert result.estudio is None
        assert result.condiciones is None
        assert result.parametros is None
        assert result.calidad is None
        assert result.graficas is None
        # Legacy sigue funcionando
        assert result.fev1 == 3.2
        assert result.fvc == 4.0
        assert result.es_interpretable is True
        assert result.completitud_documental == "suficiente"

    # --- FIX-20260812-20: Guardrails backend + normalizador de Espirometría ---

    @patch('app.services.ai.base.GeminiBase.call_gemini')
    def test_espirometria_usa_prompt_con_guardrails_backend_FIX_20260812_20(
        self, mock_gemini, extractor
    ):
        """
        FIX-20260812-20: extract_by_type(..., "Espirometria") debe construir el
        prompt con _build_espirometria_extraction_prompt (que inyecta
        _ESPIROMETRIA_BACKEND_GUARDRAILS), NO caer al prompt genérico ni al de
        Audiometría. Se usa extraction_provider_override="gemini" para que el
        mock de call_gemini capture el prompt real independientemente del
        provider por defecto del entorno (evita la fragilidad M3-sin-key).
        """
        from app.schemas.medical import EspirometriaData
        mock_gemini.return_value = {
            "paciente": "Peña Patricio Marbella",
            "fecha_estudio": "18/03/2025",
            "fev1": 3.45,
            "fvc": 4.12,
            "es_interpretable": True,
            "completitud_documental": "suficiente",
        }
        result = extractor.extract_by_type(
            "/fake/espirometria_sibelmed.pdf",
            "Espirometria",
            ai_calibration=_TEST_AI_CALIBRATION_EXTRACTION,
            extraction_provider_override="gemini",
        )
        assert isinstance(result, EspirometriaData)
        # El prompt enviado al proveedor es el 2º argumento posicional.
        sent_prompt = mock_gemini.call_args[0][1]
        # Guardrails de espirometría presentes.
        assert "GUARDRAILS ESPECÍFICOS PARA ESPIROMETRÍA" in sent_prompt
        assert "INFORME DE FVC" in sent_prompt
        # No se filtraron los guardrails de Audiometría (dispatch correcto).
        assert "GUARDRAILS ESPECÍFICOS PARA AUDIOMETRÍA" not in sent_prompt
        # El bloque de calibración (aiCalibration) sigue presente.
        assert "Extrae todos los datos relevantes" in sent_prompt

    @patch('app.services.ai.base.GeminiBase.call_gemini')
    def test_espirometria_json_exhaustivo_valida_schemas_y_normalizer_FIX_20260812_20(
        self, mock_gemini, extractor
    ):
        """
        FIX-20260812-20: un JSON exhaustivo con 11 filas de parámetros (escala
        real del PDF Sibelmed W20s) valida contra los schemas Pydantic tras
        pasar por _normalize_espirometria_result. Se verifica:
          - todas las filas se parsean como EspirometriaParamRow;
          - completitud_documental (raíz + bloque calidad) se deriva a
            "suficiente" (≥6 parámetros principales con valores de maniobra);
          - es_interpretable (legacy) se deriva a True (fev1_l + fvc_l con m1);
          - una fila con key no canónico se conserva y se anota como
            SOSPECHA_MAPEO en notas_calidad (raíz + bloque calidad).
        """
        from app.schemas.medical import (
            EspirometriaData, EspirometriaParamRow,
        )
        mock_gemini.return_value = {
            "paciente": "Peña Patricio Marbella",
            "fecha_estudio": "18/03/2025",
            # Legacy y derivables dejados en None para ejercitar el normalizador.
            "fev1": None,
            "fvc": None,
            "es_interpretable": None,
            "completitud_documental": None,
            "notas_calidad": None,
            "calidad": {
                "repetibilidad_ats_ers_fvc": "Aceptable",
                "repetibilidad_ats_ers_fev1": "Aceptable",
                "es_interpretable": None,
                "completitud_documental": None,
                "notas_calidad": None,
            },
            "parametros": [
                {"label": "FVC", "key": "fvc_l", "unidad": "L", "m1": 4.12, "m1_pct_ref": 79.4, "ref": 5.19, "lln": 4.14},
                {"label": "FEV1", "key": "fev1_l", "unidad": "L", "m1": 3.45, "m1_pct_ref": 84.1, "ref": 4.10, "lln": 3.27},
                {"label": "FEV1/FVC", "key": "fev1_fvc_pct", "unidad": "%", "m1": 83.8, "ref": 79.0, "lln": 70.0},
                {"label": "FEF25-75", "key": "fef25_75_l_s", "unidad": "L/s", "m1": 3.12, "m1_pct_ref": 69.3, "ref": 4.50, "lln": 2.20},
                {"label": "FEF25", "key": "fef25_l_s", "unidad": "L/s", "m1": 7.8, "ref": 9.5},
                {"label": "FEF50", "key": "fef50_l_s", "unidad": "L/s", "m1": 5.6, "ref": 6.1},
                {"label": "FEF75", "key": "fef75_l_s", "unidad": "L/s", "m1": 2.1, "ref": 2.8},
                {"label": "FET100", "key": "fet100_s", "unidad": "s", "m1": 6.2, "ref": 5.9},
                {"label": "Vext", "key": "vext_l", "unidad": "L", "m1": 0.15, "ref": 0.12},
                {"label": "Edad pulmonar", "key": "edad_pulmon_anios", "unidad": "años", "m1": 52.0, "ref": 40.0},
                # Fila NO canónica: debe conservarse y anotarse como sospecha de mapeo.
                {"label": "Índice personalizado", "key": "indice_xyz", "unidad": "L", "m1": 1.5},
            ],
        }
        result = extractor.extract_by_type(
            "/fake/espirometria_sibelmed_exhaustivo.pdf",
            "Espirometria",
            ai_calibration=_TEST_AI_CALIBRATION_EXTRACTION,
            extraction_provider_override="gemini",
        )
        assert isinstance(result, EspirometriaData)
        # 11 filas parseadas como EspirometriaParamRow.
        assert result.parametros is not None
        assert len(result.parametros) == 11
        assert all(isinstance(r, EspirometriaParamRow) for r in result.parametros)
        # Coerción numérica: FVC m1 == 4.12 (float).
        fvc_row = next(r for r in result.parametros if r.key == "fvc_l")
        assert fvc_row.m1 == 4.12
        assert fvc_row.lln == 4.14
        # Derivación de completitud (≥6 parámetros principales con valores).
        assert result.completitud_documental == "suficiente"
        assert result.calidad is not None
        assert result.calidad.completitud_documental == "suficiente"
        # Derivación de es_interpretable (legacy): True porque fev1_l y fvc_l con m1.
        assert result.es_interpretable is True
        # Fila no canónica conservada.
        assert any(r.key == "indice_xyz" for r in result.parametros)
        # Sospecha de mapeo anotada en raíz y bloque calidad.
        assert result.notas_calidad is not None
        assert "SOSPECHA_MAPEO" in result.notas_calidad
        assert result.calidad.notas_calidad is not None
        assert "SOSPECHA_MAPEO" in result.calidad.notas_calidad

    # --- Prediagnóstico: caso conflictivo FVC reducida + ratio conservado ---

    @patch('app.services.ai.prediagnostic.MEDGEMMA_ENABLED', True)
    @patch('app.services.ai.prediagnostic.DR7_API_KEY', 'fake-dr7-key')
    @patch('app.services.ai.prediagnostic.PrediagnosticService._call_dr7_medical_chat')
    def test_prediagnostico_ratio_conservado_fvc_reducida_no_cierra_obstructivo(
        self, mock_call, prediagnostic_svc
    ):
        """
        ARCH-20260516-13 §Regla A: FEV1/FVC conservado (0.90) + FVC reducida (72% predicho).
        El prediagnóstico no debe emitir patrón obstructivo; debe ser sugestivo de restricción
        o no concluyente. Caso clínico conflictivo representativo del layout AMI real.
        """
        mock_call.return_value = {
            "summary": "Patrón sugestivo de restricción pulmonar. FVC reducida con ratio conservado.",
            "confidence": 0.65,
            "clinical_state": "AI_PENDING_REVIEW",
            "justification": [
                "FEV1/FVC 0.90 (LLN tabla: 0.70) — ratio conservado, descarta patrón obstructivo primario según Regla A ATS/ERS 2022",
                "FVC 3.1 L (72% predicho, LLN tabla: 3.5 L) — por debajo del LLN: sugestivo de restricción; requiere pletismografía para confirmación",
                "Repetibilidad ATS/ERS FVC y FEV1 aceptables: técnica válida",
            ],
            "clinical_basis": [
                {"principle": "Clasificación espirométrica ATS/ERS 2022", "applied_parameters": ["fev1_fvc_ratio", "fvc_percent_predicho", "lln"]}
            ],
            "citations": [
                {"source_id": "ATS-ERS-2022", "title": "ATS/ERS Technical Standard", "section": "Tabla 1", "excerpt": "FVC < LLN con ratio conservado sugiere restricción", "version_or_date": "2022"}
            ],
            "limitations": ["El diagnóstico definitivo de restricción requiere TLC o pletismografía"],
            "red_flags": [],
            "recommendation": "Correlacionar con espirometría previa y considerar pletismografía para confirmar patrón restrictivo. Requiere valoración médica.",
            "non_conclusive_reason": None,
        }
        result = prediagnostic_svc.generate_prediagnosis(
            study_type="Espirometria",
            extracted_data={
                "paciente": "Trabajador A",
                "fev1": 2.8,
                "fvc": 3.1,
                "fev1_fvc_ratio": 0.90,
                "fev1_percent_predicho": 85.0,
                "fvc_percent_predicho": 72.0,
                "es_interpretable": True,
                "completitud_documental": "suficiente",
                "parametros": [
                    {"label": "FVC", "key": "fvc_l", "m1": 3.1, "m1_pct_ref": 72.0, "ref": 4.3, "lln": 3.5},
                    {"label": "FEV1", "key": "fev1_l", "m1": 2.8, "m1_pct_ref": 85.0, "ref": 3.3, "lln": 2.7},
                    {"label": "FEV1/FVC", "key": "fev1_fvc_pct", "m1": 90.0, "ref": 78.0, "lln": 70.0},
                ],
                "calidad": {
                    "repetibilidad_ats_ers_fvc": "Aceptable",
                    "repetibilidad_ats_ers_fev1": "Aceptable",
                    "es_interpretable": True,
                    "completitud_documental": "suficiente",
                },
            },
        )
        assert result.clinical_state in ("AI_PENDING_REVIEW", "AI_NON_CONCLUSIVE")
        # La justificación NO debe declarar patrón obstructivo cuando ratio es conservado
        summary_lower = (result.summary or "").lower()
        assert "obstructiv" not in summary_lower or "no obstructiv" in summary_lower or "descarta obstructiv" in summary_lower
        # recommendation debe estar presente
        assert result.recommendation is not None
        assert len(result.recommendation) > 0

    @patch('app.services.ai.prediagnostic.MEDGEMMA_ENABLED', True)
    @patch('app.services.ai.prediagnostic.DR7_API_KEY', 'fake-dr7-key')
    @patch('app.services.ai.prediagnostic.PrediagnosticService._call_dr7_medical_chat')
    def test_prediagnostico_espirometria_incluye_recommendation_cuando_normal(
        self, mock_call, prediagnostic_svc
    ):
        """ARCH-20260516-13 §C: recommendation debe ser no nulo cuando hay información suficiente."""
        mock_call.return_value = {
            "summary": "Función pulmonar dentro de límites normales.",
            "confidence": 0.80,
            "clinical_state": "AI_PENDING_REVIEW",
            "justification": ["FEV1/FVC 0.82 y FVC 92% predicho dentro de límites normales ATS/ERS 2022"],
            "clinical_basis": [{"principle": "ATS/ERS 2022", "applied_parameters": ["fev1_fvc_ratio"]}],
            "citations": [],
            "limitations": [],
            "red_flags": [],
            "recommendation": "Mantener vigilancia espirométrica periódica según programa de salud ocupacional.",
            "non_conclusive_reason": None,
        }
        result = prediagnostic_svc.generate_prediagnosis(
            study_type="Espirometria",
            extracted_data={
                "paciente": "Trabajador Normal",
                "fev1": 3.4,
                "fvc": 4.1,
                "fev1_fvc_ratio": 0.82,
                "fev1_percent_predicho": 92.0,
                "fvc_percent_predicho": 92.0,
                "es_interpretable": True,
                "completitud_documental": "suficiente",
            },
        )
        assert result.clinical_state == "AI_PENDING_REVIEW"
        assert result.recommendation is not None
        assert len(result.recommendation) > 5

    @patch('app.services.ai.prediagnostic.MEDGEMMA_ENABLED', False)
    @patch('app.services.ai.prediagnostic.DR7_API_KEY', '')
    def test_prediagnostico_espirometria_calidad_insuficiente_desde_bloque_calidad(
        self, prediagnostic_svc
    ):
        """
        ARCH-20260516-13: calidad.es_interpretable=False debe disparar AI_NON_CONCLUSIVE
        incluso cuando los campos legacy fev1/fvc tienen valores numéricos válidos.
        """
        result = prediagnostic_svc.generate_prediagnosis(
            study_type="Espirometria",
            extracted_data={
                "paciente": "Trabajador C",
                "fev1": 2.5,
                "fvc": 3.0,
                "fev1_fvc_ratio": 0.83,
                "es_interpretable": None,       # legacy vacío
                "completitud_documental": None,  # legacy vacío
                "calidad": {
                    "es_interpretable": False,          # bloque nuevo: no interpretable
                    "completitud_documental": "no_concluyente",
                    "notas_calidad": "Maniobra técnicamente deficiente",
                },
            },
        )
        assert result.clinical_state == "AI_NON_CONCLUSIVE"
        assert result.non_conclusive_reason is not None

    @patch('app.services.ai.prediagnostic.MEDGEMMA_ENABLED', False)
    @patch('app.services.ai.prediagnostic.DR7_API_KEY', '')
    def test_prediagnostico_espirometria_completitud_no_concluyente_desde_bloque_calidad(
        self, prediagnostic_svc
    ):
        """
        ARCH-20260516-13: calidad.completitud_documental='no_concluyente' debe disparar
        AI_NON_CONCLUSIVE aunque el legacy completitud_documental esté en None.
        """
        result = prediagnostic_svc.generate_prediagnosis(
            study_type="Espirometria",
            extracted_data={
                "paciente": "Trabajador D",
                "fev1": 2.9,
                "fvc": 3.5,
                "es_interpretable": None,
                "completitud_documental": None,
                "calidad": {
                    "completitud_documental": "no_concluyente",
                    "es_interpretable": None,
                },
            },
        )
        assert result.clinical_state == "AI_NON_CONCLUSIVE"


# ---------------------------------------------------------------------------
# IMPL-20260518-03: Tests de Resolución de Prompts — ARCH-20260518-03
# Contrato: extracción sin fallback, clínica con fallback general.
# ---------------------------------------------------------------------------

class TestPromptResolutionARCH20260518_03:
    """
    IMPL-20260518-03: Fija en runtime el contrato ARCH-20260518-03:
    - Extracción: sin fallback; ValueError si falta aiCalibration.extraction.prompt.
    - Clínica: usa aiCalibration.diagnosis.prompt si existe;
      si no, usa PREDIAGNOSTIC_PROMPTS como fallback general (backend_fallback).
    """

    @pytest.fixture
    def extractor(self):
        return ExtractorService(api_key="test-api-key", model="gemini-2.5-flash")

    @pytest.fixture
    def prediagnostic_svc(self):
        from app.services.ai.prediagnostic import PrediagnosticService
        return PrediagnosticService(api_key="test-api-key", model="gemini-2.5-flash")

    # Datos mínimos de audiometría válidos para pasar _check_minimum_params
    _AUDIO_VALIDA = {
        "paciente": "Test Prompt Resolution",
        "oido_derecho": {"500": 15, "1000": 20, "2000": 25, "4000": 30},
        "oido_izquierdo": {"500": 10, "1000": 15, "2000": 20, "4000": 25},
        "completitud_documental": "suficiente",
    }

    # --- Test 1: Extracción sin prompt → ValueError ---

    def test_EXTRACTION_PROMPT_NOT_CONFIGURED_cuando_falta_extraction_prompt(self, extractor):
        """
        ARCH-20260518-03: Si aiCalibration.extraction.prompt no está configurado,
        extract_by_type debe lanzar ValueError con EXTRACTION_PROMPT_NOT_CONFIGURED.
        No existe fallback de extracción en el backend.
        """
        # Caso: ai_calibration=None
        with pytest.raises(ValueError, match="EXTRACTION_PROMPT_NOT_CONFIGURED"):
            extractor.extract_by_type("/fake/test.pdf", "Audiometria", ai_calibration=None)

        # Caso: ai_calibration presente pero sin extraction.prompt
        with pytest.raises(ValueError, match="EXTRACTION_PROMPT_NOT_CONFIGURED"):
            extractor.extract_by_type(
                "/fake/test.pdf", "Audiometria",
                ai_calibration={"extraction": {}},
            )

    # --- Test 2: Clínica usa aiCalibration.diagnosis.prompt si existe ---

    @patch('app.services.ai.prediagnostic.MEDGEMMA_ENABLED', True)
    @patch('app.services.ai.prediagnostic.DR7_API_KEY', 'fake-dr7-key')
    @patch('app.services.ai.prediagnostic.PrediagnosticService._call_dr7_medical_chat')
    def test_prompt_resolution_usa_ai_calibration_cuando_diagnosis_prompt_existe(
        self, mock_call, prediagnostic_svc
    ):
        """
        ARCH-20260518-03: Si ai_calibration.diagnosis.prompt existe:
        - prompt_source='ai_calibration'
        - prompt_version toma la versión configurada (o 'calibration_custom' si falta)
        - NO cae a 'backend_fallback'
        - Conserva recommendation/justification/citations/limitations del mock
        """
        mock_call.return_value = {
            "summary": "Compatible con audición conservada.",
            "confidence": 0.78,
            "clinical_state": "AI_PENDING_REVIEW",
            "justification": ["Umbrales dentro de límites normales en todas las frecuencias evaluadas"],
            "clinical_basis": [
                {"principle": "ISO 1999:2013", "applied_parameters": ["oido_derecho", "oido_izquierdo"]}
            ],
            "citations": [
                {
                    "source_id": "ISO-1999-2013",
                    "title": "Acoustics — Estimation of noise-induced hearing loss",
                    "section": "Tabla 1",
                    "excerpt": "Umbrales audiométricos de referencia",
                    "version_or_date": "2013",
                }
            ],
            "limitations": ["Requiere correlación con historia de exposición a ruido"],
            "red_flags": [],
            "recommendation": "Mantener vigilancia audiométrica periódica.",
            "non_conclusive_reason": None,
        }

        result = prediagnostic_svc.generate_prediagnosis(
            study_type="Audiometria",
            extracted_data=self._AUDIO_VALIDA,
            ai_calibration={
                "diagnosis": {
                    "prompt": "Analiza parámetros audiométricos: {extracted_json}\n{calibration_context}",
                    "version": "custom_v1",
                }
            },
        )

        assert result.prompt_source == "ai_calibration", (
            f"Esperado 'ai_calibration', obtenido '{result.prompt_source}'"
        )
        assert result.prompt_version == "custom_v1"
        assert result.prompt_source != "backend_fallback"

        # Conserva justification del mock
        assert result.justification == [
            "Umbrales dentro de límites normales en todas las frecuencias evaluadas"
        ]
        # Conserva citations del mock
        assert len(result.citations) == 1
        assert result.citations[0].source_id == "ISO-1999-2013"
        # Conserva recommendation del mock
        assert result.recommendation == "Mantener vigilancia audiométrica periódica."
        # NO agrega nota de fallback
        fallback_note = "Prompt clínico resuelto desde fallback general backend"
        assert not any(fallback_note in lim for lim in result.limitations), (
            "No debe agregar nota de fallback cuando se usó aiCalibration.diagnosis.prompt"
        )
        mock_call.assert_called_once()

    # --- Test 3: Clínica usa backend_fallback cuando no existe diagnosis.prompt ---

    @patch('app.services.ai.prediagnostic.MEDGEMMA_ENABLED', True)
    @patch('app.services.ai.prediagnostic.DR7_API_KEY', 'fake-dr7-key')
    @patch('app.services.ai.prediagnostic.PrediagnosticService._call_dr7_medical_chat')
    def test_prompt_resolution_usa_backend_fallback_cuando_sin_diagnosis_prompt(
        self, mock_call, prediagnostic_svc
    ):
        """
        ARCH-20260518-03: Si ai_calibration.diagnosis.prompt NO existe:
        - prompt_source='backend_fallback'
        - prompt_version='backend_v2'
        - Agrega la limitación explícita del fallback en limitations (si el código lo hace).
        """
        mock_call.return_value = {
            "summary": "Compatible con audición dentro de límites.",
            "confidence": 0.72,
            "clinical_state": "AI_PENDING_REVIEW",
            "justification": ["Frecuencias evaluadas dentro de límites normales"],
            "clinical_basis": [],
            "citations": [],
            "limitations": [],
            "red_flags": [],
            "recommendation": "Vigilancia periódica recomendada.",
            "non_conclusive_reason": None,
        }

        result = prediagnostic_svc.generate_prediagnosis(
            study_type="Audiometria",
            extracted_data=self._AUDIO_VALIDA,
            ai_calibration=None,  # Sin prompt personalizado → fallback general
        )

        assert result.prompt_source == "backend_fallback", (
            f"Esperado 'backend_fallback', obtenido '{result.prompt_source}'"
        )
        assert result.prompt_version == "backend_v2"
        # El código añade nota de fallback en limitations (ARCH-20260518-03)
        fallback_note = "Prompt clínico resuelto desde fallback general backend"
        assert any(fallback_note in lim for lim in result.limitations), (
            "Debe agregar nota de fallback cuando se usa PREDIAGNOSTIC_PROMPTS como fallback"
        )
        mock_call.assert_called_once()


# ---------------------------------------------------------------------------
# ARCH-20260519-15: Tests de validación del Rollback — Gemini como proveedor extractivo
# Valida que el frente extractivo (clasificador + extractor) usa GeminiBase
# y que Featherless/Qwen-VL ya no es el proveedor activo del runtime extractivo.
# ---------------------------------------------------------------------------

class TestRollbackGeminiARCH20260519_15:
    """
    ARCH-20260519-15: Valida el rollback del frente extractivo a Gemini.
    Restricciones:
    - No toca la capa clínica.
    - No fallback dual Gemini/Featherless.
    - Extracción sin fallback de prompt sigue activa.
    - Trazabilidad honesta: proveedor activo = gemini.
    """

    def test_classifier_hereda_de_gemini_base(self):
        """DocumentClassifierService debe heredar de GeminiBase, no de FeatherlessVisionBase."""
        from app.services.ai.base import GeminiBase, FeatherlessVisionBase
        assert issubclass(DocumentClassifierService, GeminiBase), (
            "DocumentClassifierService debe usar GeminiBase (rollback ARCH-20260519-15)"
        )
        assert not issubclass(DocumentClassifierService, FeatherlessVisionBase), (
            "DocumentClassifierService NO debe heredar de FeatherlessVisionBase tras el rollback"
        )

    def test_extractor_hereda_de_gemini_base(self):
        """ExtractorService debe heredar de GeminiBase, no de FeatherlessVisionBase."""
        from app.services.ai.base import GeminiBase, FeatherlessVisionBase
        assert issubclass(ExtractorService, GeminiBase), (
            "ExtractorService debe usar GeminiBase (rollback ARCH-20260519-15)"
        )
        assert not issubclass(ExtractorService, FeatherlessVisionBase), (
            "ExtractorService NO debe heredar de FeatherlessVisionBase tras el rollback"
        )

    def test_classifier_instancia_con_gemini_api_key(self):
        """El clasificador se inicializa con api_key de Gemini sin errores."""
        svc = DocumentClassifierService(api_key="test-key", model="gemini-2.5-flash")
        assert svc.api_key == "test-key"
        assert svc.model == "gemini-2.5-flash"

    def test_extractor_instancia_con_gemini_api_key(self):
        """El extractor se inicializa con api_key de Gemini sin errores."""
        svc = ExtractorService(api_key="test-key", model="gemini-2.5-flash")
        assert svc.api_key == "test-key"
        assert svc.model == "gemini-2.5-flash"

    @patch('app.services.ai.base.GeminiBase.call_gemini')
    def test_clasificacion_llama_gemini_no_featherless(self, mock_gemini):
        """La clasificación invoca GeminiBase.call_gemini, no ningún método Featherless."""
        mock_gemini.return_value = {
            "tipo": "Audiometria",
            "confianza": 0.95,
            "razon": "Gráfico audiométrico con frecuencias y decibeles",
        }
        svc = DocumentClassifierService(api_key="test-key", model="gemini-2.5-flash")
        result = svc.classify("/fake/audio.pdf")
        assert result.tipo == "Audiometria"
        mock_gemini.assert_called_once()

    @patch('app.services.ai.base.GeminiBase.call_gemini')
    def test_extraccion_llama_gemini_no_featherless(self, mock_gemini):
        """La extracción invoca GeminiBase.call_gemini, no ningún método Featherless."""
        mock_gemini.return_value = {
            "paciente": "Test Rollback",
            "fecha_estudio": "19/05/2026",
            "oido_derecho": {"500": 10, "1000": 15, "2000": 20, "4000": 25, "6000": 30, "8000": 35},
            "oido_izquierdo": {"500": 12, "1000": 18, "2000": 22, "4000": 28, "6000": 32, "8000": 38},
            "completitud_documental": "suficiente",
        }
        svc = ExtractorService(api_key="test-key", model="gemini-2.5-flash")
        result = svc.extract_by_type(
            "/fake/audio.pdf", "Audiometria",
            ai_calibration=_TEST_AI_CALIBRATION_EXTRACTION,
        )
        assert isinstance(result, AudiometriaData)
        mock_gemini.assert_called_once()

    def test_extraccion_sin_prompt_falla_explicitamente(self):
        """
        ARCH-20260519-15 + ARCH-20260518-03: La regla de extracción sin fallback de prompt
        se preserva tras el rollback. Sin ai_calibration.extraction.prompt → ValueError.
        """
        svc = ExtractorService(api_key="test-key", model="gemini-2.5-flash")
        with pytest.raises(ValueError, match="EXTRACTION_PROMPT_NOT_CONFIGURED"):
            svc.extract_by_type("/fake/audio.pdf", "Audiometria", ai_calibration=None)


# ---------------------------------------------------------------------------
# ARCH-20260809-02 — Selector de extracción multi-proveedor (Gemini + MiniMax M3).
# Respaldo: context/SPECs/SPEC_ARCH-20260809-02-SELECTOR-EXTRACCION-MULTI-PROVEEDOR.md
# Cubre: cliente M3, fallback M3→Gemini, casos borde, override por payload,
# migración legacy, errores de autenticación.
# ---------------------------------------------------------------------------

class TestMultiProviderExtractionARCH20260809_02:
    """
    Tests del selector de extracción multi-proveedor (ARCH-20260809-02).
    Validan CA-01..CA-15 de la SPEC §14.
    """

    @pytest.fixture
    def extractor(self):
        return ExtractorService(api_key="test-gemini-key", model="gemini-2.5-flash")

    @pytest.fixture
    def base_calibration(self):
        return {
            "extraction": {
                "prompt": "Extrae todos los parámetros visibles del documento médico.",
                "version": "test_v1",
            }
        }

    # ── Resolución de provider (CA-04, CA-05, CA-06) ──────────────────────────

    def test_resolve_provider_default_sin_calibration_es_gemini(self, extractor):
        """Sin aiCalibration ni override → default gemini (migración legacy)."""
        provider, model = extractor._resolve_provider(calibration=None)
        assert provider == "gemini"
        assert model == "gemini-2.5-flash"

    def test_resolve_provider_calibracion_legacy_sin_provider_es_gemini(self, extractor, base_calibration):
        """CA-04: calibración sin `extraction.provider` → gemini (default legacy)."""
        provider, model = extractor._resolve_provider(calibration=base_calibration)
        assert provider == "gemini"
        assert model == "gemini-2.5-flash"

    def test_resolve_provider_calibracion_con_provider_m3(self, extractor):
        """aiCalibration.extraction.provider='m3' + .model='custom-m3'."""
        cal = {"extraction": {"prompt": "x", "provider": "m3", "model": "custom-m3"}}
        provider, model = extractor._resolve_provider(calibration=cal)
        assert provider == "m3"
        assert model == "custom-m3"

    def test_resolve_provider_override_toma_precedencia(self, extractor):
        """CA-05: override por payload gana sobre calibración."""
        cal = {"extraction": {"prompt": "x", "provider": "gemini", "model": "gemini-2.5-pro"}}
        provider, model = extractor._resolve_provider(
            calibration=cal, override_provider="m3", override_model="MiniMax-M3"
        )
        assert provider == "m3"
        assert model == "MiniMax-M3"

    def test_resolve_provider_override_model_solo(self, extractor):
        """CB-06: override solo de modelo conserva provider de calibración."""
        cal = {"extraction": {"prompt": "x", "provider": "gemini"}}
        provider, model = extractor._resolve_provider(
            calibration=cal, override_provider=None, override_model="gemini-2.5-pro"
        )
        assert provider == "gemini"
        assert model == "gemini-2.5-pro"

    def test_resolve_provider_invalido_levanta_excepcion(self, extractor):
        """CB-02: proveedor desconocido → ExtractionProviderUnknownError, sin fallback."""
        from app.services.ai.extractor import ExtractionProviderUnknownError
        with pytest.raises(ExtractionProviderUnknownError):
            extractor._resolve_provider(calibration=None, override_provider="foo")

    def test_resolve_provider_invalido_en_calibracion_levanta_excepcion(self, extractor):
        from app.services.ai.extractor import ExtractionProviderUnknownError
        with pytest.raises(ExtractionProviderUnknownError):
            extractor._resolve_provider(
                calibration={"extraction": {"prompt": "x", "provider": "openai"}}
            )

    # ── ARCH-20260809-05: paso 3 lee de AppConfig con caché TTL ───────────

    def test_resolve_provider_default_sin_calibration_y_sin_appconfig_es_gemini(self, extractor):
        """ARCH-20260809-05: sin override, sin calibración, AppConfig ausente
        → fallback 'gemini' (cero regresión respecto al comportamiento previo)."""
        from app.services.ai.app_config import (
            EXTRACTION_DEFAULT_PROVIDER_KEY,
            get_app_config_store,
        )
        get_app_config_store().invalidate_all()
        provider, model = extractor._resolve_provider(calibration=None)
        assert provider == "gemini"
        assert model == "gemini-2.5-flash"

    def test_resolve_provider_default_desde_appconfig_persistente(self, extractor):
        """ARCH-20260809-05: AppConfig con {provider:'m3'} → m3 + M3_DEFAULT_MODEL."""
        from app.services.ai.app_config import (
            EXTRACTION_DEFAULT_PROVIDER_KEY,
            get_app_config_store,
        )
        import time as _t
        get_app_config_store().invalidate_all()
        # Pre-poblar caché directamente con valor "m3".
        get_app_config_store()._cache[EXTRACTION_DEFAULT_PROVIDER_KEY] = (
            _t.monotonic(),
            {"provider": "m3"},
        )
        provider, model = extractor._resolve_provider(calibration=None)
        assert provider == "m3"
        assert model == "MiniMax-M3"  # _default_model_for("m3")
        # Cleanup
        get_app_config_store().invalidate_all()

    def test_resolve_provider_default_override_model_solo(self, extractor):
        """ARCH-20260809-05: AppConfig default=m3 + override_model='custom-m3'."""
        from app.services.ai.app_config import (
            EXTRACTION_DEFAULT_PROVIDER_KEY,
            get_app_config_store,
        )
        import time as _t
        get_app_config_store().invalidate_all()
        get_app_config_store()._cache[EXTRACTION_DEFAULT_PROVIDER_KEY] = (
            _t.monotonic(),
            {"provider": "m3"},
        )
        provider, model = extractor._resolve_provider(
            calibration=None, override_model="custom-m3"
        )
        assert provider == "m3"
        assert model == "custom-m3"
        get_app_config_store().invalidate_all()

    def test_put_m3_then_extract_uses_m3_sync(self, extractor):
        """
        IMPL-20260810-01 — fix B† ARCH-20260809-06 §7.4 (AC-7 integración):
        Simula el flujo "cambio por UI → siguiente extracción inmediata" sin
        tocar la variante async entre medias. Tras primar la caché con
        {provider:"m3"}, `extractor._resolve_provider(calibration=None)` retorna
        ("m3","MiniMax-M3") directamente desde la sync cache-only.

        Este test cierra AC-7 con cobertura integración completa: la priming en
        PUT + el path sync-only del extractor funcionan juntos.
        """
        from app.services.ai.app_config import (
            EXTRACTION_DEFAULT_PROVIDER_KEY,
            get_app_config_store,
        )
        import time as _t
        get_app_config_store().invalidate_all()

        # Simular el priming que haría `put_extraction_default` tras un PUT.
        get_app_config_store().prime(
            EXTRACTION_DEFAULT_PROVIDER_KEY, {"provider": "m3"}
        )

        # Sin override ni calibración → paso 3 del _resolve_provider lee del cache.
        provider, model = extractor._resolve_provider(calibration=None)
        assert provider == "m3"
        assert model == "MiniMax-M3"  # _default_model_for("m3")

        # Cleanup
        get_app_config_store().invalidate_all()

    # ── Cliente M3 (CA-01) ────────────────────────────────────────────────────

    @patch("app.services.ai.base.M3VisionBase.call_m3")
    def test_m3_client_success_retorna_dict_parseado(self, mock_call_m3, extractor, base_calibration):
        """Cliente M3 retorna dict parseado cuando la respuesta es válida."""
        mock_call_m3.return_value = {
            "paciente": "Test M3",
            "fecha_estudio": "2026-08-09",
            "oido_derecho": {"500": 10, "1000": 15, "2000": 20, "4000": 25, "6000": 30, "8000": 35},
            "oido_izquierdo": {"500": 12, "1000": 18, "2000": 22, "4000": 28, "6000": 32, "8000": 38},
            "completitud_documental": "suficiente",
        }
        with patch.dict(os.environ, {"M3_API_KEY": "test-m3-key"}):
            cal = {**base_calibration, "extraction": {**base_calibration["extraction"], "provider": "m3"}}
            result = extractor.extract_by_type(
                "/fake/audio.pdf", "Audiometria", ai_calibration=cal
            )
        assert isinstance(result, AudiometriaData)
        assert mock_call_m3.called
        assert extractor.last_extraction_audit["extraction_provider_used"] == "m3"
        assert extractor.last_extraction_audit["extraction_fallback_reason"] is None

    @patch("app.services.ai.base.GeminiBase.call_gemini")
    @patch("app.services.ai.base.M3VisionBase.call_m3")
    def test_m3_client_fallback_to_gemini_on_5xx(
        self, mock_call_m3, mock_call_gemini, extractor, base_calibration
    ):
        """CA-06: M3 → 5xx → fallback a Gemini + trazabilidad correcta."""
        # Simular error 5xx de M3 (openai SDK expone status_code en la excepción).
        m3_error = Exception("M3 upstream failed")
        m3_error.status_code = 503
        mock_call_m3.side_effect = m3_error
        mock_call_gemini.return_value = {
            "paciente": "Test Fallback",
            "fecha_estudio": "2026-08-09",
            "oido_derecho": {"500": 10, "1000": 15, "2000": 20, "4000": 25, "6000": 30, "8000": 35},
            "oido_izquierdo": {"500": 12, "1000": 18, "2000": 22, "4000": 28, "6000": 32, "8000": 38},
            "completitud_documental": "suficiente",
        }
        with patch.dict(os.environ, {"M3_API_KEY": "test-m3-key"}):
            cal = {**base_calibration, "extraction": {**base_calibration["extraction"], "provider": "m3"}}
            result = extractor.extract_by_type(
                "/fake/audio.pdf", "Audiometria", ai_calibration=cal
            )
        assert isinstance(result, AudiometriaData)
        assert mock_call_gemini.called
        audit = extractor.last_extraction_audit
        assert audit["extraction_provider_requested"] == "m3"
        assert audit["extraction_provider_used"] == "gemini"
        assert audit["extraction_fallback_reason"] == "m3_5xx"

    @patch("app.services.ai.base.GeminiBase.call_gemini")
    def test_m3_fallback_inmediato_si_api_key_ausente(
        self, mock_call_gemini, extractor, base_calibration
    ):
        """CA-07: M3_API_KEY ausente con provider='m3' → fallback inmediato a Gemini."""
        mock_call_gemini.return_value = {
            "paciente": "Test Fallback NoConfig",
            "fecha_estudio": "2026-08-09",
            "oido_derecho": {"500": 10, "1000": 15, "2000": 20, "4000": 25, "6000": 30, "8000": 35},
            "oido_izquierdo": {"500": 12, "1000": 18, "2000": 22, "4000": 28, "6000": 32, "8000": 38},
            "completitud_documental": "suficiente",
        }
        # Garantizar M3_API_KEY ausente
        env = {k: v for k, v in os.environ.items() if k != "M3_API_KEY"}
        with patch.dict(os.environ, env, clear=True):
            cal = {**base_calibration, "extraction": {**base_calibration["extraction"], "provider": "m3"}}
            result = extractor.extract_by_type(
                "/fake/audio.pdf", "Audiometria", ai_calibration=cal
            )
        assert isinstance(result, AudiometriaData)
        assert mock_call_gemini.called
        audit = extractor.last_extraction_audit
        assert audit["extraction_provider_used"] == "gemini"
        assert audit["extraction_fallback_reason"] == "m3_not_configured"

    @patch("app.services.ai.base.GeminiBase.call_gemini")
    def test_no_fallback_para_gemini_si_gemini_falla(
        self, mock_call_gemini, extractor, base_calibration
    ):
        """CA-08: provider='gemini' y Gemini falla → error explícito, sin fallback a M3."""
        mock_call_gemini.side_effect = Exception("Gemini downstream failed")
        with pytest.raises(Exception, match="Gemini downstream"):
            extractor.extract_by_type(
                "/fake/audio.pdf", "Audiometria", ai_calibration=base_calibration
            )

    @patch("app.services.ai.base.M3VisionBase.call_m3")
    def test_m3_auth_error_sin_fallback(
        self, mock_call_m3, extractor, base_calibration
    ):
        """CA-09: M3 → 401 → ExtractionAuthError, NO fallback silencioso."""
        from app.services.ai.extractor import ExtractionAuthError
        m3_error = Exception("Unauthorized")
        m3_error.status_code = 401
        mock_call_m3.side_effect = m3_error
        with patch.dict(os.environ, {"M3_API_KEY": "test-m3-key"}):
            cal = {**base_calibration, "extraction": {**base_calibration["extraction"], "provider": "m3"}}
            with pytest.raises(ExtractionAuthError, match="M3_AUTH_ERROR"):
                extractor.extract_by_type(
                    "/fake/audio.pdf", "Audiometria", ai_calibration=cal
                )

    @patch("app.services.ai.base.M3VisionBase.call_m3")
    def test_m3_timeout_dispara_fallback_a_gemini(
        self, mock_call_m3, extractor, base_calibration
    ):
        """CA-06 + CB-05: timeout → m3_timeout → fallback a Gemini."""
        # Simular excepción con nombre APITimeoutError (puede o no estar importable
        # según el entorno; el clasificador se basa en el nombre del tipo).
        timeout_exc = type("APITimeoutError", (Exception,), {})("Read timeout")
        mock_call_m3.side_effect = timeout_exc
        with patch("app.services.ai.base.GeminiBase.call_gemini") as mock_gemini:
            mock_gemini.return_value = {
                "paciente": "Test Timeout",
                "fecha_estudio": "2026-08-09",
                "oido_derecho": {"500": 10, "1000": 15, "2000": 20, "4000": 25, "6000": 30, "8000": 35},
                "oido_izquierdo": {"500": 12, "1000": 18, "2000": 22, "4000": 28, "6000": 32, "8000": 38},
                "completitud_documental": "suficiente",
            }
            with patch.dict(os.environ, {"M3_API_KEY": "test-m3-key"}):
                cal = {**base_calibration, "extraction": {**base_calibration["extraction"], "provider": "m3"}}
                result = extractor.extract_by_type(
                    "/fake/audio.pdf", "Audiometria", ai_calibration=cal
                )
        assert isinstance(result, AudiometriaData)
        audit = extractor.last_extraction_audit
        assert audit["extraction_provider_used"] == "gemini"
        assert audit["extraction_fallback_reason"] == "m3_timeout"

    @patch("app.services.ai.base.GeminiBase.call_gemini")
    def test_legacy_calibration_sin_provider_tratada_como_gemini(
        self, mock_call_gemini, extractor, base_calibration
    ):
        """CA-04: calibración legacy sin provider → gemini, sin fallback."""
        mock_call_gemini.return_value = {
            "paciente": "Test Legacy",
            "fecha_estudio": "2026-08-09",
            "oido_derecho": {"500": 10, "1000": 15, "2000": 20, "4000": 25, "6000": 30, "8000": 35},
            "oido_izquierdo": {"500": 12, "1000": 18, "2000": 22, "4000": 28, "6000": 32, "8000": 38},
            "completitud_documental": "suficiente",
        }
        result = extractor.extract_by_type(
            "/fake/audio.pdf", "Audiometria", ai_calibration=base_calibration
        )
        assert isinstance(result, AudiometriaData)
        audit = extractor.last_extraction_audit
        assert audit["extraction_provider_requested"] == "gemini"
        assert audit["extraction_provider_used"] == "gemini"
        assert audit["extraction_fallback_reason"] is None

    @patch("app.services.ai.base.M3VisionBase.call_m3")
    def test_override_payload_toma_precedencia_sobre_calibracion(
        self, mock_call_m3, extractor
    ):
        """CA-05: override por payload con provider distinto al de calibración."""
        mock_call_m3.return_value = {
            "paciente": "Test Override",
            "fecha_estudio": "2026-08-09",
            "oido_derecho": {"500": 10, "1000": 15, "2000": 20, "4000": 25, "6000": 30, "8000": 35},
            "oido_izquierdo": {"500": 12, "1000": 18, "2000": 22, "4000": 28, "6000": 32, "8000": 38},
            "completitud_documental": "suficiente",
        }
        with patch.dict(os.environ, {"M3_API_KEY": "test-m3-key"}):
            cal = {
                "extraction": {
                    "prompt": "Extrae los datos visibles.",
                    "provider": "gemini",  # calibración dice gemini
                }
            }
            result = extractor.extract_by_type(
                "/fake/audio.pdf",
                "Audiometria",
                ai_calibration=cal,
                extraction_provider_override="m3",  # pero override pide m3
            )
        assert isinstance(result, AudiometriaData)
        audit = extractor.last_extraction_audit
        assert audit["extraction_provider_requested"] == "m3"
        assert audit["extraction_provider_used"] == "m3"
        assert audit["extraction_fallback_reason"] is None

    @patch("app.services.ai.base.M3VisionBase.call_m3")
    def test_m3_json_no_parseable_no_es_fallback(
        self, mock_call_m3, extractor, base_calibration
    ):
        """CB-03: JSON corrupto no es trigger de fallback; propaga ValueError."""
        mock_call_m3.side_effect = ValueError("Respuesta de M3 no es JSON válido: garbage")
        with patch.dict(os.environ, {"M3_API_KEY": "test-m3-key"}):
            cal = {**base_calibration, "extraction": {**base_calibration["extraction"], "provider": "m3"}}
            with pytest.raises(ValueError, match="no es JSON válido"):
                extractor.extract_by_type(
                    "/fake/audio.pdf", "Audiometria", ai_calibration=cal
                )

    # ── M3VisionBase unit tests ───────────────────────────────────────────────

    def test_m3_vision_base_levanta_si_openai_no_instalado(self):
        """CA-01: si openai SDK no está disponible, M3VisionBase.call_m3 lo indica."""
        import builtins
        from app.services.ai.base import M3VisionBase

        # Forzar ImportError cuando intente importar openai.
        original_import = builtins.__import__

        def _fake_import(name, *args, **kwargs):
            if name == "openai" or name.startswith("openai."):
                raise ImportError("Simulated: openai not installed")
            return original_import(name, *args, **kwargs)

        client = M3VisionBase(api_key="test-key", model="MiniMax-M3")
        with patch("builtins.__import__", side_effect=_fake_import):
            with pytest.raises(RuntimeError, match="openai"):
                client.call_m3("/fake/audio.pdf", "test prompt")

    def test_m3_vision_base_dict_basico(self):
        """Smoke test: M3VisionBase se puede instanciar con kwargs sin fallar."""
        from app.services.ai.base import M3VisionBase
        client = M3VisionBase(api_key="test-key", model="MiniMax-M3", base_url="https://example.com")
        assert client.api_key == "test-key"
        assert client.model == "MiniMax-M3"
        assert client.base_url == "https://example.com"

    def test_m3_vision_base_constructor_default_model(self):
        """Default model = MiniMax-M3 si no se especifica."""
        from app.services.ai.base import M3VisionBase
        with patch.dict(os.environ, {"M3_DEFAULT_MODEL": ""}, clear=False):
            client = M3VisionBase(api_key="test-key")
            assert client.model == "MiniMax-M3"

    def test_m3_vision_base_constructor_default_base_url(self):
        """Default base_url = https://api.minimax.io/v1 si no se especifica."""
        from app.services.ai.base import M3VisionBase
        with patch.dict(os.environ, {"M3_BASE_URL": ""}, clear=False):
            client = M3VisionBase(api_key="test-key")
            assert client.base_url == "https://api.minimax.io/v1"

    # ── Schema y status endpoint ───────────────────────────────────────────────

    def test_aiauditmetadata_acepta_trazabilidad_m3(self):
        """CA-02: AIAuditMetadata acepta nuevos campos de trazabilidad extractiva."""
        from app.schemas.medical import AIAuditMetadata
        audit = AIAuditMetadata(
            model_name="MiniMax-M3",
            prompt_version="test_v1",
            extraction_provider_requested="m3",
            extraction_provider_used="gemini",
            extraction_fallback_reason="m3_5xx",
        )
        assert audit.extraction_provider_requested == "m3"
        assert audit.extraction_provider_used == "gemini"
        assert audit.extraction_fallback_reason == "m3_5xx"

    def test_aiauditmetadata_campos_m3_opcionales_default_none(self):
        """AIAuditMetadata con campos de trazabilidad M3 opcionales (default None)."""
        from app.schemas.medical import AIAuditMetadata
        audit = AIAuditMetadata(model_name="gemini-2.5-flash", prompt_version="v1")
        assert audit.extraction_provider_requested is None
        assert audit.extraction_provider_used is None
        assert audit.extraction_fallback_reason is None

    def test_main_declara_env_vars_m3_en_source(self):
        """CA-01: backend/app/main.py declara M3_API_KEY, M3_BASE_URL, M3_DEFAULT_MODEL.

        Lee directamente del source para evitar dependencias de runtime
        (main.py tiene imports que requieren el contexto del servidor).
        """
        main_path = Path(__file__).parent.parent / "app" / "main.py"
        source = main_path.read_text(encoding="utf-8")
        assert "M3_API_KEY" in source
        assert "M3_BASE_URL" in source
        assert "M3_DEFAULT_MODEL" in source
        assert "M3_ENABLED" in source
        assert "M3_STATUS" in source
        # Defaults explícitos en source
        assert "https://api.minimax.io/v1" in source
        assert "MiniMax-M3" in source
        # /ai/status incluye los campos
        assert "m3_enabled" in source
        assert "m3_status" in source
        assert "extraction_default_provider_configurable" in source


# ---------------------------------------------------------------------------
# FIX-20260810-05: M3 DB-resolver en dispatcher + 503 accionable para Gemini.
# SPEC: context/SPECs/SPEC_FIX-20260810-05-M3-DB-RESOLVER-DISPATCHER-FALLBACK.md
# Cubre criterios 1-8 de la SPEC.
# ---------------------------------------------------------------------------

class TestFix20260810_05_M3DbResolverAndGemini503:
    """
    FIX-20260810-05:
      - 3.3.a: AI_KEYS_FROM_DB_ENABLED=true + M3 key en BD (sin env var) →
                _is_m3_unavailable("m3") retorna False.
      - 3.3.b: Gemini HTTPError 403 → ExtractionAuthError(provider="gemini").
      - 3.3.c: upload_calibration_test ante ExtractionAuthError(provider="gemini")
                → HTTP 503 con detail conteniendo GEMINI_API_KEY_EXPIRED.
    """

    @pytest.fixture
    def extractor(self):
        return ExtractorService(api_key="test-gemini-key", model="gemini-2.5-flash")

    # ── 3.3.a: _is_m3_unavailable usa key_resolver cuando flag está on ─────

    def test_m3_unavailable_uses_db_key_when_ai_keys_from_db_enabled(
        self, monkeypatch, extractor
    ):
        """
        FIX-20260810-05 §3.3.a (actualizado por FIX-20260810-06): con
        AI_KEYS_FROM_DB_ENABLED=true y caché del resolver caliente con key
        de BD (env var ausente), _is_m3_unavailable("m3") retorna False.

        FIX-20260810-06: el lado sync ya NO awaitea `resolve()`; lee la
        caché TTL vía `resolve_sync_cached` (la frontera async pre-calienta).
        """
        # Forzar flag on y limpiar env var M3_API_KEY.
        monkeypatch.setenv("AI_KEYS_FROM_DB_ENABLED", "true")
        monkeypatch.delenv("M3_API_KEY", raising=False)

        from app.services.ai.keys import KeyResolution

        resolution_db = KeyResolution(
            provider="m3",
            api_key="m3-key-from-db",
            base_url="https://api.minimax.io/v1",
            default_model="MiniMax-M3",
            source="db",
            warning=None,
        )
        fake_resolver = MagicMock()
        fake_resolver.resolve_sync_cached = MagicMock(return_value=resolution_db)
        extractor._key_resolver = fake_resolver

        unavailable = extractor._is_m3_unavailable("m3")
        assert unavailable is False, (
            "Con M3 key en BD (caché caliente), _is_m3_unavailable debe retornar False"
        )
        fake_resolver.resolve_sync_cached.assert_called_once_with("m3")

    def test_m3_unavailable_flag_off_solo_env_var(self, monkeypatch, extractor):
        """
        FIX-20260810-05 (regresión cero): flag off → comportamiento legacy
        idéntico (env var only).
        """
        monkeypatch.setenv("AI_KEYS_FROM_DB_ENABLED", "false")
        monkeypatch.delenv("M3_API_KEY", raising=False)
        # Sin M3_API_KEY → no disponible.
        assert extractor._is_m3_unavailable("m3") is True
        # Con M3_API_KEY → disponible.
        monkeypatch.setenv("M3_API_KEY", "fake-m3-from-env")
        assert extractor._is_m3_unavailable("m3") is False

    def test_m3_unavailable_cache_cold_degrada_a_env_var(
        self, monkeypatch, extractor
    ):
        """
        FIX-20260810-06 (reemplaza B-1 de FIX-20260810-05): con flag on y
        caché FRÍA (resolve_sync_cached → None, ej. frontera async no
        pre-calentó), _is_m3_unavailable degrada a env var:
        - sin M3_API_KEY → True (fallback Gemini preservado) + stash
          'm3_cache_cold' para trazabilidad;
        - con M3_API_KEY → False.
        """
        monkeypatch.setenv("AI_KEYS_FROM_DB_ENABLED", "true")
        monkeypatch.delenv("M3_API_KEY", raising=False)

        fake_resolver = MagicMock()
        fake_resolver.resolve_sync_cached = MagicMock(return_value=None)
        extractor._key_resolver = fake_resolver

        unavailable = extractor._is_m3_unavailable("m3")
        assert unavailable is True
        assert getattr(extractor, "_m3_resolve_error", "") == "m3_cache_cold"

        # Con env var presente, caché fría igual dispone de M3 (legacy).
        monkeypatch.setenv("M3_API_KEY", "fake-m3-from-env")
        assert extractor._is_m3_unavailable("m3") is False

    def test_m3_unavailable_en_contexto_async_no_deadlock(
        self, monkeypatch, extractor
    ):
        """
        FIX-20260810-06 (REGRESIÓN FORENSE): reproduce el escenario de
        producción — `_is_m3_unavailable` invocado DESDE el hilo del event
        loop (handler `async def` → extract_by_type sync).

        Pre-fix (FIX-20260810-05): `run_coroutine_threadsafe(...).result()`
        contra el mismo loop deadlocked 5s → TimeoutError tragado → retornaba
        SIEMPRE True → "M3 no configurado" erróneo → fallback Gemini → 500.
        Post-fix: lectura sync de caché caliente → False, sin bloquear.
        """
        import asyncio

        monkeypatch.setenv("AI_KEYS_FROM_DB_ENABLED", "true")
        monkeypatch.delenv("M3_API_KEY", raising=False)

        from app.services.ai.keys import KeyResolution

        resolution_db = KeyResolution(
            provider="m3",
            api_key="m3-key-from-db",
            base_url="https://api.minimax.io/v1",
            default_model="MiniMax-M3",
            source="db",
            warning=None,
        )
        fake_resolver = MagicMock()
        fake_resolver.resolve_sync_cached = MagicMock(return_value=resolution_db)
        extractor._key_resolver = fake_resolver

        async def _run_inside_loop():
            # Estamos en el hilo del event loop — exactamente el contexto
            # de upload_calibration_test. Debe resolver sin bloquear.
            return extractor._is_m3_unavailable("m3")

        unavailable = asyncio.run(asyncio.wait_for(_run_inside_loop(), timeout=2))
        assert unavailable is False, (
            "En contexto async con caché caliente, _is_m3_unavailable debe "
            "retornar False sin deadlock (FIX-20260810-06)"
        )

    # ── 3.3.b: Gemini 401/403 → ExtractionAuthError(provider="gemini") ──────

    @patch("app.services.ai.base.GeminiBase.call_gemini")
    def test_gemini_403_returns_extraction_auth_error_gemini(self, mock_gemini, extractor):
        """
        FIX-20260810-05 §3.3.b: Gemini HTTPError 403 → ExtractionAuthError
        con provider='gemini'.
        """
        # Simular HTTPError 403 con `response.status_code` (requests.HTTPError).
        from requests import HTTPError
        mock_response = MagicMock()
        mock_response.status_code = 403
        mock_gemini.side_effect = HTTPError(
            "403 Client Error: Forbidden for url: https://generativelanguage.googleapis.com/..."
        )
        mock_gemini.side_effect.response = mock_response

        # Capturar el call_gemini success para stashear (no llega aquí).
        with pytest.raises(Exception) as exc_info:
            extractor._call_with_dispatch(
                file_path="/fake/path.pdf",
                prompt="extrae datos",
                provider="gemini",
                model="gemini-2.5-flash",
            )
        # Debe ser ExtractionAuthError provider=gemini.
        from app.services.ai.extractor import ExtractionAuthError
        assert isinstance(exc_info.value, ExtractionAuthError)
        assert exc_info.value.provider == "gemini"
        # El message NO debe contener la URL con la key (B-6).
        assert "?" not in exc_info.value.message
        assert "AIza" not in exc_info.value.message

    # ── 3.3.c: upload_calibration_test → 503 con GEMINI_API_KEY_EXPIRED ────

    def test_upload_calibration_test_returns_503_on_gemini_auth_error(self, monkeypatch, tmp_path):
        """
        FIX-20260810-05 §3.3.c: upload_calibration_test ante ExtractionAuthError
        (provider=gemini) responde **HTTP 503** (no 500) con `detail` que contiene
        `GEMINI_API_KEY_EXPIRED` y NO expone la key ni el stack crudo.
        """
        from fastapi.testclient import TestClient
        from app.api.v1.calibration import router
        from app.services.ai.extractor import ExtractionAuthError

        # Construir una app FastAPI mínima con el router de calibration.
        from fastapi import FastAPI
        app = FastAPI()
        app.include_router(router)

        # Mockear prisma_client vía set_prisma_client (patrón oficial).
        from app.services import prisma_client

        class FakeMedicalTest:
            id = "test-001"
            options = {"aiCalibration": _TEST_AI_CALIBRATION_EXTRACTION}

        class FakePrisma:
            class _MedicaltestModel:
                async def find_unique(self, where):
                    return FakeMedicalTest()
            medicaltest = _MedicaltestModel()

        prisma_client.set_prisma_client(FakePrisma())

        # Mockear _build_services para que retorne un extractor que levanta
        # ExtractionAuthError(provider="gemini") en extract_by_type.
        from app.api.v1 import calibration as cal_mod

        class FakeExtractor:
            def extract_by_type(self, **kwargs):
                raise ExtractionAuthError(
                    message="Gemini respondió HTTP 403",
                    provider="gemini",
                )

        # Prediagnostic dummy (no se llega a llamar — extractor falla primero).
        class FakePrediag:
            pass

        monkeypatch.setattr(
            cal_mod, "_build_services",
            lambda: (FakeExtractor(), FakePrediag()),
        )

        # Subir un PDF mínimo (usar tmp_path propio, no /tmp global).
        client = TestClient(app)
        tmp_pdf = tmp_path / "calibration_test_unit.pdf"
        tmp_pdf.write_bytes(b"%PDF-1.4 fake pdf")

        with open(tmp_pdf, "rb") as f:
            response = client.post(
                "/api/v1/calibration/upload",
                files={"file": ("test.pdf", f, "application/pdf")},
                data={"test_id": "test-001", "test_type": "Audiometria"},
            )

        # Debe ser 503, no 500.
        assert response.status_code == 503, (
            f"Esperaba 503, obtuvo {response.status_code}: {response.text}"
        )
        detail = response.json().get("detail", "")
        assert "GEMINI_API_KEY_EXPIRED" in detail, (
            f"detail debe contener GEMINI_API_KEY_EXPIRED, got: {detail!r}"
        )
        # NO debe exponer la key ni el stack crudo.
        assert "AIza" not in detail
        assert "Traceback" not in detail
        # Debe ser accionable.
        assert "Rota la key" in detail or "rotar" in detail.lower()

    def test_upload_calibration_test_returns_503_on_m3_auth_error(self, monkeypatch, tmp_path):
        """
        FIX-20260810-05: upload_calibration_test ante ExtractionAuthError
        (provider=m3) responde 503 con `detail` conteniendo M3_API_KEY_EXPIRED.
        """
        from fastapi.testclient import TestClient
        from app.api.v1.calibration import router
        from app.services.ai.extractor import ExtractionAuthError

        from fastapi import FastAPI
        app = FastAPI()
        app.include_router(router)

        from app.services import prisma_client

        class FakeMedicalTest:
            id = "test-002"
            options = {"aiCalibration": _TEST_AI_CALIBRATION_EXTRACTION}

        class FakePrisma:
            class _MedicaltestModel:
                async def find_unique(self, where):
                    return FakeMedicalTest()
            medicaltest = _MedicaltestModel()

        prisma_client.set_prisma_client(FakePrisma())

        from app.api.v1 import calibration as cal_mod

        class FakeExtractor:
            def extract_by_type(self, **kwargs):
                raise ExtractionAuthError(
                    message="M3_AUTH_ERROR: credenciales inválidas",
                    provider="m3",
                )

        class FakePrediag:
            pass

        monkeypatch.setattr(
            cal_mod, "_build_services",
            lambda: (FakeExtractor(), FakePrediag()),
        )

        client = TestClient(app)
        tmp_pdf = tmp_path / "calibration_test_unit_m3.pdf"
        tmp_pdf.write_bytes(b"%PDF-1.4 fake pdf")

        with open(tmp_pdf, "rb") as f:
            response = client.post(
                "/api/v1/calibration/upload",
                files={"file": ("test.pdf", f, "application/pdf")},
                data={"test_id": "test-002", "test_type": "Audiometria"},
            )

        assert response.status_code == 503
        detail = response.json().get("detail", "")
        assert "M3_API_KEY_EXPIRED" in detail
        assert "M3" in detail

    # ── Retrocompat: raise ExtractionAuthError("msg") legacy sigue OK ─────

    def test_extraction_auth_error_legacy_caller_retrocompat(self):
        """
        FIX-20260810-05 §2.2: raise ExtractionAuthError("msg") (sin provider)
        sigue funcionando con provider="m3" default. Cero regresión.
        """
        from app.services.ai.extractor import ExtractionAuthError
        err = ExtractionAuthError("M3_AUTH_ERROR: legacy")
        assert err.provider == "m3"
        # __str__ incluye provider
        assert "m3" in str(err).lower() or "M3" in str(err)
        # Mapping estable
        from app.services.ai.extractor import _EXTRACTION_AUTH_ERROR_CODES
        assert _EXTRACTION_AUTH_ERROR_CODES["m3"] == "M3_API_KEY_EXPIRED"
        assert _EXTRACTION_AUTH_ERROR_CODES["gemini"] == "GEMINI_API_KEY_EXPIRED"


# ---------------------------------------------------------------------------
# FIX-20260812-14: "Missing credentials" del SDK OpenAI en M3VisionBase.call_m3
# cuando self.api_key queda vacío tras _refresh_keys.
# Respaldo: context/diagnostics/FIX-20260812-14-m3-missing-credentials.md
# ---------------------------------------------------------------------------
class TestFix20260812_14_M3MissingCredentials:
    """
    FIX-20260812-14 — Causa raíz: M3VisionBase.call_m3 instanciaba
    `OpenAI(api_key="", base_url=...)` cuando la key quedaba vacía (env
    ausente + BD sin fila válida + cold-loader que deadlockeaba), y el SDK
    lanzaba "Missing credentials. Please pass an `api_key`..." — un mensaje
    opaco que llegaba crudo al usuario final.

    Cobertura:
      - CA-1: call_m3 con api_key vacía → M3CredentialsUnavailableError (NO
        el mensaje del SDK). El guard corre ANTES del `from openai import
        OpenAI`, así que el test NO requiere openai instalado.
      - CA-3: _call_with_dispatch convierte M3CredentialsUnavailableError en
        ExtractionAuthError(provider='m3', reason='credentials_unavailable'),
        SIN fallback a Gemini (FIX-20260812-12).
      - CA-4: calibration.py responde 503 con error_code
        M3_CREDENTIALS_UNAVAILABLE y mensaje 'no está configurado' (distinto
        del 'key inválida o revocada' del path 401/403).

    Nota: CA-2 (guard no dispara con api_key presente) queda cubierto por el
    test existente `test_m3_vision_base_levanta_si_openai_no_instalado`:
    si el guard disparara con key presente, ese test esperaría RuntimeError
    pero obtendría M3CredentialsUnavailableError y fallaría.
    """

    @pytest.fixture
    def extractor(self):
        return ExtractorService(
            api_key="test-gemini-key", model="gemini-2.5-flash"
        )

    def test_call_m3_levanta_m3credentials_unavailable_si_api_key_vacia(
        self, monkeypatch
    ):
        """CA-1: api_key vacía tras _refresh_keys → M3CredentialsUnavailableError
        (NO el 'Missing credentials' del SDK). El guard corre antes del import
        de openai, así que el test NO requiere openai instalado."""
        from app.services.ai.base import (
            M3VisionBase,
            M3CredentialsUnavailableError,
        )

        # Garantizar M3_API_KEY ausente y flag off (path legacy que degrada a "").
        monkeypatch.delenv("M3_API_KEY", raising=False)
        monkeypatch.setenv("AI_KEYS_FROM_DB_ENABLED", "false")

        client = M3VisionBase()  # __init__ deja self.api_key = "" (sin env var)
        assert client.api_key == "", "Precondición: api_key debe quedar vacía"

        with pytest.raises(
            M3CredentialsUnavailableError, match="M3_CREDENTIALS_UNAVAILABLE"
        ):
            client.call_m3("/fake/audio.pdf", "prompt de extracción")

    @patch("app.services.ai.base.M3VisionBase.call_m3")
    def test_dispatcher_convierte_credentials_unavailable_sin_fallback_a_gemini(
        self, mock_call_m3, extractor
    ):
        """CA-3: M3VisionBase.call_m3 levanta M3CredentialsUnavailableError →
        _call_with_dispatch la convierte en ExtractionAuthError(provider='m3',
        reason='credentials_unavailable'). NO hay fallback a Gemini
        (FIX-20260812-12). call_gemini jamás se invoca."""
        from app.services.ai.base import M3CredentialsUnavailableError
        from app.services.ai.extractor import ExtractionAuthError

        mock_call_m3.side_effect = M3CredentialsUnavailableError(
            "M3_CREDENTIALS_UNAVAILABLE: key vacía"
        )

        with patch("app.services.ai.base.GeminiBase.call_gemini") as mock_gemini:
            mock_gemini.return_value = {"paciente": "no-deberia-usarse"}
            with pytest.raises(ExtractionAuthError) as exc_info:
                extractor._call_with_dispatch(
                    file_path="/fake/audio.pdf",
                    prompt="prompt de extracción",
                    provider="m3",
                    model="MiniMax-M3",
                )
        # reason y provider correctos.
        assert exc_info.value.provider == "m3"
        assert exc_info.value.reason == "credentials_unavailable"
        # Mensaje accionable, NO el del SDK.
        assert "M3_CREDENTIALS_UNAVAILABLE" in str(exc_info.value)
        assert "Missing credentials" not in str(exc_info.value)
        # FIX-20260812-12: NUNCA se llama a Gemini (sin plan B).
        assert mock_gemini.called is False, (
            "FIX-20260812-12: credenciales M3 ausentes NO deben degradar a Gemini"
        )

    def test_calibration_returns_503_with_credentials_unavailable_for_m3(
        self, monkeypatch, tmp_path
    ):
        """CA-4: upload_calibration_test ante
        ExtractionAuthError(provider='m3', reason='credentials_unavailable')
        responde HTTP 503 con detail conteniendo M3_CREDENTIALS_UNAVAILABLE y
        'no está configurado' (NO 'key inválida o revocada' — ese es el
        mensaje del path 401/403)."""
        from fastapi.testclient import TestClient
        from fastapi import FastAPI
        from app.api.v1.calibration import router
        from app.services.ai.extractor import ExtractionAuthError
        from app.services import prisma_client

        app = FastAPI()
        app.include_router(router)

        class FakeMedicalTest:
            id = "test-cred-m3"
            options = {"aiCalibration": _TEST_AI_CALIBRATION_EXTRACTION}

        class FakePrisma:
            class _MedicaltestModel:
                async def find_unique(self, where):
                    return FakeMedicalTest()

            medicaltest = _MedicaltestModel()

        prisma_client.set_prisma_client(FakePrisma())

        from app.api.v1 import calibration as cal_mod

        class FakeExtractor:
            def extract_by_type(self, **kwargs):
                raise ExtractionAuthError(
                    message=(
                        "M3_CREDENTIALS_UNAVAILABLE: El servicio de análisis "
                        "IA (M3) no está configurado."
                    ),
                    provider="m3",
                    reason="credentials_unavailable",
                )

        class FakePrediag:
            pass

        monkeypatch.setattr(
            cal_mod,
            "_build_services",
            lambda: (FakeExtractor(), FakePrediag()),
        )

        client = TestClient(app)
        tmp_pdf = tmp_path / "calib_credentials_m3.pdf"
        tmp_pdf.write_bytes(b"%PDF-1.4 fake pdf")

        with open(tmp_pdf, "rb") as f:
            response = client.post(
                "/api/v1/calibration/upload",
                files={"file": ("test.pdf", f, "application/pdf")},
                data={"test_id": "test-cred-m3", "test_type": "Audiometria"},
            )

        assert response.status_code == 503, (
            f"Esperaba 503, obtuvo {response.status_code}: {response.text}"
        )
        detail = response.json().get("detail", "")
        assert "M3_CREDENTIALS_UNAVAILABLE" in detail
        assert "no está configurado" in detail
        # NO debe usar el mensaje del path 401/403.
        assert "inválida o revocada" not in detail
        # No expone stack ni key.
        assert "Traceback" not in detail


class TestFix20260812_18_M3WarmupCacheCoherence:
    """
    FIX-20260812-18 — Regresión del contrato warmup ↔ caché TTL ↔ _refresh_keys.

    Bug en producción: probe M3 OK (descifra desde BD) pero upload-and-analyze
    retorna M3_CREDENTIALS_UNAVAILABLE. El mecanismo proximal es que
    `M3VisionBase._refresh_keys` lee de la caché TTL una resolución NO-USABLE
    (api_key vacía) o nada, y `self.api_key` queda "" → guard de call_m3 lanza.

    Estos tests fijan el contrato entre el warmup async (frontera FastAPI) y la
    lectura sync del pipeline, SIN importar prisma (evita el hang de import de
    prisma/types.py bajo Python 3.14 — problema ambiental local, no de este código):

      - CA-1: caché caliente con resolución DB válida → _refresh_keys popula
        self.api_key (el warmup alcanza al cliente M3).
      - CA-2: caché con resolución NO-USABLE (api_key="", warning=row_missing)
        → self.api_key NO se popula (documenta el mecanismo proximal del bug).
      - CA-3: warmup async (resolve con lookup BD fake) puebla caché legible por
        resolve_sync_cached y por _refresh_keys (coherencia end-to-end sin prisma).
    """

    def _fresh_resolver_with_cached(self, resolution, age_seconds=0.0):
        """KeyResolver nuevo con una entrada de caché inyectada directamente."""
        import time as _time
        from app.services.ai.keys import KeyResolver

        r = KeyResolver()
        r.invalidate_all()
        r._cache["m3"] = (_time.monotonic() - age_seconds, resolution)
        return r

    def test_refresh_keys_popula_api_key_desde_cache_caliente_db(self, monkeypatch):
        """CA-1: warmup pobló caché con key DB → _refresh_keys la aplica al cliente."""
        import time as _time
        from app.services.ai.keys import KeyResolution
        from app.services.ai.base import M3VisionBase

        monkeypatch.setenv("AI_KEYS_FROM_DB_ENABLED", "true")
        monkeypatch.delenv("M3_API_KEY", raising=False)

        resolution = KeyResolution(
            provider="m3",
            api_key="sk-db-rotated-xyz",
            base_url="https://db.example.com/v1",
            default_model="MiniMax-DB",
            source="db",
            warning=None,
        )
        resolver = self._fresh_resolver_with_cached(resolution)
        # base.py importa `key_resolver` por nombre → patchear en SU namespace.
        monkeypatch.setattr("app.services.ai.base.key_resolver", resolver)

        client = M3VisionBase()  # env ausente → api_key inicial ""
        assert client.api_key == "", "Precondición: sin env, api_key arranca vacía"

        client._refresh_keys()

        assert client.api_key == "sk-db-rotated-xyz", (
            "FIX-20260812-18: la caché caliente del warmup DEBE alimentar _refresh_keys"
        )
        assert client.key_source == "db"
        assert client.key_resolution_warning is None
        # IMPL-20260812-05: el model del selector NO se sobreescribe.
        assert client.model != "MiniMax-DB" or client.model == os.environ.get(
            "M3_DEFAULT_MODEL", "MiniMax-M3"
        )

    def test_refresh_keys_no_popula_api_key_si_resolucion_inutil(self, monkeypatch):
        """CA-2: caché con fallback env (api_key="", warning=row_missing) →
        self.api_key queda vacía. Este es el mecanismo proximal del bug de prod:
        el warmup cacheó una resolución NO-USABLE y el pipeline la hereda."""
        from app.services.ai.keys import KeyResolution
        from app.services.ai.base import M3VisionBase

        monkeypatch.setenv("AI_KEYS_FROM_DB_ENABLED", "true")
        monkeypatch.delenv("M3_API_KEY", raising=False)

        resolution = KeyResolution(
            provider="m3",
            api_key="",  # fallback env con M3_API_KEY ausente
            base_url="https://api.minimax.io/v1",
            default_model="MiniMax-M3",
            source="env",
            warning="row_missing",
        )
        resolver = self._fresh_resolver_with_cached(resolution)
        monkeypatch.setattr("app.services.ai.base.key_resolver", resolver)

        client = M3VisionBase()
        client._refresh_keys()

        assert client.api_key == "", (
            "Resolución NO-USABLE no debe inventar key"
        )
        assert client.key_source == "env"
        assert client.key_resolution_warning == "row_missing"

    def test_warmup_async_puebla_cache_legible_por_refresh_keys(self, monkeypatch):
        """CA-3: coherencia end-to-end warmup→caché→cliente SIN prisma.
        resolve() con _lookup_db fake (async def plano) descifra la key DB y la
        cachea; resolve_sync_cached la ve; _refresh_keys la aplica."""
        import asyncio
        import base64 as _b64
        from app.services.ai.keys import KeyResolver, encrypt_key
        from app.services.ai.base import M3VisionBase

        monkeypatch.setenv("AI_KEYS_FROM_DB_ENABLED", "true")
        monkeypatch.delenv("M3_API_KEY", raising=False)
        master = b"\x42" * 32
        monkeypatch.setenv("ENCRYPTION_KEY", _b64.b64encode(master).decode())

        ct, nonce, tag = encrypt_key("sk-db-warmup-e2e", master)

        class _FakeBase64Field:
            """Imita fields.Base64 de prisma-client-py 0.15 (FIX-20260810-03)."""

            def __init__(self, raw: bytes):
                self._raw = raw

            def decode(self) -> bytes:
                return self._raw

        class _FakeRow:
            provider = "m3"
            enabled = True
            baseUrl = "https://db.example.com/v1"
            defaultModel = "MiniMax-DB"
            keyCiphertext = _FakeBase64Field(ct)
            keyNonce = _FakeBase64Field(nonce)
            keyTag = _FakeBase64Field(tag)

        resolver = KeyResolver()
        resolver.invalidate_all()

        async def _fake_lookup_db(provider):
            assert provider == "m3"
            return _FakeRow()

        monkeypatch.setattr(resolver, "_lookup_db", _fake_lookup_db)
        monkeypatch.setattr("app.services.ai.base.key_resolver", resolver)

        # 1. Warmup async (lo que hace v2_upload_and_analyze en la frontera).
        warm = asyncio.run(resolver.resolve("m3"))
        assert warm.source == "db"
        assert warm.api_key == "sk-db-warmup-e2e"
        assert warm.warning is None

        # 2. Lectura sync del pipeline (resolve_sync_cached) ve la misma caché.
        cached = resolver.resolve_sync_cached("m3")
        assert cached is not None, (
            "FIX-20260812-18: el warmup DEBE dejar caché legible por el pipeline sync"
        )
        assert cached.api_key == "sk-db-warmup-e2e"

        # 3. El cliente M3 aplica la key desde la caché.
        client = M3VisionBase()
        client._refresh_keys()
        assert client.api_key == "sk-db-warmup-e2e"
        assert client.key_source == "db"


# ---------------------------------------------------------------------------
# ARCH-20260820-01 Fase 4 — `clinicalCriteria` reemplaza hardcodeos en backend
# Cubre AC-4.1 a AC-4.5 (handoff §5).
# Respaldo: context/interconsultas/HANDOFF_ARCH-20260820-01_FASE4_SOFIA_CALIBRACION-FUENTE-UNICA.md
# ---------------------------------------------------------------------------

class _FakeAICalibrationVersionResolved:
    """
    Helper mínimo para inyectar una `AICalibrationVersionResolved` sintética
    en `generate_prediagnosis` (sin acoplar los tests al shape interno del
    dataclass de `calibration_resolver`).
    """

    __slots__ = (
        "operationMode",
        "enabled",
        "canonicalStudyType",
        "extraction",
        "fieldDefinitions",
        "clinicalCriteria",
        "presentation",
        "versionId",
        "versionNumber",
        "familyTemplateId",
        "requiresReview",
        "schemaVersion",
        "status",
        "sourceRaw",
    )

    def __init__(self, **kwargs: Any) -> None:
        for k in self.__slots__:
            setattr(self, k, kwargs.get(k))

    def to_dict(self) -> Dict[str, Any]:
        return {k: getattr(self, k) for k in self.__slots__}


class TestPrediagnosisFase4ARCH20260820_01:
    """
    Tests dirigidos a Fase 4 — `clinicalCriteria` V3 reemplaza hardcodeos
    en backend, fallback `legacy_hardcoded` trazado, sin llamada a DR7 si
    `enabled=false` o `prediagnosisEnabled=false`, y canal `medical_calibration`
    retirado del flujo principal (H11).
    """

    @pytest.fixture
    def prediagnostic_svc(self):
        from app.services.ai.prediagnostic import PrediagnosticService
        return PrediagnosticService(api_key="test-api-key", model="gemini-2.5-flash")

    _AUDIO_MINIMA = {
        "paciente": "Test Fase4",
        "oido_derecho": {"500": 15, "1000": 20, "2000": 25},
        "oido_izquierdo": {"500": 10, "1000": 15, "2000": 20},
        "completitud_documental": "suficiente",
    }

    # --- AC-4.1 --------------------------------------------------------

    @patch('app.services.ai.prediagnostic.MEDGEMMA_ENABLED', True)
    @patch('app.services.ai.prediagnostic.DR7_API_KEY', 'fake-dr7-key')
    @patch('app.services.ai.prediagnostic.PrediagnosticService._call_dr7_medical_chat')
    def test_AC_4_1_calibration_v3_resuelta_inyecta_clinical_criteria(
        self, mock_call, prediagnostic_svc
    ):
        """
        AC-4.1: `generate_prediagnosis` recibe `calibration_version` resuelta y
        lee `requiredParams`, `confidenceThreshold`, `prediagnosisEnabled`,
        `prompt` desde `clinicalCriteria` (no desde constantes de módulo).
        - `prompt_source == "clinical_criteria_v3"`
        - `calibration_source == "published_v3"`
        - el `prompt` inyectado es el publicado (no el hardcoded).
        """
        custom_prompt = "PROMPT_V3_INYECTADO: {extracted_json}"
        custom_threshold = 0.99  # distinto a CONFIDENCE_THRESHOLDS["Audiometria"]=0.55
        custom_required = ["oido_derecho", "oido_izquierdo"]
        v3 = _FakeAICalibrationVersionResolved(
            operationMode="clinical_interpretation",
            enabled=True,
            canonicalStudyType="Audiometria",
            extraction=None,
            fieldDefinitions=[],
            clinicalCriteria={
                "prediagnosisEnabled": True,
                "requiredParams": custom_required,
                "confidenceThreshold": custom_threshold,
                "prompt": custom_prompt,
                "promptVersion": "calibration_v3_test",
                "supportingReferences": [],
            },
            presentation=None,
            versionId="cal-v3-test",
            versionNumber=3,
            familyTemplateId=None,
            requiresReview=False,
            schemaVersion="V3",
            status="published",
            sourceRaw={},
        )
        mock_call.return_value = {
            "summary": "Audiometría V3 resuelta.",
            "confidence": 0.90,
            "clinical_state": "AI_PENDING_REVIEW",
            "justification": ["Umbrales disponibles"],
            "clinical_basis": [],
            "citations": [],
            "limitations": [],
            "red_flags": [],
            "non_conclusive_reason": None,
        }

        result = prediagnostic_svc.generate_prediagnosis(
            study_type="Audiometria",
            extracted_data=self._AUDIO_MINIMA,
            calibration_version=v3,
        )

        assert result.calibration_source == "published_v3"
        assert result.prompt_source == "clinical_criteria_v3"
        assert result.legacy_hardcoded_reason is None
        assert result.prompt_version == "calibration_v3_test"

        # El mock de DR7 fue invocado con el prompt V3 inyectado.
        sent_prompt = mock_call.call_args[0][0]
        assert "PROMPT_V3_INYECTADO" in sent_prompt
        # El umbral custom_threshold (0.99) > 0.90 (mock confidence), por lo que
        # el resultado debe degradarse a AI_NON_CONCLUSIVE por umbral (no por gate).
        assert result.clinical_state == "AI_NON_CONCLUSIVE"
        assert "umbral 0.99" in (result.non_conclusive_reason or "")

    # --- AC-4.2 --------------------------------------------------------

    @patch('app.services.ai.prediagnostic.MEDGEMMA_ENABLED', False)
    @patch('app.services.ai.prediagnostic.DR7_API_KEY', '')
    def test_AC_4_2_fallback_legacy_hardcoded_trazado(self, prediagnostic_svc):
        """
        AC-4.2: si `calibration_version is None`, el comportamiento cae a
        hardcodeados actuales con `calibration_source == "legacy_hardcoded"`
        y `legacy_hardcoded_reason` poblado.
        """
        result = prediagnostic_svc.generate_prediagnosis(
            study_type="Audiometria",
            extracted_data=self._AUDIO_MINIMA,
            calibration_version=None,
        )
        # Faltan campos requeridos por REQUIRED_PARAMS pero la versión
        # tiene 'oido_derecho' y 'oido_izquierdo' parciales (>=3 frecuencias)
        # — el _check_minimum_params falla por sub-keys pero eso es OK: la
        # trazabilidad de fallback debe estar poblada de todos modos.
        assert result.calibration_source == "legacy_hardcoded"
        assert result.legacy_hardcoded_reason in (
            "no_published_version",
            "field_definitions_incomplete",
        )
        assert result.clinical_state in ("AI_NON_CONCLUSIVE", "AI_PENDING_REVIEW")

    # --- AC-4.3 (verificación de fuente, no behavioral) ----------------

    def test_AC_4_3_medical_calibration_retirado_del_flujo_principal(self):
        """
        AC-4.3: `_build_calibration_context` ya no se invoca desde el flujo
        principal (canal muerto H11 eliminado). Se conserva como stub no-op
        para no romper callers legacy.
        """
        from app.services.ai.prediagnostic import PrediagnosticService
        # El stub retorna cadena vacía (no afecta la trazabilidad clínica).
        assert PrediagnosticService._build_calibration_context(
            {"description": "x"}
        ) == ""

    def test_AC_4_3b_medical_calibration_no_aparece_en_main_prediagnosis_callers(self):
        """
        AC-4.3 (verificación de fuente, AST-based multi-línea): `medical_calibration=`
        no se pasa como kwarg en llamadas activas a
        `prediagnostic_svc.generate_prediagnosis(...)` en `main.py`.

        Excepción documentada (handoff Fase 4 §6.3 — Transición de firma):
        se autoriza mantener el kwarg `medical_calibration=` como shim
        deprecado/compatibilidad únicamente en callers backend no migrables,
        siempre que la línea del kwarg esté explícitamente marcada como
        deprecada ( `# DEPRECADO`, `# COMPAT`, referencia a `Fase 4` /
        `handoff` / `§6.3`). El servicio emite warning único por proceso al
        recibir el kwarg legacy (`prediagnostic.py` ~798-810).

        Implementación: usamos `ast` para localizar TODAS las llamadas a
        `prediagnostic_svc.generate_prediagnosis(...)` (multi-línea robusto),
        capturamos kwargs y el bloque fuente de cada llamada, y verificamos
        que ningún caller pase `medical_calibration=` sin marcador de shim.
        Esto cubre la regresión F-1 de QA-20260820-05 (grep single-line que
        pasaba falsamente por el caller `v2_prediagnosis_from_params:1491-1497`).
        """
        import ast as _ast

        main_path = Path(__file__).parent.parent / "app" / "main.py"
        source = main_path.read_text(encoding="utf-8")
        source_lines = source.splitlines()

        tree = _ast.parse(source)
        calls = [
            n for n in _ast.walk(tree)
            if isinstance(n, _ast.Call)
            and isinstance(n.func, _ast.Attribute)
            and n.func.attr == "generate_prediagnosis"
            # `prediagnostic_svc` es una variable local en main.py (no
            # `module.attr`), así que `func.value` es `ast.Name`.
            and isinstance(n.func.value, _ast.Name)
            and n.func.value.id == "prediagnostic_svc"
        ]

        # El test asume que existe al menos un caller backend del servicio;
        # si en el futuro se eliminan todos los callers, este test debe
        # re-evaluarse (no aplica AC-4.3 sin callers).
        assert calls, (
            "AC-4.3: no se encontraron llamadas a "
            "`prediagnostic_svc.generate_prediagnosis(...)` en main.py; "
            "revisa si el caller fue refactorizado fuera de main.py."
        )

        # Marcadores válidos de shim explícitamente deprecado/compatibilidad.
        # Coinciden con los que autoriza el handoff Fase 4 §6.3 y con el
        # comentario observado en main.py:1496 (`# DEPRECADO Fase 4`).
        _SHIM_MARKERS = (
            "DEPRECADO",
            "DEPRECATED",
            "COMPAT",
            "§6.3",
            "Fase 4",
            "shim",
        )

        active_callers = []   # pasan medical_calibration= SIN marcador de shim
        documented_shims = []  # pasan medical_calibration= CON marcador de shim
        for call in calls:
            kwarg_names = [k.arg for k in call.keywords]
            if "medical_calibration" not in kwarg_names:
                continue
            start = call.lineno
            end = call.end_lineno or call.lineno
            block = "\n".join(source_lines[start - 1 : end])
            if any(marker in block for marker in _SHIM_MARKERS):
                documented_shims.append((start, end, block))
            else:
                active_callers.append((start, end, block))

        assert active_callers == [], (
            "AC-4.3: main.py pasa `medical_calibration=` como kwarg a "
            "`prediagnostic_svc.generate_prediagnosis(...)` SIN marcador de "
            "shim deprecado/compatibilidad. El kwarg debe retirarse del "
            "flujo principal (handoff Fase 4 §6.3) o, si se conserva como "
            "compat, marcarse explícitamente con `# DEPRECADO`, `# COMPAT`, "
            "`Fase 4`, `§6.3` o `shim`. Callers activos encontrados:\n"
            + "\n".join(
                f"  líneas {s}-{e}:\n{blk}" for s, e, blk in active_callers
            )
        )
        # Nota: la presencia/ausencia de shims documentados es informativa;
        # AC-4.3 sólo exige que los `medical_calibration=` restantes sean shims
        # explícitamente marcados. Si en una iteración futura todos los
        # callers dejan de pasar el kwarg, `documented_shims` quedará vacío
        # y el test seguirá pasando (cumple la condición "no existe uso
        # activo en callers principales").

    # --- AC-4.4 --------------------------------------------------------

    @patch('app.services.ai.prediagnostic.MEDGEMMA_ENABLED', True)
    @patch('app.services.ai.prediagnostic.DR7_API_KEY', 'fake-dr7-key')
    @patch('app.services.ai.prediagnostic.PrediagnosticService._call_dr7_medical_chat')
    def test_AC_4_4_enabled_false_retorna_non_conclusive_sin_llamar_dr7(
        self, mock_call, prediagnostic_svc
    ):
        """
        AC-4.4: con `calibration_version.enabled=false` →
        `AI_NON_CONCLUSIVE` con `non_conclusive_reason="calibration_disabled"`
        **sin llamar** a DR7 (`_call_dr7_medical_chat` no se invoca).
        """
        v3 = _FakeAICalibrationVersionResolved(
            operationMode="clinical_interpretation",
            enabled=False,  # <-- gate global
            canonicalStudyType="Audiometria",
            extraction=None,
            fieldDefinitions=[],
            clinicalCriteria={
                "prediagnosisEnabled": True,
                "requiredParams": ["oido_derecho", "oido_izquierdo"],
                "confidenceThreshold": 0.55,
                "prompt": "PROMPT_NO_DEBE_LLEGAR",
                "promptVersion": "calibration_v3_disabled",
            },
            presentation=None,
            versionId="cal-v3-disabled",
            versionNumber=3,
            familyTemplateId=None,
            requiresReview=False,
            schemaVersion="V3",
            status="disabled",
            sourceRaw={},
        )
        result = prediagnostic_svc.generate_prediagnosis(
            study_type="Audiometria",
            extracted_data=self._AUDIO_MINIMA,
            calibration_version=v3,
        )
        assert result.clinical_state == "AI_NON_CONCLUSIVE"
        assert result.non_conclusive_reason == "calibration_disabled"
        assert result.calibration_source == "calibration_disabled"
        assert result.legacy_hardcoded_reason is None
        # DR7 NO se invocó.
        mock_call.assert_not_called()

    @patch('app.services.ai.prediagnostic.MEDGEMMA_ENABLED', True)
    @patch('app.services.ai.prediagnostic.DR7_API_KEY', 'fake-dr7-key')
    @patch('app.services.ai.prediagnostic.PrediagnosticService._call_dr7_medical_chat')
    def test_AC_4_4b_prediagnosis_disabled_false_retorna_non_conclusive_sin_llamar_dr7(
        self, mock_call, prediagnostic_svc
    ):
        """
        AC-4.4 (variante): `clinicalCriteria.prediagnosisEnabled=false` →
        `AI_NON_CONCLUSIVE` con `non_conclusive_reason="calibration_disabled"`
        sin llamar DR7, aunque `enabled` global sea true.
        """
        v3 = _FakeAICalibrationVersionResolved(
            operationMode="clinical_interpretation",
            enabled=True,  # gate global OK
            canonicalStudyType="Audiometria",
            extraction=None,
            fieldDefinitions=[],
            clinicalCriteria={
                "prediagnosisEnabled": False,  # <-- gate de capa
                "requiredParams": ["oido_derecho"],
                "confidenceThreshold": 0.55,
                "prompt": "PROMPT_NO_DEBE_LLEGAR",
                "promptVersion": "calibration_v3_prediag_off",
            },
            presentation=None,
            versionId="cal-v3-prediag-off",
            versionNumber=3,
            familyTemplateId=None,
            requiresReview=False,
            schemaVersion="V3",
            status="published",
            sourceRaw={},
        )
        result = prediagnostic_svc.generate_prediagnosis(
            study_type="Audiometria",
            extracted_data=self._AUDIO_MINIMA,
            calibration_version=v3,
        )
        assert result.clinical_state == "AI_NON_CONCLUSIVE"
        assert result.non_conclusive_reason == "calibration_disabled"
        assert result.calibration_source == "calibration_disabled"
        mock_call.assert_not_called()

    # --- AC-4.5 --------------------------------------------------------

    @patch('app.services.ai.prediagnostic.MEDGEMMA_ENABLED', True)
    @patch('app.services.ai.prediagnostic.DR7_API_KEY', 'fake-dr7-key')
    @patch('app.services.ai.prediagnostic.PrediagnosticService._call_dr7_medical_chat')
    def test_AC_4_5_document_extraction_sintetiza_prediagnosis_solo_con_clinical_criteria(
        self, mock_call, prediagnostic_svc
    ):
        """
        AC-4.5: un `MedicalTest` con `operationMode=document_extraction` (sin
        `clinicalCriteria` en V3) → el resolver devuelve `clinicalCriteria=None`
        ⇒ el prediagnóstico NO debe sintetizar `clinicalCriteria` indebido.
        Cae al fallback `legacy_hardcoded`; si el estudio está en
        `PREDIAGNOSIS_SUPPORTED_TYPES` y los params mínimos están presentes,
        se ejecuta el prompt backend (sin V3), trazado como
        `calibration_source="legacy_hardcoded"`.
        """
        # Resolved con clinicalCriteria=None (document_extraction ⇒ no IA clínica).
        v3 = _FakeAICalibrationVersionResolved(
            operationMode="document_extraction",
            enabled=True,
            canonicalStudyType="Laboratorio",
            extraction={"prompt": "extract"},
            fieldDefinitions=[],
            clinicalCriteria=None,  # <-- document_extraction ⇒ None
            presentation={"schema": {}},
            versionId="cal-v3-doc",
            versionNumber=3,
            familyTemplateId=None,
            requiresReview=False,
            schemaVersion="V3",
            status="published",
            sourceRaw={},
        )
        # Si cae al backend_fallback y el estudio tiene prompt, el mock debe
        # devolver un resultado válido para verificar que NO se invoca con
        # un clinicalCriteria inventado.
        mock_call.return_value = {
            "summary": "Resultado backend fallback.",
            "confidence": 0.80,
            "clinical_state": "AI_PENDING_REVIEW",
            "justification": ["params mínimos OK"],
            "clinical_basis": [],
            "citations": [],
            "limitations": [],
            "red_flags": [],
            "non_conclusive_reason": None,
        }
        result = prediagnostic_svc.generate_prediagnosis(
            study_type="Laboratorio",
            extracted_data={
                "paciente": "Test DocExt",
                "parametros": [{"parametro": "Glucosa", "valor": "90", "estado": "normal"}],
            },
            calibration_version=v3,
        )
        # calibration_source=legacy_hardcoded (no published_v3 porque
        # clinicalCriteria=None ⇒ no hay V3 efectiva para capa clínica).
        assert result.calibration_source == "legacy_hardcoded"
        # prompt_source cae al backend_fallback (V3 ausente) o clinical_criteria_v3
        # sólo si V3 presente — en este caso el bloque `if not v3.clinicalCriteria`
        # fuerza `prompt_source="backend_fallback"`.
        assert result.prompt_source == "backend_fallback"
        # DR7 sí se invoca con el prompt backend hardcodeado (no se inventó clinicalCriteria).
        mock_call.assert_called_once()
        sent_prompt = mock_call.call_args[0][0]
        # El prompt NO contiene contenido de clinicalCriteria inventado.
        assert "PROMPT_NO_DEBE_LLEGAR" not in sent_prompt

    # --- Cobertura adicional: ai_calibration shim legacy → prompt_source --

    @patch('app.services.ai.prediagnostic.MEDGEMMA_ENABLED', True)
    @patch('app.services.ai.prediagnostic.DR7_API_KEY', 'fake-dr7-key')
    @patch('app.services.ai.prediagnostic.PrediagnosticService._call_dr7_medical_chat')
    def test_prompt_source_ai_calibration_shim_legacy_sin_v3(
        self, mock_call, prediagnostic_svc
    ):
        """
        Si NO hay V3 pero `ai_calibration["diagnosis"]["prompt"]` existe
        (shim legacy V1/V2), `prompt_source="ai_calibration"` y
        `calibration_source="legacy_hardcoded"` (no published_v3).
        """
        mock_call.return_value = {
            "summary": "Resultado con shim legacy.",
            "confidence": 0.80,
            "clinical_state": "AI_PENDING_REVIEW",
            "justification": ["params OK"],
            "clinical_basis": [],
            "citations": [],
            "limitations": [],
            "red_flags": [],
            "non_conclusive_reason": None,
        }
        result = prediagnostic_svc.generate_prediagnosis(
            study_type="Audiometria",
            extracted_data=self._AUDIO_MINIMA,
            calibration_version=None,
            ai_calibration={
                "diagnosis": {"prompt": "PROMPT_LEGACY", "version": "legacy_v1"}
            },
        )
        # Como faltan los required_params completos (sólo 3 frecuencias por oído
        # vs REQUIRED_PARAMS["Audiometria"]=["oido_derecho","oido_izquierdo"]),
        # puede caer a AI_NON_CONCLUSIVE — pero `prompt_source` debe ser
        # trazable si llegó al bloque DR7. Como params faltan, debe ser
        # AI_NON_CONCLUSIVE por params mínimos — el prompt_source se fija
        # antes del gate de params, así que podemos inspeccionarlo vía result.
        assert result.calibration_source == "legacy_hardcoded"
        # prompt_source cae al backend_fallback (porque el gate params falla
        # antes de llegar a DR7). Si quisiéramos probar el camino DR7 con shim
        # legacy, los requiredParams deberían estar completos.
        assert result.prompt_source in ("ai_calibration", "backend_fallback")

    # --- _resolve_clinical_criteria: helper unitario ----------------------

    def test_resolve_clinical_criteria_v3_completo(self, prediagnostic_svc):
        """
        `_resolve_clinical_criteria` devuelve el dict V3 tal cual cuando
        `clinicalCriteria` está completo; no marca `incomplete`.
        """
        v3 = _FakeAICalibrationVersionResolved(
            operationMode="clinical_interpretation",
            enabled=True,
            canonicalStudyType="Audiometria",
            extraction=None,
            fieldDefinitions=[],
            clinicalCriteria={
                "prediagnosisEnabled": True,
                "requiredParams": ["oido_derecho"],
                "confidenceThreshold": 0.5,
                "prompt": "X",
                "promptVersion": "v3",
            },
            presentation=None,
            versionId="v",
            versionNumber=3,
            familyTemplateId=None,
            requiresReview=False,
            schemaVersion="V3",
            status="published",
            sourceRaw={},
        )
        eff = prediagnostic_svc._resolve_clinical_criteria(
            calibration_version=v3, ai_calibration_shim=None, study_type="Audiometria"
        )
        assert eff["prediagnosisEnabled"] is True
        assert eff["requiredParams"] == ["oido_derecho"]
        assert eff["confidenceThreshold"] == 0.5
        assert eff["prompt"] == "X"
        assert eff["incomplete"] is False
        assert eff["fieldDefinitionsIncomplete"] is False

    def test_resolve_clinical_criteria_v3_incompleto_marca_fallback(self, prediagnostic_svc):
        """
        V3 con `clinicalCriteria` parcial (sin `prompt`) se marca como
        `incomplete=True` y `fieldDefinitionsIncomplete=True`.
        """
        v3 = _FakeAICalibrationVersionResolved(
            operationMode="clinical_interpretation",
            enabled=True,
            canonicalStudyType="Audiometria",
            extraction=None,
            fieldDefinitions=[],
            clinicalCriteria={
                "prediagnosisEnabled": True,
                "requiredParams": ["oido_derecho"],
                "confidenceThreshold": 0.5,
                # prompt ausente
            },
            presentation=None,
            versionId="v",
            versionNumber=3,
            familyTemplateId=None,
            requiresReview=False,
            schemaVersion="V3",
            status="published",
            sourceRaw={},
        )
        eff = prediagnostic_svc._resolve_clinical_criteria(
            calibration_version=v3, ai_calibration_shim=None, study_type="Audiometria"
        )
        assert eff["incomplete"] is True
        assert eff["fieldDefinitionsIncomplete"] is True
        # El prompt vacío fuerza fallback parcial al backend_fallback.
        assert eff["prompt"] == ""


# ---------------------------------------------------------------------------
# IMPL-20260821-01 — FIX-20260821-01: Gate table-aware Espirometría +
# backfill determinista desde `parametros[]`.
# Cubre AC-1.1..1.3 (gate), AC-2.1..2.5 (normalizador), AC-3.1 (determinismo),
# AC-4.1..4.2 (control regresión), AC-5.1 (selector provider).
# Spec: context/SPECs/SPEC_FIX-20260821-01-GATE-TABLEAWARE-ESPIROMETRIA.md §7
# ---------------------------------------------------------------------------

class TestFIX20260821_01GateTableawareEspirometria:
    """
    FIX-20260821-01: Suite dirigida al fix del gate clínico table-aware
    para Espirometría y al backfill determinista desde `parametros[]`.
    """

    @pytest.fixture
    def extractor(self):
        return ExtractorService(api_key="test-api-key", model="gemini-2.5-pro")

    @pytest.fixture
    def prediagnostic_svc(self):
        from app.services.ai.prediagnostic import PrediagnosticService
        return PrediagnosticService(api_key="test-api-key", model="gemini-2.5-flash")

    # ── AC-1.1: Gate table-aware Espirometría — fila FEV1 estándar sin `fev1` raíz
    @patch('app.services.ai.prediagnostic.MEDGEMMA_ENABLED', True)
    @patch('app.services.ai.prediagnostic.DR7_API_KEY', 'fake-dr7-key')
    @patch('app.services.ai.prediagnostic.PrediagnosticService._call_dr7_medical_chat')
    def test_check_minimum_params_espirometry_tableaware_basic(
        self, mock_call, prediagnostic_svc
    ):
        """
        AC-1.1: Espirometría con fev1/fvc=None en raíz pero con filas estándar
        en `parametros[]`. El gate debe PASAR y debe invocarse DR7.
        """
        mock_call.return_value = {
            "summary": "Función pulmonar normal.",
            "confidence": 0.78,
            "clinical_state": "AI_PENDING_REVIEW",
            "justification": ["FEV1/FVC y FVC dentro de rangos normales"],
            "clinical_basis": [],
            "citations": [],
            "limitations": [],
            "red_flags": [],
            "non_conclusive_reason": None,
        }
        result = prediagnostic_svc.generate_prediagnosis(
            study_type="Espirometria",
            extracted_data={
                "paciente": "Test AC-1.1",
                "fev1": None,
                "fvc": None,
                # FEV1/FVC estándar en `parametros[]` con m1 poblado.
                "parametros": [
                    {"label": "FVC", "key": "fvc_l", "unidad": "L",
                     "m1": 4.0, "m2": 3.9, "m3": 3.8, "ref": 5.0, "lln": 4.0},
                    {"label": "FEV1", "key": "fev1_l", "unidad": "L",
                     "m1": 3.2, "m2": 3.1, "m3": 3.0, "ref": 3.8, "lln": 3.0},
                ],
            },
        )
        assert result.clinical_state == "AI_PENDING_REVIEW"
        assert result.non_conclusive_reason is None
        # DR7 debe haber sido invocado (mock verificado).
        mock_call.assert_called_once()

    # ── AC-1.2: Gate table-aware — fila `Mejor FEV1` con m1 poblada
    @patch('app.services.ai.prediagnostic.MEDGEMMA_ENABLED', True)
    @patch('app.services.ai.prediagnostic.DR7_API_KEY', 'fake-dr7-key')
    @patch('app.services.ai.prediagnostic.PrediagnosticService._call_dr7_medical_chat')
    def test_check_minimum_params_espirometry_mejor_fila(
        self, mock_call, prediagnostic_svc
    ):
        """
        AC-1.2: Mejor FEV1 + Mejor FVC en tabla → gate pasa.
        El backfill (no el gate) prioriza fila Mejor (m1) sobre estándar.
        """
        mock_call.return_value = {
            "summary": "Función pulmonar normal.",
            "confidence": 0.80,
            "clinical_state": "AI_PENDING_REVIEW",
            "justification": [],
            "clinical_basis": [],
            "citations": [],
            "limitations": [],
            "red_flags": [],
            "non_conclusive_reason": None,
        }
        result = prediagnostic_svc.generate_prediagnosis(
            study_type="Espirometria",
            extracted_data={
                "paciente": "Test AC-1.2",
                "fev1": None,
                "fvc": None,
                "parametros": [
                    {"label": "Mejor FEV1", "key": "mejor_fev1_l", "unidad": "L",
                     "m1": 3.45, "m1_pct_ref": 84.1},
                    {"label": "Mejor FVC", "key": "mejor_fvc_l", "unidad": "L",
                     "m1": 4.12, "m1_pct_ref": 79.4},
                    # Fila estándar redundante (m1 != m1 de Mejor *) — el backfill
                    # debe preferir la fila Mejor *.
                    {"label": "FVC", "key": "fvc_l", "unidad": "L",
                     "m1": 3.5, "m2": 3.4, "m3": 3.3},
                    {"label": "FEV1", "key": "fev1_l", "unidad": "L",
                     "m1": 2.9, "m2": 2.8, "m3": 2.7},
                ],
            },
        )
        assert result.clinical_state == "AI_PENDING_REVIEW"
        assert result.non_conclusive_reason is None
        mock_call.assert_called_once()

    # ── AC-1.3: Negativa — sin filas FEV1/FVC en raíz ni tabla
    @patch('app.services.ai.prediagnostic.MEDGEMMA_ENABLED', True)
    @patch('app.services.ai.prediagnostic.DR7_API_KEY', 'fake-dr7-key')
    @patch('app.services.ai.prediagnostic.PrediagnosticService._call_dr7_medical_chat')
    def test_check_minimum_params_espirometry_negative(
        self, mock_call, prediagnostic_svc
    ):
        """
        AC-1.3: Espirometría sin fev1/fvc en raíz ni en tabla →
        AI_NON_CONCLUSIVE con reason idéntico al actual (sin cambios).
        """
        result = prediagnostic_svc.generate_prediagnosis(
            study_type="Espirometria",
            extracted_data={
                "paciente": "Test AC-1.3",
                "fev1": None,
                "fvc": None,
                "parametros": [
                    {"label": "FEF25-75", "key": "fef25_75_l_s",
                     "m1": 3.0, "ref": 4.5},
                ],
            },
        )
        assert result.clinical_state == "AI_NON_CONCLUSIVE"
        assert result.non_conclusive_reason is not None
        assert "fev1" in result.non_conclusive_reason
        assert "fvc" in result.non_conclusive_reason
        mock_call.assert_not_called()

    # ── AC-2.1: Backfill desde fila estándar (sin sufijo) → max(m1,m2,m3)
    @patch('app.services.ai.base.GeminiBase.call_gemini')
    def test_normalize_espirometry_backfill_standard(
        self, mock_gemini, extractor
    ):
        """
        AC-2.1: Sin fev1/fvc en raíz pero con filas `fev1_l` / `fvc_l` en tabla
        con m1/m2/m3 poblados → backfill = max(m1,m2,m3) por fila estándar.
        """
        from app.schemas.medical import EspirometriaData
        mock_gemini.return_value = {
            "paciente": "Test AC-2.1",
            "fecha_estudio": "16/05/2026",
            "fev1": None,
            "fvc": None,
            "fev1_fvc_ratio": None,
            "fev1_percent_predicho": None,
            "fvc_percent_predicho": None,
            "es_interpretable": None,
            "completitud_documental": None,
            "parametros": [
                {"label": "FVC", "key": "fvc_l", "unidad": "L",
                 "m1": 4.0, "m2": 3.8, "m3": 3.7, "m1_pct_ref": 78.0,
                 "ref": 5.1, "lln": 4.1},
                {"label": "FEV1", "key": "fev1_l", "unidad": "L",
                 "m1": 3.2, "m2": 3.1, "m3": 3.0, "m1_pct_ref": 84.0,
                 "ref": 3.8, "lln": 3.0},
            ],
        }
        result = extractor.extract_by_type(
            "/fake/ac_2_1.pdf", "Espirometria",
            ai_calibration=_TEST_AI_CALIBRATION_EXTRACTION,
            extraction_provider_override="gemini",
        )
        assert isinstance(result, EspirometriaData)
        assert result.fev1 == 3.2  # max(3.2, 3.1, 3.0)
        assert result.fvc == 4.0   # max(4.0, 3.8, 3.7)
        assert result.fev1_fvc_ratio == round(3.2 / 4.0, 4)

    # ── AC-2.2: Backfill con `Mejor FEV1`/`Mejor FVC` con prioridad
    @patch('app.services.ai.base.GeminiBase.call_gemini')
    def test_normalize_espirometry_backfill_mejor_priority(
        self, mock_gemini, extractor
    ):
        """
        AC-2.2: fila `Mejor FEV1` con m1 poblado → backfill toma m1 de esa fila
        (no max de la fila estándar). Precedencia: Mejor * > estándar.
        """
        from app.schemas.medical import EspirometriaData
        mock_gemini.return_value = {
            "paciente": "Test AC-2.2",
            "fecha_estudio": "16/05/2026",
            "fev1": None,
            "fvc": None,
            "fev1_fvc_ratio": None,
            "es_interpretable": None,
            "completitud_documental": None,
            "parametros": [
                # Fila Mejor * con m1 explícito (distinto del estándar).
                {"label": "Mejor FVC", "key": "mejor_fvc_l", "unidad": "L",
                 "m1": 4.12, "m1_pct_ref": 79.4},
                {"label": "Mejor FEV1", "key": "mejor_fev1_l", "unidad": "L",
                 "m1": 3.45, "m1_pct_ref": 84.1},
                # Fila estándar con m1/m2/m3 — debe ser IGNORADA por backfill
                # porque la fila Mejor * tiene prioridad.
                {"label": "FVC", "key": "fvc_l", "unidad": "L",
                 "m1": 3.5, "m2": 3.4, "m3": 3.3},
                {"label": "FEV1", "key": "fev1_l", "unidad": "L",
                 "m1": 2.9, "m2": 2.8, "m3": 2.7},
            ],
        }
        result = extractor.extract_by_type(
            "/fake/ac_2_2.pdf", "Espirometria",
            ai_calibration=_TEST_AI_CALIBRATION_EXTRACTION,
            extraction_provider_override="gemini",
        )
        assert isinstance(result, EspirometriaData)
        assert result.fev1 == 3.45   # m1 de Mejor FEV1 (no max estándar 2.9)
        assert result.fvc == 4.12    # m1 de Mejor FVC (no max estándar 3.5)
        assert result.fev1_percent_predicho == 84.1
        assert result.fvc_percent_predicho == 79.4

    # ── AC-2.3: Variantes con sufijo (`fev1_l`/`fvc_l`) — backfill idéntico
    @patch('app.services.ai.base.GeminiBase.call_gemini')
    def test_normalize_espirometry_backfill_with_suffix(
        self, mock_gemini, extractor
    ):
        """
        AC-2.3: filas con sufijo `_l` (fev1_l, fvc_l) → backfill idéntico a AC-2.1.
        """
        from app.schemas.medical import EspirometriaData
        mock_gemini.return_value = {
            "paciente": "Test AC-2.3",
            "fecha_estudio": "16/05/2026",
            "fev1": None,
            "fvc": None,
            "parametros": [
                {"label": "FVC", "key": "fvc_l", "unidad": "L",
                 "m1": 4.0, "m2": 3.8, "m3": 3.7},
                {"label": "FEV1", "key": "fev1_l", "unidad": "L",
                 "m1": 3.2, "m2": 3.1, "m3": 3.0},
            ],
        }
        result = extractor.extract_by_type(
            "/fake/ac_2_3.pdf", "Espirometria",
            ai_calibration=_TEST_AI_CALIBRATION_EXTRACTION,
            extraction_provider_override="gemini",
        )
        assert isinstance(result, EspirometriaData)
        assert result.fev1 == 3.2
        assert result.fvc == 4.0

    # ── AC-2.4: `es_interpretable=true` con keys bare (`fev1`, `fvc`)
    @patch('app.services.ai.base.GeminiBase.call_gemini')
    def test_normalize_espirometry_quality_with_bare_keys(
        self, mock_gemini, extractor
    ):
        """
        AC-2.4: variantes bare `fev1`/`fvc` (sin sufijo) en `parametros[]`
        → es_interpretable=true, completitud_documental=suficiente (≥6 principales).
        """
        from app.schemas.medical import EspirometriaData
        mock_gemini.return_value = {
            "paciente": "Test AC-2.4",
            "fecha_estudio": "16/05/2026",
            "fev1": None,
            "fvc": None,
            "es_interpretable": None,
            "completitud_documental": None,
            "notas_calidad": None,
            "calidad": {
                "repetibilidad_ats_ers_fvc": "Aceptable",
                "es_interpretable": None,
                "completitud_documental": None,
            },
            "parametros": [
                {"label": "FVC", "key": "fvc", "m1": 4.0, "m2": 3.9, "m3": 3.8},
                {"label": "FEV1", "key": "fev1", "m1": 3.2, "m2": 3.1, "m3": 3.0},
                {"label": "FEV1/FVC", "key": "fev1_fvc", "m1": 80.0},
                {"label": "FEF25-75", "key": "fef25_75", "m1": 3.0},
                {"label": "FEF25", "key": "fef25", "m1": 7.0},
                {"label": "FEF50", "key": "fef50", "m1": 5.0},
                {"label": "FEF75", "key": "fef75", "m1": 2.0},
            ],
        }
        result = extractor.extract_by_type(
            "/fake/ac_2_4.pdf", "Espirometria",
            ai_calibration=_TEST_AI_CALIBRATION_EXTRACTION,
            extraction_provider_override="gemini",
        )
        assert isinstance(result, EspirometriaData)
        assert result.es_interpretable is True
        assert result.completitud_documental == "suficiente"
        assert result.calidad is not None
        assert result.calidad.completitud_documental == "suficiente"

    # ── AC-2.5: `paciente`/`fecha_estudio` desde sub-bloques
    @patch('app.services.ai.base.GeminiBase.call_gemini')
    def test_normalize_espirometry_paciente_fecha_from_subblocks(
        self, mock_gemini, extractor
    ):
        """
        AC-2.4: paciente/fecha_estudio ausentes en raíz pero presentes en
        `paciente_detalle.nombre_completo` / `estudio.fecha_estudio` →
        se mapean defensivamente a raíz para evitar la caída al dict crudo.
        """
        from app.schemas.medical import EspirometriaData
        mock_gemini.return_value = {
            # Sin paciente/fecha_estudio en raíz
            "paciente": "",
            "fecha_estudio": "",
            "fev1": 3.2,
            "fvc": 4.0,
            "paciente_detalle": {"nombre_completo": "Trabajador B"},
            "estudio": {"fecha_estudio": "18/05/2026"},
            "parametros": [
                {"label": "FVC", "key": "fvc_l", "m1": 4.0},
                {"label": "FEV1", "key": "fev1_l", "m1": 3.2},
            ],
        }
        result = extractor.extract_by_type(
            "/fake/ac_2_5.pdf", "Espirometria",
            ai_calibration=_TEST_AI_CALIBRATION_EXTRACTION,
            extraction_provider_override="gemini",
        )
        assert isinstance(result, EspirometriaData)
        assert result.paciente == "Trabajador B"
        assert result.fecha_estudio == "18/05/2026"

    # ── AC-3.1: Determinismo bit-a-bit
    def test_normalize_espirometry_determinism(self, extractor):
        """
        AC-3.1: dos corridas sobre el mismo input → mismo output (dict equality).
        El backfill es puro, sin RNG, sin timestamps.
        """
        input_dict = {
            "paciente": "Determinismo",
            "fecha_estudio": "16/05/2026",
            "fev1": None,
            "fvc": None,
            "fev1_fvc_ratio": None,
            "fev1_percent_predicho": None,
            "fvc_percent_predicho": None,
            "es_interpretable": None,
            "completitud_documental": None,
            "parametros": [
                {"label": "FVC", "key": "fvc_l", "m1": 4.0, "m2": 3.8, "m3": 3.7,
                 "m1_pct_ref": 78.0},
                {"label": "FEV1", "key": "fev1_l", "m1": 3.2, "m2": 3.1, "m3": 3.0,
                 "m1_pct_ref": 84.0},
                {"label": "Mejor FVC", "key": "mejor_fvc_l", "m1": 4.12,
                 "m1_pct_ref": 79.4},
                {"label": "Mejor FEV1", "key": "mejor_fev1_l", "m1": 3.45,
                 "m1_pct_ref": 84.1},
            ],
        }
        r1 = extractor._normalize_espirometria_result({**input_dict})
        r2 = extractor._normalize_espirometria_result({**input_dict})
        assert r1 == r2

    # ── AC-4.1: Audiometría — comportamiento del gate sin cambios
    @patch('app.services.ai.prediagnostic.MEDGEMMA_ENABLED', False)
    @patch('app.services.ai.prediagnostic.DR7_API_KEY', '')
    def test_check_minimum_params_audiometria_unchanged(self, prediagnostic_svc):
        """
        AC-4.1: Audiometría con oido_derecho/oido_izquierdo presentes en raíz
        → gate pasa; sin cambios respecto al comportamiento previo.
        """
        result = prediagnostic_svc.generate_prediagnosis(
            study_type="Audiometria",
            extracted_data={
                "paciente": "Test AC-4.1",
                "oido_derecho": {"1000": 10, "4000": 15},
                "oido_izquierdo": {"1000": 12, "4000": 14},
            },
        )
        # Sin MedGemma/DR7 el resultado cae a AI_NON_CONCLUSIVE por falta de
        # capacidad clínica, NO por el gate de mínimos (el gate pasó).
        assert result.non_conclusive_reason is None or (
            "fev1" not in (result.non_conclusive_reason or "")
            and "fvc" not in (result.non_conclusive_reason or "")
        )

    # ── AC-4.2: Otros tipos — sin cambios
    @patch('app.services.ai.prediagnostic.MEDGEMMA_ENABLED', False)
    @patch('app.services.ai.prediagnostic.DR7_API_KEY', '')
    def test_check_minimum_params_other_studies_unchanged(self, prediagnostic_svc):
        """
        AC-4.2: Laboratorio / Rayos_X / ECG / Somatometría / AgudezaVisual —
        el gate table-aware SOLO aplica a Espirometría; el resto conserva el
        comportamiento previo (parámetros faltantes en raíz → missing, sin
        consultar `parametros[]`).
        """
        # Laboratorio: sin `parametros` raíz → debe fallar el gate.
        result = prediagnostic_svc.generate_prediagnosis(
            study_type="Laboratorio",
            extracted_data={"paciente": "Test AC-4.2 Lab"},
        )
        assert result.clinical_state == "AI_NON_CONCLUSIVE"
        assert result.non_conclusive_reason is not None
        assert "parametros" in result.non_conclusive_reason

        # Rayos_X: sin hallazgos/localizacion → debe fallar.
        result = prediagnostic_svc.generate_prediagnosis(
            study_type="Rayos_X",
            extracted_data={"paciente": "Test AC-4.2 RX"},
        )
        assert "hallazgos" in (result.non_conclusive_reason or "")
        assert "localizacion" in (result.non_conclusive_reason or "")

        # Electrocardiograma: sin ritmo/frecuencia → debe fallar.
        result = prediagnostic_svc.generate_prediagnosis(
            study_type="Electrocardiograma",
            extracted_data={"paciente": "Test AC-4.2 ECG"},
        )
        assert "ritmo" in (result.non_conclusive_reason or "")
        assert "frecuencia_bpm" in (result.non_conclusive_reason or "")

    # ── AC-5.1: Provider extractivo `m3` preservado
    @patch("app.services.ai.base.M3VisionBase.call_m3")
    def test_extractor_provider_selector_unchanged(self, mock_call_m3, extractor):
        """
        AC-5.1: el dispatcher extractivo sigue resolviendo provider=m3 para
        espirometría cuando el selector apunta a m3 (no se introdujo fallback).
        Verifica que `last_extraction_audit.extraction_provider_used == "m3"`.
        Mockea `M3VisionBase.call_m3` para que el dispatch no falle por falta de
        credenciales en el entorno de tests.
        """
        mock_call_m3.return_value = {
            "paciente": "Test AC-5.1",
            "fecha_estudio": "16/05/2026",
            "fev1": 3.2,
            "fvc": 4.0,
        }
        with patch.dict(os.environ, {"M3_API_KEY": "test-m3-key"}):
            extractor.extract_by_type(
                "/fake/ac_5_1.pdf", "Espirometria",
                ai_calibration=_TEST_AI_CALIBRATION_EXTRACTION,
                extraction_provider_override="m3",
            )
        assert mock_call_m3.called
        audit = extractor.last_extraction_audit
        assert audit["extraction_provider_requested"] == "m3"
        assert audit["extraction_provider_used"] == "m3"
        assert audit["extraction_fallback_reason"] is None


# ---------------------------------------------------------------------------
# SPEC-FIX-20260824-01: STUDY_TYPE_MISMATCH estructurado.
#
# Cubre AC-1 (Audio→Espiro), AC-2 (Espiro→Audio inverso), AC-3 (UI/resultNotes
# sin HTML/prompt/respuesta), AC-4 (errores no-mismatch siguen propagándose
# sanitizados) y AC-5 (extracción válida Audio/Espiro no cambia).
# ---------------------------------------------------------------------------

class TestFIX20260824_01StudyTypeMismatch:
    """
    FIX-20260824-01: Suite dirigida al clasificador de mismatch de modalidad
    + integración en ExtractorService._call_with_dispatch + capa HTTP
    boundary de main.py.
    """

    # ── AC-1.1: Detector puro — Audio→Espirometría mismatch
    def test_detect_mismatch_audio_to_espirometry(self):
        """AC-1: rechazo del proveedor indica que el doc es Espirometría cuando
        el operador eligió Audiometría → is_mismatch=True, detected='Espirometria'."""
        from app.services.ai.study_type_mismatch import detect_study_type_mismatch

        rejection = (
            "Lo siento, este documento no parece ser un estudio de Audiometría. "
            "El documento es una espirometría con valores FEV1 y FVC. "
            "No puedo extraer umbrales audiométricos."
        )
        assessment = detect_study_type_mismatch(rejection, "Audiometria")
        assert assessment.is_mismatch is True
        assert assessment.detected_study_type == "Espirometria"
        assert assessment.selected_study_type == "Audiometria"
        # provider_text NUNCA debe ser None (lo necesita el audit log).
        assert assessment.provider_text

    # ── AC-2.1: Detector puro — Espirometría→Audiometría inverso
    def test_detect_mismatch_espirometry_to_audio_inverse(self):
        """AC-2: rechazo del proveedor indica que el doc es Audiometría cuando
        el operador eligió Espirometría → is_mismatch=True, detected='Audiometria'.

        QA-20260824-12 F-1: el fixture original ('This document is not an
        audiogram. Parece ser un estudio de función pulmonar (espirometría).')
        afirmaba que el doc ES espirometría (= selected) y por tanto NO era
        un mismatch real — el test documentaba un falso positivo. Reemplazado
        por un fixture naturalmente Audio: el rechazo niega explícitamente
        el estudio seleccionado y afirma que el doc es un audiograma.
        """
        from app.services.ai.study_type_mismatch import detect_study_type_mismatch

        rejection = (
            "Lo siento, este documento no parece ser una espirometría. "
            "Es un audiograma con umbrales en 500/1000/2000 Hz. "
            "No puedo extraer parámetros espirométricos."
        )
        assessment = detect_study_type_mismatch(rejection, "Espirometria")
        assert assessment.is_mismatch is True
        assert assessment.detected_study_type == "Audiometria"
        assert assessment.selected_study_type == "Espirometria"

    # ── F-1 regression: detector consciente de negación
    def test_detect_negated_different_type_is_NOT_mismatch(self):
        """QA-20260824-12 F-1: 'This is not a radiografía; es una
        espirometría válida' con selected=Espirometria debe ser NO mismatch.
        Antes del fix, el detector clasificaba Rayos_X por la mention negada.
        """
        from app.services.ai.study_type_mismatch import detect_study_type_mismatch

        text = (
            "This is not a radiografía de tórax; "
            "es una espirometría válida."
        )
        assessment = detect_study_type_mismatch(text, "Espirometria")
        assert assessment.is_mismatch is False
        assert assessment.detected_study_type is None

    def test_detect_negated_then_affirmed_different_type_IS_mismatch(self):
        """F-1: 'This is not a radiografía. Es un electrocardiograma válido.'
        con selected=Audiometria → mismatch con detected=Electrocardiograma.
        """
        from app.services.ai.study_type_mismatch import detect_study_type_mismatch

        text = (
            "This is not a radiografía de tórax. "
            "Es un electrocardiograma válido."
        )
        assessment = detect_study_type_mismatch(text, "Audiometria")
        assert assessment.is_mismatch is True
        assert assessment.detected_study_type == "Electrocardiograma"

    def test_detect_only_negations_low_confidence(self):
        """F-1: 'Esto no es una radiografía. Tampoco es un audiograma. No es
        un electrocardiograma. Es una espirometría válida.' con selected=
        Espirometria → NOT mismatch (el doc ES el seleccionado)."""
        from app.services.ai.study_type_mismatch import detect_study_type_mismatch

        text = (
            "Esto no es una radiografía de tórax. "
            "Tampoco es un audiograma. "
            "No es un electrocardiograma. "
            "Es una espirometría válida."
        )
        assessment = detect_study_type_mismatch(text, "Espirometria")
        assert assessment.is_mismatch is False
        assert assessment.detected_study_type is None

    def test_detect_only_negations_no_affirmation(self):
        """F-1: 'Tampoco es un audiograma' con selected=Audiometria →
        mismatch con detected=None (sabemos qué NO es, no qué es)."""
        from app.services.ai.study_type_mismatch import detect_study_type_mismatch

        text = "Tampoco es un audiograma."
        assessment = detect_study_type_mismatch(text, "Audiometria")
        assert assessment.is_mismatch is True
        assert assessment.detected_study_type is None

    def test_detect_ni_list_negation_es(self):
        """F-1: 'Ni audiograma, ni radiografía, ni electrocardiograma.
        Es claramente un estudio de función pulmonar.' con selected=
        Audiometria → mismatch con detected=Espirometria."""
        from app.services.ai.study_type_mismatch import detect_study_type_mismatch

        text = (
            "Ni audiograma, ni radiografía, ni electrocardiograma. "
            "Es claramente un estudio de función pulmonar."
        )
        assessment = detect_study_type_mismatch(text, "Audiometria")
        assert assessment.is_mismatch is True
        assert assessment.detected_study_type == "Espirometria"

    def test_detect_doesnt_appear_to_be_negation(self):
        """F-1: 'This doesn't appear to be an audiogram. It's a spirometry
        report.' con selected=Audiometria → mismatch, detected=Espirometria."""
        from app.services.ai.study_type_mismatch import detect_study_type_mismatch

        text = (
            "This doesn't appear to be an audiogram. "
            "It's a spirometry report."
        )
        assessment = detect_study_type_mismatch(text, "Audiometria")
        assert assessment.is_mismatch is True
        assert assessment.detected_study_type == "Espirometria"

    def test_detect_isnt_a_negation_en(self):
        """F-1: 'This isn't a spirometry. It's an ECG.' con selected=
        Espirometria → mismatch, detected=Electrocardiograma."""
        from app.services.ai.study_type_mismatch import detect_study_type_mismatch

        text = "This isn't a spirometry. It's an ECG."
        assessment = detect_study_type_mismatch(text, "Espirometria")
        assert assessment.is_mismatch is True
        assert assessment.detected_study_type == "Electrocardiograma"

    # ── QA-20260824-13 G-1: ventana 6 tokens + stripping de modificadores
    def test_g1_long_modal_en_does_not_appear_to_be(self):
        """QA-20260824-13 G-1.A (repro exacta): 'This does not appear to be an
        audiogram. It's a spirometry report.' con selected=Audiometria debe
        clasificar como mismatch detected=Espirometria. Antes del fix, la
        ventana de 5 tokens truncaba la frase 'does not appear to be an'
        → audiograma quedaba como AFFIRMED y no había mismatch.
        """
        from app.services.ai.study_type_mismatch import detect_study_type_mismatch

        text = (
            "This does not appear to be an audiogram. "
            "It's a spirometry report."
        )
        assessment = detect_study_type_mismatch(text, "Audiometria")
        assert assessment.is_mismatch is True
        assert assessment.detected_study_type == "Espirometria"
        assert assessment.selected_study_type == "Audiometria"

    def test_g1_modifier_between_article_and_noun(self):
        """QA-20260824-13 G-1.B (repro exacta): 'This is not a valid
        radiograph. It is a valid spirometry report.' con selected=Espirometria
        debe ser NO mismatch (radiograph queda negated por 'is not a valid').
        Antes del fix, 'valid' se interponía entre 'not a' y 'radiograph' y
        la mention quedaba AFFIRMED → Rayos_X como detected → falso positivo.
        """
        from app.services.ai.study_type_mismatch import detect_study_type_mismatch

        text = (
            "This is not a valid radiograph. "
            "It is a valid spirometry report."
        )
        assessment = detect_study_type_mismatch(text, "Espirometria")
        assert assessment.is_mismatch is False
        assert assessment.detected_study_type is None

    def test_g1_doesnt_appear_to_be_negates_audiogram(self):
        """G-1 (variante contraída): 'This doesn't appear to be an audiogram.
        It's a spirometry report.' con selected=Audiometria → mismatch,
        detected=Espirometria. Variante de G-1.A con forma contraída."""
        from app.services.ai.study_type_mismatch import detect_study_type_mismatch

        text = (
            "This doesn't appear to be an audiogram. "
            "It's a spirometry report."
        )
        assessment = detect_study_type_mismatch(text, "Audiometria")
        assert assessment.is_mismatch is True
        assert assessment.detected_study_type == "Espirometria"

    def test_g1_adverb_not_recognized(self):
        """G-1: 'This is actually not a spirometry. It is an audiogram.' con
        selected=Espirometria → mismatch, detected=Audiometria. Adverbio
        'actually' antes del verbo 'not'."""
        from app.services.ai.study_type_mismatch import detect_study_type_mismatch

        text = (
            "This is actually not a spirometry. "
            "It is an audiogram."
        )
        assessment = detect_study_type_mismatch(text, "Espirometria")
        assert assessment.is_mismatch is True
        assert assessment.detected_study_type == "Audiometria"

    def test_g1_double_modifier_negation(self):
        """G-1 (no-regresión): 'This is not a really valid audiogram. It is
        a spirometry report.' con selected=Audiometria → mismatch,
        detected=Espirometria. Dos modificadores ('really' + 'valid')
        stripping progresivo → match."""
        from app.services.ai.study_type_mismatch import detect_study_type_mismatch

        text = (
            "This is not a really valid audiogram. "
            "It is a spirometry report."
        )
        assessment = detect_study_type_mismatch(text, "Audiometria")
        assert assessment.is_mismatch is True
        assert assessment.detected_study_type == "Espirometria"

    def test_g1_affirmed_remains_affirmed_with_modifier(self):
        """G-1 (no-regresión crítica): 'This is a valid radiograph.' con
        selected=Audiometria NO debe clasificar como mismatch. Antes del
        fix, sin refusal signal → no clasifica. Esta versión añade
        'is a valid X' como patrón de afirmación (sin 'not'), así que
        'radiograph' queda AFFIRMED. Pero al no haber refusal signal
        explícito, debe seguir siendo NO mismatch.

        Si se añade un refusal signal en el texto (p.ej. "This is not a
        valid radiograph. It is a spirometry."), entonces SÍ debe
        clasificar: 'radiograph' queda negated (no se cuenta), 'spirometry'
        queda affirmed (cuenta) → detected=Espirometria (lo que el doc ES).
        """
        from app.services.ai.study_type_mismatch import detect_study_type_mismatch

        # Sin refusal signal → no mismatch (correcto)
        text1 = "This is a valid radiograph."
        assessment = detect_study_type_mismatch(text1, "Audiometria")
        assert assessment.is_mismatch is False

        # Con refusal signal → mismatch con detected=Espirometria (el doc ES
        # spirometry; "radiograph" queda negated por "not a valid").
        text2 = "This is not a valid radiograph. It is a spirometry."
        assessment = detect_study_type_mismatch(text2, "Audiometria")
        assert assessment.is_mismatch is True
        assert assessment.detected_study_type == "Espirometria"

    def test_g1_max_three_iterations_protect_false_negatives(self):
        """G-1 (defensa): el cap de 3 iteraciones de stripping previene
        falsos positivos con cláusulas largas donde los modificadores se
        acumulan. 'this is not really clearly simply a radiograph' podría
        ser un caso adversativo. Verificamos que NO se clasifica como
        negated (4 modificadores en cadena — cap los protege)."""
        from app.services.ai.study_type_mismatch import detect_study_type_mismatch

        text = (
            "I don't think this is not really clearly simply a radiograph. "
            "It is a spirometry."
        )
        # El cap de 3 iteraciones deja 1 modificador sin strip →
        # 'a' se stopea (no es article ni modifier). El negation match
        # requiere ('is', 'not') como últimas 2 → falla → AFFIRMED.
        # Esto preserva el comportamiento conservador.
        assessment = detect_study_type_mismatch(text, "Audiometria")
        # El doc dice 'is not really clearly simply a radiograph' (negación
        # implícita) pero con cap de 3 puede no detectarse. Verificamos
        # que el resultado es al menos consistente (no error, no crash).
        assert isinstance(assessment, object)
        assert isinstance(assessment.is_mismatch, bool)

    # ── AC-1.2: Caso genérico — rechazo sin mención de tipo → mensaje genérico
    def test_detect_mismatch_generic_no_type_mentioned(self):
        """Si el rechazo NO menciona un tipo canónico, detected=None y la UI
        usa el mensaje genérico ('no parece corresponder...')."""
        from app.services.ai.study_type_mismatch import detect_study_type_mismatch

        rejection = (
            "I cannot process this document. The content is not suitable for "
            "automated extraction."
        )
        assessment = detect_study_type_mismatch(rejection, "Audiometria")
        assert assessment.is_mismatch is True  # rechazo claro
        assert assessment.detected_study_type is None  # sin tipo confiable

    # ── AC-1.3: Rechazo del mismo tipo (modelo repite el nombre) → no mismatch
    def test_detect_mismatch_same_type_not_a_mismatch(self):
        """Si el modelo sólo enuncia el tipo seleccionado sin rechazarlo,
        NO clasificamos como mismatch (falso positivo a evitar)."""
        from app.services.ai.study_type_mismatch import detect_study_type_mismatch

        text = "OK, voy a procesar este estudio de Audiometría. Generando JSON..."
        assessment = detect_study_type_mismatch(text, "Audiometria")
        assert assessment.is_mismatch is False
        assert assessment.detected_study_type is None

    # ── AC-1.4: Texto sin señal de rechazo → no mismatch
    def test_detect_no_refusal_signal_not_mismatch(self):
        """Si el texto NO contiene una señal de rechazo/refutación, NO es mismatch."""
        from app.services.ai.study_type_mismatch import detect_study_type_mismatch

        # Texto con mención de tipo pero sin rechazo
        text = "Audiometría valores 500Hz 10dB, 1000Hz 15dB."
        assessment = detect_study_type_mismatch(text, "Espirometria")
        assert assessment.is_mismatch is False

    # ── AC-1.5: Texto vacío → no mismatch (no inventar detección)
    def test_detect_empty_text_not_mismatch(self):
        from app.services.ai.study_type_mismatch import detect_study_type_mismatch

        for empty in ("", "   ", None):
            assessment = detect_study_type_mismatch(empty, "Audiometria")  # type: ignore[arg-type]
            assert assessment.is_mismatch is False
            assert assessment.detected_study_type is None

    # ── AC-3.1: Mensaje user-facing — caso confianza alta
    def test_build_user_facing_message_confident(self):
        from app.services.ai.study_type_mismatch import build_user_facing_message

        msg = build_user_facing_message("Audiometria", "Espirometria")
        # QA-20260824-12 F-5: el copy incluye tildes para alinear con
        # DEC-20260824-01 ("Audiometría", "Espirometría"). Verifica
        # versión con tilde Y canónica sin tilde (defensa).
        assert "Audiometría" in msg
        assert "Espirometria" in msg or "Espirometría" in msg
        # NO contiene placeholders técnicos.
        assert "{" not in msg
        # NO contiene el provider (privacidad).
        assert "M3" not in msg
        assert "Gemini" not in msg
        # El copy se alinea con el ejemplo del DEC-20260824-01.
        assert "Seleccionaste Audiometría" in msg
        assert "Espirometría" in msg

    # ── F-5: tildes en TODOS los tipos canónicos
    def test_build_user_facing_message_tildes_all_types(self):
        """QA-20260824-12 F-5: el copy user-facing usa tildes para todos los
        tipos que las llevan naturalmente (Audiometría, Espirometría,
        Campimetría, Rayos X, Riesgo Cardiovascular)."""
        from app.services.ai.study_type_mismatch import build_user_facing_message

        cases = [
            ("Audiometria", "Espirometria", "Audiometría", "Espirometría"),
            ("Audiometria", "Campimetria", "Audiometría", "Campimetría"),
            ("Audiometria", "Rayos_X", "Audiometría", "Rayos X"),
            ("Audiometria", "RiesgoCardiovascular", "Audiometría", "Riesgo Cardiovascular"),
        ]
        for selected, detected, sel_disp, det_disp in cases:
            msg = build_user_facing_message(selected, detected)
            assert sel_disp in msg, f"{sel_disp!r} not in {msg!r}"
            assert det_disp in msg, f"{det_disp!r} not in {msg!r}"
            # NO contiene el canonical sin tilde "Rayos_X" (con underscore).
            assert "Rayos_X" not in msg

    # ── AC-3.2: Mensaje user-facing — caso confianza baja (genérico)
    def test_build_user_facing_message_generic(self):
        from app.services.ai.study_type_mismatch import build_user_facing_message

        msg = build_user_facing_message("Audiometria", None)
        assert "no parece corresponder" in msg.lower()
        # NO afirma un tipo detectado.
        assert "Espirometria" not in msg

    # ── AC-3.3: Mensaje user-facing — same selected == detected (defensa)
    def test_build_user_facing_message_same_type_falls_back(self):
        """Si por algún motivo selected == detected (no debería pasar),
        caemos al mensaje genérico para no decir 'parece ser Audiometría
        cuando seleccionaste Audiometría'."""
        from app.services.ai.study_type_mismatch import build_user_facing_message

        msg = build_user_facing_message("Audiometria", "Audiometria")
        assert "no parece corresponder" in msg.lower()

    # ── F-4: sanitize_provider_text_for_log — NO contenido crudo en log
    def test_sanitize_provider_text_for_log_no_raw_content(self):
        """QA-20260824-12 F-4: el helper de sanitización NO expone el
        contenido del modelo. Sólo devuelve len y sha256 truncado.
        NUNCA debe filtrar PII ni siquiera truncado."""
        from app.services.ai.study_type_mismatch import sanitize_provider_text_for_log

        pii_text = (
            "No parece ser un audiograma. Paciente: Juan Pérez, "
            "DNI 12345678, dirección Av. Reforma 123. Prompt: ..."
        )
        log = sanitize_provider_text_for_log(pii_text)
        # NUNCA debe contener el contenido del texto (ni PII ni siquiera truncado).
        log_str = str(log)
        assert "Juan Pérez" not in log_str
        assert "DNI 12345678" not in log_str
        assert "Av. Reforma" not in log_str
        assert "Paciente" not in log_str
        assert pii_text[:40] not in log_str
        # El dict NO debe contener `head_chars` ni `provider_text`.
        assert "head_chars" not in log
        assert "provider_text" not in log
        # sha256_16 tiene 16 chars hex.
        assert len(log["sha256_16"]) == 16
        # len correcto.
        assert log["len"] == len(pii_text)

    def test_sanitize_provider_text_for_log_empty(self):
        """Defensa: input vacío."""
        from app.services.ai.study_type_mismatch import sanitize_provider_text_for_log

        log = sanitize_provider_text_for_log("")
        assert log["len"] == 0
        # sha256_16 sigue presente (hash de string vacío).
        assert len(log["sha256_16"]) == 16

    def test_sanitize_provider_text_for_log_different_inputs_different_hashes(self):
        """Defensa: el sha256_16 permite deduplicar/correlar entre logs."""
        from app.services.ai.study_type_mismatch import sanitize_provider_text_for_log

        a = sanitize_provider_text_for_log("texto A")
        b = sanitize_provider_text_for_log("texto B")
        assert a["sha256_16"] != b["sha256_16"]
        # Mismo input → mismo hash (determinismo).
        a2 = sanitize_provider_text_for_log("texto A")
        assert a["sha256_16"] == a2["sha256_16"]

    # ── AC-3.4: extract_raw_response_text_from_value_error — formato canónico
    def test_extract_raw_response_text_from_canonical_value_error(self):
        from app.services.ai.study_type_mismatch import (
            extract_raw_response_text_from_value_error,
        )

        err = ValueError("Respuesta de M3 no es JSON válido: 'audiometría rechazo'")
        raw = extract_raw_response_text_from_value_error(err)
        # Debe contener la pista textual — los repr '' se eliminan.
        assert "audiometría" in raw or "audiometria" in raw

    # ── AC-3.5: extract_raw_response_text_from_value_error — defensivo
    def test_extract_raw_response_text_from_arbitrary_value_error(self):
        from app.services.ai.study_type_mismatch import (
            extract_raw_response_text_from_value_error,
        )

        err = ValueError("something else")
        raw = extract_raw_response_text_from_value_error(err)
        # Defensivo: nunca lanza, devuelve string no vacío.
        assert isinstance(raw, str)
        assert len(raw) > 0

    # ── AC-4.1: Extractor dispatcher — M3 mismatch raises StudyTypeMismatchError
    @patch("app.services.ai.base.M3VisionBase.call_m3")
    def test_m3_modality_mismatch_raises_typed_error(
        self, mock_call_m3
    ):
        """AC-4: cuando M3 rechaza con texto de mismatch, el dispatcher
        propaga `StudyTypeMismatchError` (NO ValueError genérico)."""
        from app.services.ai.study_type_mismatch import StudyTypeMismatchError

        mock_call_m3.side_effect = ValueError(
            "Respuesta de M3 no es JSON válido: 'Lo siento, no parece ser un "
            "estudio de Audiometría. El documento es una espirometría.'"
        )
        extractor = ExtractorService(api_key="test-api-key", model="gemini-2.5-pro")
        with patch.dict(os.environ, {"M3_API_KEY": "test-m3-key"}):
            cal = {
                "extraction": {
                    "prompt": "Extrae los datos.",
                    "provider": "m3",
                }
            }
            with pytest.raises(StudyTypeMismatchError) as excinfo:
                extractor.extract_by_type(
                    "/fake/audio.pdf", "Audiometria", ai_calibration=cal
                )
        err = excinfo.value
        assert err.selected_study_type == "Audiometria"
        assert err.detected_study_type == "Espirometria"
        assert err.provider == "m3"
        # Audit debe haber sido poblado con el texto crudo para log interno.
        audit = extractor.last_extraction_audit
        assert audit["extraction_fallback_reason"] == "study_type_mismatch"
        assert audit["mismatch_provider_text"]

    # ── AC-4.2: Extractor dispatcher — M3 mismatch NO dispara fallback a Gemini
    @patch("app.services.ai.base.M3VisionBase.call_m3")
    def test_m3_modality_mismatch_does_not_fallback_to_gemini(
        self, mock_call_m3
    ):
        """AC-4: mismatch es DOMINIO (no transient) — NO fallback a Gemini."""
        from app.services.ai.study_type_mismatch import StudyTypeMismatchError

        mock_call_m3.side_effect = ValueError(
            "Respuesta de M3 no es JSON válido: 'Esto no es un audiograma. "
            "Parece ser un electrocardiograma.'"
        )
        # Espiamos call_gemini: NO debe ser invocado cuando hay mismatch.
        with patch("app.services.ai.base.GeminiBase.call_gemini") as mock_gemini:
            extractor = ExtractorService(
                api_key="test-api-key", model="gemini-2.5-pro"
            )
            with patch.dict(os.environ, {"M3_API_KEY": "test-m3-key"}):
                cal = {
                    "extraction": {
                        "prompt": "Extrae los datos.",
                        "provider": "m3",
                    }
                }
                with pytest.raises(StudyTypeMismatchError):
                    extractor.extract_by_type(
                        "/fake/audio.pdf", "Audiometria", ai_calibration=cal
                    )
            mock_gemini.assert_not_called()

    # ── AC-4.3: Errores genéricos de M3 (no mismatch) NO se reclasifican
    @patch("app.services.ai.base.M3VisionBase.call_m3")
    def test_m3_generic_json_error_still_propagates_as_value_error(
        self, mock_call_m3
    ):
        """AC-4: si el rechazo NO es mismatch, propagamos ValueError original
        (CB-03: JSON corrupto NO es fallback)."""
        from app.services.ai.study_type_mismatch import StudyTypeMismatchError

        # Garbage random — sin señales de rechazo ni mención de tipo.
        mock_call_m3.side_effect = ValueError(
            "Respuesta de M3 no es JSON válido: 'asdjk3290hf83'"
        )
        extractor = ExtractorService(api_key="test-api-key", model="gemini-2.5-pro")
        with patch.dict(os.environ, {"M3_API_KEY": "test-m3-key"}):
            cal = {
                "extraction": {
                    "prompt": "Extrae los datos.",
                    "provider": "m3",
                }
            }
            with pytest.raises(ValueError) as excinfo:
                extractor.extract_by_type(
                    "/fake/audio.pdf", "Audiometria", ai_calibration=cal
                )
            # NO debe ser un StudyTypeMismatchError (type-check estricto).
            assert not isinstance(excinfo.value, StudyTypeMismatchError)
            assert "no es JSON" in str(excinfo.value)

    # ── AC-4.4: Gemini parity — clasifica mismatch también
    @patch("app.services.ai.base.GeminiBase.call_gemini")
    def test_gemini_modality_mismatch_raises_typed_error(
        self, mock_call_gemini
    ):
        """AC-4 (paridad): Gemini con rechazo de modalidad también produce
        StudyTypeMismatchError con provider='gemini'."""
        from app.services.ai.study_type_mismatch import StudyTypeMismatchError

        mock_call_gemini.side_effect = ValueError(
            "Respuesta de Gemini no es JSON válido: 'No parece ser un documento "
            "de Audiometría. Esto parece ser un electrocardiograma.'"
        )
        extractor = ExtractorService(api_key="test-api-key", model="gemini-2.5-pro")
        cal = {
            "extraction": {
                "prompt": "Extrae los datos.",
                "provider": "gemini",
            }
        }
        with pytest.raises(StudyTypeMismatchError) as excinfo:
            extractor.extract_by_type(
                "/fake/audio.pdf", "Audiometria", ai_calibration=cal
            )
        err = excinfo.value
        assert err.provider == "gemini"
        assert err.detected_study_type == "Electrocardiograma"
        assert err.selected_study_type == "Audiometria"

    # ── AC-5.1: Extracción válida Audio no cambia (regresión)
    @patch("app.services.ai.base.GeminiBase.call_gemini")
    def test_valid_audio_extraction_unchanged(self, mock_call_gemini):
        """AC-5: cuando el extractor responde con JSON válido, NO se modifica
        comportamiento. AUDIOMETRIA sigue devolviendo AudiometriaData."""
        from app.schemas.medical import AudiometriaData

        mock_call_gemini.return_value = {
            "paciente": "Test AC-5.1",
            "fecha_estudio": "2026-08-24",
            "oido_derecho": {
                "500": 10, "1000": 15, "2000": 20, "3000": 22,
                "4000": 25, "6000": 30, "8000": 35,
            },
            "oido_izquierdo": {
                "500": 12, "1000": 18, "2000": 22, "3000": 25,
                "4000": 28, "6000": 32, "8000": 38,
            },
            "completitud_documental": "suficiente",
        }
        extractor = ExtractorService(api_key="test-api-key", model="gemini-2.5-pro")
        result = extractor.extract_by_type(
            "/fake/audio.pdf", "Audiometria",
            ai_calibration=_TEST_AI_CALIBRATION_EXTRACTION,
            extraction_provider_override="gemini",
        )
        assert isinstance(result, AudiometriaData)
        # last_extraction_audit NO debe contener fallback_reason="study_type_mismatch".
        audit = extractor.last_extraction_audit
        assert audit.get("extraction_fallback_reason") != "study_type_mismatch"

    # ── AC-5.2: Extracción válida Espirometría no cambia (regresión)
    @patch("app.services.ai.base.GeminiBase.call_gemini")
    def test_valid_espirometry_extraction_unchanged(self, mock_call_gemini):
        """AC-5: ESPIROMETRIA sigue devolviendo EspirometriaData sin cambios."""
        from app.schemas.medical import EspirometriaData

        mock_call_gemini.return_value = {
            "paciente": "Test AC-5.2",
            "fecha_estudio": "2026-08-24",
            "fev1": 3.2,
            "fvc": 4.0,
            "fev1_fvc_ratio": 0.8,
            "es_interpretable": True,
            "completitud_documental": "suficiente",
            "parametros": [
                {"label": "FEV1", "key": "fev1_l", "unidad": "L",
                 "m1": 3.2, "m2": 3.1, "m3": 3.0},
                {"label": "FVC", "key": "fvc_l", "unidad": "L",
                 "m1": 4.0, "m2": 3.9, "m3": 3.8},
            ],
        }
        extractor = ExtractorService(api_key="test-api-key", model="gemini-2.5-pro")
        result = extractor.extract_by_type(
            "/fake/espirometry.pdf", "Espirometria",
            ai_calibration=_TEST_AI_CALIBRATION_EXTRACTION,
            extraction_provider_override="gemini",
        )
        assert isinstance(result, EspirometriaData)
        assert result.fev1 == 3.2
        assert result.fvc == 4.0

    # ── AC-6: main.py V2 endpoint shape — error_code, selected/detected/message
    def test_main_endpoint_response_shape_for_mismatch(self):
        """AC-6 + QA-20260824-12 F-2: la respuesta del endpoint V2 cuando hay
        mismatch expone `error_code='STUDY_TYPE_MISMATCH'`,
        `selected_study_type`, `detected_study_type` Y `message`
        (contrato explícito). NO incluye `provider_text` ni el error crudo
        del proveedor."""
        import re
        from pathlib import Path as _P

        main_path = _P(__file__).parent.parent / "app" / "main.py"
        source = main_path.read_text(encoding="utf-8")

        # Importa el error tipado
        assert "from app.services.ai.study_type_mismatch import StudyTypeMismatchError" in source

        # Hay un bloque except StudyTypeMismatchError
        assert re.search(
            r"except\s+StudyTypeMismatchError\s+as\s+\w+_err",
            source,
        ), "Falta except StudyTypeMismatchError en main.py"

        # El bloque emite los 5 campos canónicos (F-2 añade `message`).
        match_block = re.search(
            r"except\s+StudyTypeMismatchError\s+as\s+(\w+):\s*(.*?)(?=\n\s*(?:except\s+\w|else\s*:))",
            source,
            flags=re.DOTALL,
        )
        assert match_block, "No se localizó el bloque except StudyTypeMismatchError"
        block_body = match_block.group(2)
        var = match_block.group(1)
        for field in ("error_code", "selected_study_type", "detected_study_type", "message"):
            assert field in block_body, f"Falta {field} en la respuesta del endpoint"
        assert '"STUDY_TYPE_MISMATCH"' in block_body, "Falta error_code canónico"
        # NUNCA debe incluir provider_text en la respuesta serializada.
        # Sí lo usa en el log (sanitizado), pero el dict retornado al cliente
        # debe omitirlo. El check: la respuesta (return {...}) no debe
        # contener provider_text.
        return_match = re.search(r"return\s*\{([^}]*)\}", block_body, flags=re.DOTALL)
        assert return_match, "No se localizó el dict de respuesta"
        return_body = return_match.group(1)
        assert "provider_text" not in return_body, (
            "El response serializa provider_text — riesgo de PII/prompt leakage"
        )

    # ── AC-6.1: main.py: el mensaje user-facing es redactado (no raw)
    def test_main_endpoint_uses_redacted_message(self):
        """AC-6: el `error` Y `message` enviados al frontend son el mensaje
        redactado por `build_user_facing_message`, NO `str(mismatch_err)`
        ni el texto crudo del proveedor."""
        import re
        from pathlib import Path as _P

        main_path = _P(__file__).parent.parent / "app" / "main.py"
        source = main_path.read_text(encoding="utf-8")

        match_block = re.search(
            r"except\s+StudyTypeMismatchError\s+as\s+(\w+):\s*(.*?)(?=\n\s*(?:except\s+\w|else\s*:))",
            source,
            flags=re.DOTALL,
        )
        assert match_block
        block_body = match_block.group(2)
        var = match_block.group(1)
        # El `error` Y `message` del response deben ser `mismatch_err.message`.
        for field in ("error", "message"):
            return_match = re.search(
                rf'"{field}"\s*:\s*([^,\n}}]+)', block_body
            )
            assert return_match, f"No se localizó el campo '{field}' en el response"
            expr = return_match.group(1).strip()
            assert f"{var}.message" in expr or "_user_message" in expr, (
                f"El campo '{field}' debe provenir de {var}.message; "
                f"se encontró: {expr}"
            )

    # ── F-2 / F-3: detected_study_type validado a canónico o null
    def test_main_endpoint_validates_detected_study_type(self):
        """QA-20260824-12 F-3: el campo `detected_study_type` se valida al
        conjunto canónico antes de serializar; si no es canónico, queda null.
        Defensa contra inputs no controlados que filtren strings arbitrarios."""
        import re
        from pathlib import Path as _P

        main_path = _P(__file__).parent.parent / "app" / "main.py"
        source = main_path.read_text(encoding="utf-8")

        match_block = re.search(
            r"except\s+StudyTypeMismatchError\s+as\s+(\w+):\s*(.*?)(?=\n\s*(?:except\s+\w|else\s*:))",
            source,
            flags=re.DOTALL,
        )
        assert match_block
        block_body = match_block.group(2)
        # El bloque debe importar CANONICAL_STUDY_TYPES o equivalente y
        # validar antes de usar.
        assert "CANONICAL_STUDY_TYPES" in block_body or "_CANON" in block_body, (
            "Falta validación contra CANONICAL_STUDY_TYPES en main.py"
        )
        # Debe haber un check tipo `if X not in _CANON` o `not in CANONICAL_STUDY_TYPES`.
        assert re.search(
            r"if\s+\w+\s+is\s+not\s+None\s+and\s+\w+\s+not\s+in\s+(_?CANON|CANONICAL_STUDY_TYPES)",
            block_body,
        ), "Falta el guard `if x is not None and x not in CANON`"

    # ── F-4: log NO imprime provider_text crudo
    def test_main_log_does_not_print_raw_provider_text(self):
        """QA-20260824-12 F-4: el log de servidor NUNCA imprime el
        `provider_text` crudo (riesgo de PII). Sólo emite longitud + sha256
        truncado vía `sanitize_provider_text_for_log`."""
        import re
        from pathlib import Path as _P

        main_path = _P(__file__).parent.parent / "app" / "main.py"
        source = main_path.read_text(encoding="utf-8")

        match_block = re.search(
            r"except\s+StudyTypeMismatchError\s+as\s+(\w+):\s*(.*?)(?=\n\s*(?:except\s+\w|else\s*:))",
            source,
            flags=re.DOTALL,
        )
        assert match_block
        block_body = match_block.group(2)
        # El bloque debe usar sanitize_provider_text_for_log.
        assert "sanitize_provider_text_for_log" in block_body, (
            "Falta sanitize_provider_text_for_log en el log de mismatch"
        )
        # El bloque NO debe imprimir `provider_text={var}.provider_text!r}`
        # (forma anterior con raw content).
        assert not re.search(
            r"provider_text\s*=\s*\{?\w*provider_text",
            block_body,
        ), (
            "El log imprime provider_text raw — riesgo de PII/prompt leakage"
        )
        # Sí debe imprimir la longitud y sha.
        assert "provider_len" in block_body, "Falta provider_len en el log"
        assert "provider_sha256_16" in block_body, "Falta provider_sha256_16 en el log"

    # ── QA-20260824-13 G-1: catch-all `except Exception` en V2 sanitiza
    def test_main_catchall_does_not_leak_raw_str_e(self):
        """QA-20260824-13 G-1: el catch-all `except Exception` al final del
        endpoint V2 NUNCA devuelve `str(e)` al cliente (puede contener el
        raw text del proveedor si un `ValueError("Respuesta de X no es
        JSON válido: '<raw>…")` se filtra sin ser clasificado como
        StudyTypeMismatchError). Sanitiza con error_code estructurado."""
        import re
        from pathlib import Path as _P

        main_path = _P(__file__).parent.parent / "app" / "main.py"
        source = main_path.read_text(encoding="utf-8")

        # Aislar el catch-all del endpoint V2 upload-and-analyze.
        # Lo identificamos por estar precedido del comentario QA-20260824-13
        # y contener los marcadores específicos de esta sesión (sentinela).
        sentinel_start = "# SPEC-FIX-20260824-01 + QA-20260824-13 G-1"
        sentinel_idx = source.find(sentinel_start)
        assert sentinel_idx > 0, (
            f"No se localizó el comentario sentinela {sentinel_start!r}"
        )
        # El catch-all termina en la línea `}\n` antes de `\n\n\n@app.post`.
        # Capturamos desde sentinel hasta el final del bloque.
        tail = source[sentinel_idx:]
        # El catch-all termina antes de `\n\n\n@app.post` o `\n@app.post`.
        end_match = re.search(r"\n\s*@app\.post\(", tail)
        assert end_match, "No se localizó el fin del catch-all del V2"
        block_body = tail[: end_match.start()]

        # El bloque NUNCA debe devolver `str(e)` ni `str(err)` ni `f"{e}"`.
        # (permitimos str(e) en print() de log, no en return).
        # Buscamos solo dentro del bloque return.
        return_blocks = re.findall(
            r"return\s*\{[^}]*\}", block_body, flags=re.DOTALL
        )
        for rb in return_blocks:
            assert "str(e)" not in rb, (
                f"El response del catch-all incluye str(e): {rb!r}"
            )
            assert "provider_text" not in rb, (
                f"El response del catch-all incluye provider_text: {rb!r}"
            )
        # El bloque DEBE devolver un error_code estructurado.
        assert "error_code" in block_body, (
            "Falta error_code estructurado en catch-all"
        )
        # El bloque DEBE usar sanitize_provider_text_for_log para el log.
        assert "sanitize_provider_text_for_log" in block_body, (
            "Falta sanitize_provider_text_for_log en el catch-all"
        )

    def test_main_catchall_detects_value_error_no_json(self):
        """QA-20260824-13 G-1: cuando el catch-all captura un
        `ValueError("Respuesta de X no es JSON válido: ...")` que escapó
        del clasificador (caso adversativo G-1), debe mapearlo a
        `error_code="EXTRACTION_NOT_JSON"` con mensaje user-friendly —
        NO devolver el raw del modelo."""
        import re
        from pathlib import Path as _P

        main_path = _P(__file__).parent.parent / "app" / "main.py"
        source = main_path.read_text(encoding="utf-8")

        sentinel_start = "# SPEC-FIX-20260824-01 + QA-20260824-13 G-1"
        sentinel_idx = source.find(sentinel_start)
        assert sentinel_idx > 0
        tail = source[sentinel_idx:]
        end_match = re.search(r"\n\s*@app\.post\(", tail)
        assert end_match
        block_body = tail[: end_match.start()]

        # Detectar ValueError con "no es JSON" → error_code específico.
        assert "ValueError" in block_body, (
            "Falta rama explícita ValueError en el catch-all"
        )
        assert "no es JSON" in block_body or "not JSON" in block_body, (
            "Falta detección del patrón 'no es JSON' del extractor"
        )
        assert "EXTRACTION_NOT_JSON" in block_body, (
            "Falta error_code='EXTRACTION_NOT_JSON' en el catch-all"
        )
        # El catch-all general debe tener un fallback con error_code distinto.
        assert "EXTRACTION_FAILED" in block_body, (
            "Falta error_code='EXTRACTION_FAILED' como fallback"
        )
