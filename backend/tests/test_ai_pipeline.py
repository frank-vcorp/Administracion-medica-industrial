"""
Tests para el Pipeline IA Modular.
IMPL-20260225-01: Clasificación y extracción de documentos médicos.
IMPL-20260326-17: Tests para Campimetria (GEN-O1WV7), Electrocardiograma (GEN-C85PD), RiesgoCardiovascular (GEN-U5BQX).
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
    CampimetriaData,
    ElectrocardiogramaData,
    RiesgoCardiovascularData,
)


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
        
        result = extractor.extract_by_type("/fake/path/audio.pdf", "Audiometria")
        
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
        
        result = extractor.extract_by_type("/fake/path/lab.pdf", "Laboratorio")
        
        assert result.paciente == "María García"
        assert len(result.parametros) == 1
        assert result.parametros[0]["parametro"] == "Glucosa"
    
    @patch('app.services.ai.base.GeminiBase.call_gemini')
    def test_extract_tipo_desconocido(self, mock_gemini, extractor):
        """Test que retorna dict para tipos desconocidos."""
        mock_gemini.return_value = {"datos": "genéricos"}
        
        result = extractor.extract_by_type("/fake/path/doc.pdf", "TipoDesconocido")
        
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
        result = extractor.extract_by_type("/fake/campimetria.pdf", "Campimetria")
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
        result = extractor.extract_by_type("/fake/campimetria2.pdf", "Campimetria")
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
        result = extractor.extract_by_type("/fake/ecg.pdf", "Electrocardiograma")
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
        result = extractor.extract_by_type("/fake/ecg2.pdf", "Electrocardiograma")
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
        result = extractor.extract_by_type("/fake/riesgo_cv.pdf", "RiesgoCardiovascular")
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
        result = extractor.extract_by_type("/fake/riesgo_cv2.pdf", "RiesgoCardiovascular")
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

    @patch('app.services.ai.prediagnostic.PrediagnosticService._call_gemini_text_only')
    def test_ecg_con_params_minimos_genera_prediagnostico(self, mock_gemini_text, prediagnostic_svc):
        """ECG con ritmo y frecuencia genera un prediagnóstico IA válido."""
        mock_gemini_text.return_value = {
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

    def test_ecg_sin_params_minimos_retorna_non_conclusive(self, prediagnostic_svc):
        """ECG sin ritmo ni frecuencia debe retornar AI_NON_CONCLUSIVE."""
        result = prediagnostic_svc.generate_prediagnosis(
            "Electrocardiograma",
            {"paciente": "Test", "hallazgos": []}
        )
        assert result.clinical_state == "AI_NON_CONCLUSIVE"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
