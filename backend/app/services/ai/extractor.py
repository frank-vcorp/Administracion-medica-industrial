"""
Servicio de Extracción Especializada de Datos Médicos.
IMPL-20260225-01: Extractores por tipo de documento.
IMPL-20260326-16: Separación capa extractiva / interpretativa (ARCH-20260326-16).
               Los prompts ahora extraen SOLO parámetros canónicos + calidad documental.
               La interpretación clínica vive en PrediagnosticService (prediagnostic.py).

ARCH-20260518-06:
    - La extracción se compone con una base universal fija en backend
        más un bloque específico editable desde aiCalibration.extraction.prompt.
ARCH-20260519-15: ROLLBACK — Featherless/Qwen-VL desactivado del runtime extractivo
                  por inestabilidad productiva (503 capacity_exhausted).
                  Gemini restaurado como proveedor activo de extracción documental.
                  Respaldo: context/SPECs/SPEC_ARCH-20260519-15-ROLLBACK-EXTRACCION-A-GEMINI.md
"""

import time
import os
from typing import Dict, Any, Union, Optional, Tuple
from .base import GeminiBase, M3VisionBase
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

# ARCH-20260809-02: Proveedores de extracción soportados por el dispatcher.
EXTRACTION_PROVIDERS = frozenset({"gemini", "m3"})


# ARCH-20260809-02: Excepciones de control del dispatcher (no son errores de upstream;
# el caller las trata de forma específica para devolver trazabilidad y status code).
class ExtractionProviderUnknownError(ValueError):
    """Proveedor pedido no reconocido (no es 'gemini' ni 'm3'). No hay fallback."""


class ExtractionAuthError(ValueError):
    """
    Credenciales del proveedor de extracción inválidas (HTTP 401/403).
    No hay fallback — error explícito.

    FIX-20260810-05: factorizada para soportar tanto M3 (default retrocompatible)
    como Gemini. El campo `provider` permite a la capa HTTP responder con
    `error_code` accionable (GEMINI_API_KEY_EXPIRED vs M3_API_KEY_EXPIRED).
    `__str__` preserva el `message` original para retrocompat con callers
    que sólo hacen `str(err)` (calibration.py imprimía el mensaje completo).
    """

    def __init__(self, message: str, provider: str = "m3") -> None:
        super().__init__(message)
        self.provider = provider
        self.message = message

    def __str__(self) -> str:  # noqa: D401 — override para incluir provider
        return f"[{self.provider.upper()}] {self.message}"


# Mapa estable provider → error_code (FIX-20260810-05). Usado por calibration.py
# y main.py para responder 503 con `error_code` accionable.
_EXTRACTION_AUTH_ERROR_CODES: dict = {"m3": "M3_API_KEY_EXPIRED", "gemini": "GEMINI_API_KEY_EXPIRED"}


def _classify_m3_failure(error: Exception) -> Optional[str]:
    """
    ARCH-20260809-02: Clasifica una excepción del cliente M3 según los
    triggers del SPEC §7. Retorna None si NO es trigger de fallback (ej.
    JSON no parseable — debe propagarse como ValueError sin enmascarar).

    Returns:
        - 'm3_5xx'        → HTTP 5xx del upstream.
        - 'm3_timeout'    → Timeout de lectura >60s.
        - 'm3_4xx_persistent' → HTTP 4xx (distinto de 401/403) tras 1 reintento.
        - 'm3_auth'       → HTTP 401/403 (credenciales inválidas; sin fallback).
        - None            → No clasificado como trigger de fallback (se propaga).
    """
    # openai SDK expone atributos en la excepción cuando viene del upstream.
    status = getattr(error, "status_code", None) or getattr(error, "status", None)
    body = (getattr(error, "body", None) or {}) if hasattr(error, "body") else {}
    code = body.get("code") if isinstance(body, dict) else None

    if status == 401 or status == 403:
        return "m3_auth"

    # Timeout detection: openai expone APITimeoutError / TimeoutError.
    # Chequeamos por nombre de clase para no requerir import de openai
    # (puede no estar instalado en el entorno de tests).
    err_name = type(error).__name__
    if (
        err_name in ("APITimeoutError", "Timeout", "TimeoutError", "ReadTimeoutError")
        or isinstance(error, TimeoutError)
    ):
        return "m3_timeout"

    if isinstance(status, int) and 500 <= status < 600:
        return "m3_5xx"

    if isinstance(status, int) and 400 <= status < 500:
        # SPEC §7: 4xx persistente (excluyendo 401/403).
        return "m3_4xx_persistent"

    # openai.APIError sin status_code explícito; algunos tipos cuentan como 5xx
    if err_name in ("APIConnectionError", "InternalServerError", "ServiceUnavailableError"):
        return "m3_5xx"

    # Si llegamos aquí, no es un trigger conocido — propagar sin fallback.
    return None


