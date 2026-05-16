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
    # IMPL-20260513-01: Actualizado para frecuencias canónicas 250-8000 Hz, completitud documental
    PROMPTS = {
        # IMPL-20260516-07: Prompt actualizado — campos fuente del formato diagnóstico (ARCH-20260516-07)
        "Audiometria": """Eres un técnico de audiología. Tu tarea es EXTRAER datos del documento, NO interpretarlos clínicamente.

**REGLAS CRÍTICAS:**
1. El PACIENTE está en la parte superior del documento.
2. La FECHA está cerca del nombre del paciente.
3. OÍDO DERECHO (OD) y OÍDO IZQUIERDO (OI) están marcados claramente.
4. LAS FRECUENCIAS CANÓNICAS son: 250, 500, 1000, 2000, 3000, 4000, 6000, 8000 Hz.
   - Extrae todas las que puedas ver; si alguna no está en el documento, omítela del dict.
5. Los DECIBELES (dB) son valores numéricos en el audiograma.
6. NO incluyas diagnóstico, interpretación clínica ni recomendaciones de aptitud.
7. Si el documento es ilegible o faltan datos, indícalo en notas_calidad.
8. Llena `frecuencias_detectadas` con la lista de frecuencias que SÍ pudiste leer (ej: ["250","500","1000"]).
9. Llena `completitud_documental` según cuántas frecuencias canónicas tienes POR OÍDO:
   - "suficiente" si tienes 6 o más de 8 frecuencias en AMBOS oídos
   - "parcial" si tienes entre 3 y 5 frecuencias en algún oído
   - "no_concluyente" si tienes menos de 3 frecuencias en algún oído o el trazado es ilegible
10. CAMPOS FUENTE DEL FORMATO (solo si están visibles en el documento):
    - `faringe`: texto del hallazgo de faringe si aparece en el formato (ej: "Normal", "Sin datos patológicos").
    - `cad`: texto del hallazgo de Conducto Auditivo externo Derecho si aparece (ej: "Permeable").
    - `cai`: texto del hallazgo de Conducto Auditivo externo Izquierdo si aparece.
    - `mtd`: texto del hallazgo de Membrana Timpánica Derecha si aparece (ej: "Íntegra").
    - `mti`: texto del hallazgo de Membrana Timpánica Izquierda si aparece.
    Si alguno de estos campos NO aparece en el documento, omítelo (o pon null).
11. PROHIBIDO: NO extraigas ni incluyas la sección de descripción audiométrica narrativa/redactada que pueda aparecer al final del formato. Esa sección no forma parte del contrato de extracción.

**Respuesta OBLIGATORIA en JSON (solo {}, sin ```json):**
{
  "paciente": "Nombre Completo",
  "fecha_estudio": "dd/mm/yyyy",
  "oido_derecho": {"250": 10, "500": 10, "1000": 15, "2000": 20, "3000": 20, "4000": 25, "6000": 30, "8000": 35},
  "oido_izquierdo": {"250": 10, "500": 10, "1000": 15, "2000": 20, "3000": 20, "4000": 25, "6000": 30, "8000": 35},
  "frecuencias_detectadas": ["250", "500", "1000", "2000", "3000", "4000", "6000", "8000"],
  "completitud_documental": "suficiente",
  "notas_calidad": null,
  "faringe": null,
  "cad": null,
  "cai": null,
  "mtd": null,
  "mti": null
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

        # IMPL-20260516-12: Prompt exhaustivo de Espirometría (ARCH-20260516-12)
        # Extrae los 6 bloques del layout real AMI + legacy flat fields para backward compat.
        "Espirometria": """Eres un técnico de neumología. Tu tarea es EXTRAER TODOS los datos visibles del documento espirométrico, NO interpretarlos clínicamente.

**REGLAS CRÍTICAS:**
1. La tabla numérica tiene PRECEDENCIA ABSOLUTA sobre la gráfica o cualquier texto narrativo.
2. Extrae TODOS los datos fuente visibles: identificación, condiciones, tabla de parámetros, repetibilidad y gráficas.
3. Para cada fila de la tabla de parámetros, captura el label literal, una key canónica (si la puedes mapear), unidad, valores M1/M2/M3, %REF de cada maniobra, REF y LLN.
4. NO incluyas diagnóstico, interpretación clínica ni recomendaciones de aptitud. Solo extracción documental.
5. Mapeo canónico de filas: "FVC"→fvc_l, "FEV1"→fev1_l, "FEV1/FVC"→fev1_fvc_pct, "FEV1/VC"→fev1_vc_pct, "PEF"→pef_l_s, "FEF25-75"→fef25_75_l_s, "FET100"→fet100_s, "Vext."→vext_l, "Mejor FVC"→mejor_fvc_l, "Mejor FEV1"→mejor_fev1_l, "Mejor FEV1/FVC"→mejor_fev1_fvc_pct. Si no reconoces el label, usa null en key.
6. Si una fila de la tabla no se puede leer, no la omitas: ponla con el label visible y null en los campos no legibles.
7. Para los campos legacy (fev1, fvc, fev1_fvc_ratio, fev1_percent_predicho, fvc_percent_predicho): extrae el mejor valor disponible de la tabla (M1 de la fila correspondiente o el valor "Mejor" si existe).
8. `es_interpretable` (legacy y calidad.es_interpretable): true si tienes al menos fev1 y fvc; false si faltan ambos o el documento es ilegible.
9. `completitud_documental` (legacy y calidad.completitud_documental): "suficiente" si hay fev1+fvc+ratio+%predicho, "parcial" si solo fev1+fvc, "no_concluyente" si faltan fev1 o fvc.
10. Si no hay datos de un bloque (ej. no hay bloque de condiciones), pon el campo en null.

**Respuesta OBLIGATORIA en JSON (solo {}, sin ```json):**
{
  "paciente": "Nombre Completo",
  "fecha_estudio": "dd/mm/yyyy",
  "fev1": 3.5,
  "fvc": 4.2,
  "fev1_fvc_ratio": 0.83,
  "fev1_percent_predicho": 92.0,
  "fvc_percent_predicho": 95.0,
  "broncodilatador_post_fev1": null,
  "broncodilatador_post_fvc": null,
  "es_interpretable": true,
  "completitud_documental": "suficiente",
  "notas_calidad": null,
  "paciente_detalle": {
    "nombre_completo": "Nombre Completo",
    "sexo": "Masculino",
    "edad_anios": 35.0,
    "talla_cm": 170.0,
    "peso_kg": 75.0,
    "imc": 26.0,
    "fuma": "No",
    "motivo": "Examen periódico",
    "procedencia": null
  },
  "estudio": {
    "referencia": "ESP-2026-001",
    "fecha_estudio": "dd/mm/yyyy",
    "hora_estudio": "09:00",
    "tipo_reporte": "Espirometría simple",
    "equipo_modelo": "Equipo/Modelo",
    "version_software": "v1.0"
  },
  "condiciones": {
    "temperatura_c": 22.0,
    "presion_mmhg": 760.0,
    "humedad_pct": 50.0,
    "tecnico": "TEC-001",
    "transductor": null,
    "referencia_ecuacion": "NHANES III",
    "factor_etnico": null,
    "factor_btps": null
  },
  "parametros": [
    {"label": "FVC", "key": "fvc_l", "unidad": "L", "m1": 4.2, "m1_pct_ref": 95.0, "m2": null, "m2_pct_ref": null, "m3": null, "m3_pct_ref": null, "ref": 4.4, "lln": 3.6},
    {"label": "FEV1", "key": "fev1_l", "unidad": "L", "m1": 3.5, "m1_pct_ref": 92.0, "m2": null, "m2_pct_ref": null, "m3": null, "m3_pct_ref": null, "ref": 3.8, "lln": 3.0},
    {"label": "FEV1/FVC", "key": "fev1_fvc_pct", "unidad": "%", "m1": 83.0, "m1_pct_ref": null, "m2": null, "m2_pct_ref": null, "m3": null, "m3_pct_ref": null, "ref": 78.0, "lln": 70.0}
  ],
  "calidad": {
    "repetibilidad_ats_ers_fvc": "Aceptable",
    "repetibilidad_ats_ers_fev1": "Aceptable",
    "es_interpretable": true,
    "completitud_documental": "suficiente",
    "notas_calidad": null
  },
  "graficas": {
    "curva_flujo_volumen_presente": true,
    "curva_volumen_tiempo_presente": true,
    "maniobras_graficadas": 3,
    "observaciones_grafica": null
  }
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
