"""
Servicio de Prediagnóstico IA por Estudio — Capa separada de interpretación clínica.
IMPL-20260326-16: ARCH-20260326-16 §"Separación de capas" §"Prediagnóstico IA"
IMPL-20260513-01: Política de calibración médica; soporte MedGemma (pending_integration).
IMPL-20260603-01: Migración clínica a DR7.ai; respaldo: context/SPECs/SPEC_ARCH-20260603-04-MIGRACION-CLINICA-DR7-TEXTO.md.

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

MEDGEMMA (IMPL-20260513-01 / IMPL-20260603-01):
    - MedGemma es el proveedor médico objetivo para esta capa.
    - Estado: integrado vía DR7.ai usando endpoint médico HTTP directo.
    - Cuando MEDGEMMA_ENABLED=true y DR7_API_KEY está configurada,
        PrediagnosticService enruta la llamada a _call_dr7_medical_chat().
        - Si DR7 no está disponible, la capa clínica degrada a AI_NON_CONCLUSIVE.
        - Gemini se reserva para la extracción, no para el prediagnóstico clínico.
    - NUNCA se envía PDF/imagen a DR7 — solo prompt textual/JSON estructurado.
"""

import json
import os
from typing import Dict, Any, Optional
from .base import GeminiBase
from .keys import key_resolver, is_ai_keys_from_db_enabled
from app.schemas.medical import AIPrediagnosisResult, ClinicalBasisItem, ClinicalCitation, PrediagnosisInputDebug


def _medgemma_enabled() -> bool:
    """
    IMPL-20260809-06: Lee MEDGEMMA_ENABLED fresco del entorno.
    SPEC §5.3 — las constants de módulo se convierten a lecturas por llamada
    para que cambios del flag sin redeploy surtan efecto inmediato.

    Compatibilidad con tests: si el flag de proceso está apagado, considera
    la constante de módulo (que los tests parchean vía mock.patch).
    """
    env_raw = os.environ.get("MEDGEMMA_ENABLED", "")
    if env_raw.strip():
        return env_raw.strip().lower() == "true"
    return bool(MEDGEMMA_ENABLED)


def _resolve_dr7_config() -> Dict[str, Any]:
    """
    IMPL-20260809-06: Resuelve la config clínica DR7 (api_key, base_url, model,
    key_source, warning). Si AI_KEYS_FROM_DB_ENABLED está activo, consulta
    el resolver singleton (con caché TTL + invalidación). Si no, cae a env vars
    (con fallback a las constantes de módulo — preserva tests legacy que las
    parchean con `unittest.mock.patch`).

    FIX-20260810-06: `generate_prediagnosis` se invoca desde handlers
    `async def` (calibration.py, main.py) sobre el hilo del event loop, por
    lo que NO se puede awaitear ni bloquear el loop con el resolver async.
    Se usa `key_resolver.resolve_sync_cached("dr7")` (lectura sync de la
    caché TTL); la caché se pre-calienta en la frontera async con
    `await key_resolver.resolve("dr7")`. Ver DICTAMEN_FIX-20260810-06.
    """
    # Defaults leídos: preferimos env var (fresco), cayendo a constantes de
    # módulo (legacy compat: tests las parchean vía mock.patch). En runtime
    # real, las constantes son snapshots al import del process.
    default_api_key = (
        os.environ.get("DR7_API_KEY", "").strip() or DR7_API_KEY
    )
    default_base_url = (
        os.environ.get("DR7_BASE_URL", "").strip()
        or DR7_BASE_URL
        or "https://dr7.ai/api/v1/medical/chat/completions"
    )
    default_model = (
        os.environ.get("DR7_MODEL", "").strip()
        or DR7_MODEL
        or "medgemma-4b-it"
    )

    if not is_ai_keys_from_db_enabled():
        # Fallback env-var-only (comportamiento legacy idéntico al actual).
        return {
            "api_key": default_api_key,
            "base_url": default_base_url,
            "model": default_model,
            "key_source": "env",
            "warning": "flag_off",
        }

    # FIX-20260810-06: lectura sincrónica de la caché TTL del resolver.
    # El patrón anterior (run_coroutine_threadsafe + .result() contra el loop
    # corriente) DEADLOCKeaba cuando generate_prediagnosis corría en el hilo
    # del event loop (handler async calibration.py/main.py → pipeline sync):
    # 5s de bloqueo por request + TimeoutError tragado → siempre env var.
    # La caché se pre-calienta en la frontera async (`await resolve("dr7")`).
    # Ver DICTAMEN_FIX-20260810-06.
    resolution = key_resolver.resolve_sync_cached("dr7")
    if resolution is None:
        # Caché fría (frontera async no pre-calentó, o TTL vencido):
        # degradar a defaults env (comportamiento legacy).
        return {
            "api_key": default_api_key,
            "base_url": default_base_url,
            "model": default_model,
            "key_source": "env",
            "warning": "cache_cold",
        }
    return {
        "api_key": resolution.api_key or default_api_key,
        "base_url": resolution.base_url or default_base_url,
        "model": resolution.default_model or default_model,
        "key_source": resolution.source,
        "warning": resolution.warning,
    }


