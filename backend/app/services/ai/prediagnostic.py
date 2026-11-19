"""
Servicio de Prediagnóstico IA por Estudio — Capa separada de interpretación clínica.
IMPL-20260326-16: ARCH-20260326-16 §"Separación de capas" §"Prediagnóstico IA"
IMPL-20260513-01: Política de calibración médica; soporte MedGemma (pending_integration).
IMPL-20260603-01: Migración clínica a DR7.ai; respaldo: context/SPECs/SPEC_ARCH-20260603-04-MIGRACION-CLINICA-DR7-TEXTO.md.

ARCH-20260820-01 Fase 4 (SPEC §14 + handoff Fase 4):
  - `clinicalCriteria` del contrato V3 resuelto por `CalibrationResolver` es la
    fuente primaria de `requiredParams`, `confidenceThreshold`, `prediagnosisEnabled`
    y `prompt` clínico. Las constantes de módulo (`REQUIRED_PARAMS`,
    `CONFIDENCE_THRESHOLDS`, `PREDIAGNOSIS_SUPPORTED_TYPES`, `PREDIAGNOSTIC_PROMPTS`)
    permanecen como **fallback explícito y trazado** (`legacy_hardcoded`).
  - El canal `medical_calibration` se retira del flujo principal (H11 FIX);
    `_build_calibration_context` se elimina. `ai_calibration` se conserva
    como shim deprecado (remapea a `published_v3` cuando contiene
    `clinicalCriteria`, sino a `legacy_hardcoded`).
  - Si `calibration_version.enabled=false` o `clinicalCriteria.prediagnosisEnabled=false`
    → `AI_NON_CONCLUSIVE` con `non_conclusive_reason="calibration_disabled"`
    **sin** invocar MiniMax, salvo el fallback runtime documentado.
  - `calibration_source` ∈ {`published_v3`, `calibration_disabled`, `legacy_hardcoded`}
    (legacy `medical_calibration`/`general_fallback` siguen aceptos como
    deprecados para compat de snapshots históricos).
  - `prompt_source` ∈ {`clinical_criteria_v3`, `ai_calibration`, `backend_fallback`}.

GUARDRAILS obligatorios:
  - Esta capa recibe parámetros ya extraídos y validados (ExtractionSnapshotPayload).
  - NO puede autopoblar aptitud laboral, dictamen final, firma digital ni documentos oficiales.
  - El lenguaje deve ser prudente: "compatible con", "sugiere", "requiere correlación clínica".
  - Si faltan parámetros mínimos o calidad es baja → estado: AI_NON_CONCLUSIVE.

MINIMAX (FIX-20261028-01):
    - El prediagnóstico clínico usa solo MiniMax M3 (texto / JSON ya extraído).
    - Credenciales: el mismo resolver `m3` que la extracción
      (BD si `AI_KEYS_FROM_DB_ENABLED`, si no `M3_API_KEY` / `M3_BASE_URL` /
      `M3_DEFAULT_MODEL`).
    - `DR7_API_KEY` y `MEDGEMMA_ENABLED` no habilitan esta capa. Aunque sigan
      en el entorno o en la fila `dr7`, este flujo no llama a dr7.ai.
    - Si MiniMax falla, responde vacío o devuelve JSON no parseable, la capa
      degrada a `AI_NON_CONCLUSIVE`. No es un diagnóstico final.
    - Gemini queda reservado a extracción documental, no al prediagnóstico.
    - NUNCA se envía PDF/imagen al chat clínico — solo prompt textual.
"""

import json
import os
import re
from typing import Dict, Any, Optional
from .base import GeminiBase
from .keys import key_resolver, is_ai_keys_from_db_enabled
from app.schemas.medical import AIPrediagnosisResult, ClinicalBasisItem, ClinicalCitation, PrediagnosisInputDebug
# ARCH-20260820-01 Fase 4 (handoff §6.4): resolver de calibración V3 en proceso.
# `calibration_version` viaja como `AICalibrationVersionResolved` ya resuelto
# por `get_default_resolver().resolve(test_row, "published")` desde `main.py`.
# Importación local para evitar ciclos y mantener snapshot al import.
try:
    from .calibration_resolver import AICalibrationVersionResolved  # noqa: F401
    _HAS_CALIBRATION_RESOLVER = True
