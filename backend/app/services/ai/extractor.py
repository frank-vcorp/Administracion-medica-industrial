"""
Servicio de Extracción Especializada de Datos Médicos.
IMPL-20260225-01: Extractores por tipo de documento.
"""

import time
from typing import Dict, Any, Union
from .base import GeminiBase
from schemas.medical import (
    AudiometriaData,
    LaboratorioData,
    EspirometriaData,
    RayosXData,
    DocumentClassification,
)


class ExtractorService(GeminiBase):
    """
    Servicio que extrae datos estructurados según el tipo de documento.
    Cada tipo tiene un prompt y esquema Pydantic especializado.
    """
    
    PROMPTS = {
        "Audiometria": """Eres un experto en Audiología. Analiza esta audiometría y extrae los datos.

**REGLAS CRÍTICAS:**
1. El PACIENTE está en la parte superior.
2. La FECHA está cerca del paciente.
3. OÍDO DERECHO y OÍDO IZQUIERDO están marcados claramente (OD vs OI).
4. LAS FRECUENCIAS son: 500, 1000, 2000, 3000, 4000, 6000, 8000 Hz.
5. Los DECIBELES (dB) son valores numéricos en el gráfico.

**Respuesta OBLIGATORIA en JSON (sin ```json, solo {}):**
{
  "paciente": "Nombre Completo",
  "fecha_estudio": "dd/mm/yyyy",
  "oido_derecho": {"500": 10, "1000": 15, "2000": 20, "3000": 20, "4000": 25, "6000": 30, "8000": 35},
  "oido_izquierdo": {"500": 10, "1000": 15, "2000": 20, "3000": 20, "4000": 25, "6000": 30, "8000": 35},
  "diagnostico_ia": "Hipoacusia bilateral leve en altas frecuencias",
  "recomendaciones": ["Seguimiento cada 6 meses", "Evaluación protección auditiva"],
  "interpretacion": "Patrón típico de exposición a ruido ocupacional."
}""",
        
        "Laboratorio": """Eres un experto en Patología Clínica. Analiza este resultado de laboratorio.

**Extrae:**
1. PACIENTE
2. FECHA del análisis
3. TIPO de estudio (Biometría, Química Sanguínea, etc.)
4. VALORES ANORMALES (solo los que están fuera de rango)
5. INTERPRETACIÓN breve

**Respuesta OBLIGATORIA en JSON:**
{
  "paciente": "Nombre",
  "fecha": "dd/mm/yyyy",
  "estudio_tipo": "Biometría Hemática",
  "valores_anormales": [
    {"parametro": "Glucosa", "valor": "110 mg/dL", "referencia": "70-100"},
    {"parametro": "Hemoglobina", "valor": "13.2 g/dL", "referencia": "14.0-16.0"}
  ],
  "interpretacion": "Prediabetes detectada. Anemia leve",
  "profesional": "Dr. García" (si está visible)
}""",
        
        "Espirometria": """Eres un experto en Neumología. Analiza esta prueba de función pulmonar (espirometría).

**Extrae:**
1. PACIENTE
2. FECHA
3. FEV1 (Volumen Espiratorio Forzado en 1 segundo) en LITROS
4. FVC (Capacidad Vital Forzada) en LITROS
5. Relación FEV1/FVC
6. FEV1 % Predicho
7. DIAGNÓSTICO (Restrictivo, Obstructivo, Normal, etc.)

**Respuesta OBLIGATORIA en JSON:**
{
  "paciente": "Nombre",
  "fecha_estudio": "dd/mm/yyyy",
  "fev1": 3.5,
  "fvc": 4.2,
  "fev1_fvc_ratio": 0.83,
  "fev1_percent_predicho": 92.0,
  "diagnostico_ia": "Función pulmonar normal",
  "recomendaciones": []
}""",
        
        "Rayos_X": """Eres un experto Radiólogo. Analiza esta imagen radiológica.

**Extrae:**
1. PACIENTE
2. FECHA
3. LOCALIZACIÓN (Tórax, Columna Lumbar, Extremidad, etc.)
4. HALLAZGOS (lista de observaciones)
5. INTERPRETACIÓN final

**Respuesta OBLIGATORIA en JSON:**
{
  "paciente": "Nombre",
  "fecha_estudio": "dd/mm/yyyy",
  "localizacion": "Tórax",
  "hallazgos": ["Cardiomegalia leve", "Infiltrado en base izquierda"],
  "interpretacion": "Sospecha de cardiomiopatía dilatada",
  "radiologista": "Dr. López" (si está visible)
}""",
    }
    
    def extract_by_type(
        self,
        file_path: str,
        doc_type: str
    ) -> Union[AudiometriaData, LaboratorioData, EspirometriaData, RayosXData, Dict]:
        """
        Extrae datos estructurados según el tipo de documento.
        
        Args:
            file_path: Ruta del archivo
            doc_type: Tipo de documento (Audiometria, Laboratorio, etc.)
        
        Returns:
            Objeto Pydantic del tipo correspondiente o Dict genérico.
        """
        prompt = self.PROMPTS.get(doc_type, "Extrae todos los datos relevantes de este documento médico.")
        
        print(f"🧠 Extrayendo datos para tipo: {doc_type}")
        
        start_time = time.time()
        result = self.call_gemini(file_path, prompt)
        duration = time.time() - start_time
        
        print(f"✅ Extracción completada en {duration:.2f}s")
        
        # Parsear según el tipo
        try:
            if doc_type == "Audiometria":
                # Convertir strings a ints en diccionarios de frecuencias
                if isinstance(result.get("oido_derecho"), dict):
                    result["oido_derecho"] = {
                        int(k): int(v) for k, v in result["oido_derecho"].items()
                    }
                if isinstance(result.get("oido_izquierdo"), dict):
                    result["oido_izquierdo"] = {
                        int(k): int(v) for k, v in result["oido_izquierdo"].items()
                    }
                return AudiometriaData(**result)
            
            elif doc_type == "Laboratorio":
                return LaboratorioData(**result)
            
            elif doc_type == "Espirometria":
                return EspirometriaData(**result)
            
            elif doc_type == "Rayos_X":
                return RayosXData(**result)
            
            else:
                # Tipo desconocido, retornar como dict
                return result
        
        except Exception as e:
            print(f"⚠️ Error al parsear {doc_type}: {e}")
            # Retornar raw si no parsea
            return result
