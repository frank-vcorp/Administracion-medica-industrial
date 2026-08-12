"""
IMPL-20260809-09 — ARCH-20260809-05: Servicio de configuración runtime
editable por UI (AppConfig, tabla KV genérica).

Esta capa encapsula:
  - Caché TTL 60 s por clave (mismo patrón que KeyResolver).
  - Resolución tolerante a fallos (AppConfig ausente / valor inválido / BD caída
    → fallback al valor por defecto provisto por el caller).
  - Invalidación explícita tras escritura (`invalidate(key)`).

Política:
  - NUNCA loguear el `value` si contiene secretos (este módulo no es para eso;
    sólo se usa para settings no-secretas como `extraction_default_provider`).
  - El caller es responsable de validar el schema del `value` (ej. Pydantic / Zod).
"""
from __future__ import annotations

import asyncio
import logging
import time
from typing import Any, Callable, Dict, Optional

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Default extraction provider (clave canónica única hoy).
# ---------------------------------------------------------------------------
EXTRACTION_DEFAULT_PROVIDER_KEY = "extraction_default_provider"
EXTRACTION_DEFAULT_PROVIDER_VALID = {"gemini", "m3"}
# FIX-20260812-10: el fallback hardcoded cambió a "m3" porque la env var
# GEMINI_API_KEY está reportada como leaked por Google (403 PERMISSION_DENIED)
# y el resolver DB retornaba una fila leaked. Con fallback "m3", cualquier
# cache miss o BD caída cae al proveedor funcional. Si en el futuro se rota
# la key Gemini y se reactiva Gemini como default, basta con cambiar aquí o
# persistir el valor en AppConfig (key `extraction_default_provider`).
EXTRACTION_DEFAULT_PROVIDER_FALLBACK = "m3"


# ---------------------------------------------------------------------------
# AppConfigStore singleton
# ---------------------------------------------------------------------------
class AppConfigStore:
    """
    Cache TTL 60 s para `get(key, default, validator)`. Las escrituras deben
    llamar `invalidate(key)` tras commit para que la siguiente lectura recargue.

    Diseño:
      - Singleton global `app_config_store`. Tests pueden sobrescribirlo con
        `set_app_config_store()`.
      - Captura excepciones Prisma y cae al valor por defecto (degradación
        controlada, sin propagar errores a callers runtime).
      - El `validator` opcional valida el `value` (debe retornar True/False).
        Si retorna False, se cae al default y se loguea warning.
    """

    def __init__(self, ttl_seconds: int = 60) -> None:
        self.ttl = ttl_seconds
        self._cache: Dict[str, tuple[float, Any]] = {}
        self._lock = asyncio.Lock()

    async def get(
        self,
        key: str,
        default: Any,
        validator: Optional[Callable[[Any], bool]] = None,
    ) -> Any:
        """
        Lee `key` desde la BD con caché TTL. Retorna `default` si:
          - la fila no existe,
          - el valor no pasa `validator`,
          - la BD cae (degradación controlada).
        """
        async with self._lock:
            now = time.monotonic()
            cached = self._cache.get(key)
            if cached is not None:
                ts, value = cached
                if now - ts < self.ttl:
                    return value

            value = await self._load_from_db(key, default, validator)
            self._cache[key] = (now, value)
            return value

    async def _load_from_db(
        self,
        key: str,
        default: Any,
        validator: Optional[Callable[[Any], bool]],
    ) -> Any:
        try:
            from app.services.prisma_client import get_prisma_client
            prisma = get_prisma_client()
        except Exception as e:
            logger.warning(
                "AppConfigStore: prisma no disponible (%s) — fallback a default",
                type(e).__name__,
            )
            return default

        try:
            row = await prisma.appconfig.find_unique(where={"key": key})
        except Exception as e:
            logger.warning(
                "AppConfigStore: BD caída consultando %s (%s) — fallback a default",
                key,
                type(e).__name__,
            )
            return default

        if row is None:
            return default

        raw_value = row.value
        if validator is not None:
            try:
                if not validator(raw_value):
                    logger.warning(
                        "AppConfigStore: valor para '%s' no pasa validator — fallback a default",
                        key,
                    )
                    return default
            except Exception as e:
                logger.warning(
                    "AppConfigStore: validator lanzó excepción para '%s' (%s) — fallback a default",
                    key,
                    type(e).__name__,
                )
                return default

        return raw_value

    def invalidate(self, key: str) -> None:
        """Elimina la entrada de caché para forzar re-lookup en próxima `get`."""
        self._cache.pop(key, None)

    def invalidate_all(self) -> None:
        """Útil para tests."""
        self._cache.clear()

    def prime(self, key: str, value: Any) -> None:
        """
        IMPL-20260810-01 (fix B† ARCH-20260809-06 §7.4): escribe `value` directamente
        en la caché con timestamp fresco, evitando I/O en la siguiente lectura
        (especialmente importante para `get_extraction_default_provider_sync()`,
        que es solo-lectura de caché y no puede consultar BD).

        Caso de uso: tras un `PUT` exitoso, primar con el valor nuevo para que la
        próxima lectura síncrona (status, extractor) retorne inmediatamente sin
        depender del GET async que recalienta la caché ni de la expiración TTL.

        No rompe la convergencia multi-réplica: otras réplicas siguen convergiendo
        por TTL (60 s); el priming solo acelera la convergencia intra-proceso.
        """
        self._cache[key] = (time.monotonic(), value)


