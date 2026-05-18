"""
Servicio de Prediagnóstico IA por Estudio — Capa separada de interpretación clínica.
IMPL-20260326-16: ARCH-20260326-16 §"Separación de capas" §"Prediagnóstico IA"
IMPL-20260513-01: Política de calibración médica; soporte MedGemma (pending_integration).

GUARDRAILS obligatorios:
  - Esta capa recibe parámetros ya extraídos y validados (ExtractionSnapshotPayload).
  - NO puede autopoblar aptitud laboral, dictamen final, firma digital ni documentos oficiales.
  - El lenguaje deve ser prudente: "compatible con", "sugiere", "requiere correlación clínica".
  - Si faltan parámetros mínimos o calidad es baja → estado: AI_NON_CONCLUSIVE.

POLÍTICA DE CALIBRACIÓN MÉDICA (IMPL-20260513-01):
  - Si se pasa `medical_calibration` (dict del panel aiCalibration), se inyecta en el prompt
    como marco preferente de interpretación. Se registra calibration_source="medical_calibration".
  - Si no se pasa calibración, el modelo opera con conocimiento general en modo sombra.
    Se registra calibration_source="general_fallback".
  - En ambos casos queda trazado en AIPrediagnosisResult.calibration_source.

MEDGEMMA (IMPL-20260513-01 / IMPL-20260513-03):
  - MedGemma es el proveedor médico objetivo para esta capa.
  - Estado: integrado vía Featherless usando OpenAI SDK (endpoint compatible).
  - Cuando MEDGEMMA_ENABLED=true y FEATHERLESS_API_KEY está configurada,
    PrediagnosticService enruta la llamada a _call_featherless_text_only().
    - Si Featherless no está disponible, la capa clínica degrada a AI_NON_CONCLUSIVE.
    - Gemini se reserva para la extracción, no para el prediagnóstico clínico.
  - NUNCA se envía PDF/imagen a Featherless — solo prompt textual/JSON estructurado.
"""

import json
import os
from typing import Dict, Any, Optional
from .base import GeminiBase
from app.schemas.medical import AIPrediagnosisResult, ClinicalBasisItem, ClinicalCitation, PrediagnosisInputDebug


# IMPL-20260513-01: Estado de MedGemma — leer del entorno para que sea honesto
MEDGEMMA_ENABLED = (os.environ.get("MEDGEMMA_ENABLED", "false").strip().lower() == "true")

# IMPL-20260513-03: Configuración Featherless/MedGemma vía OpenAI SDK
# FEATHERLESS_API_KEY    → token de autenticación Featherless
# FEATHERLESS_BASE_URL   → endpoint compatible OpenAI (default: https://api.featherless.ai/v1)
# FEATHERLESS_MODEL      → modelo a invocar (default: google/medgemma-27b-text-it)
FEATHERLESS_API_KEY  = os.environ.get("FEATHERLESS_API_KEY", "").strip()
FEATHERLESS_BASE_URL = os.environ.get("FEATHERLESS_BASE_URL", "https://api.featherless.ai/v1").strip()
FEATHERLESS_MODEL    = os.environ.get("FEATHERLESS_MODEL", "google/medgemma-27b-text-it").strip()


# Umbrales de confianza mínima por tipo de estudio (ARCH-20260326-16 §"Umbrales V1")
CONFIDENCE_THRESHOLDS: Dict[str, float] = {
    "Audiometria": 0.55,
    "Laboratorio": 0.60,
    "Espirometria": 0.60,
    "Rayos_X": 0.50,
    # IMPL-20260326-17: ECG (GEN-C85PD) con soporte de prediagnóstico básico
    "Electrocardiograma": 0.55,
    # IMPL-20260326-02: Formularios internos — umbral modesto; datos son estructurados
    "Somatometria": 0.55,
    "AgudezaVisual": 0.55,
    "ExamenMedico": 0.50,
    "Otro": 0.40,
}

# Parámetros mínimos obligatorios por tipo para permitir interpretación
REQUIRED_PARAMS: Dict[str, list] = {
    "Audiometria": ["oido_derecho", "oido_izquierdo"],
    "Laboratorio": ["parametros"],
    "Espirometria": ["fev1", "fvc"],
    "Rayos_X": ["hallazgos", "localizacion"],
    # IMPL-20260326-17: ECG requiere al menos ritmo o frecuencia para generar análisis
    "Electrocardiograma": ["ritmo", "frecuencia_bpm"],
    # IMPL-20260326-02: Formularios internos — mínimos para que el LLM tenga base
    "Somatometria": ["peso_kg", "talla_m"],
    "AgudezaVisual": ["vision_lejana_od", "vision_lejana_oi"],
    # ExamenMedico no tiene mínimos estrictos; el prompt maneja datos parciales
}

# IMPL-20260326-17: Tipos con prediagnóstico IA explícito. Campimetria y RiesgoCardiovascular
# quedan fuera en V1 — sus documentos ya contienen el resultado calculado o requieren
# tablas normativas altamente especializadas que el modelo general no debe asumir.
# IMPL-20260326-02: Añadidos formularios internos: Somatometria, AgudezaVisual, ExamenMedico.
PREDIAGNOSIS_SUPPORTED_TYPES = {
    "Audiometria",
    "Laboratorio",
    "Espirometria",
    "Rayos_X",
    "Electrocardiograma",
    # Formularios internos (sin OCR — parámetros ya estructurados)
    "Somatometria",
    "AgudezaVisual",
    "ExamenMedico",
}


