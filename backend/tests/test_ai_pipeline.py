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
    @patch('app.services.ai.prediagnostic.FEATHERLESS_API_KEY', 'fake-featherless-key')
    @patch('app.services.ai.prediagnostic.PrediagnosticService._call_featherless_text_only')
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
        assert result.clinical_provider == "featherless"

    def test_ecg_sin_params_minimos_retorna_non_conclusive(self, prediagnostic_svc):
        """ECG sin ritmo ni frecuencia debe retornar AI_NON_CONCLUSIVE."""
        result = prediagnostic_svc.generate_prediagnosis(
            "Electrocardiograma",
            {"paciente": "Test", "hallazgos": []}
        )
        assert result.clinical_state == "AI_NON_CONCLUSIVE"


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
    @patch('app.services.ai.prediagnostic.FEATHERLESS_API_KEY', '')
    def test_prediagnostico_audiometria_usa_calibracion_medica_cuando_disponible(self, prediagnostic_svc):
        """
        Cuando se pasa medical_calibration, el resultado debe tener
        calibration_source='medical_calibration' (sin llamada real a Gemini).
        Se valida el camino de datos, no la respuesta del modelo.
        """
        # Prediagnóstico sin datos mínimos pero verificando el campo calibration_source
        result = prediagnostic_svc.generate_prediagnosis(
            study_type="Audiometria",
            extracted_data={"paciente": "Test"},  # Faltarán oido_derecho y oido_izquierdo
            medical_calibration={"description": "Calibración NOM-011", "version": "v1"},
        )
        # Al faltar parámetros mínimos retorna AI_NON_CONCLUSIVE, pero con calibration_source correcto
        assert result.clinical_state == "AI_NON_CONCLUSIVE"
        assert result.calibration_source == "medical_calibration"
        assert result.clinical_model_used == "google/medgemma-27b-text-it"

    @patch('app.services.ai.prediagnostic.MEDGEMMA_ENABLED', False)
    @patch('app.services.ai.prediagnostic.FEATHERLESS_API_KEY', '')
    def test_prediagnostico_audiometria_usa_fallback_general_sin_calibracion(self, prediagnostic_svc):
        """
        Cuando NO se pasa medical_calibration, el resultado debe tener
        calibration_source='general_fallback'.
        """
        result = prediagnostic_svc.generate_prediagnosis(
            study_type="Audiometria",
            extracted_data={"paciente": "Test"},  # Faltarán oido_derecho y oido_izquierdo
            # Sin medical_calibration → fallback general
        )
        assert result.clinical_state == "AI_NON_CONCLUSIVE"
        assert result.calibration_source == "general_fallback"
        assert result.clinical_model_used == "google/medgemma-27b-text-it"

    @patch('app.services.ai.prediagnostic.MEDGEMMA_ENABLED', False)
    @patch('app.services.ai.prediagnostic.FEATHERLESS_API_KEY', '')
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
    @patch('app.services.ai.prediagnostic.FEATHERLESS_API_KEY', 'fake-featherless-key')
    @patch('app.services.ai.prediagnostic.PrediagnosticService._call_featherless_text_only')
    def test_prediagnostico_espirometria_nominal_con_calibracion(self, mock_call, prediagnostic_svc):
        """
        Espirometría nominal con calibración médica: el prediagnóstico debe completarse
        con calibration_source='medical_calibration' y el modelo clínico trazado.
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
        assert result.calibration_source == "medical_calibration"
        assert result.clinical_model_used == "google/medgemma-27b-text-it"
        assert result.confidence >= 0.60


if __name__ == "__main__":
    pytest.main([__file__, "-v"])


# ---------------------------------------------------------------------------
# IMPL-20260513-03: Tests del proveedor MedGemma/Featherless
# Valida selección de proveedor, trazabilidad de clinical_provider y fallback.
# ---------------------------------------------------------------------------

class TestMedGemmaFeatherlessProvider:
    """
    Tests para la integración MedGemma vía Featherless (OpenAI SDK).
    IMPL-20260513-03: Selección de proveedor, trazabilidad y degradación honesta.
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
    @patch('app.services.ai.prediagnostic.FEATHERLESS_API_KEY', '')
    def test_sin_medgemma_retorna_non_conclusive_y_no_usa_gemini(self, prediagnostic_svc):
        """
        FIX-20260518-02: sin MedGemma disponible no se debe rescatar con Gemini.
        """
        result = prediagnostic_svc.generate_prediagnosis("Espirometria", self.ESPIRO_VALIDA)
        assert result.clinical_provider == "featherless"
        assert result.clinical_state == "AI_NON_CONCLUSIVE"
        assert "Gemini se usa solo para extracción" in (result.non_conclusive_reason or "")

    @patch('app.services.ai.prediagnostic.MEDGEMMA_ENABLED', True)
    @patch('app.services.ai.prediagnostic.FEATHERLESS_API_KEY', '')
    def test_medgemma_enabled_pero_sin_key_retorna_non_conclusive(self, prediagnostic_svc):
        """
        FIX-20260518-02: si falta FEATHERLESS_API_KEY no existe fallback clínico a Gemini.
        """
        result = prediagnostic_svc.generate_prediagnosis("Espirometria", self.ESPIRO_VALIDA)
        assert result.clinical_provider == "featherless"
        assert result.clinical_state == "AI_NON_CONCLUSIVE"
        assert "falta FEATHERLESS_API_KEY" in (result.non_conclusive_reason or "")

    @patch('app.services.ai.prediagnostic.MEDGEMMA_ENABLED', True)
    @patch('app.services.ai.prediagnostic.FEATHERLESS_API_KEY', 'fake-featherless-key')
    @patch('app.services.ai.prediagnostic.FEATHERLESS_MODEL', 'google/medgemma-27b-text-it')
    @patch('app.services.ai.prediagnostic.PrediagnosticService._call_featherless_text_only')
    def test_medgemma_enabled_con_key_llama_featherless(self, mock_featherless, prediagnostic_svc):
        """
        MEDGEMMA_ENABLED=true + FEATHERLESS_API_KEY presente → llama a _call_featherless_text_only.
        clinical_provider debe ser 'featherless' y clinical_model_used el modelo Featherless.
        """
        mock_featherless.return_value = self.MOCK_PREDIAGNOSIS_RESPONSE.copy()
        result = prediagnostic_svc.generate_prediagnosis("Espirometria", self.ESPIRO_VALIDA)
        assert result.clinical_provider == "featherless"
        assert result.clinical_model_used == "google/medgemma-27b-text-it"
        assert result.clinical_state == "AI_PENDING_REVIEW"
        mock_featherless.assert_called_once()

    @patch('app.services.ai.prediagnostic.MEDGEMMA_ENABLED', True)
    @patch('app.services.ai.prediagnostic.FEATHERLESS_API_KEY', 'fake-featherless-key')
    @patch('app.services.ai.prediagnostic.PrediagnosticService._call_featherless_text_only')
    def test_featherless_error_retorna_non_conclusive_con_provider_trazado(self, mock_featherless, prediagnostic_svc):
        """
        Si Featherless lanza excepción, retorna AI_NON_CONCLUSIVE con clinical_provider='featherless'
        para mantener trazabilidad del proveedor que falló.
        """
        mock_featherless.side_effect = RuntimeError("Featherless timeout")
        result = prediagnostic_svc.generate_prediagnosis("Espirometria", self.ESPIRO_VALIDA)
        assert result.clinical_state == "AI_NON_CONCLUSIVE"
        assert result.clinical_provider == "featherless"
        assert result.non_conclusive_reason is not None
        assert "featherless" in result.non_conclusive_reason.lower()

    @patch('app.services.ai.prediagnostic.MEDGEMMA_ENABLED', True)
    @patch('app.services.ai.prediagnostic.FEATHERLESS_API_KEY', 'fake-featherless-key')
    @patch('app.services.ai.prediagnostic.PrediagnosticService._call_featherless_text_only')
    def test_featherless_gated_retorna_non_conclusive_sin_fallback_a_gemini(
        self,
        mock_featherless,
        prediagnostic_svc,
    ):
        """
        FIX-20260518-02: si Featherless cae por modelo gated, el resultado debe ser
        no concluyente; Gemini no participa en la capa clínica.
        """
        mock_featherless.side_effect = RuntimeError("FEATHERLESS_GATED: model_gated_needs_oauth")

        result = prediagnostic_svc.generate_prediagnosis("Espirometria", self.ESPIRO_VALIDA)

        assert result.clinical_provider == "featherless"
        assert result.clinical_state == "AI_NON_CONCLUSIVE"
        assert result.clinical_model_used == "google/medgemma-27b-text-it"
        assert any("model_gated_needs_oauth" in limitation for limitation in result.limitations)
        mock_featherless.assert_called_once()

    @patch('app.services.ai.prediagnostic.MEDGEMMA_ENABLED', True)
    @patch('app.services.ai.prediagnostic.FEATHERLESS_API_KEY', 'fake-featherless-key')
    @patch('app.services.ai.prediagnostic.PrediagnosticService._call_featherless_text_only')
    def test_non_conclusive_por_params_expone_clinical_provider(self, mock_featherless, prediagnostic_svc):
        """
        Incluso en early-return por params mínimos, clinical_provider queda trazado.
        """
        result = prediagnostic_svc.generate_prediagnosis(
            "Espirometria",
            {"paciente": "Test", "fev1": None, "fvc": None, "es_interpretable": False}
        )
        assert result.clinical_state == "AI_NON_CONCLUSIVE"
        assert result.clinical_provider == "featherless"
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

    # --- Prediagnóstico: caso conflictivo FVC reducida + ratio conservado ---

    @patch('app.services.ai.prediagnostic.MEDGEMMA_ENABLED', True)
    @patch('app.services.ai.prediagnostic.FEATHERLESS_API_KEY', 'fake-featherless-key')
    @patch('app.services.ai.prediagnostic.PrediagnosticService._call_featherless_text_only')
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
    @patch('app.services.ai.prediagnostic.FEATHERLESS_API_KEY', 'fake-featherless-key')
    @patch('app.services.ai.prediagnostic.PrediagnosticService._call_featherless_text_only')
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
    @patch('app.services.ai.prediagnostic.FEATHERLESS_API_KEY', '')
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
    @patch('app.services.ai.prediagnostic.FEATHERLESS_API_KEY', '')
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
    @patch('app.services.ai.prediagnostic.FEATHERLESS_API_KEY', 'fake-featherless-key')
    @patch('app.services.ai.prediagnostic.PrediagnosticService._call_featherless_text_only')
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
    @patch('app.services.ai.prediagnostic.FEATHERLESS_API_KEY', 'fake-featherless-key')
    @patch('app.services.ai.prediagnostic.PrediagnosticService._call_featherless_text_only')
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
