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
from app.schemas.medical import (
    AudiometriaData,
    LaboratorioData,
    EspirometriaData,
    RayosXData,
    CampimetriaData,
    ElectrocardiogramaData,
    RiesgoCardiovascularData,
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

        # IMPL-20260326-17: Prompt para Campimetría (GEN-O1WV7)
        "Campimetria": """Eres un técnico de oftalmología. Tu tarea es EXTRAER datos del campo visual, NO interpretarlos clínicamente.

**Extrae:**
1. PACIENTE
2. FECHA del estudio
3. DEFECTOS OJO DERECHO (OD): lista de defectos o escotomas descritos o zonas con sensibilidad reducida
4. DEFECTOS OJO IZQUIERDO (OI): ídem para ojo izquierdo
5. ÍNDICES OD: MD (Mean Deviation), PSD (Pattern Std Dev), VFI si están visibles — como strings
6. ÍNDICES OI: ídem para ojo izquierdo
7. Profesional firmante si es visible
8. NO incluyas diagnóstico, interpretación ni aptitud.
9. Si el documento es ilegible o faltan datos, indícalo en notas_calidad.

**Respuesta OBLIGATORIA en JSON:**
{
  "paciente": "Nombre",
  "fecha_estudio": "dd/mm/yyyy",
  "ojo_derecho_defectos": ["Escotoma paracentral superior", "Depresión nasal inferior"],
  "ojo_izquierdo_defectos": [],
  "indices_ojo_derecho": {"MD": "-4.2 dB", "PSD": "2.1 dB", "VFI": "94%"},
  "indices_ojo_izquierdo": {"MD": "-1.0 dB", "PSD": "1.5 dB"},
  "profesional": "Dr. González",
  "notas_calidad": null
}""",

        # IMPL-20260326-17: Prompt para Electrocardiograma (GEN-C85PD)
        "Electrocardiograma": """Eres un técnico de cardiología. Tu tarea es EXTRAER parámetros del trazado ECG, NO interpretarlos clínicamente.

**Extrae:**
1. PACIENTE
2. FECHA
3. RITMO: descripción del ritmo (Ej: Sinusal, Fibrilación Auricular, Taquicardia)
4. FRECUENCIA cardíaca en lpm (número entero)
5. INTERVALO PR en milisegundos (número entero)
6. DURACIÓN QRS en milisegundos (número entero)
7. QTc corregido en milisegundos (número entero)
8. EJE ELÉCTRICO: Normal, Desviación izquierda, Desviación derecha, Indeterminado
9. HALLAZGOS: lista de observaciones descriptivas del trazado (sin diagnóstico final). Ej: "Bloqueo de rama derecha", "Elevación de segmento ST en V2-V4"
10. Profesional firmante si es visible
11. NO incluyas diagnóstico definitivo, aptitud ni interpretación de urgencia.

**Respuesta OBLIGATORIA en JSON:**
{
  "paciente": "Nombre",
  "fecha_estudio": "dd/mm/yyyy",
  "ritmo": "Sinusal",
  "frecuencia_bpm": 72,
  "intervalo_pr_ms": 160,
  "duracion_qrs_ms": 90,
  "qtc_ms": 410,
  "eje_electrico": "Normal",
  "hallazgos": ["Onda T invertida en V1-V3", "Sin otras alteraciones del trazado"],
  "profesional": "Dr. Martínez",
  "notas_calidad": null
}""",

        # IMPL-20260326-17: Prompt para Riesgo Cardiovascular (GEN-U5BQX)
        "RiesgoCardiovascular": """Eres un técnico médico. Tu tarea es EXTRAER el resultado de la evaluación de riesgo cardiovascular ya calculado en el documento, NO recalcular ni reinterpretar.

**Extrae:**
1. PACIENTE
2. FECHA de la evaluación
3. NIVEL DE RIESGO calculado (Ej: Bajo, Moderado, Alto, Muy Alto)
4. PORCENTAJE DE RIESGO a 10 años si está disponible (número decimal)
5. ESCALA UTILIZADA (Framingham, OMS/ISH, ACC/AHA ASCVD, SCORE, etc.)
6. FACTORES DE RIESGO listados en el documento (Ej: HTA, diabetes, tabaquismo, dislipidemia, obesidad)
7. Profesional firmante si es visible
8. NO recalcules, NO interpretes. Solo extrae lo que está escrito en el documento.

**Respuesta OBLIGATORIA en JSON:**
{
  "paciente": "Nombre",
  "fecha_estudio": "dd/mm/yyyy",
  "nivel_riesgo": "Moderado",
  "porcentaje_riesgo": 12.5,
  "escala_utilizada": "Framingham",
  "factores_riesgo": ["HTA", "Tabaquismo", "Dislipidemia"],
  "profesional": "Dr. Ramírez",
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

            # IMPL-20260326-17: Parseo para estudios GEN-O1WV7, GEN-C85PD, GEN-U5BQX
            elif doc_type == "Campimetria":
                for legacy_field in ("diagnostico_ia", "interpretacion"):
                    result.pop(legacy_field, None)
                return CampimetriaData(**result)

            elif doc_type == "Electrocardiograma":
                for legacy_field in ("diagnostico_ia", "interpretacion", "recomendaciones"):
                    result.pop(legacy_field, None)
                # Normalizar frecuencia_bpm a int si viene como string
                if isinstance(result.get("frecuencia_bpm"), str):
                    try:
                        result["frecuencia_bpm"] = int(result["frecuencia_bpm"])
                    except (ValueError, TypeError):
                        result["frecuencia_bpm"] = None
                return ElectrocardiogramaData(**result)

            elif doc_type == "RiesgoCardiovascular":
                for legacy_field in ("diagnostico_ia", "interpretacion"):
                    result.pop(legacy_field, None)
                # Normalizar porcentaje_riesgo a float si viene como string
                if isinstance(result.get("porcentaje_riesgo"), str):
                    try:
                        result["porcentaje_riesgo"] = float(result["porcentaje_riesgo"].replace("%", ""))
                    except (ValueError, TypeError):
                        result["porcentaje_riesgo"] = None
                return RiesgoCardiovascularData(**result)

            else:
                return result

        except Exception as e:
            print(f"⚠️ Error al parsear {doc_type}: {e}")
            return result