except Exception:  # pragma: no cover — protege tests aislados sin resolver.
    _HAS_CALIBRATION_RESOLVER = False
    AICalibrationVersionResolved = None  # type: ignore[assignment]


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
    LEGACY. El prediagnóstico ya no llama esta función (FIX-20261028-01).
    Se conserva para tests del resolver de keys. No usar en el flujo clínico.

    IMPL-20260809-06: Resuelve la config DR7 (api_key, base_url, model,
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

# FIX-20261028-01: credenciales clínicas MiniMax. Lectura runtime en
# `_resolve_m3_clinical_config()`; estas constantes permiten que los tests
# parcheen el fallback de módulo (mismo patrón que DR7_API_KEY).
M3_API_KEY = os.environ.get("M3_API_KEY", "").strip()
M3_BASE_URL = os.environ.get("M3_BASE_URL", "https://api.minimax.io/v1").strip()
from app.services.ai.m3_model import M3_MODEL_FLASH, resolve_m3_model
from app.audiometry_criteria import enrich_audiometry_extracted_data

M3_DEFAULT_MODEL = resolve_m3_model(os.environ.get("M3_DEFAULT_MODEL", M3_MODEL_FLASH))
# Con razonamiento bajo la llamada debe cerrar pronto. 90s deja margen
# y, junto con la extracción, cabe antes del corte de 300s de Vercel.
M3_CLINICAL_DEADLINE_SEC = 90

# Texto user-facing: no arrastrar cuerpos HTTP (crédito, URLs de upgrade, DR7).
_PROVIDER_LEAK_RE = re.compile(
    r"https?://\S+|dr7(?:\.ai)?(?:_[\w-]*)?|insufficient[_\s-]?credit|\bupgrade\b",
    re.IGNORECASE,
)


def _redact_provider_leak(text: str) -> str:
    """Quita de un mensaje user-facing URLs, DR7 y texto de crédito insuficiente."""
    cleaned = _PROVIDER_LEAK_RE.sub("", text or "")
    cleaned = re.sub(r"\s+", " ", cleaned).strip(" :.-")
    return cleaned


def _public_minimax_http_reason(status_code: str) -> str:
    """
    Motivo user-facing de un fallo HTTP de MiniMax.
    No incluye el cuerpo de la respuesta.
    """
    code = str(status_code or "").strip()
    labels = {
        "0": "clave de MiniMax no disponible",
        "timeout": "tiempo de espera agotado",
        "401": "autenticación rechazada por MiniMax",
        "402": "solicitud no autorizada por MiniMax",
        "429": "límite de uso de MiniMax",
        "500": "error interno de MiniMax",
    }
    label = labels.get(code, "error de MiniMax")
    if code in {"401", "402", "429", "500"}:
        return (
            f"MiniMax no pudo completar el prediagnóstico clínico "
            f"(HTTP {code}: {label})."
        )
    return f"MiniMax no pudo completar el prediagnóstico clínico ({label})."


def _m3_chat_completions_url(base_url: str) -> str:
    """Arma el endpoint OpenAI-compatible de MiniMax. Rechaza hosts dr7.ai."""
    base = (base_url or "").strip().rstrip("/")
    if not base:
        base = "https://api.minimax.io/v1"
    if "dr7.ai" in base.lower():
        raise RuntimeError("M3_HTTP:0:endpoint clínico rechazado")
    if base.endswith("/chat/completions"):
        return base
    return f"{base}/chat/completions"


def _resolve_m3_clinical_config() -> Dict[str, Any]:
    """
    FIX-20261028-01: config clínica MiniMax M3.

    Misma ruta de credenciales que la extracción (key_resolver de "m3"):
    fila BD cuando `AI_KEYS_FROM_DB_ENABLED`, si no env
    (`M3_API_KEY`, `M3_BASE_URL`, `M3_DEFAULT_MODEL`).
    `DR7_API_KEY` no se lee. Caché fría: intenta `_resolve_sync_cold("m3")`
    (mismo helper que `M3VisionBase._refresh_keys`) y, si no hay key, env.
    """
    default_api_key = os.environ.get("M3_API_KEY", "").strip() or M3_API_KEY
    default_base_url = (
        os.environ.get("M3_BASE_URL", "").strip()
        or M3_BASE_URL
        or "https://api.minimax.io/v1"
    )
    default_model = resolve_m3_model(
        os.environ.get("M3_DEFAULT_MODEL", "").strip() or M3_DEFAULT_MODEL
    )

    if not is_ai_keys_from_db_enabled():
        return {
            "api_key": default_api_key,
            "base_url": default_base_url,
            "model": default_model,
            "key_source": "env",
            "warning": "flag_off",
        }

    from app.services.ai import keys as keys_mod

    resolver = keys_mod.key_resolver
    resolution = resolver.resolve_sync_cached("m3")
    if resolution is None:
        resolution = keys_mod._resolve_sync_cold("m3")
    if resolution is None:
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
        "model": resolve_m3_model(resolution.default_model or default_model),
        "key_source": resolution.source,
        "warning": resolution.warning,
    }


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
    "Campimetria": 0.55,
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
    "Campimetria": ["confrontacion_od", "confrontacion_oi"],
    # ExamenMedico no tiene mínimos estrictos; el prompt maneja datos parciales
}


# FIX-20260821-01 §4.2: Helper módulo-nivel para gate table-aware Espirometría.
# Reutiliza `_backfill_espirometry_scalar` del extractor (misma precedencia:
# Mejor * → estándar → max(m1,m2,m3)). Si el helper devuelve escalar > 0,
# el parámetro se considera presente en la tabla y el gate pasa.
def _espirometry_param_present_in_tabla(extracted_data: Dict[str, Any], param: str) -> bool:
    """
    Args:
        extracted_data: dict con posible clave `parametros` (lista de filas).
        param: 'fev1' | 'fvc' (únicos relevantes para el gate actual).

    Returns:
        True si hay una fila utilizable en `parametros[]` que aporte un escalar
        > 0 para el parámetro; False en caso contrario (incluye ausencia de tabla).
    """
    # Import lazy para evitar ciclos; el helper es puro y módulo-nivel.
    from app.services.ai.extractor import _backfill_espirometry_scalar

    parametros = extracted_data.get("parametros")
    if not isinstance(parametros, list) or not parametros:
        return False
    # `param` es 'fev1' o 'fvc'; mapeo directo al bucket del helper.
    value = _backfill_espirometry_scalar(parametros, param)
    return isinstance(value, (int, float)) and value > 0

# IMPL-20260326-17: Tipos con prediagnóstico IA explícito. RiesgoCardiovascular
# queda fuera en V1 — el documento ya contiene el resultado calculado.
# IMPL-20260326-02: Añadidos formularios internos: Somatometria, AgudezaVisual, ExamenMedico.
# IMPL-FEATURE-20260914-01: Campimetria pasa a formulario interno (confrontación + Ishihara).
PREDIAGNOSIS_SUPPORTED_TYPES = {
    "Audiometria",
    "Laboratorio",
    "Espirometria",
    "Rayos_X",
    "Electrocardiograma",
    "Campimetria",
    # Formularios internos (sin OCR — parámetros ya estructurados)
    "Somatometria",
    "AgudezaVisual",
    "ExamenMedico",
}