# ARCH-20260518-17 | respaldo: context/interconsultas/PROMPTS_DOC-20260518-02-AUDIOMETRIA.md
# Frecuencias canónicas para Audiometría ocupacional (columnas esperadas de la tabla VA).
_AUDIOMETRIA_CANONICAL_FREQS: frozenset = frozenset(
    {"250", "500", "1000", "2000", "3000", "4000", "6000", "8000"}
)

# Guardrails backend inyectados antes del bloque de calibración para reforzar
# fiabilidad tabular sin depender de ediciones en la configuración de DB.
_AUDIOMETRIA_BACKEND_GUARDRAILS = """
GUARDRAILS ESPECÍFICOS PARA AUDIOMETRÍA (BACKEND — NO MODIFICAR VÍA CALIBRACIÓN)
1. La tabla de umbrales tonales (vía aérea VA) es la fuente primaria de datos numéricos.
   La descripción narrativa del diagnóstico NO es fuente de valores de umbral.
2. Cada celda de la tabla corresponde a UNA frecuencia específica. Si una celda está vacía
   o ilegible, usa null — NUNCA desplaces el valor de la columna adyacente para completar el hueco.
3. Frecuencias canónicas aceptadas: 250, 500, 1000, 2000, 3000, 4000, 6000, 8000 Hz.
   No incluyas 125 Hz a menos que aparezca EXPLÍCITAMENTE como columna de la tabla en el documento.
4. Si una frecuencia no está visible en la tabla, omite esa clave del dict — no uses 0 ni la inventes.
5. `frecuencias_detectadas`: registra SOLO las frecuencias con valor numérico visible en la tabla.
6. `completitud_documental` (calcula tú mismo antes de responder):
   - "suficiente"     → ≥6 frecuencias con valor por oído en la tabla
   - "parcial"        → 3-5 frecuencias con valor por oído
   - "no_concluyente" → <3 frecuencias con valor por oído
""".strip()