# Singleton global. Tests pueden sobrescribirlo con `set_app_config_store()`.
app_config_store = AppConfigStore()


def set_app_config_store(store: AppConfigStore) -> None:
    """Inyecta un store alternativo (para tests)."""
    global app_config_store
    app_config_store = store


def get_app_config_store() -> AppConfigStore:
    """Acceso al singleton."""
    return app_config_store


# ---------------------------------------------------------------------------
# Helpers canónicos para `extraction_default_provider`
# ---------------------------------------------------------------------------
def _validate_extraction_default_provider(value: Any) -> bool:
    """
    Valida que `value` sea `{"provider": "gemini"|"m3"}`.
    Usado como `validator` en `get_extraction_default_provider()`.
    """
    if not isinstance(value, dict):
        return False
    provider = value.get("provider")
    if not isinstance(provider, str):
        return False
    return provider in EXTRACTION_DEFAULT_PROVIDER_VALID


async def get_extraction_default_provider() -> tuple[str, str]:
    """
    Retorna `(provider, source)` donde `source ∈ {"db", "default"}`.
    - `source="db"`: valor persistido en AppConfig.
    - `source="default"`: fallback hardcoded (ausencia / valor inválido / BD caída).
    """
    raw = await get_app_config_store().get(
        EXTRACTION_DEFAULT_PROVIDER_KEY,
        default=None,
        validator=_validate_extraction_default_provider,
    )
    if raw is None or not isinstance(raw, dict):
        return EXTRACTION_DEFAULT_PROVIDER_FALLBACK, "default"
    provider = raw.get("provider")
    if provider not in EXTRACTION_DEFAULT_PROVIDER_VALID:
        return EXTRACTION_DEFAULT_PROVIDER_FALLBACK, "default"
    return provider, "db"


def get_extraction_default_provider_sync() -> tuple[str, str]:
    """
    Variante sincrónica para usar en lugares donde no se puede await
    (ej. `GET /api/v2/ai/status`). Implementación segura que cae a default
    si no hay caché o el event loop no permite consultar.

    Estrategia: si la caché tiene valor fresco, lo retorna. Si no, retorna
    fallback (cero regresión — el status público no debe bloquear).
    """
    now = time.monotonic()
    cached = app_config_store._cache.get(EXTRACTION_DEFAULT_PROVIDER_KEY)
    if cached is not None:
        ts, value = cached
        if now - ts < app_config_store.ttl:
            if isinstance(value, dict):
                p = value.get("provider")
                if p in EXTRACTION_DEFAULT_PROVIDER_VALID:
                    return p, "db"
    return EXTRACTION_DEFAULT_PROVIDER_FALLBACK, "default"