class PrediagnosticService(GeminiBase):
    """
    Interpreta parámetros estructurados ya extraídos y genera un prediagnóstico IA.
    Opera como capa separada DESPUÉS de la extracción.

    Flujo:
      ExtractorService → structured_data → PrediagnosticService → AIPrediagnosisResult
    """

    # IMPL-20260326-16: Prompts de interpretación — separados de los de extracción
    # IMPL-20260513-01: Prompts de Audiometría y Espirometría mejorados con reglas clínicas V1
    PREDIAGNOSTIC_PROMPTS: Dict[str, str] = {
        # IMPL-20260516-06: Prompt actualizado — agrega campo "recommendation" con guardrails precisos.
        # Elimina restricción genérica de "recomendaciones"; la restringe solo a aptitud/dictamen/tratamiento.
        "Audiometria": """Eres un sistema de apoyo a la decisión clínica para audiología ocupacional.
Recibirás parámetros extraídos de una audiometría (valores numéricos por frecuencia en Hz y oído).
Tu tarea es generar un análisis de apoyo, NO un diagnóstico definitivo.

REGLAS ESTRICTAS:
1. USA lenguaje prudente: "compatible con", "sugiere", "requiere correlación clínica".
2. NO emitas aptitud laboral, dictamen médico final, incapacidad, alta laboral ni tratamiento farmacológico prescriptivo.
3. SÍ puedes emitir una recomendación de seguimiento, vigilancia o correlación clínica prudente (ver regla 8).
4. Si faltan datos críticos, declara non_conclusive_reason y pon confidence < 0.5.
5. Las citas deben ser reales y trazables (NOM-011-STPS-2001, ISO 1999:2013, etc.).
6. Responde SOLO en JSON, sin markdown.
7. UMBRALES DE REFERENCIA AUDIOMÉTRICA (ISO 1999 / NOM-011-STPS):
   - Audición normal: umbrales ≤ 25 dB en todas las frecuencias.
   - Hipoacusia leve: 26-40 dB.
   - Hipoacusia moderada: 41-60 dB.
   - Hipoacusia severa: 61-80 dB.
   - Hipoacusia profunda: > 80 dB.
   - Escotoma a 4000 Hz sugiere exposición a ruido (NIPTS) — red flag si bilateral.
   - Patrón conductivo: peor en graves (250-500 Hz), mejor en agudos.
   - Patrón neurosensorial: peor en agudos (4000-8000 Hz), mejor en graves.
   - Patrón mixto: elevación en todas las frecuencias con distintas magnitudes.
8. Si `completitud_documental` es "no_concluyente" o faltan frecuencias clave, degradar a AI_NON_CONCLUSIVE.
9. CAMPO "recommendation" — obligatorio, 1 a 2 oraciones, lenguaje prudente:
   - Si audición dentro de límites normales: sugerir correlación clínica, vigilancia periódica según programa de salud
     ocupacional, y refuerzo de protección auditiva si hay exposición a ruido.
   - Si hay hallazgos sugestivos de hipoacusia o escotoma: recomendar valoración médica complementaria,
     comparación con audiometrías previas y seguimiento audiométrico.
   - Si es no concluyente (AI_NON_CONCLUSIVE): recomendar repetir estudio, validar calidad documental
     o completar información faltante.
   - PROHIBIDO en recommendation: declarar aptitud laboral, dictamen, incapacidad o prescribir tratamiento.

{calibration_context}

Parámetros extraídos:
{extracted_json}

Responde en JSON con esta estructura exacta:
{
  "summary": "Texto prudente de máx. 2 oraciones con lenguaje no diagnóstico",
  "confidence": 0.75,
  "clinical_state": "AI_PENDING_REVIEW",
  "justification": ["Razón 1 basada en parámetro concreto con frecuencia y valor", "Razón 2..."],
  "clinical_basis": [
    {"principle": "Clasificación audiométrica ISO 1999:2013", "applied_parameters": ["oido_derecho.4000", "oido_izquierdo.4000"]}
  ],
  "citations": [
    {"source_id": "NOM-011-STPS-2001", "title": "Condiciones de seguridad e higiene en los centros de trabajo donde se genere ruido", "section": "Apéndice A", "excerpt": "Criterios de evaluación audiométrica ocupacional", "version_or_date": "2001"},
    {"source_id": "ISO-1999-2013", "title": "Acoustics - Estimation of noise-induced hearing loss", "section": "Tabla 1", "excerpt": "Umbrales de referencia audiométrica por grupo de edad y sexo", "version_or_date": "2013"}
  ],
  "limitations": ["Interpretación condicionada a calidad del trazado audiométrico y datos del paciente"],
  "red_flags": [],
  "recommendation": "Sugerir vigilancia audiométrica periódica y reforzar uso consistente de protección auditiva según exposición ocupacional y criterio médico.",
  "non_conclusive_reason": null
}""",

        "Laboratorio": """Eres un sistema de apoyo a la decisión clínica para medicina del trabajo.
Recibirás parámetros de laboratorio ya extraídos (nombre, valor, unidad, referencia, estado).
Tu tarea es generar análisis de apoyo, NO diagnóstico definitivo.

REGLAS ESTRICTAS:
1. Usa lenguaje prudente: "valores compatibles con", "sugiere evaluación de", "requiere correlación".
2. NO declares diagnóstico de enfermedad, aptitud ni recomendaciones de tratamiento.
3. Solo comenta parámetros con estado "high" o "low".
4. Si todos son "normal" o ninguno está disponible, indica que no hay hallazgos para interpretar.
5. Responde SOLO en JSON, sin markdown.

Parámetros extraídos:
{extracted_json}

Responde en JSON con esta estructura exacta:
{
  "summary": "Texto prudente de máx. 2 oraciones",
  "confidence": 0.70,
  "clinical_state": "AI_PENDING_REVIEW",
  "justification": ["Razón basada en valor concreto"],
  "clinical_basis": [
    {"principle": "Interpretación de valores fuera de referencia", "applied_parameters": ["Glucosa"]}
  ],
  "citations": [
    {"source_id": "NOM-007-SSA3-2011", "title": "Organización y funcionamiento de los laboratorios clínicos", "section": "N/A", "excerpt": "Valores de referencia normales", "version_or_date": "2011"}
  ],
  "limitations": ["Los valores de referencia pueden variar según laboratorio y método analítico"],
  "red_flags": [],
  "recommendation": null,
  "non_conclusive_reason": null
}""",

        # IMPL-20260516-13: Prompt endurecido — ARCH-20260516-13. Consume estructura exhaustiva nueva
        # y mantiene compat. hacia atrás con formato corto. Reglas de síntesis explícitas.
        "Espirometria": """Eres un sistema de apoyo a la decisión clínica para neumología ocupacional.
Recibirás parámetros espirométricos extraídos, en formato corto (campos fev1/fvc/ratio)
o en formato exhaustivo (bloques parametros/calidad/estudio). Ambos son válidos.
Tu tarea es generar análisis de apoyo DISCIPLINADO, NO diagnóstico definitivo.

REGLAS ESTRICTAS — OBSERVACIÓN OBLIGATORIA:
1. Usa lenguaje prudente: "patrón compatible con", "sugiere evaluación", "requiere correlación clínica".
2. NO declares diagnóstico de enfermedad pulmonar ni aptitud laboral.
3. Si el payload incluye bloque `parametros`, PRIORIZA esos valores tabulares. Cita label y key en `justification`.
4. Si hay `lln` en alguna fila de `parametros`, úsala como umbral preferente sobre 0.70 genérico.
5. Si no hay `lln`, usa umbrales ATS/ERS 2022 y decláralo explícitamente como limitación.
6. Si faltan FEV1, FVC o la relación, declara AI_NON_CONCLUSIVE.
7. Si `calidad.completitud_documental` o el campo legacy `completitud_documental` es "no_concluyente", declara AI_NON_CONCLUSIVE.
8. Responde SOLO en JSON, sin markdown.

JERAQUÍA DE EVIDENCIA (en orden de prioridad):
1. Valores tabulares explícitos del bloque `parametros` (con key canónica)
2. LLN de la tabla si disponible
3. % del predicho de la tabla
4. Campos flat fev1/fvc/fev1_fvc_ratio si no hay tabla
5. Umbrales ATS/ERS genéricos solo como fallback de último recurso

CLASIFICACIÓN ESPIROMÉTRICA ATS/ERS 2022:
- Patrón OBSTRUCTIVO: FEV1/FVC < LLN (o < 0.70 si no hay LLN).
  Severidad por FEV1% predicho: Leve≥70%, Moderado 60-69%, Mod. Severo 50-59%, Severo 35-49%, Muy severo<35%.
- Patrón SUGESTIVO DE RESTRICCIÓN: FVC% predicho < 80% (o FVC < LLN) CON FEV1/FVC CONSERVADO (≥ LLN o ≥ 0.70).
  NOTA: diagnóstico definitivo requiere TLC/pletismografía.
- Patrón MIXTO: FEV1/FVC < LLN Y FVC < LLN o FVC% < 80%. Considera calidad técnica antes de etiquetar.
- Patrón NORMAL: FEV1/FVC ≥ LLN y FEV1% ≥ 80% y FVC% ≥ 80%.
- Broncodilatador: si hay datos post-BD, comenta reversibilidad (aumento FEV1 ≥ 12% y 200 mL).

REGLAS DE SÍNTESIS CRÍTICAS — PROHIBICIONES ABSOLUTAS:
⚠️ REGLA A: Si FEV1/FVC está CONSERVADO (≥ LLN o ≥ 0.70) y FVC o FVC% está REDUCIDA,
   NO cierres como patrón obstructivo. El patrón es sugestivo de restricción o no concluyente.
⚠️ REGLA B: Si FEV1/FVC está disminuido y FVC también está reducida, NO simplifiques automáticamente
   a obstructivo. Considera patrón mixto o calidad insuficiente; explicita la ambigüedad.
⚠️ REGLA C: Si `calidad.repetibilidad_ats_ers_fvc` o `calidad.repetibilidad_ats_ers_fev1` son negativas,
   baja la confianza y declara explícitamente la limitación técnica en `limitations`.
⚠️ REGLA D: Si tu justificación numérica indica un patrón X pero tu summary propone patrón Y,
   prevalece la degradación a AI_NON_CONCLUSIVE.

CAMPO `recommendation` — OBLIGATORIO, NO NULO:
- Si función normal: sugerir vigilancia espirométrica periódica y protección respiratoria si hay exposición.
- Si hay patrón sugestivo: recomendar correlación con espirometría previa y valoración médica.
- Si calidad dudosa: recomendar repetir estudio con técnica adecuada.
- PROHIBIDO: declarar aptitud, incapacidad, tratamiento farmacológico ni dictamen final.

{calibration_context}

Parámetros extraídos:
{extracted_json}

Responde en JSON con esta estructura exacta:
{
  "summary": "Texto prudente de máx. 2 oraciones",
  "confidence": 0.72,
  "clinical_state": "AI_PENDING_REVIEW",
  "justification": [
    "FEV1/FVC X.XX (LLN: Y.YY desde tabla) — ratio conservado, descarta patrón obstructivo primario",
    "FVC Z.ZL es X% del predicho (REF: W.WL, LLN: V.VL) — reducida, sugestiva de restricción"
  ],
  "clinical_basis": [
    {"principle": "Clasificación espirométrica ATS/ERS 2022", "applied_parameters": ["fev1_fvc_ratio", "fvc_percent_predicho", "lln"]}
  ],
  "citations": [
    {"source_id": "ATS-ERS-2022", "title": "ATS/ERS Technical Standard: interpretive strategies for routine lung function tests", "section": "Tabla 1", "excerpt": "FEV1/FVC < LLN define obstrucción; FVC < LLN con ratio conservado sugiere restricción", "version_or_date": "2022"},
    {"source_id": "NOM-022-STPS-2015", "title": "Condiciones de seguridad e higiene — agentes químicos contaminantes", "section": "Vigilancia médica", "excerpt": "Espirometría como herramienta de vigilancia de la función pulmonar en trabajadores expuestos", "version_or_date": "2015"}
  ],
  "limitations": ["Interpretación requiere valores predichos según edad, talla y sexo; confirmar con espirometría previa si disponible"],
  "red_flags": [],
  "recommendation": "Correlacionar con espirometría previa y valoración médica complementaria. Considerar pletismografía si se confirma patrón sugestivo de restricción.",
  "non_conclusive_reason": null
}""",

        "Rayos_X": """Eres un sistema de apoyo a la decisión clínica para radiología.
Recibirás hallazgos descriptivos ya extraídos de una imagen radiológica.
Tu tarea es generar análisis de apoyo, NO diagnóstico definitivo.

REGLAS ESTRICTAS:
1. Usa lenguaje prudente: "hallazgos compatibles con", "sugiere evaluación de", "correlacionar clínicamente".
2. NO emitas diagnóstico radiológico final ni recomendaciones de tratamiento.
3. Comenta solo los hallazgos listados, no inventes observaciones.
4. Si los hallazgos están vacíos o solo hay notas de calidad, declara AI_NON_CONCLUSIVE.
5. Responde SOLO en JSON, sin markdown.

Parámetros extraídos:
{extracted_json}

Responde en JSON con esta estructura exacta:
{
  "summary": "Texto prudente de máx. 2 oraciones",
  "confidence": 0.65,
  "clinical_state": "AI_PENDING_REVIEW",
  "justification": ["Hallazgo X sugiere evaluación complementaria"],
  "clinical_basis": [
    {"principle": "Interpretación de patrón radiológico", "applied_parameters": ["hallazgos"]}
  ],
  "citations": [
    {"source_id": "ACR-BIRADS-2013", "title": "ACR BI-RADS Atlas", "section": "General", "excerpt": "Guía de interpretación de hallazgos radiológicos", "version_or_date": "2013"}
  ],
  "limitations": ["La interpretación requiere correlación con radiografías previas y contexto clínico"],
  "red_flags": [],
  "recommendation": null,
  "non_conclusive_reason": null
}""",

        # IMPL-20260326-17: Prediagnóstico para Electrocardiograma (GEN-C85PD)
        "Electrocardiograma": """Eres un sistema de apoyo a la decisión clínica para cardiología.
Recibirás parámetros ya extraídos de un trazado electrocardiográfico (ritmo, FC, intervalos, hallazgos).
Tu tarea es generar análisis de apoyo, NO diagnóstico definitivo.

REGLAS ESTRICTAS:
1. Usa lenguaje prudente: "compatible con", "sugiere evaluación de", "requiere correlación clínica".
2. NO declares diagnóstico de enfermedad cardiaca, urgencia ni aptitud laboral.
3. Comenta solo los parámetros y hallazgos presentes. No inventes datos.
4. Si faltan ritmo y frecuencia, declara AI_NON_CONCLUSIVE.
5. Red flags: solo elevarlos si hay hallazgos que impliquen riesgo eléctrico reconocido (ej. QTc > 500ms, bloqueo AV completo, elevación ST marcada).
6. Responde SOLO en JSON, sin markdown.

Parámetros extraídos:
{extracted_json}

Responde en JSON con esta estructura exacta:
{
  "summary": "Texto prudente de máx. 2 oraciones",
  "confidence": 0.65,
  "clinical_state": "AI_PENDING_REVIEW",
  "justification": ["FC dentro de rango normal para ritmo sinusal según AHA/ACC"],
  "clinical_basis": [
    {"principle": "Interpretación de intervalos ECG según AHA/ACC 2022", "applied_parameters": ["frecuencia_bpm", "intervalo_pr_ms", "qtc_ms"]}
  ],
  "citations": [
    {"source_id": "AHA-ECG-2022", "title": "AHA/ACC ECG Interpretation Guidelines", "section": "Tabla de intervalos normales", "excerpt": "PR normal: 120-200 ms; QRS normal: <120 ms; QTc normal: <440ms (H), <460ms (M)", "version_or_date": "2022"}
  ],
  "limitations": ["Interpretación requiere correlación con contexto clínico y sintomatología del paciente"],
  "red_flags": [],
  "recommendation": null,
  "non_conclusive_reason": null
}""",

        # IMPL-20260326-02: Formularios internos — prediagnóstico sin OCR
        "Somatometria": """Eres un sistema de apoyo a la decisión clínica para medicina del trabajo.
Recibirás valores de somatometría y signos vitales capturados directamente por el operador
(talla, peso, IMC, tensión arterial, frecuencia cardíaca, temperatura).
Tu tarea es generar un análisis de apoyo, NO un diagnóstico definitivo ni aptitud laboral.

REGLAS ESTRICTAS:
1. Usa lenguaje prudente: "valores compatibles con", "sugiere evaluación de", "requiere correlación clínica".
2. NO emitas aptitud laboral, dictamen médico final ni recomendaciones de tratamiento.
3. Comenta solo los parámetros disponibles. No inventes ni extrapoles valores.
4. IMC: usa clasificación OMS (Bajo peso < 18.5, Normal 18.5-24.9, Sobrepeso 25-29.9, Obesidad ≥ 30).
5. TA: valores de referencia según JNC8/ESH 2018 (normal < 120/80, elevada 120-129/<80, HTA ≥ 130/80).
6. Si peso_kg y talla_m están ausentes, declara AI_NON_CONCLUSIVE.
7. Red flags: solo para hipertensión crisi (TA ≥ 180/120) o bradicardia severa (FC < 40 lpm).
8. Responde SOLO en JSON, sin markdown.

Parámetros capturados:
{extracted_json}

Responde en JSON con esta estructura exacta:
{
  "summary": "Texto prudente de máx. 2 oraciones con valores observados",
  "confidence": 0.70,
  "clinical_state": "AI_PENDING_REVIEW",
  "justification": ["IMC de X sugiere clasificación Y según OMS 2000", "TA dentro de rango normal"],
  "clinical_basis": [
    {"principle": "Clasificación antropométrica OMS", "applied_parameters": ["imc", "peso_kg", "talla_m"]},
    {"principle": "Clasificación de presión arterial JNC8/ESH 2018", "applied_parameters": ["ta_sistolica", "ta_diastolica"]}
  ],
  "citations": [
    {"source_id": "OMS-IMC-2000", "title": "Obesity: preventing and managing the global epidemic", "section": "Clasificación IMC adultos", "excerpt": "IMC 25-29.9 = Sobrepeso; ≥ 30 = Obesidad", "version_or_date": "2000"},
    {"source_id": "NOM-030-SSA2-2009", "title": "Prevención, detección, diagnóstico, tratamiento y control de la hipertensión arterial sistémica", "section": "Clasificación", "excerpt": "TA normal < 120/80 mmHg", "version_or_date": "2009"}
  ],
  "limitations": ["La somatometría aislada no es suficiente para determinar riesgo metabólico sin historia clínica completa"],
  "red_flags": [],
  "recommendation": null,
  "non_conclusive_reason": null
}""",

        "AgudezaVisual": """Eres un sistema de apoyo a la decisión clínica para salud visual ocupacional.
Recibirás valores de agudeza visual capturados directamente por el operador
(visión lejana/cercana por ojo, valores corregidos, reflejos, test de Ishihara).
Tu tarea es generar un análisis de apoyo, NO un diagnóstico oftalmológico definitivo.

REGLAS ESTRICTAS:
1. Usa lenguaje prudente: "valores compatibles con", "sugiere evaluación oftalmológica", "requiere correlación clínica".
2. NO emitas diagnóstico de enfermedad ocular, aptitud laboral ni recomendaciones de tratamiento.
3. Agudeza visual normal en adultos: 20/20 o equivalente (1.0 decimal, 6/6 métrico).
4. Considera como hallazgo relevante cualquier valor peor que 20/40 (0.5 decimal) sin corrección.
5. Comenta Ishihara solo si está documentado. No asumas daltonismo si no hay dato.
6. Si vision_lejana_od y vision_lejana_oi están ausentes, declara AI_NON_CONCLUSIVE.
7. Responde SOLO en JSON, sin markdown.

Parámetros capturados:
{extracted_json}

Responde en JSON con esta estructura exacta:
{
  "summary": "Texto prudente de máx. 2 oraciones sobre los valores de agudeza visual",
  "confidence": 0.68,
  "clinical_state": "AI_PENDING_REVIEW",
  "justification": ["Agudeza visual lejana OD 20/20 compatible con visión normal", "Sin corrección, valores dentro de rango funcional"],
  "clinical_basis": [
    {"principle": "Estándar de agudeza visual 20/20 (Snellen)", "applied_parameters": ["vision_lejana_od", "vision_lejana_oi"]},
    {"principle": "Evaluación de visión cromática (Ishihara)", "applied_parameters": ["test_ishihara"]}
  ],
  "citations": [
    {"source_id": "NOM-009-STPS-2011", "title": "Condiciones de seguridad e higiene en los centros de trabajo donde se realicen actividades de soldadura y corte", "section": "Req. visuales", "excerpt": "Referencia a requisitos de agudeza visual en actividades de riesgo", "version_or_date": "2011"},
    {"source_id": "CONAPO-OV-2018", "title": "Guía de práctica clínica: detección y diagnóstico de errores de refracción", "section": "Clasificación AV", "excerpt": "AV 20/20 normal; < 20/40 sugiere evaluación", "version_or_date": "2018"}
  ],
  "limitations": ["La agudeza visual por sí sola no descarta patología ocular estructural; se requiere valoración oftalmológica completa para diagnóstico"],
  "red_flags": [],
  "recommendation": null,
  "non_conclusive_reason": null
}""",

        "ExamenMedico": """Eres un sistema de apoyo a la decisión clínica para medicina del trabajo.
Recibirás hallazgos de una exploración física general capturados directamente por el médico
(hallazgos por sistema: neurológico, corazón, pulmones, abdomen, columna, extremidades, etc.).
Tu tarea es generar un análisis de apoyo, NO un diagnóstico médico definitivo.

REGLAS ESTRICTAS:
1. Usa lenguaje prudente: "hallazgos compatibles con", "sugiere evaluación de", "requiere correlación clínica".
2. NO emitas diagnóstico de enfermedad, aptitud laboral ni recomendaciones de tratamiento.
3. Solo comenta los sistemas con hallazgos documentados. Ignora campos vacíos o null.
4. Red flags: solo para hallazgos que impliquen riesgo inmediato (ej. soplo cardíaco no documentado, signos meníngeos, abdomen en tabla).
5. Si todos los campos están vacíos o null, declara AI_NON_CONCLUSIVE.
6. Responde SOLO en JSON, sin markdown.

Parámetros capturados:
{extracted_json}

Responde en JSON con esta estructura exacta:
{
  "summary": "Texto prudente de máx. 2 oraciones sobre los hallazgos principales",
  "confidence": 0.60,
  "clinical_state": "AI_PENDING_REVIEW",
  "justification": ["Exploración cardiovascular sin hallazgos patológicos documentados", "Sistema osteomuscular con hallazgos que sugieren evaluación complementaria"],
  "clinical_basis": [
    {"principle": "Exploración física sistemática por aparatos y sistemas", "applied_parameters": ["corazon", "campos_pulmonares", "ms_superiores", "ms_inferiores"]}
  ],
  "citations": [
    {"source_id": "NOM-030-SSA2-2009", "title": "Prevención y control de enfermedades cardiovasculares", "section": "Exploración física", "excerpt": "Hallazgos auscultatorios como criterio de evaluación", "version_or_date": "2009"},
    {"source_id": "IMSS-575-12", "title": "Guía de práctica clínica: examen médico ocupacional", "section": "Exploración por sistemas", "excerpt": "La exploración por sistemas es parte integral del examen médico de ingreso y periódico", "version_or_date": "2012"}
  ],
  "limitations": ["La exploración física aislada no reemplaza estudios de gabinete complementarios; requiere correlación con historia clínica y antecedentes"],
  "red_flags": [],
  "recommendation": null,
  "non_conclusive_reason": null
}""",
    }

    def _check_minimum_params(self, study_type: str, extracted_data: Dict[str, Any]) -> Optional[str]:
        """
        Verifica si existen los parámetros mínimos para generar prediagnóstico.
        Retorna None si OK, o la razón de non-conclusive si faltan parámetros.
        """
        required = REQUIRED_PARAMS.get(study_type, [])
        missing = []
        for param in required:
            value = extracted_data.get(param)
            if value is None or value == [] or value == {}:
                missing.append(param)
        if missing:
            return f"Parámetros mínimos faltantes: {', '.join(missing)}"
        # IMPL-20260513-01: verificación de interpretabilidad explícita en Espirometría
        # IMPL-20260516-13: también buscar en bloque calidad.es_interpretable (ARCH-20260516-13)
        if study_type == "Espirometria":
            is_interpretable = extracted_data.get("es_interpretable")
            if is_interpretable is None:
                calidad_block = extracted_data.get("calidad")
                if isinstance(calidad_block, dict):
                    is_interpretable = calidad_block.get("es_interpretable")
            if is_interpretable is False:
                return "El documento fue marcado como no interpretable por el extractor (es_interpretable=false)"
            completitud = extracted_data.get("completitud_documental")
            if completitud is None:
                calidad_block = extracted_data.get("calidad")
                if isinstance(calidad_block, dict):
                    completitud = calidad_block.get("completitud_documental")
            if completitud == "no_concluyente":
                return "Completitud documental espirométrica insuficiente para interpretación"
        # IMPL-20260513-01: verificación de completitud para Audiometría
        if study_type == "Audiometria" and extracted_data.get("completitud_documental") == "no_concluyente":
            return "Completitud documental insuficiente para audiometría: menos de 3 frecuencias por oído"
        return None

    @staticmethod
    def _build_calibration_context(medical_calibration: Optional[Dict[str, Any]]) -> str:
        """
        IMPL-20260513-01: Construye el bloque de contexto de calibración médica para el prompt.
        Si existe calibración capturada en el panel aiCalibration, la inyecta como marco preferente.
        Si no, retorna cadena vacía (el prompt opera con conocimiento general).
        """
        if not medical_calibration:
            return ""  # Sin calibración → el prompt usa conocimiento general

        lines = [
            "MARCO DE CALIBRACIÓN MÉDICA (prioridad sobre conocimiento general):",
            "Se ha capturado calibración médica específica en el panel de administración.",
            "Úsala como marco preferente de interpretación sobre el conocimiento general.",
            "",
        ]
        # Extraer campos relevantes de aiCalibration si existen
        description = medical_calibration.get("description") or medical_calibration.get("descripcion")
        if description:
            lines.append(f"- Descripción: {description}")

        criteria = medical_calibration.get("criteria") or medical_calibration.get("criterios")
        if criteria:
            if isinstance(criteria, list):
                for c in criteria:
                    lines.append(f"- Criterio: {c}")
            else:
                lines.append(f"- Criterios: {criteria}")

        thresholds = medical_calibration.get("thresholds") or medical_calibration.get("umbrales")
        if thresholds:
            lines.append(f"- Umbrales específicos: {json.dumps(thresholds, ensure_ascii=False)}")

        notes = medical_calibration.get("notes") or medical_calibration.get("notas")
        if notes:
            lines.append(f"- Notas del calibrador: {notes}")

        version = medical_calibration.get("version") or medical_calibration.get("calibration_version")
        if version:
            lines.append(f"- Versión de calibración: {version}")

        lines.append("")
        return "\n".join(lines)

    def generate_prediagnosis(
        self,
        study_type: str,
        extracted_data: Dict[str, Any],
        medical_calibration: Optional[Dict[str, Any]] = None,
        ai_calibration: Optional[Dict[str, Any]] = None,
    ) -> AIPrediagnosisResult:
        """
        Genera prediagnóstico IA basado en parámetros ya extraídos.
        IMPL-20260513-01: Acepta calibración médica del panel aiCalibration.
        IMPL-20260518-03: Resuelve prompt clínico desde aiCalibration.diagnosis.prompt;
            si falta, usa fallback clínico general backend (ARCH-20260518-03).

        Args:
            study_type:        Tipo de estudio (Audiometria, Laboratorio, etc.)
            extracted_data:    Dict con parámetros canónicos extraídos
            medical_calibration: Dict con aiCalibration del panel admin para contexto de
                calibración (umbrales, criterios). Si se pasa → calibration_source='medical_calibration'.
            ai_calibration:    Dict completo de aiCalibration. Si contiene
                ai_calibration['diagnosis']['prompt'], se usa como template clínico
                (prompt_source='ai_calibration'). Si no, se usa PREDIAGNOSTIC_PROMPTS
                como fallback general (prompt_source='backend_fallback').

        Returns:
            AIPrediagnosisResult — siempre retorna un resultado; usa AI_NON_CONCLUSIVE si no hay datos.
            Los campos calibration_source, clinical_model_used y prompt_source quedan trazados.
        """
        # IMPL-20260513-01: determinar camino de calibración para trazabilidad
        calibration_source = "medical_calibration" if medical_calibration else "general_fallback"

        # FIX-20260518-02 | respaldo: context/interconsultas/DICTAMEN_FIX-20260518-01.md
        # La capa clínica usa exclusivamente MedGemma vía Featherless.
        # Gemini queda reservado a la extracción multimodal, nunca al prediagnóstico.
        clinical_provider = "featherless"
        clinical_model_used = FEATHERLESS_MODEL
        clinical_provider_available = bool(MEDGEMMA_ENABLED and FEATHERLESS_API_KEY)

        # IMPL-20260518-03: resolver prompt clínico desde aiCalibration o fallback general backend
        _diagnosis_cfg = (ai_calibration or {}).get("diagnosis") or {}
        _custom_clinical_prompt = _diagnosis_cfg.get("prompt")
        if _custom_clinical_prompt:
            prompt_source = "ai_calibration"
            _clinical_prompt_version = _diagnosis_cfg.get("version", "calibration_custom")
            print(
                f"✅ [ARCH-20260518-03] Prompt clínico resuelto desde aiCalibration "
                f"(v={_clinical_prompt_version}) para {study_type}"
            )
        else:
            prompt_source = "backend_fallback"
            _clinical_prompt_version = "backend_v2"
            print(
                f"ℹ️ [ARCH-20260518-03] Sin prompt clínico en aiCalibration — "
                f"usando fallback general backend para {study_type}"
            )

        # IMPL-20260326-17: Tipos sin soporte de prediagnóstico IA en V1
        # Campimetria y RiesgoCardiovascular retornan AI_NON_CONCLUSIVE explícito.
        if study_type not in PREDIAGNOSIS_SUPPORTED_TYPES:
            print(f"ℹ️ Tipo '{study_type}' sin prediagnóstico IA en V1 — revisión médica manual requerida")
            return AIPrediagnosisResult(
                summary=(
                    f"Estudio '{study_type}' registrado. "
                    "El documento requiere revisión médica manual. "
                    "El prediagnóstico IA no está disponible para este tipo en V1."
                ),
                confidence=0.0,
                clinical_state="AI_NON_CONCLUSIVE",
                justification=[],
                clinical_basis=[],
                citations=[],
                limitations=[f"Prediagnóstico IA no soportado para '{study_type}' en V1."],
                red_flags=[],
                non_conclusive_reason=f"Tipo '{study_type}' sin prompt de prediagnóstico definido en V1.",
                calibration_source=calibration_source,
                clinical_model_used=clinical_model_used,
                clinical_provider=clinical_provider,
                prompt_source=prompt_source,
                prompt_version=_clinical_prompt_version,
            )

        # Verificar parámetros mínimos
        non_conclusive_reason = self._check_minimum_params(study_type, extracted_data)
        if non_conclusive_reason:
            print(f"⚠️ Prediagnóstico no concluyente: {non_conclusive_reason}")
            return AIPrediagnosisResult(
                summary="No es posible generar una sugerencia clínica con la información disponible.",
                confidence=0.0,
                clinical_state="AI_NON_CONCLUSIVE",
                justification=[],
                clinical_basis=[],
                citations=[],
                limitations=["Parámetros insuficientes extraídos del documento."],
                red_flags=[],
                non_conclusive_reason=non_conclusive_reason,
                calibration_source=calibration_source,
                clinical_model_used=clinical_model_used,
                clinical_provider=clinical_provider,
                prompt_source=prompt_source,
                prompt_version=_clinical_prompt_version,
            )

        # ARCH-20260518-03: prompt template = aiCalibration.diagnosis.prompt si existe,
        #                    sino PREDIAGNOSTIC_PROMPTS[study_type] como fallback general backend.
        if _custom_clinical_prompt:
            prompt_template = _custom_clinical_prompt
        else:
            prompt_template = self.PREDIAGNOSTIC_PROMPTS.get(study_type, "")

        if not prompt_template:
            return AIPrediagnosisResult(
                summary="Tipo de estudio sin soporte de prediagnóstico en V1.",
                confidence=0.0,
                clinical_state="AI_NON_CONCLUSIVE",
                limitations=["Tipo de estudio no soportado por prediagnóstico V1."],
                non_conclusive_reason=f"Tipo '{study_type}' sin prompt de prediagnóstico definido.",
                calibration_source=calibration_source,
                clinical_model_used=clinical_model_used,
                clinical_provider=clinical_provider,
                prompt_source=prompt_source,
                prompt_version=_clinical_prompt_version,
            )

        # IMPL-20260513-01: inyectar contexto de calibración médica en el prompt
        calibration_context_block = self._build_calibration_context(medical_calibration)
        if calibration_source == "medical_calibration":
            print(f"✅ Usando calibración médica del panel para {study_type}")
        else:
            print(f"ℹ️ Sin calibración médica — operando con conocimiento general para {study_type}")

        prompt = prompt_template.replace(
            "{calibration_context}",
            calibration_context_block,
        ).replace(
            "{extracted_json}",
            json.dumps(extracted_data, ensure_ascii=False, indent=2),
        )

        # IMPL-20260516-08: capturar el prompt renderizado antes de la llamada al modelo (ARCH-20260516-08)
        _rendered_prompt = prompt

        if not clinical_provider_available:
            if not MEDGEMMA_ENABLED:
                unavailable_reason = (
                    "Prediagnóstico clínico no disponible: MEDGEMMA_ENABLED=false. "
                    "Gemini se usa solo para extracción."
                )
            else:
                unavailable_reason = (
                    "Prediagnóstico clínico no disponible: falta FEATHERLESS_API_KEY para MedGemma. "
                    "Gemini se usa solo para extracción."
                )

            return AIPrediagnosisResult(
                summary="No fue posible generar el prediagnóstico clínico porque MedGemma no está disponible.",
                confidence=0.0,
                clinical_state="AI_NON_CONCLUSIVE",
                justification=[],
                clinical_basis=[],
                citations=[],
                limitations=[unavailable_reason],
                red_flags=[],
                non_conclusive_reason=unavailable_reason,
                calibration_source=calibration_source,
                clinical_model_used=clinical_model_used,
                clinical_provider=clinical_provider,
                prompt_source=prompt_source,
                prompt_version=_clinical_prompt_version,
                input_debug=PrediagnosisInputDebug(
                    study_type=study_type,
                    extracted_data=extracted_data,
                    medical_calibration=medical_calibration,
                    clinical_provider=clinical_provider,
                    clinical_model_used=clinical_model_used,
                    rendered_prompt=_rendered_prompt,
                ),
            )

        print(f"🧠 Generando prediagnóstico IA para: {study_type} | proveedor: {clinical_provider} | modelo: {clinical_model_used} | calibración: {calibration_source}")
        # IMPL-20260513-03: enrutar al proveedor correcto según configuración
        # IMPL-20260326-03: degradar a AI_NON_CONCLUSIVE en lugar de propagar excepción
        # FIX-20260518-02: si Featherless falla o está gated, la capa clínica degrada a
        # AI_NON_CONCLUSIVE. No existe fallback clínico a Gemini.
        try:
            raw_result = self._call_featherless_text_only(prompt)
        except Exception as e:
            err_str = str(e)
            # — Caso: Featherless rechaza el modelo por permisos OAuth (model_gated_needs_oauth)
            if "FEATHERLESS_GATED:" in err_str:
                gated_reason = (
                    f"Featherless rechazó el modelo {FEATHERLESS_MODEL} con error model_gated_needs_oauth (HTTP 403). "
                    "El modelo requiere autorización OAuth explícita en la cuenta del proveedor. "
                    "Esto no es un fallo de código; requiere acción en el panel de Featherless."
                )
                print(f"⚠️ {gated_reason}")
                return AIPrediagnosisResult(
                    summary="El proveedor clínico MedGemma no está disponible porque el modelo está gated.",
                    confidence=0.0,
                    clinical_state="AI_NON_CONCLUSIVE",
                    justification=[],
                    clinical_basis=[],
                    citations=[],
                    limitations=[gated_reason],
                    red_flags=[],
                    non_conclusive_reason=gated_reason,
                    calibration_source=calibration_source,
                    clinical_model_used=FEATHERLESS_MODEL,
                    clinical_provider="featherless",
                    prompt_source=prompt_source,
                    prompt_version=_clinical_prompt_version,
                )
            else:
                print(f"⚠️ Fallo al llamar/parsear proveedor '{clinical_provider}' para {study_type}: {e}")
                return AIPrediagnosisResult(
                    summary="No fue posible obtener análisis IA para este estudio debido a un error en la respuesta del modelo.",
                    confidence=0.0,
                    clinical_state="AI_NON_CONCLUSIVE",
                    justification=[],
                    clinical_basis=[],
                    citations=[],
                    limitations=["Error al parsear respuesta del modelo IA. La extracción de parámetros puede estar disponible."],
                    red_flags=[],
                    non_conclusive_reason=f"{clinical_provider.capitalize()}ParseError: {str(e)[:300]}",
                    calibration_source=calibration_source,
                    clinical_model_used=clinical_model_used,
                    clinical_provider=clinical_provider,
                    prompt_source=prompt_source,
                    prompt_version=_clinical_prompt_version,
                )

        try:
            result = AIPrediagnosisResult(**raw_result)
            # IMPL-20260513-03: añadir proveedor clínico real
            # IMPL-20260518-03: añadir fuente real del prompt clínico (ARCH-20260518-03)
            result.calibration_source = calibration_source
            result.clinical_model_used = clinical_model_used
            result.clinical_provider = clinical_provider
            result.prompt_source = prompt_source
            result.prompt_version = _clinical_prompt_version
            # IMPL-20260518-03: si se usó fallback clínico backend, registrar en limitations
            if prompt_source == "backend_fallback":
                result.limitations.append(
                    "Prompt clínico resuelto desde fallback general backend (aiCalibration.diagnosis.prompt no configurado)."
                )
            # IMPL-20260516-08: poblar input_debug con payload de entrada (ARCH-20260516-08)
            # Solo datos clínicos: study_type, extracted_data, calibración y prompt renderizado.
            # GUARDRAIL: no se incluyen API keys ni secrets — la calibración es metadata clínica.
            result.input_debug = PrediagnosisInputDebug(
                study_type=study_type,
                extracted_data=extracted_data,
                medical_calibration=medical_calibration,
                clinical_provider=result.clinical_provider,
                clinical_model_used=result.clinical_model_used,
                rendered_prompt=_rendered_prompt,
            )
            # Aplicar umbral de confianza — si baja del umbral, marcar non-conclusive
            threshold = CONFIDENCE_THRESHOLDS.get(study_type, 0.5)
            if result.confidence < threshold and result.clinical_state == "AI_PENDING_REVIEW":
                result.clinical_state = "AI_NON_CONCLUSIVE"
                reason = f"Confianza {result.confidence:.2f} por debajo del umbral {threshold:.2f} para {study_type}"
                result.non_conclusive_reason = reason
                result.limitations.append(reason)
                print(f"⚠️ Confianza baja — marcado como AI_NON_CONCLUSIVE")
            return result
        except Exception as e:
            print(f"⚠️ Error al parsear prediagnóstico IA: {e}. Raw: {raw_result}")
            return AIPrediagnosisResult(
                summary="No fue posible estructurar la sugerencia IA para este estudio.",
                confidence=0.0,
                clinical_state="AI_NON_CONCLUSIVE",
                limitations=["Error interno al procesar respuesta del modelo IA."],
                non_conclusive_reason=f"ParseError: {str(e)[:200]}",
                calibration_source=calibration_source,
                clinical_model_used=clinical_model_used,
                clinical_provider=clinical_provider,
                prompt_source=prompt_source,
                prompt_version=_clinical_prompt_version,
            )

    def _call_featherless_text_only(self, prompt: str) -> Dict[str, Any]:
        """
        Llama a MedGemma vía Featherless usando OpenAI SDK (endpoint compatible OpenAI).
        IMPL-20260513-03: Integración real MedGemma/Featherless.

        Contrato estricto:
          - NO envía PDF ni imagen. Solo prompt textual/JSON estructurado.
          - La extracción multimodal SIEMPRE sigue en Gemini (capa separada, sin tocar).
          - Lanza excepción si hay error → generate_prediagnosis degrada a AI_NON_CONCLUSIVE.

        Variables de entorno requeridas:
          FEATHERLESS_API_KEY   — token de autenticación Featherless
          FEATHERLESS_BASE_URL  — endpoint base (default: https://api.featherless.ai/v1)
          FEATHERLESS_MODEL     — modelo (default: google/medgemma-27b-text-it)
        """
        # Importación lazy — no rompe el módulo si openai no está instalado en dev local
        try:
            from openai import OpenAI
        except ImportError as exc:
            raise RuntimeError(
                "openai SDK no instalado. Ejecuta: pip install openai>=1.0"
            ) from exc

        client = OpenAI(
            api_key=FEATHERLESS_API_KEY,
            base_url=FEATHERLESS_BASE_URL,
        )

        try:
            response = client.chat.completions.create(
                model=FEATHERLESS_MODEL,
                messages=[
                    {
                        "role": "system",
                        "content": (
                    "Eres un sistema de apoyo clínico para medicina del trabajo. "
                    "Recibes exclusivamente datos clínicos estructurados ya extraídos de documentos médicos; "
                    "no analizas imágenes ni PDFs y no debes inferir datos ausentes. "
                    "Tu función es generar un prediagnóstico prudente y revisable por un médico, nunca un "
                    "diagnóstico definitivo, dictamen médico, aptitud laboral, alta, baja ni tratamiento. "
                    "Usa lenguaje prudente como 'compatible con', 'sugiere' y 'requiere correlación clínica'. "
                    "Si faltan parámetros mínimos, la calidad documental es insuficiente o la evidencia es débil, "
                    "debes devolver un resultado no concluyente con confidence baja y non_conclusive_reason explícita. "
                    "Si existe un bloque de calibración médica, úsalo como criterio prioritario sobre conocimiento general; "
                    "si no existe, opera con conocimiento clínico general conservador y trazable. "
                    "No inventes hallazgos, citas ni parámetros no sustentados por la información recibida. "
                    "Responde SIEMPRE en JSON válido, sin markdown ni bloques de código."
                        ),
                    },
                    {"role": "user", "content": prompt},
                ],
                temperature=0.2,
                max_tokens=2048,
            )
        except Exception as _featherless_err:
            _err_str = str(_featherless_err)
            # IMPL-20260516-01: Marca explícita de rechazo por modelo gated (403 model_gated_needs_oauth).
            # El marcador FEATHERLESS_GATED permite degradar honestamente a AI_NON_CONCLUSIVE
            # sin introducir un fallback clínico a Gemini. ARCH-20260516-01 / FIX-20260518-02.
            _status_code = getattr(_featherless_err, "status_code", None)
            if _status_code == 403 or "model_gated" in _err_str or "403" in _err_str:
                raise RuntimeError(
                    f"FEATHERLESS_GATED:{FEATHERLESS_MODEL}:{_err_str[:250]}"
                ) from _featherless_err
            raise

        raw_text = response.choices[0].message.content or ""
        # Stripping robusto de markdown (por si el modelo ignora la instrucción de sistema)
        raw_text = raw_text.replace("```json", "").replace("```", "").strip()

        return GeminiBase._tolerant_json_parse(raw_text)

    def _call_gemini_text_only(self, prompt: str) -> Dict[str, Any]:
        """
        Llama a Gemini con prompt de texto únicamente (sin imagen).
        Usado para la capa de interpretación que opera sobre JSON estructurado.
        """
        import requests

        url = (
            f"https://generativelanguage.googleapis.com/v1beta/models/"
            f"{self.model}:generateContent?key={self.api_key}"
        )
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.2, "maxOutputTokens": 2048},
        }

        try:
            response = requests.post(
                url,
                headers={"Content-Type": "application/json"},
                json=payload,
                timeout=(10, 60),
            )
            response.raise_for_status()
            data = response.json()

            candidates = data.get("candidates", [])
            if not candidates:
                raise ValueError("Sin candidatos en respuesta de Gemini")

            text = candidates[0]["content"]["parts"][0]["text"].strip()

            # IMPL-20260326-03: stripping robusto de markdown (incondicional)
            text = text.replace("```json", "").replace("```", "").strip()

            return GeminiBase._tolerant_json_parse(text)

        except Exception as e:
            print(f"❌ Error llamando Gemini (text-only): {e}")
            raise