class ExtractorService(GeminiBase):
    """
    Servicio que extrae parámetros canónicos según el tipo de documento.
    GUARDRAIL: Los prompts NO deben pedir diagnóstico, interpretación clínica final
    ni recomendaciones de aptitud. Esas capas pertenecen a PrediagnosticService.

    FIX-20260810-05: acepta `key_resolver` opcional para inyección en tests
    y para evitar recálculo del resolver cuando el caller ya lo tiene. Si es
    None, usa el singleton global `key_resolver` (vía import lazy).
    """

    def __init__(self, api_key: str = None, model: str = "gemini-2.5-flash", key_resolver=None):
        super().__init__(api_key=api_key, model=model)
        # FIX-20260810-05: resolver inyectable. Si es None, lazy-load del singleton
        # global en primer uso (evita import circular en tests).
        self._key_resolver = key_resolver
        # Stash de errores transitorios del resolver (trazabilidad).
        self._m3_resolve_error: Optional[str] = None

    @property
    def key_resolver(self):
        """FIX-20260810-05: acceso lazy al singleton si no fue inyectado."""
        if self._key_resolver is None:
            from .keys import key_resolver as _singleton
            self._key_resolver = _singleton
        return self._key_resolver

    # ARCH-20260518-03: Prompts de extracción ELIMINADOS del backend.
    # El prompt de extracción se resuelve ÚNICAMENTE desde aiCalibration.extraction.prompt.
    # No existe fallback de extracción en el backend — ver extract_by_type().

    # LEGACY NOTE (ARCH-20260518-03): El dict PROMPTS fue eliminado. Cualquier referencia a
    # self.PROMPTS en código externo debe actualizarse para pasar ai_calibration correctamente.

    # Prompt de referencia solo para documentación: ver context/SPECs/SPEC_ARCH-20260518-03*.md

    # ARCH-20260518-06 | respaldo: context/SPECs/SPEC_ARCH-20260518-06-BASE-EXTRACCION-Y-PLANTILLA-CALIBRACION.md
    BASE_EXTRACTION_PROMPT = """
Eres un extractor de datos médicos estructurados.

Tu tarea es leer un documento médico y extraer TODOS los datos visibles con máxima precisión y exhaustividad,
devolviendo exclusivamente JSON válido según el esquema esperado.

REGLAS GENERALES
1. Extrae únicamente datos visibles en el documento.
2. No inventes, no deduzcas y no completes valores ausentes.
3. No hagas interpretación clínica, no emitas diagnósticos, no clasifiques normalidad o anormalidad.
4. Si un dato está visible en cualquier parte del documento, no lo dejes fuera.
5. Conserva números, unidades, porcentajes, fechas, horas, nombres y etiquetas con la mayor fidelidad posible.
6. Si un campo del esquema no aparece visible, usa null.
7. Si hay tablas, extrae todas las filas y columnas relevantes; no reduzcas el documento a pocos valores principales.
8. Si una etiqueta no coincide exactamente con el esquema pero es claramente equivalente, mapea al campo canónico correcto.
9. Si una etiqueta visible no tiene mapeo claro, conserva el label y sus valores en el bloque estructurado más cercano posible.
10. Devuelve SOLO JSON válido. Sin markdown, sin comentarios, sin explicación adicional.

CONTEXTO
Este documento contiene datos médicos ocupacionales reales. Puedes encontrar identificación del paciente,
metadatos del estudio, condiciones de medición, tablas de parámetros, referencias, LLN, porcentajes del predicho,
notas de calidad y gráficas.
""".strip()

    def _build_extraction_prompt(self, study_specific_prompt: str) -> str:
        """Compone la base universal con el bloque específico editable por calibración."""
        return (
            f"{self.BASE_EXTRACTION_PROMPT}\n\n"
            "BLOQUE ESPECIFICO DEL ESTUDIO\n"
            "El siguiente bloque complementa la base universal con reglas particulares del estudio actual.\n\n"
            f"{study_specific_prompt.strip()}"
        )

    def _build_audiometria_extraction_prompt(self, study_specific_prompt: str) -> str:
        """
        ARCH-20260518-17: Variante de _build_extraction_prompt que inyecta los
        guardrails backend de Audiometría entre la base universal y el bloque de calibración,
        reforzando la fiabilidad tabular sin tocar la DB.
        """
        return (
            f"{self.BASE_EXTRACTION_PROMPT}\n\n"
            f"{_AUDIOMETRIA_BACKEND_GUARDRAILS}\n\n"
            "BLOQUE ESPECIFICO DEL ESTUDIO\n"
            "El siguiente bloque complementa la base universal con reglas particulares del estudio actual.\n\n"
            f"{study_specific_prompt.strip()}"
        )

    def _normalize_audiometria_result(self, result: dict) -> dict:
        """
        ARCH-20260518-17: Post-procesamiento del dict extraído para Audiometría.

        Acciones:
        1. Normaliza claves a str y valores a int, descartando entradas null.
        2. Deriva `frecuencias_detectadas` desde las claves reales si el LLM lo omitió.
        3. Deriva `completitud_documental` desde el conteo de frecuencias si quedó null.
        4. Anota sospecha de corrimiento en `notas_calidad` cuando hay frecuencias
           fuera del conjunto canónico (ej. 125 Hz).
        """
        # 1. Normalizar: str keys, int values, omitir nulos
        for ear_key in ("oido_derecho", "oido_izquierdo"):
            if isinstance(result.get(ear_key), dict):
                result[ear_key] = {
                    str(k): int(v)
                    for k, v in result[ear_key].items()
                    if v is not None
                }

        # 2. Derivar frecuencias_detectadas si null
        if not result.get("frecuencias_detectadas"):
            all_freqs: set = set()
            for ear_key in ("oido_derecho", "oido_izquierdo"):
                if isinstance(result.get(ear_key), dict):
                    all_freqs.update(result[ear_key].keys())
            if all_freqs:
                result["frecuencias_detectadas"] = sorted(
                    all_freqs, key=lambda f: int(f)
                )

        # 3. Derivar completitud_documental si null
        if result.get("completitud_documental") is None:
            freqs_per_ear = max(
                len(result.get("oido_derecho") or {}),
                len(result.get("oido_izquierdo") or {}),
            )
            if freqs_per_ear >= 6:
                result["completitud_documental"] = "suficiente"
            elif freqs_per_ear >= 3:
                result["completitud_documental"] = "parcial"
            else:
                result["completitud_documental"] = "no_concluyente"

        # 4. Detectar sospecha de corrimiento tabular
        all_detected_keys: set = set()
        for ear_key in ("oido_derecho", "oido_izquierdo"):
            if isinstance(result.get(ear_key), dict):
                all_detected_keys.update(result[ear_key].keys())
        non_canonical = all_detected_keys - _AUDIOMETRIA_CANONICAL_FREQS
        if non_canonical:
            warning = (
                f"SOSPECHA_CORRIMIENTO: frecuencias no canónicas en extracción: "
                f"{sorted(non_canonical, key=lambda f: int(f))}. "
                "Verifique alineación tabular de columnas."
            )
            existing = result.get("notas_calidad") or ""
            result["notas_calidad"] = (
                f"{existing} | {warning}" if existing else warning
            )

        return result

    def _default_model_for(self, provider: str) -> str:
        """
        ARCH-20260809-02: Devuelve el modelo default de proceso para un proveedor.
        La precedencia de selección completa vive en `_resolve_provider`.
        """
        if provider == "m3":
            return os.environ.get("M3_DEFAULT_MODEL", "MiniMax-M3")
        return os.environ.get("GEMINI_MODEL_EXTRACTION", "gemini-2.5-flash")

    def _resolve_provider(
        self,
        calibration: Optional[Dict[str, Any]],
        override_provider: Optional[str] = None,
        override_model: Optional[str] = None,
    ) -> Tuple[str, str]:
        """
        ARCH-20260809-02 + ARCH-20260809-05: Resuelve (provider, model) efectivos
        con la precedencia del SPEC §3:
          1. override por payload (gana si presente)
          2. aiCalibration.extraction.provider + .model
          3. default global persistido en AppConfig (caché TTL 60s).
             Si AppConfig ausente / inválido / BD caída → fallback "gemini"
             (cero regresión respecto al comportamiento previo).

        El campo `override_model` se aplica siempre que esté presente, incluso
        si `override_provider` es None (CB-06: cambiar solo modelo de la calibración
        vigente sin tocar el proveedor).

        Returns:
            (provider, model) tupla resuelta.

        Raises:
            ExtractionProviderUnknownError: Si override o calibración declaran
                un proveedor que no es 'gemini' ni 'm3' (sin fallback silencioso).
        """
        # 1. Override por payload (provider explícito).
        if override_provider:
            if override_provider not in EXTRACTION_PROVIDERS:
                raise ExtractionProviderUnknownError(
                    f"EXTRACTION_PROVIDER_UNKNOWN: proveedor '{override_provider}' "
                    "no soportado. Usa 'gemini' o 'm3'."
                )
            return override_provider, override_model or self._default_model_for(override_provider)

        # 2. aiCalibration.extraction
        extraction_cfg = (calibration or {}).get("extraction") or {}
        cfg_provider = extraction_cfg.get("provider")
        if cfg_provider:
            if cfg_provider not in EXTRACTION_PROVIDERS:
                raise ExtractionProviderUnknownError(
                    f"EXTRACTION_PROVIDER_UNKNOWN: aiCalibration.extraction.provider "
                    f"'{cfg_provider}' no soportado. Usa 'gemini' o 'm3'."
                )
            cfg_model = (
                override_model
                or extraction_cfg.get("model")
                or self._default_model_for(cfg_provider)
            )
            return cfg_provider, cfg_model

        # 3. Default global persistido en AppConfig (ARCH-20260809-05).
        # Si AppConfig no existe / valor inválido / BD caída → fallback "gemini"
        # (cero regresión respecto al comportamiento previo).
        # Usamos variante sincrónica que retorna desde caché TTL 60s o fallback;
        # _resolve_provider se llama dentro del event loop, podemos intentar la
        # versión async si hay loop corriendo, si no fallback.
        from app.services.ai.app_config import (
            EXTRACTION_DEFAULT_PROVIDER_FALLBACK,
            get_extraction_default_provider_sync,
        )
        try:
            default_provider, _src = get_extraction_default_provider_sync()
        except Exception:
            default_provider = EXTRACTION_DEFAULT_PROVIDER_FALLBACK
        if default_provider not in EXTRACTION_PROVIDERS:
            default_provider = EXTRACTION_DEFAULT_PROVIDER_FALLBACK
        return default_provider, override_model or self._default_model_for(default_provider)

    def _is_m3_unavailable(self, provider: str) -> bool:
        """
        ARCH-20260809-02: Caso especial 'm3_not_configured' (SPEC §7).
        Si el provider pedido es M3 pero M3_API_KEY no está configurada,
        retorna True para que el dispatcher falle a Gemini sin intentar M3.

        FIX-20260810-05: si AI_KEYS_FROM_DB_ENABLED=true, la key puede vivir
        en BD (sin env var).
        FIX-20260810-06: la resolución se hace vía lectura sincrónica de la
        caché TTL del resolver (`resolve_sync_cached`), pre-calentada en la
        frontera async (calibration.py / main.py hacen `await resolve("m3")`
        antes de entrar al pipeline sync). El patrón anterior
        (`run_coroutine_threadsafe(...).result()` contra el loop corriente)
        DEADLOCKeaba cuando este método corría en el hilo del event loop
        (handler async → extract_by_type): el loop no puede ejecutar la
        corrutina mientras este hilo la espera; tras 5s el TimeoutError era
        tragado por `except Exception` → retornaba SIEMPRE True → fallback
        erróneo a Gemini (causa raíz del 500 post FIX-20260810-05).
        Si la flag está off, comportamiento idéntico al previo (sólo env
        var) — cero regresión.
        """
        if provider != "m3":
            return False

        # FIX-20260810-05: si flag on, resolver desde BD con caché TTL.
        from .keys import is_ai_keys_from_db_enabled
        if is_ai_keys_from_db_enabled():
            # FIX-20260810-06: usar el resolver inyectado (testable) o el
            # singleton global. La property `key_resolver` carga el singleton
            # lazy si no fue inyectado en __init__. Lectura sync de la caché
            # TTL — nunca bloquear el event loop (ver docstring).
            resolution = self.key_resolver.resolve_sync_cached("m3")
            if resolution is not None:
                # Caché caliente: M3 disponible si hay api_key (BD o el
                # fallback env del resolver).
                return not bool(resolution.api_key)
            # Caché fría (frontera async no pre-calentó, o TTL vencido en
            # un request de >60s): degradar a env var (comportamiento legacy).
            self._m3_resolve_error = "m3_cache_cold"
            return not bool(os.environ.get("M3_API_KEY"))

        # Retrocompat estricta: sin flag, sólo env var.
        return not bool(os.environ.get("M3_API_KEY"))

    def _call_with_dispatch(
        self,
        file_path: str,
        prompt: str,
        provider: str,
        model: str,
    ) -> Tuple[Dict[str, Any], str, Optional[str]]:
        """
        ARCH-20260809-02: Ejecuta la llamada al proveedor resolviendo fallback
        M3→Gemini según los triggers del SPEC §7.

        IMPL-20260809-06: stashes `key_source` y `key_resolution_warning` del
        proveedor que efectivamente respondió en `self._last_call_key_source`
        (dict por provider) para que `extract_by_type` los propague al audit.

        Returns:
            (extracted_dict, provider_used, fallback_reason)
            - extracted_dict: resultado parseado (dict).
            - provider_used: 'gemini' o 'm3' (el que efectivamente respondió).
            - fallback_reason: None o uno de ('m3_5xx', 'm3_timeout',
              'm3_4xx_persistent', 'm3_not_configured').

        Raises:
            ExtractionProviderUnknownError: Si provider no reconocido.
            ExtractionAuthError: Si M3 responde 401/403 (sin fallback).
            Exception: Si provider='gemini' falla (sin fallback por contrato).
        """
        # Inicializa el stash por-provider para trazabilidad de key.
        if not hasattr(self, "_last_call_key_source"):
            self._last_call_key_source = {}

        # Caso especial: provider=m3 sin M3_API_KEY → fallback inmediato.
        if provider == "m3" and self._is_m3_unavailable(provider):
            print("⚠️ [ARCH-20260809-02] M3 no configurado → fallback a Gemini")
            result = self.call_gemini(file_path, prompt)
            self._last_call_key_source["gemini"] = (
                getattr(self, "key_source", None),
                getattr(self, "key_resolution_warning", None),
            )
            return result, "gemini", "m3_not_configured"

        if provider == "m3":
            try:
                m3_client = M3VisionBase(model=model)
                result = m3_client.call_m3(file_path, prompt)
                # Tras call_m3, m3_client tiene key_source actualizado.
                self._last_call_key_source["m3"] = (
                    getattr(m3_client, "key_source", None),
                    getattr(m3_client, "key_resolution_warning", None),
                )
                return result, "m3", None
            except Exception as e:
                # Detectar tipo de error para clasificar el fallback.
                fallback_reason = _classify_m3_failure(e)
                if fallback_reason is None:
                    # Es un error que NO es trigger de fallback
                    # (ej. JSON no parseable → propagar).
                    raise
                # M3_AUTH_ERROR (401/403): error explícito, sin fallback.
                if fallback_reason == "m3_auth":
                    raise ExtractionAuthError(
                        f"M3_AUTH_ERROR: credenciales M3 inválidas o sin permisos "
                        f"({type(e).__name__}). Verifica M3_API_KEY y permisos del plan Pro."
                    ) from e
                print(
                    f"⚠️ [ARCH-20260809-02] M3 falló ({fallback_reason}) "
                    "→ fallback a Gemini"
                )
                result = self.call_gemini(file_path, prompt)
                self._last_call_key_source["gemini"] = (
                    getattr(self, "key_source", None),
                    getattr(self, "key_resolution_warning", None),
                )
                return result, "gemini", fallback_reason

        # provider == "gemini": sin fallback por contrato.
        # FIX-20260810-05: si Gemini responde 401/403, envolver en
        # ExtractionAuthError(provider="gemini") para que la capa HTTP
        # boundary (calibration.py) responda 503 con error_code accionable
        # (`GEMINI_API_KEY_EXPIRED`) en lugar del 500 opaco previo.
        try:
            result = self.call_gemini(file_path, prompt)
        except Exception as gemini_err:
            status_code = getattr(gemini_err, "response", None)
            status_code = getattr(status_code, "status_code", None) if status_code is not None else None
            if status_code is None:
                # Algunas libs (urllib3) exponen `.status` en el error.
                status_code = getattr(gemini_err, "status", None)
            if status_code in (401, 403):
                # Sanitizar: NO incluir `str(gemini_err)` porque la URL de
                # Gemini contiene la key como query param (?key=AIzaSy...).
                # Sólo exponer tipo + status (B-6).
                raise ExtractionAuthError(
                    message=(
                        f"GEMINI_API_KEY_REVOKED: Gemini respondió HTTP {status_code}. "
                        "Rota la key en /admin/ai-keys o cambia el proveedor de extracción."
                    ),
                    provider="gemini",
                ) from gemini_err
            raise
        self._last_call_key_source["gemini"] = (
            getattr(self, "key_source", None),
            getattr(self, "key_resolution_warning", None),
        )
        return result, "gemini", None

    def extract_by_type(
        self,
        file_path: str,
        doc_type: str,
        ai_calibration: Optional[Dict[str, Any]] = None,
        extraction_provider_override: Optional[str] = None,
        extraction_model_override: Optional[str] = None,
    ) -> Union[AudiometriaData, LaboratorioData, EspirometriaData, RayosXData, Dict]:
        """
        Extrae datos estructurados según el tipo de documento.

        ARCH-20260518-03: El prompt de extracción se resuelve ÚNICAMENTE desde aiCalibration.
        Si no está configurado, la corrida falla explícitamente con EXTRACTION_PROMPT_NOT_CONFIGURED.
        No existe fallback de extracción en el backend.

        ARCH-20260809-02: Selector multi-proveedor con override por payload.
        Precedencia: override > aiCalibration.extraction > default 'gemini'.
        Política de fallback unidireccional M3 → Gemini (triggers en _call_with_dispatch).

        Args:
            file_path:                  Ruta del archivo
            doc_type:                   Tipo de documento (Audiometria, Laboratorio, etc.)
            ai_calibration:             Dict con aiCalibration de la prueba. Debe contener
                                        ai_calibration["extraction"]["prompt"] para que la
                                        extracción proceda.
            extraction_provider_override: Si presente, sobreescribe aiCalibration.extraction.provider.
            extraction_model_override:   Si presente, sobreescribe aiCalibration.extraction.model.

        Returns:
            Tupla (extracted_object, audit_metadata) o, por compat con el contrato
            histórico del pipeline, el objeto Pydántico/dict directo. La metadata
            de auditoría extractiva (provider requested/used, model_used, fallback_reason)
            se devuelve vía el parámetro de salida opcional `extraction_audit_out`.

        Raises:
            ValueError: EXTRACTION_PROMPT_NOT_CONFIGURED si falta prompt.
            ExtractionProviderUnknownError: proveedor inválido (no fallback).
            ExtractionAuthError: M3 respondió 401/403 (no fallback).
        """
        # ARCH-20260518-03: resolver prompt únicamente desde aiCalibration
        extraction_cfg = (ai_calibration or {}).get("extraction") or {}
        prompt = extraction_cfg.get("prompt")

        if not prompt:
            # Sin fallback — error explícito y trazable de configuración
            raise ValueError(
                f"EXTRACTION_PROMPT_NOT_CONFIGURED: La prueba '{doc_type}' no tiene "
                "prompt de extracción configurado en aiCalibration. "
                "Configure el prompt de extracción en el panel de calibración antes de procesar."
            )

        # ARCH-20260518-17: Audiometría usa prompt enriquecido con guardrails backend.
        if doc_type == "Audiometria":
            prompt = self._build_audiometria_extraction_prompt(prompt)
        else:
            prompt = self._build_extraction_prompt(prompt)

        # ARCH-20260809-02: resolver provider/model efectivo con precedencia.
        provider, model = self._resolve_provider(
            calibration=ai_calibration,
            override_provider=extraction_provider_override,
            override_model=extraction_model_override,
        )

        # IMPL-20260812-05 — Single source of truth tras `_resolve_provider`.
        # Trazabilidad explícita: la selección final (provider, model) es la
        # que se usará en la llamada HTTP, sin sobrescrituras posteriores
        # por `_refresh_keys()` (FIX-1 ya blindó ese camino).
        # Si la flag BD está activa pero el resolver no tiene key para el
        # provider seleccionado, se hace warning explícito (sin substituir
        # el model — sólo aceptamos env var para la key).
        from .keys import is_ai_keys_from_db_enabled, key_resolver as _kr_singleton
        if is_ai_keys_from_db_enabled():
            _db_resolution = _kr_singleton.resolve_sync_cached(provider)
            if _db_resolution is None:
                # La frontera async no pre-calentó la caché TTL para este
                # provider. El pipeline degradará a env var (cache_cold).
                print(
                    f"⚠️ [IMPL-20260812-05] AI_KEYS_FROM_DB_ENABLED=true pero "
                    f"caché TTL fría para provider='{provider}'. El pipeline "
                    f"usará env var para la key. Model selector='{model}' se "
                    f"respeta."
                )
            elif _db_resolution.source == "env" and _db_resolution.warning in (
                "row_missing",
                "row_disabled",
                "decrypt_error",
                "db_unavailable",
                "encryption_key_missing",
            ):
                print(
                    f"⚠️ [IMPL-20260812-05] provider='{provider}' no tiene key "
                    f"usable en BD (warning={_db_resolution.warning}). "
                    f"Flujo continúa con env var. Model selector='{model}' "
                    f"se respeta."
                )

        _extraction_prompt_version = extraction_cfg.get("version", "calibration_custom")
        print(
            f"✅ [ARCH-20260518-03] Prompt de extracción resuelto desde aiCalibration "
            f"(v={_extraction_prompt_version}) para {doc_type}"
        )
        print(
            f"🧠 [ARCH-20260809-02] Extracción solicitada con provider='{provider}' "
            f"model='{model}' para tipo: {doc_type}"
        )

        start_time = time.time()
        try:
            result, provider_used, fallback_reason = self._call_with_dispatch(
                file_path=file_path,
                prompt=prompt,
                provider=provider,
                model=model,
            )
        except ExtractionAuthError as auth_err:
            # Adjuntar trazabilidad mínima al error para que main.py la propague.
            self.last_extraction_audit = {
                "extraction_provider_requested": provider,
                "extraction_provider_used": None,
                "extraction_model_used": model,
                "extraction_fallback_reason": "m3_auth",
            }
            raise

        duration = time.time() - start_time
        # IMPL-20260809-06 — key_source del proveedor que efectivamente respondió.
        # `_call_with_dispatch` stasha el par (key_source, key_warning) por
        # provider en `self._last_call_key_source`. Priorizamos el provider final.
        used_key_source = None
        used_key_warning = None
        stash = getattr(self, "_last_call_key_source", {}) or {}
        used = stash.get(provider_used)
        if used:
            used_key_source, used_key_warning = used

        # Stash trazabilidad en la instancia para que main.py la recupere.
        self.last_extraction_audit = {
            "extraction_provider_requested": provider,
            "extraction_provider_used": provider_used,
            "extraction_model_used": model if provider_used == provider else self._default_model_for(provider_used),
            "extraction_fallback_reason": fallback_reason,
            "key_source": used_key_source,
            "key_resolution_warning": used_key_warning,
        }
        if fallback_reason:
            print(
                f"⚠️ [ARCH-20260809-02] Extracción completada vía fallback "
                f"({fallback_reason}) en {duration:.2f}s"
            )
        else:
            print(f"✅ Extracción completada en {duration:.2f}s con provider={provider_used}")
        
        # Parsear según el tipo
        # IMPL-20260326-16: los schemas ya no tienen diagnostico_ia/interpretacion
        try:
            if doc_type == "Audiometria":
                # Limpiar campos legacy que el modelo IA podría enviar aún
                for legacy_field in ("diagnostico_ia", "interpretacion", "recomendaciones"):
                    result.pop(legacy_field, None)
                # ARCH-20260518-17: normalización + guardrails post-extracción
                result = self._normalize_audiometria_result(result)
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