# IMPL-FEATURE-20260824-02 (gap fix): helper puro para renderizar el bloque
# de contexto clínico estructurado que se inyecta al prompt del
# prediagnóstico (MiniMax M3). El bloque:
#   - Está envuelto en un fence `=== CONTEXTO CLÍNICO ===` para delimitar
#     claramente que NO es parte de los parámetros extraídos del documento.
#   - Incluye instrucciones explícitas al modelo para que use el cuestionario
#     sólo como contexto corroborante, NO invente respuestas ausentes y NO
#     sustituya los parámetros extraídos del documento.
#   - NO incluye PII del encabezado de la papeleta (el cuestionario por
#     contrato sólo contiene antecedentes clínicos y exploración física del
#     estudio).
#   - Si el contexto no es un objeto o no tiene `schemaVersion`, devuelve
#     cadena vacía (defensa contra payloads arbitrarios / prompt injection).
def _render_clinical_context_block(clinical_context: Dict[str, Any]) -> str:
    if not isinstance(clinical_context, dict):
        return ""
    version = clinical_context.get("schemaVersion")
    if not isinstance(version, str) or not version.strip():
        return ""
    try:
        serialized = json.dumps(clinical_context, ensure_ascii=False, indent=2)
    except (TypeError, ValueError):
        return ""
    return (
        "=== CONTEXTO CLÍNICO DEL PACIENTE (cuestionario estructurado, NO es "
        "resultado del documento) ===\n"
        f"schemaVersion: {version}\n"
        "Instrucciones al modelo:\n"
        "  - Trata este bloque sólo como contexto corroborante del paciente.\n"
        "  - NO inventes respuestas para campos ausentes en el cuestionario.\n"
        "  - NO sustituyas los parámetros extraídos del documento por los "
        "del cuestionario: el documento es la fuente primaria de parámetros "
        "clínicos.\n"
        "  - Si el cuestionario contradice el documento, mantén el documento "
        "como fuente y refleja la discrepancia sólo si es clínicamente "
        "relevante y con justificación.\n"
        "=== INICIO BLOQUE ===\n"
        f"{serialized}\n"
        "=== FIN BLOQUE ==="
    )