# IMPL-20260513-01: Estado de MedGemma — retrocompat. La lectura fresca se hace
# ahora vía `_medgemma_enabled()`. Esta constante sigue exportada para código
# legacy que la importe (ej. tests) — evalúa una vez al import (legacy pattern).
MEDGEMMA_ENABLED = (os.environ.get("MEDGEMMA_ENABLED", "false").strip().lower() == "true")

# IMPL-20260603-01: Retrocompat — config DR7/MedGemma vía endpoint médico HTTP.
# Las lecturas runtime se hacen ahora vía `_resolve_dr7_config()`; estas
# constantes reflejan el snapshot al import (legacy pattern preservado).
DR7_API_KEY  = os.environ.get("DR7_API_KEY", "").strip()
DR7_BASE_URL = os.environ.get("DR7_BASE_URL", "https://dr7.ai/api/v1/medical/chat/completions").strip()
DR7_MODEL    = os.environ.get("DR7_MODEL", "medgemma-4b-it").strip()


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
        # IMPL-20260715-02 (ARCH-20260715-02): Sincronizado con prompt objetivo `predx-audiometria-v2-derivado`
        # documentado en context/interconsultas/PROMPTS_DOC-20260518-02-AUDIOMETRIA.md §"1. Prompt Clínico Final".
        # Cambios: agrega bloques derivados (resumen_por_oido, resumen_bilateral, clasificacion_hipoacusia),
        # prohíbe copiar narrativa diagnóstica fuente, prioriza PTA extraído sobre estimación, y exige
        # declarar limitaciones cuando completitud_documental es "parcial" o "no_concluyente".
        "Audiometria": """Eres un sistema de apoyo a la decisión clínica para audiología ocupacional.
Recibirás parámetros extraídos de una audiometría ocupacional. Debes generar una síntesis clínica derivada a partir de esos parámetros, NO copiar ni reutilizar la narrativa diagnóstica escrita en el documento fuente.

Tu tarea es producir una interpretación prudente, estructurada y trazable. No emitas diagnóstico definitivo, aptitud laboral, incapacidad, tratamiento farmacológico ni dictamen final.

REGLAS GENERALES
1. Usa lenguaje prudente: "compatible con", "sugiere", "sin evidencia suficiente para afirmar", "requiere correlación clínica".
2. Responde SOLO en JSON válido, sin markdown.
3. Si faltan datos críticos, reduce la confianza y usa `non_conclusive_reason`.
4. No copies literalmente la descripción audiométrica del documento fuente como si fuera tu conclusión.
5. Los campos Faringe, CAD, CAI, MTD y MTI pueden mencionarse como contexto documental secundario, pero no deben ser la base principal de la interpretación audiométrica.

REGLAS ESPECÍFICAS PARA AUDIOMETRÍA
1. Si existen umbrales de vía aérea por oído y frecuencias suficientes, genera obligatoriamente:
   - `resumen_por_oido`
   - `resumen_bilateral`
   - `clasificacion_hipoacusia`
2. Usa PTA por oído si ya viene extraído. Si no viene, solo puedes estimarlo cuando haya frecuencias suficientes y debes declarar esa limitación.
3. Considera audición dentro de límites normales cuando los umbrales relevantes permanezcan <= 25 dB en las frecuencias disponibles y no exista patrón patológico claro.
4. Si detectas pérdida, describe lateralidad, severidad y patrón sugerido con lenguaje prudente.
5. Solo infiere tipo de hipoacusia (conductiva, neurosensorial o mixta) si hay datos suficientes, por ejemplo vía ósea útil, separación aéreo-ósea o patrón consistente. Si no, usa `NO_CONCLUYENTE_PARA_TIPO`.
6. Si la `completitud_documental` es insuficiente o las frecuencias clave faltan, usa `AI_NON_CONCLUSIVE` o un resumen prudente con limitaciones explícitas.
7. La recommendation debe ser prudente y ocupacional: seguimiento, vigilancia, correlación clínica, comparación con estudios previos, o repetición del estudio si la calidad es insuficiente.

CRITERIOS DE REFERENCIA ORIENTATIVOS
- Audición dentro de límites normales: umbrales <= 25 dB en frecuencias relevantes disponibles.
- Hipoacusia leve: 26-40 dB.
- Hipoacusia moderada: 41-60 dB.
- Hipoacusia severa: 61-80 dB.
- Hipoacusia profunda: > 80 dB.
- Un escotoma sugerente a 4000 Hz puede ser una bandera de exposición a ruido, pero no debe afirmarse sin suficiente evidencia del estudio completo.

{calibration_context}

Parámetros extraídos:
{extracted_json}

Responde con esta estructura exacta:
{
  "summary": "Texto prudente de máximo 2 oraciones",
  "confidence": 0.78,
  "clinical_state": "AI_PENDING_REVIEW",
  "justification": ["Razón 1 basada en parámetros concretos", "Razón 2..."],
  "clinical_basis": [
    {"principle": "Regla clínica aplicada", "applied_parameters": ["oido_derecho.via_aerea.250", "oido_izquierdo.via_aerea.500"]}
  ],
  "citations": [
    {"source_id": "NOM-011-STPS-2001", "title": "Condiciones de seguridad e higiene en los centros de trabajo donde se genere ruido", "section": "Apéndice A", "excerpt": "Criterios de evaluación audiométrica ocupacional", "version_or_date": "2001"}
  ],
  "limitations": ["Limitación 1", "Limitación 2"],
  "red_flags": [],
  "recommendation": "Recomendación prudente y no prescriptiva",
  "non_conclusive_reason": null,
  "resumen_por_oido": {
    "oido_derecho": {
      "pta": 13,
      "status": "AUDICION_DENTRO_DE_LIMITES_NORMALES",
      "severity": "NORMAL",
      "pattern": "SIN_PATRON_PATOLOGICO_CLARO",
      "basis": ["250=15", "500=20", "1000=10", "2000=10"]
    },
    "oido_izquierdo": {
      "pta": 8,
      "status": "AUDICION_DENTRO_DE_LIMITES_NORMALES",
      "severity": "NORMAL",
      "pattern": "SIN_PATRON_PATOLOGICO_CLARO",
      "basis": ["250=10", "500=15", "1000=0", "2000=10"]
    }
  },
  "resumen_bilateral": {
    "status": "AUDICION_BILATERAL_DENTRO_DE_LIMITES_NORMALES",
    "laterality": "BILATERAL",
    "symmetry": "SIN_ASIMETRIA_CLINICAMENTE_RELEVANTE",
    "note": "Hallazgos globales compatibles con audición bilateral dentro de límites normales para las frecuencias disponibles."
  },
  "clasificacion_hipoacusia": {
    "right": "NO_APLICA",
    "left": "NO_APLICA",
    "bilateral": "NO_APLICA",
    "confidence": 0.78
  }
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
7. Si `calidad.completitud_documental` o el campo legacy `completitud_documental` indica limitaciones, consérvalo como limitación técnica; NO bloquees automáticamente la interpretación si los parámetros clave y la tabla están presentes.
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
   baja la confianza y declara explícitamente la limitación técnica en `limitations`, pero no anules automáticamente la sugerencia clínica si los parámetros esenciales son legibles y consistentes.
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
        # ARCH-20260518-11: En espirometría, la calidad técnica del estudio no debe bloquear
        # automáticamente el prediagnóstico si los parámetros esenciales están presentes.
        # Esos indicadores se conservan para modular confianza y limitations en la capa clínica.
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

        # IMPL-20260603-01 | respaldo: context/SPECs/SPEC_ARCH-20260603-04-MIGRACION-CLINICA-DR7-TEXTO.md
        # La capa clínica usa exclusivamente MedGemma vía DR7.ai.
        # Gemini queda reservado a la extracción multimodal, nunca al prediagnóstico.
        clinical_provider = "dr7"

        # IMPL-20260809-06: Resolución fresca de la config DR7 vía key_resolver.
        # Permite rotación runtime sin reinicio cuando AI_KEYS_FROM_DB_ENABLED=true.
        # Con flag off (default), cae transparentemente a env vars (comportamiento actual).
        _dr7_cfg = _resolve_dr7_config()
        clinical_model_used = _dr7_cfg["model"]
        _dr7_api_key = _dr7_cfg["api_key"]
        _dr7_base_url = _dr7_cfg["base_url"]
        # Trazabilidad de fuente de key (se propaga al result para auditoría clínica).
        self._last_key_source = _dr7_cfg["key_source"]
        self._last_key_warning = _dr7_cfg["warning"]
        clinical_provider_available = bool(_medgemma_enabled() and _dr7_api_key)

        # IMPL-20260603-01. Respaldo: context/SPECs/SPEC_ARCH-20260603-04-MIGRACION-CLINICA-DR7-TEXTO.md.
        # Mantiene compatibilidad con el Literal legado del schema (gemini|featherless)
        # sin cambiar contrato: valida como featherless y expone dr7 en runtime.
        def _result_with_provider(**kwargs) -> AIPrediagnosisResult:
            payload = dict(kwargs)
            payload["clinical_provider"] = "featherless"
            result_obj = AIPrediagnosisResult(**payload)
            result_obj.clinical_provider = clinical_provider
            return result_obj

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
            return _result_with_provider(
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
                prompt_source=prompt_source,
                prompt_version=_clinical_prompt_version,
            )

        # Verificar parámetros mínimos
        non_conclusive_reason = self._check_minimum_params(study_type, extracted_data)
        if non_conclusive_reason:
            print(f"⚠️ Prediagnóstico no concluyente: {non_conclusive_reason}")
            return _result_with_provider(
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
            return _result_with_provider(
                summary="Tipo de estudio sin soporte de prediagnóstico en V1.",
                confidence=0.0,
                clinical_state="AI_NON_CONCLUSIVE",
                limitations=["Tipo de estudio no soportado por prediagnóstico V1."],
                non_conclusive_reason=f"Tipo '{study_type}' sin prompt de prediagnóstico definido.",
                calibration_source=calibration_source,
                clinical_model_used=clinical_model_used,
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
                    "Prediagnóstico clínico no disponible: falta DR7_API_KEY para MedGemma en DR7. "
                    "Gemini se usa solo para extracción."
                )

            return _result_with_provider(
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
        # IMPL-20260603-01: enrutar al proveedor clínico DR7.ai según configuración
        # IMPL-20260326-03: degradar a AI_NON_CONCLUSIVE en lugar de propagar excepción
        # No existe fallback clínico a Featherless ni a Gemini.
        try:
            # IMPL-20260809-06: pasar la config ya resuelta para evitar 2ª lookup.
            raw_result = self._call_dr7_medical_chat(prompt, dr7_cfg=_dr7_cfg)
        except Exception as e:
            err_str = str(e)
            if err_str.startswith("DR7_HTTP:"):
                _, status_code, raw_detail = err_str.split(":", 2)
                status_reason_map = {
                    "401": "error de autenticación DR7",
                    "402": "saldo insuficiente en DR7",
                    "429": "rate limit de DR7",
                    "500": "error interno del proveedor DR7",
                }
                dr7_reason = (
                    f"DR7 devolvió HTTP {status_code} ({status_reason_map.get(status_code, 'error HTTP DR7')}). "
                    f"Detalle: {raw_detail[:200]}"
                )
                print(f"⚠️ {dr7_reason}")
                return _result_with_provider(
                    summary="El proveedor clínico DR7 no está disponible para completar el prediagnóstico clínico.",
                    confidence=0.0,
                    clinical_state="AI_NON_CONCLUSIVE",
                    justification=[],
                    clinical_basis=[],
                    citations=[],
                    limitations=[dr7_reason],
                    red_flags=[],
                    non_conclusive_reason=dr7_reason,
                    calibration_source=calibration_source,
                    clinical_model_used=clinical_model_used,
                    prompt_source=prompt_source,
                    prompt_version=_clinical_prompt_version,
                )
            else:
                print(f"⚠️ Fallo al llamar/parsear proveedor '{clinical_provider}' para {study_type}: {e}")
                return _result_with_provider(
                    summary="No fue posible obtener análisis IA para este estudio debido a un error en la respuesta del modelo.",
                    confidence=0.0,
                    clinical_state="AI_NON_CONCLUSIVE",
                    justification=[],
                    clinical_basis=[],
                    citations=[],
                    limitations=["Error al parsear respuesta del modelo IA. La extracción de parámetros puede estar disponible."],
                    red_flags=[],
                    non_conclusive_reason=f"DR7ParseError: {str(e)[:300]}",
                    calibration_source=calibration_source,
                    clinical_model_used=clinical_model_used,
                    prompt_source=prompt_source,
                    prompt_version=_clinical_prompt_version,
                )

        try:
            result = AIPrediagnosisResult(**raw_result)
            result_fields = getattr(type(result), "model_fields", {})
            # IMPL-20260513-03: añadir proveedor clínico real
            # IMPL-20260518-03: añadir fuente real del prompt clínico (ARCH-20260518-03)
            if "calibration_source" in result_fields:
                result.calibration_source = calibration_source
            if "clinical_model_used" in result_fields:
                result.clinical_model_used = clinical_model_used
            if "clinical_provider" in result_fields:
                result.clinical_provider = clinical_provider
            if "prompt_source" in result_fields:
                result.prompt_source = prompt_source
            if "prompt_version" in result_fields:
                result.prompt_version = _clinical_prompt_version
            # IMPL-20260518-03: si se usó fallback clínico backend, registrar en limitations
            if prompt_source == "backend_fallback":
                result.limitations.append(
                    "Prompt clínico resuelto desde fallback general backend (aiCalibration.diagnosis.prompt no configurado)."
                )
            # IMPL-20260516-08: poblar input_debug con payload de entrada (ARCH-20260516-08)
            # Solo datos clínicos: study_type, extracted_data, calibración y prompt renderizado.
            # GUARDRAIL: no se incluyen API keys ni secrets — la calibración es metadata clínica.
            if "input_debug" in result_fields:
                result.input_debug = PrediagnosisInputDebug(
                    study_type=study_type,
                    extracted_data=extracted_data,
                    medical_calibration=medical_calibration,
                    clinical_provider=getattr(result, "clinical_provider", clinical_provider),
                    clinical_model_used=getattr(result, "clinical_model_used", clinical_model_used),
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
            return _result_with_provider(
                summary="No fue posible estructurar la sugerencia IA para este estudio.",
                confidence=0.0,
                clinical_state="AI_NON_CONCLUSIVE",
                limitations=["Error interno al procesar respuesta del modelo IA."],
                non_conclusive_reason=f"ParseError: {str(e)[:200]}",
                calibration_source=calibration_source,
                clinical_model_used=clinical_model_used,
                prompt_source=prompt_source,
                prompt_version=_clinical_prompt_version,
            )

    def _call_dr7_medical_chat(self, prompt: str, dr7_cfg: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        IMPL-20260603-01. Respaldo: context/SPECs/SPEC_ARCH-20260603-04-MIGRACION-CLINICA-DR7-TEXTO.md.
        Llama a MedGemma vía DR7.ai usando el endpoint médico HTTP directo.

        IMPL-20260809-06: Acepta `dr7_cfg` (dict con api_key/base_url/model
        ya resueltos por `_resolve_dr7_config()`) para no reconsultar el
        resolver. Si no se pasa, resuelve fresh (compat con tests legacy).

        Contrato estricto:
          - NO envía PDF ni imagen. Solo prompt textual/JSON estructurado.
          - La extracción multimodal SIEMPRE sigue en Gemini (capa separada, sin tocar).
          - Lanza excepción si hay error → generate_prediagnosis degrada a AI_NON_CONCLUSIVE.
        """
        import requests

        if dr7_cfg is None:
            dr7_cfg = _resolve_dr7_config()

        _dr7_api_key = dr7_cfg.get("api_key") or ""
        _dr7_base_url = dr7_cfg.get("base_url") or os.environ.get(
            "DR7_BASE_URL",
            "https://dr7.ai/api/v1/medical/chat/completions",
        )
        _dr7_model = dr7_cfg.get("model") or os.environ.get("DR7_MODEL", "medgemma-4b-it")

        if not _dr7_api_key:
            raise RuntimeError(
                "DR7_HTTP:0:DR7_API_KEY ausente (ni env var ni BD)"
            )

        payload = {
            "model": _dr7_model,
            "messages": [
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
            "temperature": 0.2,
            "max_tokens": 2048,
        }

        response = requests.post(
            _dr7_base_url,
            headers={
                "Authorization": f"Bearer {_dr7_api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=(10, 60),
        )

        if response.status_code in {401, 402, 429, 500}:
            raise RuntimeError(f"DR7_HTTP:{response.status_code}:{response.text[:250]}")

        response.raise_for_status()
        data = response.json()
        raw_text = GeminiBase._sanitize_model_json_text(
            ((data.get("choices") or [{}])[0].get("message") or {}).get("content", "")
        )
        if not raw_text:
            raise ValueError("Respuesta DR7 vacia o sin contenido util")

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
