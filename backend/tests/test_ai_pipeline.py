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
    EspirometriaData,
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
        result = extractor.extract_by_type("/fake/audiometria_nominal.pdf", "Audiometria")
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
        result = extractor.extract_by_type("/fake/audiometria_incompleta.pdf", "Audiometria")
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
        result = extractor.extract_by_type("/fake/audiometria_formato_diagnostico.pdf", "Audiometria")
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
        result = extractor.extract_by_type("/fake/audiometria_viejo.pdf", "Audiometria")
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
        result = extractor.extract_by_type("/fake/espirometria_nominal.pdf", "Espirometria")
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
        result = extractor.extract_by_type("/fake/espirometria_incompleta.pdf", "Espirometria")
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
        assert result.clinical_model_used == "gemini-2.5-flash"

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
        assert result.clinical_model_used == "gemini-2.5-flash"

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

    @patch('app.services.ai.prediagnostic.MEDGEMMA_ENABLED', False)
    @patch('app.services.ai.prediagnostic.FEATHERLESS_API_KEY', '')
    @patch('app.services.ai.prediagnostic.PrediagnosticService._call_gemini_text_only')
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
        assert result.clinical_model_used == "gemini-2.5-flash"
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
    IMPL-20260513-03: Selección de proveedor, trazabilidad y fallback honesto.
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
    @patch('app.services.ai.prediagnostic.PrediagnosticService._call_gemini_text_only')
    def test_sin_medgemma_usa_gemini_y_clinical_provider_es_gemini(self, mock_gemini, prediagnostic_svc):
        """
        MEDGEMMA_ENABLED=false → proveedor debe ser 'gemini', no se llama Featherless.
        """
        mock_gemini.return_value = self.MOCK_PREDIAGNOSIS_RESPONSE.copy()
        result = prediagnostic_svc.generate_prediagnosis("Espirometria", self.ESPIRO_VALIDA)
        assert result.clinical_provider == "gemini"
        assert result.clinical_state == "AI_PENDING_REVIEW"
        mock_gemini.assert_called_once()

    @patch('app.services.ai.prediagnostic.MEDGEMMA_ENABLED', True)
    @patch('app.services.ai.prediagnostic.FEATHERLESS_API_KEY', '')
    @patch('app.services.ai.prediagnostic.PrediagnosticService._call_gemini_text_only')
    def test_medgemma_enabled_pero_sin_key_hace_fallback_gemini(self, mock_gemini, prediagnostic_svc):
        """
        MEDGEMMA_ENABLED=true pero sin FEATHERLESS_API_KEY → fallback honesto a Gemini.
        clinical_provider debe ser 'gemini', no 'featherless'.
        """
        mock_gemini.return_value = self.MOCK_PREDIAGNOSIS_RESPONSE.copy()
        result = prediagnostic_svc.generate_prediagnosis("Espirometria", self.ESPIRO_VALIDA)
        assert result.clinical_provider == "gemini"
        mock_gemini.assert_called_once()

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
