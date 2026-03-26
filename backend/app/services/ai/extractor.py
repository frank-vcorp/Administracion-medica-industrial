"""
Servicio de Extracción Especializada de Datos Médicos.
IMPL-20260225-01: Extractores por tipo de documento.
IMPL-20260326-16: Separación capa extractiva / interpretativa (ARCH-20260326-16).
               Los prompts ahora extraen SOLO parámetros canónicos + calidad documental.
               La interpretación clínica vive en PrediagnosticService (prediagnostic.py).
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
    Servicio que extrae parámetros canónicos según el tipo de documento.
    GUARDRAIL: Los prompts NO deben pedir diagnóstico, interpretación clínica final
    ni recomendaciones de aptitud. Esas capas pertenecen a PrediagnosticService.
    """

    # IMPL-20260326-16: Prompts de extracción pura — sin diagnóstico_ia
    PROMPTS = {
        "Audiometria": """Eres un técnico de audiología. Tu tarea es EXTRAER datos del documento, NO interpretarlos clínicamente.

**REGLAS CRÍTICAS:**
1. El PACIENTE está en la parte superior del documento.
2. La FECHA está cerca del nombre del paciente.
3. OÍDO DERECHO (OD) y OÍDO IZQUIERDO (OI) están marcados claramente.
4. LAS FRECUENCIAS son: 500, 1000, 2000, 3000, 4000, 6000, 8000 Hz.
5. Los DECIBELES (dB) son valores numéricos en el audiograma.
6. NO incluyas diagnóstico, interpretación clínica ni recomendaciones de aptitud.
7. Si el documento es ilegible o faltan datos, indícalo en notas_calidad.

**Respuesta OBLIGATORIA en JSON (solo {}, sin ```json):**
{
  "paciente": "Nombre Completo",
  "fecha_estudio": "dd/mm/yyyy",
  "oido_derecho": {"500": 10, "1000": 15, "2000": 20, "3000": 20, "4000": 25, "6000": 30, "8000": 35},
  "oido_izquierdo": {"500": 10, "1000": 15, "2000": 20, "3000": 20, "4000": 25, "6000": 30, "8000": 35},
  "notas_calidad": null
}""",

        "Laboratorio": """Eres un técnico de patología clínica. Tu tarea es EXTRAER parámetros del documento, NO interpretarlos.

**Extrae:**
1. PACIENTE
2. FECHA del análisis
3. TIPO de estudio (Biometría, Química Sanguínea, etc.)
4. TODOS LOS PARÁMETROS con valor, unidad, referencia y estado (normal/high/low/unknown)
5. Profesional firmante si es visible
6. NO incluyas interpretación clínica ni diagnóstico.

**Respuesta OBLIGATORIA en JSON:**
{
  "paciente": "Nombre",
  "fecha": "dd/mm/yyyy",
  "estudio_tipo": "Biometría Hemática",
  "parametros": [
    {"parametro": "Glucosa", "valor": "110", "unidad": "mg/dL", "referencia": "70-100", "estado": "high"},
    {"parametro": "Hemoglobina", "valor": "14.2", "unidad": "g/dL", "referencia": "14.0-16.0", "estado": "normal"}
  ],
  "profesional": "Dr. García",
  "notas_calidad": null
}""",

        "Espirometria": """Eres un técnico de neumología. Tu tarea es EXTRAER mediciones de la prueba, NO interpretarlas clínicamente.

**Extrae:**
1. PACIENTE
2. FECHA
3. FEV1 (Volumen Espiratorio Forzado en 1 segundo) en LITROS — solo el número
4. FVC (Capacidad Vital Forzada) en LITROS — solo el número
5. Relación FEV1/FVC — solo el número
6. FEV1 % Predicho — solo el número
7. NO incluyas diagnóstico ni interpretación clínica final.

**Respuesta OBLIGATORIA en JSON:**
{
  "paciente": "Nombre",
  "fecha_estudio": "dd/mm/yyyy",
  "fev1": 3.5,
  "fvc": 4.2,
  "fev1_fvc_ratio": 0.83,
  "fev1_percent_predicho": 92.0,
  "notas_calidad": null
}""",

        "Rayos_X": """Eres un técnico radiólogo. Tu tarea es EXTRAER hallazgos descriptivos del estudio, NO emitir diagnóstico final.

**Extrae:**
1. PACIENTE
2. FECHA
3. LOCALIZACIÓN anatómica (Tórax, Columna Lumbar, Extremidad, etc.)
4. HALLAZGOS: lista de observaciones descriptivas objetivas (lo que se ve, no el diagnóstico).
5. Radiólogo firmante si es visible.
6. Los hallazgos deben ser observaciones factuales. Evita frases como "compatible con X".

**Respuesta OBLIGATORIA en JSON:**
{
  "paciente": "Nombre",
  "fecha_estudio": "dd/mm/yyyy",
  "localizacion": "Tórax",
  "hallazgos": ["Índice cardiotorácico aumentado", "Área de opacidad en base pulmonar izquierda"],
  "radiologista": "Dr. López",
  "notas_calidad": null
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
        # IMPL-20260326-16: los schemas ya no tienen diagnostico_ia/interpretacion
        try:
            if doc_type == "Audiometria":
                # Normalizar claves de frecuencia a strings (el schema acepta Dict[str, int])
                for key in ("oido_derecho", "oido_izquierdo"):
                    if isinstance(result.get(key), dict):
                        result[key] = {str(k): int(v) for k, v in result[key].items()}
                # Limpiar campos legacy que el modelo IA podría enviar aún
                for legacy_field in ("diagnostico_ia", "interpretacion", "recomendaciones"):
                    result.pop(legacy_field, None)
                return AudiometriaData(**result)

            elif doc_type == "Laboratorio":
                # Normalizar: si el LLM devuelve "valores_anormales" legacy mapear a "parametros"
                if "valores_anormales" in result and "parametros" not in result:
                    result["parametros"] = result.pop("valores_anormales")
                for legacy_field in ("interpretacion",):
                    result.pop(legacy_field, None)
                return LaboratorioData(**result)

            elif doc_type == "Espirometria":
                for legacy_field in ("diagnostico_ia", "recomendaciones"):
                    result.pop(legacy_field, None)
                return EspirometriaData(**result)

            elif doc_type == "Rayos_X":
                for legacy_field in ("interpretacion",):
                    result.pop(legacy_field, None)
                return RayosXData(**result)

            else:
                return result

        except Exception as e:
            print(f"⚠️ Error al parsear {doc_type}: {e}")
            return result
