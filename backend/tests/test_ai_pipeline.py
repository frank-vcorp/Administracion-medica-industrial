"""
Tests para el Pipeline IA Modular.
IMPL-20260225-01: Clasificación y extracción de documentos médicos.
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
from app.schemas.medical import DocumentClassification, AudiometriaData


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
        assert result.oido_derecho[500] == 10  # String convertido a int
    
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
        assert len(result.valores_anormales) == 1
        assert result.valores_anormales[0]["parametro"] == "Glucosa"
    
    @patch('app.services.ai.base.GeminiBase.call_gemini')
    def test_extract_tipo_desconocido(self, mock_gemini, extractor):
        """Test que retorna dict para tipos desconocidos."""
        mock_gemini.return_value = {"datos": "genéricos"}
        
        result = extractor.extract_by_type("/fake/path/doc.pdf", "TipoDesconocido")
        
        assert isinstance(result, dict)
        assert result["datos"] == "genéricos"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
