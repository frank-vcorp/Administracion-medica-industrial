"""
Servicio de Prediagnóstico IA por Estudio — Capa separada de interpretación clínica.
IMPL-20260326-16: ARCH-20260326-16 §"Separación de capas" §"Prediagnóstico IA"

GUARDRAILS obligatorios:
  - Esta capa recibe parámetros ya extraídos y validados (ExtractionSnapshotPayload).
  - NO puede autopoblar aptitud laboral, dictamen final, firma digital ni documentos oficiales.
  - El lenguaje deve ser prudente: "compatible con", "sugiere", "requiere correlación clínica".
  - Si faltan parámetros mínimos o calidad es baja → estado: AI_NON_CONCLUSIVE.
"""

import json
from typing import Dict, Any, Optional
from .base import GeminiBase
from schemas.medical import AIPrediagnosisResult, ClinicalBasisItem, ClinicalCitation


# Umbrales de confianza mínima por tipo de estudio (ARCH-20260326-16 §"Umbrales V1")
CONFIDENCE_THRESHOLDS: Dict[str, float] = {
    "Audiometria": 0.55,
    "Laboratorio": 0.60,
    "Espirometria": 0.60,
    "Rayos_X": 0.50,
    "Otro": 0.40,
}

# Parámetros mínimos obligatorios por tipo para permitir interpretación
REQUIRED_PARAMS: Dict[str, list] = {
    "Audiometria": ["oido_derecho", "oido_izquierdo"],
    "Laboratorio": ["parametros"],
    "Espirometria": ["fev1", "fvc"],
    "Rayos_X": ["hallazgos", "localizacion"],
}


class PrediagnosticService(GeminiBase):
    """
    Interpreta parámetros estructurados ya extraídos y genera un prediagnóstico IA.
    Opera como capa separada DESPUÉS de la extracción.

    Flujo:
      ExtractorService → structured_data → PrediagnosticService → AIPrediagnosisResult
    """

    # IMPL-20260326-16: Prompts de interpretación — separados de los de extracción
    PREDIAGNOSTIC_PROMPTS: Dict[str, str] = {
        "Audiometria": """Eres un sistema de apoyo a la decisión clínica para audiología ocupacional.
Recibirás parámetros extraídos de una audiometría (valores numéricos por frecuencia en Hz y oído).
Tu tarea es generar un análisis de apoyo, NO un diagnóstico definitivo.

REGLAS ESTRICTAS:
1. USA lenguaje prudente: "compatible con", "sugiere", "requiere correlación clínica".
2. NO emitas aptitud laboral, dictamen médico final ni recomendaciones de alta o baja.
3. Si faltan datos críticos, declara non_conclusive_reason y pon confidence < 0.5.
4. Las citas deben ser reales y trazables (NOM-011-STPS-2001, ISO 1999:2013, etc.).
5. Responde SOLO en JSON, sin markdown.

Parámetros extraídos:
{extracted_json}

Responde en JSON con esta estructura exacta:
{
  "summary": "Texto prudente de máx. 2 oraciones con lenguaje no diagnóstico",
  "confidence": 0.75,
  "clinical_state": "AI_PENDING_REVIEW",
  "justification": ["Razón 1 basada en parámetro concreto", "Razón 2..."],
  "clinical_basis": [
    {"principle": "Elevación de umbrales audiométricos", "applied_parameters": ["oido_derecho.4000", "oido_izquierdo.4000"]}
  ],
  "citations": [
    {"source_id": "NOM-011-STPS-2001", "title": "Condiciones de seguridad e higiene en los centros de trabajo donde se genere ruido", "section": "Apéndice A", "excerpt": "Referencia a límites de exposición", "version_or_date": "2001"}
  ],
  "limitations": ["Interpretación condicionada a calidad del trazado audiométrico"],
  "red_flags": [],
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
  "non_conclusive_reason": null
}""",

        "Espirometria": """Eres un sistema de apoyo a la decisión clínica para neumología ocupacional.
Recibirás mediciones espirométricas ya extraídas (FEV1, FVC, ratio, % predicho).
Tu tarea es generar análisis de apoyo, NO diagnóstico definitivo.

REGLAS ESTRICTAS:
1. Usa lenguaje prudente: "patrón compatible con", "sugiere evaluación", "requiere correlación clínica".
2. NO declares diagnóstico de enfermedad pulmonar ni aptitud laboral.
3. Interpreta la relación FEV1/FVC y los porcentajes de predicho usando ATS/ERS.
4. Si faltan FEV1 o FVC, declara AI_NON_CONCLUSIVE.
5. Responde SOLO en JSON, sin markdown.

Parámetros extraídos:
{extracted_json}

Responde en JSON con esta estructura exacta:
{
  "summary": "Texto prudente de máx. 2 oraciones",
  "confidence": 0.72,
  "clinical_state": "AI_PENDING_REVIEW",
  "justification": ["FEV1/FVC < 0.70 sugiere patrón obstructivo según criterios ATS/ERS"],
  "clinical_basis": [
    {"principle": "Clasificación espirométrica ATS/ERS 2022", "applied_parameters": ["fev1_fvc_ratio", "fev1_percent_predicho"]}
  ],
  "citations": [
    {"source_id": "ATS-ERS-2022", "title": "ATS/ERS Technical Standard: interpretive strategies for routine lung function tests", "section": "Tabla 1", "excerpt": "FEV1/FVC < LLN define obstrucción al flujo aéreo", "version_or_date": "2022"}
  ],
  "limitations": ["Interpretación requiere comparación con valores espirométricos previos del paciente"],
  "red_flags": [],
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
        return None

    def generate_prediagnosis(
        self,
        study_type: str,
        extracted_data: Dict[str, Any],
    ) -> AIPrediagnosisResult:
        """
        Genera prediagnóstico IA basado en parámetros ya extraídos.

        Args:
            study_type: Tipo de estudio (Audiometria, Laboratorio, etc.)
            extracted_data: Dict con parámetros canónicos extraídos

        Returns:
            AIPrediagnosisResult — siempre retorna un resultado; usa AI_NON_CONCLUSIVE si no hay datos.
        """
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
            )

        prompt_template = self.PREDIAGNOSTIC_PROMPTS.get(
            study_type,
            self.PREDIAGNOSTIC_PROMPTS.get("Laboratorio", ""),  # fallback
        )
        if not prompt_template:
            return AIPrediagnosisResult(
                summary="Tipo de estudio sin soporte de prediagnóstico en V1.",
                confidence=0.0,
                clinical_state="AI_NON_CONCLUSIVE",
                limitations=["Tipo de estudio no soportado por prediagnóstico V1."],
                non_conclusive_reason=f"Tipo '{study_type}' sin prompt de prediagnóstico definido.",
            )

        prompt = prompt_template.replace(
            "{extracted_json}",
            json.dumps(extracted_data, ensure_ascii=False, indent=2),
        )

        print(f"🧠 Generando prediagnóstico IA para: {study_type}")
        raw_result = self._call_gemini_text_only(prompt)

        try:
            result = AIPrediagnosisResult(**raw_result)
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
            )

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

            # Limpiar markdown si el modelo lo añade
            if text.startswith("```"):
                text = text.split("```")[1]
                if text.startswith("json"):
                    text = text[4:]
            text = text.strip().rstrip("```").strip()

            import json as _json
            return _json.loads(text)

        except Exception as e:
            print(f"❌ Error llamando Gemini (text-only): {e}")
            raise