class PrediagnosticService(GeminiBase):
    """
    Interpreta parámetros estructurados ya extraídos y genera un prediagnóstico IA.
    Opera como capa separada DESPUÉS de la extracción.

    Única fuente de verdad: los prompts de prediagnóstico provienen únicamente
    de `MedicalTest.options.aiCalibration` en PostgreSQL (sin prompts
    hardcodeados ni fallback silencioso en código).
    """

    # Sin prompts hardcodeados en código; conservado vacío únicamente como
    # referencia de interfaz histórica.
    PREDIAGNOSTIC_PROMPTS: Dict[str, str] = {}

    def _check_minimum_params(
        self,
        study_type: str,
        extracted_data: Dict[str, Any],
        required_params: Optional[list] = None,
    ) -> Optional[str]:
        """
        Verifica si existen los parámetros mínimos para generar prediagnóstico.
        Retorna None si OK, o la razón de non-conclusive si faltan parámetros.

        ARCH-20260820-01 Fase 4 (handoff §6.4): `required_params` proviene de
        `calibration_version.clinicalCriteria.requiredParams` si está presente;
        si no, cae a la constante de módulo `REQUIRED_PARAMS[study_type]`.

        FIX-20260821-01 §4.2: gate table-aware SOLO para Espirometría. Si el
        parámetro requerido no está en raíz, lo busca en `extracted_data.parametros[]`
        por key/label con precedencia (Mejor * → estándar → max(m1,m2,m3)).
        Resto de tipos: comportamiento actual sin cambios. El gate NO se relaja:
        si una fila no existe en raíz ni en `parametros[]` (con cualquier variante),
        sigue retornando `AI_NON_CONCLUSIVE` con el mismo reason.
        """
        if required_params is None:
            required = REQUIRED_PARAMS.get(study_type, [])
        else:
            required = required_params
        missing = []
        for param in required:
            value = extracted_data.get(param)
            if value is None or value == [] or value == {}:
                # FIX-20260821-01: gate table-aware solo para Espirometría.
                if study_type == "Espirometria" and param in ("fev1", "fvc"):
                    if _espirometry_param_present_in_tabla(extracted_data, param):
                        continue
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

    # ARCH-20260820-01 Fase 4 (handoff §2.2, §6): `_build_calibration_context`
    # se elimina del flujo principal (canal muerto H11). Los criterios clínicos
    # viven dentro de `clinicalCriteria` del contrato V3 resuelto y se inyectan
    # en el prompt como bloque derivado de `prompt_source=clinical_criteria_v3`.
    # El método se conserva como stub deprecado para tests legacy que aún lo
    # invocan — retorna cadena vacía (no afecta trazabilidad).
    @staticmethod
    def _build_calibration_context(medical_calibration: Optional[Dict[str, Any]]) -> str:  # noqa: D401
        """
        DEPRECADO Fase 4 (H11). El canal `medical_calibration` fue retirado del
        flujo principal en ARCH-20260820-01; los criterios viven en
        `calibration_version.clinicalCriteria` (resuelto por
        `CalibrationResolver`). Se conserva la firma para no romper callers
        legacy y/o tests que importan el símbolo.
        """
        return ""

    # ── Helpers internos Fase 4 ──────────────────────────────────────────

    def _resolve_clinical_criteria(
        self,
        calibration_version: Any,
        ai_calibration_shim: Optional[Dict[str, Any]],
        study_type: str,
    ) -> Dict[str, Any]:
        """
        Resuelve el `clinicalCriteria` efectivo únicamente desde la calibración
        persistida en BD (V3 `clinicalCriteria` o V1/V2 `diagnosis`), sin
        prompts hardcodeados en código.
        """
        # Prioridad 1: V3 resuelta (o adaptador V1/V2 desde CalibrationResolver)
        if calibration_version is not None and getattr(calibration_version, "clinicalCriteria", None):
            cc = calibration_version.clinicalCriteria
            raw_prompt = cc.get("prompt")
            prompt_str = raw_prompt.strip() if isinstance(raw_prompt, str) else ""
            incomplete = (
                cc.get("prediagnosisEnabled") is None
                or cc.get("requiredParams") is None
                or cc.get("confidenceThreshold") is None
                or not prompt_str
            )
            return {
                "prediagnosisEnabled": bool(cc.get("prediagnosisEnabled", bool(prompt_str))),
                "requiredParams": list(cc.get("requiredParams") or []),
                "confidenceThreshold": cc.get("confidenceThreshold"),
                "prompt": prompt_str,
                "promptVersion": cc.get("promptVersion") or "calibration_v3",
                "incomplete": incomplete,
                "fieldDefinitionsIncomplete": incomplete,
                "missingCalibration": not bool(prompt_str),
            }

        # Prioridad 2: shim `ai_calibration` (V1/V2 con diagnosis.prompt o V3 slice)
        if isinstance(ai_calibration_shim, dict) and ai_calibration_shim:
            shim_cc = ai_calibration_shim.get("clinicalCriteria")
            if isinstance(shim_cc, dict):
                raw_prompt = shim_cc.get("prompt")
                prompt_str = raw_prompt.strip() if isinstance(raw_prompt, str) else ""
                if prompt_str:
                    return {
                        "prediagnosisEnabled": bool(shim_cc.get("prediagnosisEnabled", True)),
                        "requiredParams": list(shim_cc.get("requiredParams") or []),
                        "confidenceThreshold": (
                            shim_cc.get("confidenceThreshold")
                            if shim_cc.get("confidenceThreshold") is not None
                            else CONFIDENCE_THRESHOLDS.get(study_type)
                        ),
                        "prompt": prompt_str,
                        "promptVersion": shim_cc.get("promptVersion") or "calibration_v3",
                        "incomplete": False,
                        "fieldDefinitionsIncomplete": False,
                        "missingCalibration": False,
                    }

            _diagnosis_cfg = ai_calibration_shim.get("diagnosis") or {}
            if isinstance(_diagnosis_cfg, dict):
                raw_legacy_prompt = _diagnosis_cfg.get("prompt")
                legacy_prompt = raw_legacy_prompt.strip() if isinstance(raw_legacy_prompt, str) else ""
                if legacy_prompt:
                    diag_enabled = _diagnosis_cfg.get("enabled")
                    return {
                        "prediagnosisEnabled": True if diag_enabled is None else bool(diag_enabled),
                        "requiredParams": list(_diagnosis_cfg.get("requiredParams") or []),
                        "confidenceThreshold": (
                            _diagnosis_cfg.get("confidenceThreshold")
                            if _diagnosis_cfg.get("confidenceThreshold") is not None
                            else CONFIDENCE_THRESHOLDS.get(study_type)
                        ),
                        "prompt": legacy_prompt,
                        "promptVersion": _diagnosis_cfg.get("version") or _diagnosis_cfg.get("promptVersion") or "calibration_custom",
                        "incomplete": True,
                        "fieldDefinitionsIncomplete": True,
                        "missingCalibration": False,
                    }

        # Prioridad 3: sin prompt clínico en BD (no hay fallback hardcodeado)
        return {
            "prediagnosisEnabled": False,
            "requiredParams": list(REQUIRED_PARAMS.get(study_type, [])),
            "confidenceThreshold": CONFIDENCE_THRESHOLDS.get(study_type),
            "prompt": "",
            "promptVersion": None,
            "incomplete": True,
            "fieldDefinitionsIncomplete": True,
            "missingCalibration": True,
        }

    # Mantengo bloque stub para que `generate_prediagnosis` lo invoque de forma
    # no-op en lugar de fallar si un test monkey-patchea el símbolo.
    _legacy_build_calibration_context = _build_calibration_context  # type: ignore[attr-defined]

    def generate_prediagnosis(
        self,
        study_type: str,
        extracted_data: Dict[str, Any],
        calibration_version: Any = None,
        ai_calibration: Optional[Dict[str, Any]] = None,
        medical_calibration: Optional[Dict[str, Any]] = None,  # DEPRECADO Fase 4
        clinical_context: Optional[Dict[str, Any]] = None,
        test_name: Optional[str] = None,
    ) -> AIPrediagnosisResult:
        """
        Genera prediagnóstico IA basado en parámetros ya extraídos.

        ARCH-20260820-01 Fase 4 (handoff §3.1, §5, §6):
          - `calibration_version`: `AICalibrationVersionResolved` producida por
            `CalibrationResolver.resolve(test_row, "published")` en `main.py`.
            Es la fuente primaria de `clinicalCriteria` (SPEC §5.2, §14 Fase 4).
          - `ai_calibration`: shim legacy V1/V2 (deprecado). Se conserva sólo
            para compat: si trae `diagnosis.prompt`, se usa como
            `prompt_source="ai_calibration"`; si no, se ignora silenciosamente.
          - `medical_calibration`: RETIRADO del flujo principal (H11 FIX). El
            parámetro se conserva para no romper callers legacy pero se ignora;
            se loguea una sola vez por proceso si se recibe.

        IMPL-FEATURE-20260824-02 (gap fix):
          - `clinical_context`: cuestionario estructurado opcional del paciente
            (p.ej. `espirometria-questionnaire-v1` con antecedentes
            respiratorios y exploración física). Se inyecta al prompt del
            prediagnóstico clínico (MiniMax M3) como contexto adicional;
            NUNCA se reenvía a la capa extractiva M3. Si está ausente, el
            comportamiento es idéntico al pre-FEATURE-20260824-02.

        Args:
            study_type:        Tipo de estudio (Audiometria, Laboratorio, etc.)
            extracted_data:    Dict con parámetros canónicos extraídos
            calibration_version: Versión V3 resuelta por el resolver en proceso
                (ver handoff §6.1). None → fallback hardcodeado trazado.
            ai_calibration:    DEPRECADO. Dict V1/V2 de aiCalibration. Si
                contiene `diagnosis.prompt`, se usa como prompt clínico legacy
                (prompt_source="ai_calibration") sin enriquecer con
                `clinicalCriteria` (no hay V3 resuelta).
            clinical_context:  Cuestionario estructurado opcional. Dict validado
                por el frontend (`schemaVersion` + campos por Zod) que se
                inyecta al prompt del prediagnóstico clínico como contexto
                adicional. NO se reenvía al extractor. Ausencia es válida
                y preserva el comportamiento legacy.

        Returns:
            AIPrediagnosisResult — siempre retorna un resultado; usa AI_NON_CONCLUSIVE si no hay datos.
            `calibration_source` ∈ {`published_v3`, `calibration_disabled`,
            `legacy_hardcoded`}. `prompt_source` ∈ {`clinical_criteria_v3`,
            `ai_calibration`, `backend_fallback`}. `legacy_hardcoded_reason`
            ∈ {`no_published_version`, `published_disabled`,
            `field_definitions_incomplete`} sólo cuando
            `calibration_source == "legacy_hardcoded"`.
        """
        # FIX-20261028-01: la capa clínica usa solo MiniMax M3.
        # DR7_API_KEY y MEDGEMMA_ENABLED no habilitan este flujo.
        # Gemini queda reservado a la extracción, nunca al prediagnóstico.
        clinical_provider = "m3"

        _m3_cfg = _resolve_m3_clinical_config()
        clinical_model_used = _m3_cfg["model"]
        _m3_api_key = _m3_cfg["api_key"]
        self._last_key_source = _m3_cfg["key_source"]
        self._last_key_warning = _m3_cfg["warning"]
        clinical_provider_available = bool(_m3_api_key)

        def _result_with_provider(**kwargs) -> AIPrediagnosisResult:
            payload = dict(kwargs)
            payload["clinical_provider"] = clinical_provider
            return AIPrediagnosisResult(**payload)

        # ── Fase 4: resolver clinicalCriteria efectivo ─────────────────────
        effective = self._resolve_clinical_criteria(
            calibration_version=calibration_version,
            ai_calibration_shim=ai_calibration,
            study_type=study_type,
        )
        # Shim deprecado medical_calibration: warning único por proceso (no por call).
        if medical_calibration is not None:
            try:
                if not getattr(PrediagnosticService, "_warned_deprecated_medical_calibration", False):
                    print(
                        "⚠️ [ARCH-20260820-01 Fase 4] `medical_calibration` está "
                        "deprecado; el flujo principal consume "
                        "`calibration_version` (V3 resuelta). El parámetro se "
                        "ignora para trazabilidad."
                    )
                    PrediagnosticService._warned_deprecated_medical_calibration = True
            except Exception:
                pass

        # ── Determinar calibration_source y prompt_source (fuente única BD) ───
        test_label = (test_name or study_type or "desconocida").strip()
        shim_disabled = isinstance(ai_calibration, dict) and (
            ai_calibration.get("enabled") is False
            or (
                isinstance(ai_calibration.get("diagnosis"), dict)
                and (ai_calibration.get("diagnosis") or {}).get("enabled") is False
            )
        )

        if calibration_version is not None and getattr(calibration_version, "clinicalCriteria", None):
            v3_enabled = bool(getattr(calibration_version, "enabled", True))
            v3_prediag_enabled = bool(effective["prediagnosisEnabled"])
            has_prompt = bool((effective.get("prompt") or "").strip())
            if not v3_enabled or (not v3_prediag_enabled and has_prompt):
                calibration_source = "calibration_disabled"
                legacy_hardcoded_reason = None
                prompt_source = "clinical_criteria_v3"
                _clinical_prompt_version = effective.get("promptVersion") or "calibration_v3"
            elif has_prompt:
                calibration_source = "published_v3"
                legacy_hardcoded_reason = None
                prompt_source = "clinical_criteria_v3"
                _clinical_prompt_version = effective.get("promptVersion") or "calibration_v3"
            else:
                calibration_source = "missing_calibration"
                legacy_hardcoded_reason = None
                prompt_source = "missing_calibration"
                _clinical_prompt_version = None
        elif calibration_version is not None and not bool(getattr(calibration_version, "enabled", True)):
            calibration_source = "calibration_disabled"
            legacy_hardcoded_reason = None
            prompt_source = "clinical_criteria_v3"
            _clinical_prompt_version = effective.get("promptVersion") or "calibration_v3"
        elif shim_disabled:
            calibration_source = "calibration_disabled"
            legacy_hardcoded_reason = None
            prompt_source = "ai_calibration"
            _clinical_prompt_version = effective.get("promptVersion") or "calibration_custom"
        elif (effective.get("prompt") or "").strip():
            calibration_source = "published_v3"
            legacy_hardcoded_reason = None
            prompt_source = (
                "clinical_criteria_v3"
                if isinstance(ai_calibration, dict) and isinstance(ai_calibration.get("clinicalCriteria"), dict)
                else "ai_calibration"
            )
            _clinical_prompt_version = effective.get("promptVersion") or "calibration_custom"
        else:
            calibration_source = "missing_calibration"
            legacy_hardcoded_reason = None
            prompt_source = "missing_calibration"
            _clinical_prompt_version = None

        # ── Gate: calibración explícitamente deshabilitada en BD ─────────────
        if calibration_source == "calibration_disabled":
            reason = (
                "calibration_disabled: aiCalibration publicada con enabled=false"
                if (calibration_version is not None and not bool(getattr(calibration_version, "enabled", True))) or shim_disabled
                else "calibration_disabled: clinicalCriteria.prediagnosisEnabled=false"
            )
            print(f"ℹ️ [SingleSource] {reason} para {test_label}")
            return _result_with_provider(
                summary=(
                    f"Prediagnóstico IA deshabilitado para la prueba '{test_label}' "
                    "según su calibración en Pruebas (/admin/services)."
                ),
                confidence=0.0,
                clinical_state="AI_NON_CONCLUSIVE",
                justification=[],
                clinical_basis=[],
                citations=[],
                limitations=[
                    "Calibración deshabilitada para esta prueba en BD; no se invoca MiniMax.",
                ],
                red_flags=[],
                non_conclusive_reason="calibration_disabled",
                calibration_source=calibration_source,
                legacy_hardcoded_reason=legacy_hardcoded_reason,
                clinical_model_used=clinical_model_used,
                prompt_source=prompt_source,
                prompt_version=_clinical_prompt_version,
                input_debug=PrediagnosisInputDebug(
                    study_type=study_type,
                    extracted_data=extracted_data,
                    medical_calibration=None,
                    calibration_version=(
                        calibration_version.to_dict()
                        if calibration_version is not None
                        and hasattr(calibration_version, "to_dict")
                        else None
                    ),
                    clinical_provider=clinical_provider,
                    clinical_model_used=clinical_model_used,
                    rendered_prompt=None,
                ),
            )

        # Tipos sin soporte de prediagnóstico IA en V1 (ej. RiesgoCardiovascular)
        if study_type not in PREDIAGNOSIS_SUPPORTED_TYPES and not (effective.get("prompt") or "").strip():
            print(f"ℹ️ Tipo '{study_type}' sin prediagnóstico IA habilitado — revisión médica manual requerida")
            return _result_with_provider(
                summary=(
                    f"Estudio '{study_type}' registrado. "
                    "El documento requiere revisión médica manual. "
                    "El prediagnóstico IA no está disponible para este tipo."
                ),
                confidence=0.0,
                clinical_state="AI_NON_CONCLUSIVE",
                justification=[],
                clinical_basis=[],
                citations=[],
                limitations=[f"Prediagnóstico IA no soportado para '{study_type}'."],
                red_flags=[],
                non_conclusive_reason=f"Tipo '{study_type}' sin prediagnóstico IA.",
                calibration_source=calibration_source,
                legacy_hardcoded_reason=legacy_hardcoded_reason,
                clinical_model_used=clinical_model_used,
                prompt_source=prompt_source,
                prompt_version=_clinical_prompt_version,
            )

        # Gate: sin calibración/prompt de prediagnóstico en BD (sin fallback)
        prompt_template = (effective.get("prompt") or "").strip()
        if calibration_source == "missing_calibration" or not prompt_template:
            missing_msg = (
                f"La prueba '{test_label}' no tiene calibración IA de prediagnóstico "
                "configurada en base de datos. Configúrala en Pruebas (/admin/services)."
            )
            print(f"⚠️ [SingleSource] {missing_msg}")
            return _result_with_provider(
                summary=missing_msg,
                confidence=0.0,
                clinical_state="AI_NON_CONCLUSIVE",
                justification=[],
                clinical_basis=[],
                citations=[],
                limitations=[missing_msg],
                red_flags=[],
                non_conclusive_reason=missing_msg,
                calibration_source="missing_calibration",
                legacy_hardcoded_reason=None,
                clinical_model_used=clinical_model_used,
                prompt_source="missing_calibration",
                prompt_version=None,
            )

        # Verificar parámetros mínimos
        non_conclusive_reason = self._check_minimum_params(
            study_type,
            extracted_data,
            required_params=effective["requiredParams"] or None,
        )
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
                legacy_hardcoded_reason=legacy_hardcoded_reason,
                clinical_model_used=clinical_model_used,
                prompt_source=prompt_source,
                prompt_version=_clinical_prompt_version,
            )

        serialized_extracted = json.dumps(
            enrich_audiometry_extracted_data(extracted_data)
            if study_type == "Audiometria"
            else extracted_data,
            ensure_ascii=False,
            indent=2,
        )
        prompt = prompt_template.replace("{calibration_context}", "")
        if "{extracted_json}" in prompt:
            prompt = prompt.replace("{extracted_json}", serialized_extracted)
        else:
            prompt = f"{prompt}\n\nParámetros extraídos:\n{serialized_extracted}"

        # IMPL-FEATURE-20260824-02 (gap fix): inyectar el cuestionario
        # clínico estructurado (`clinical_context`) como contexto adicional
        # del paciente. Se añade al final del prompt, DESPUÉS del JSON
        # extraído del documento, con instrucciones explícitas al modelo
        # para que:
        #   (a) use el cuestionario sólo como contexto corroborante,
        #   (b) NO invente respuestas ausentes en el cuestionario,
        #   (c) NO sustituya los parámetros extraídos del documento por los
        #       del cuestionario — el documento es la fuente primaria.
        # Esta capa NO se reenvía al extractor M3 (la extracción es puramente
        # documental). El bloque se omite cuando `clinical_context` es None
        # para preservar el comportamiento pre-FEATURE-20260824-02 al 100%.
        if clinical_context and isinstance(clinical_context, dict):
            clinical_context_block = _render_clinical_context_block(clinical_context)
            if clinical_context_block:
                prompt = f"{prompt}\n\n{clinical_context_block}"

        # IMPL-20260516-08: capturar el prompt renderizado antes de la llamada al modelo (ARCH-20260516-08)
        _rendered_prompt = prompt

        if not clinical_provider_available:
            unavailable_reason = (
                "Prediagnóstico clínico no disponible: falta la clave de MiniMax "
                "(M3_API_KEY o la fila m3 en /admin/ai-keys). "
                "Gemini se usa solo para extracción."
            )

            return _result_with_provider(
                summary="No fue posible generar el prediagnóstico clínico porque la clave de MiniMax no está disponible en este proceso.",
                confidence=0.0,
                clinical_state="AI_NON_CONCLUSIVE",
                justification=[],
                clinical_basis=[],
                citations=[],
                limitations=[unavailable_reason],
                red_flags=[],
                non_conclusive_reason=unavailable_reason,
                calibration_source=calibration_source,
                legacy_hardcoded_reason=legacy_hardcoded_reason,
                clinical_model_used=clinical_model_used,
                prompt_source=prompt_source,
                prompt_version=_clinical_prompt_version,
                input_debug=PrediagnosisInputDebug(
                    study_type=study_type,
                    extracted_data=extracted_data,
                    medical_calibration=None,  # H11: canal retirado.
                    calibration_version=(
                        calibration_version.to_dict()
                        if calibration_version is not None
                        and hasattr(calibration_version, "to_dict")
                        else None
                    ),
                    clinical_provider=clinical_provider,
                    clinical_model_used=clinical_model_used,
                    rendered_prompt=_rendered_prompt,
                ),
            )

        print(f"🧠 Generando prediagnóstico IA para: {study_type} | proveedor: {clinical_provider} | modelo: {clinical_model_used} | calibración: {calibration_source}")
        # FIX-20261028-01: MiniMax M3. Sin fallback clínico a DR7, Featherless ni Gemini.
        # Un fallo del modelo degrada a AI_NON_CONCLUSIVE (apoyo a la decisión, no diagnóstico).
        try:
            raw_result = self._call_m3_clinical_chat(prompt, m3_cfg=_m3_cfg)
        except Exception as e:
            err_str = str(e)
            if err_str.startswith("M3_HTTP:"):
                parts = err_str.split(":", 2)
                status_code = parts[1] if len(parts) > 1 else "error"
                minimax_reason = _public_minimax_http_reason(status_code)
                print(f"⚠️ {minimax_reason}")
                return _result_with_provider(
                    summary="El proveedor clínico MiniMax no está disponible para completar el prediagnóstico clínico.",
                    confidence=0.0,
                    clinical_state="AI_NON_CONCLUSIVE",
                    justification=[],
                    clinical_basis=[],
                    citations=[],
                    limitations=[minimax_reason],
                    red_flags=[],
                    non_conclusive_reason=minimax_reason,
                    calibration_source=calibration_source,
                    legacy_hardcoded_reason=legacy_hardcoded_reason,
                    clinical_model_used=clinical_model_used,
                    prompt_source=prompt_source,
                    prompt_version=_clinical_prompt_version,
                )
            safe_detail = _redact_provider_leak(str(e)) or "respuesta no utilizable"
            parse_reason = f"MiniMaxParseError: {safe_detail[:300]}"
            print(
                f"⚠️ Fallo al llamar/parsear proveedor '{clinical_provider}' "
                f"para {study_type}: {parse_reason}"
            )
            return _result_with_provider(
                summary="No fue posible obtener análisis IA para este estudio debido a un error en la respuesta del modelo.",
                confidence=0.0,
                clinical_state="AI_NON_CONCLUSIVE",
                justification=[],
                clinical_basis=[],
                citations=[],
                limitations=["Error al parsear respuesta del modelo IA. La extracción de parámetros puede estar disponible."],
                red_flags=[],
                non_conclusive_reason=parse_reason,
                calibration_source=calibration_source,
                legacy_hardcoded_reason=legacy_hardcoded_reason,
                clinical_model_used=clinical_model_used,
                prompt_source=prompt_source,
                prompt_version=_clinical_prompt_version,
            )

        try:
            result = AIPrediagnosisResult(**raw_result)
            result_fields = getattr(type(result), "model_fields", {})
            # IMPL-20260513-03: añadir proveedor clínico real
            # IMPL-20260518-03 + Fase 4: añadir fuente real del prompt clínico.
            if "calibration_source" in result_fields:
                result.calibration_source = calibration_source
            if "legacy_hardcoded_reason" in result_fields:
                result.legacy_hardcoded_reason = legacy_hardcoded_reason
            if "clinical_model_used" in result_fields:
                result.clinical_model_used = clinical_model_used
            if "clinical_provider" in result_fields:
                result.clinical_provider = clinical_provider
            if "prompt_source" in result_fields:
                result.prompt_source = prompt_source
            if "prompt_version" in result_fields:
                result.prompt_version = _clinical_prompt_version
            if prompt_source == "clinical_criteria_v3":
                result.limitations.append(
                    "Prompt clínico resuelto desde calibración publicada en BD."
                )
            # IMPL-FEATURE-20260824-02 (gap fix): trazabilidad explícita de
            # la presencia del cuestionario clínico estructurado cuando fue
            # inyectado al prompt. NO se duplica el payload (vive en
            # EventTest.clinicalContext); sólo se documenta la fuente.
            if clinical_context and isinstance(clinical_context, dict):
                _cc_version = clinical_context.get("schemaVersion")
                if isinstance(_cc_version, str) and _cc_version.strip():
                    result.limitations.append(
                        f"Contexto clínico del paciente inyectado al prompt "
                        f"(schemaVersion={_cc_version}); el modelo NO debe "
                        f"inventar respuestas ausentes ni sustituir los "
                        f"parámetros del documento por los del cuestionario."
                    )
            # IMPL-20260516-08: poblar input_debug con payload de entrada (ARCH-20260516-08)
            # Solo datos clínicos: study_type, extracted_data, calibración y prompt renderizado.
            # GUARDRAIL: no se incluyen API keys ni secrets — la calibración es metadata clínica.
            if "input_debug" in result_fields:
                result.input_debug = PrediagnosisInputDebug(
                    study_type=study_type,
                    extracted_data=extracted_data,
                    medical_calibration=None,  # H11: canal retirado.
                    calibration_version=(
                        calibration_version.to_dict()
                        if calibration_version is not None
                        and hasattr(calibration_version, "to_dict")
                        else None
                    ),
                    clinical_provider=getattr(result, "clinical_provider", clinical_provider),
                    clinical_model_used=getattr(result, "clinical_model_used", clinical_model_used),
                    rendered_prompt=_rendered_prompt,
                )
            # Aplicar umbral de confianza — si baja del umbral, marcar non-conclusive.
            # Fase 4: threshold viene de clinicalCriteria si está; si no, constante.
            threshold = effective["confidenceThreshold"]
            if threshold is None:
                threshold = CONFIDENCE_THRESHOLDS.get(study_type, 0.5)
            if result.confidence < threshold and result.clinical_state == "AI_PENDING_REVIEW":
                result.clinical_state = "AI_NON_CONCLUSIVE"
                reason = f"Confianza {result.confidence:.2f} por debajo del umbral {threshold:.2f} para {study_type}"
                result.non_conclusive_reason = reason
                result.limitations.append(reason)
                print(f"⚠️ Confianza baja — marcado como AI_NON_CONCLUSIVE")
            # AMI-SR F-017 R-06: asegurar recomendación práctica para espiro/audio.
            if study_type in ("Espirometria", "Audiometria"):
                from app.services.ai.practical_recommendations import derive_practical_recommendation

                if not (result.practical_recommendation or "").strip():
                    derived = derive_practical_recommendation(
                        study_type,
                        extracted_data,
                        result.model_dump(),
                    )
                    if derived:
                        result.practical_recommendation = derived
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
                legacy_hardcoded_reason=legacy_hardcoded_reason,
                clinical_model_used=clinical_model_used,
                prompt_source=prompt_source,
                prompt_version=_clinical_prompt_version,
            )

    def _call_m3_clinical_chat(self, prompt: str, m3_cfg: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        FIX-20261028-01: chat clínico text-only contra MiniMax M3.

        Contrato:
          - Credenciales ya resueltas por `_resolve_m3_clinical_config()` (mismo
            resolver `m3` que la extracción). Si no se pasan, se resuelven aquí.
          - NO envía PDF ni imagen. Solo prompt textual/JSON estructurado.
          - NO llama a dr7.ai. Un base_url que apunte allí se rechaza.
          - El cuerpo HTTP de error no se propaga al usuario.
          - Lanza excepción si hay error → generate_prediagnosis degrada a
            AI_NON_CONCLUSIVE. Esto es apoyo a la decisión, no un diagnóstico.
        """
        import requests

        if m3_cfg is None:
            m3_cfg = _resolve_m3_clinical_config()

        api_key = (m3_cfg.get("api_key") or "").strip()
        base_url = m3_cfg.get("base_url") or M3_BASE_URL or "https://api.minimax.io/v1"
        model = resolve_m3_model(m3_cfg.get("model") or M3_DEFAULT_MODEL or M3_MODEL_FLASH)

        if not api_key:
            raise RuntimeError("M3_HTTP:0:clave ausente")

        url = _m3_chat_completions_url(str(base_url))

        payload = {
            "model": model,
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
                        "Sigue estrictamente las instrucciones y criterios configurados en el prompt de la prueba. "
                        "No inventes hallazgos, citas ni parámetros no sustentados por la información recibida. "
                        "Responde SIEMPRE en JSON válido, sin markdown ni bloques de código."
                    ),
                },
                {"role": "user", "content": prompt},
            ],
            "temperature": 0.2,
            "max_tokens": 8192,
            "response_format": {"type": "json_object"},
        }
        from app.services.ai.m3_model import m3_performance_body

        payload.update(m3_performance_body(model))

        # Plazo total, no solo silencio entre bytes. Si MiniMax no cierra
        # el cuerpo, se abandona la llamada y el estudio igual se guarda
        # con prediagnóstico no concluyente.
        from concurrent.futures import ThreadPoolExecutor
        from concurrent.futures import TimeoutError as FuturesTimeout

        def _post_clinical():
            return requests.post(
                url,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json=payload,
                timeout=(10, M3_CLINICAL_DEADLINE_SEC),
            )

        pool = ThreadPoolExecutor(max_workers=1, thread_name_prefix="m3-clinical")
        try:
            response = pool.submit(_post_clinical).result(timeout=M3_CLINICAL_DEADLINE_SEC)
        except FuturesTimeout:
            print(
                f"⚠️ MiniMax clínico superó {M3_CLINICAL_DEADLINE_SEC}s; "
                "se guarda el archivo sin prediagnóstico."
            )
            raise RuntimeError("M3_HTTP:timeout:")
        finally:
            pool.shutdown(wait=False, cancel_futures=True)

        if response.status_code >= 400:
            # No loguear ni propagar response.text: puede incluir URLs o saldo.
            print(f"⚠️ MiniMax clínico HTTP {response.status_code}")
            raise RuntimeError(f"M3_HTTP:{response.status_code}:")

        try:
            data = response.json()
        except Exception as exc:
            raise ValueError("Respuesta MiniMax vacia o sin contenido util") from exc
        raw_text = GeminiBase._sanitize_model_json_text(
            ((data.get("choices") or [{}])[0].get("message") or {}).get("content", "")
        )
        if not raw_text:
            raise ValueError("Respuesta MiniMax vacia o sin contenido util")

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
