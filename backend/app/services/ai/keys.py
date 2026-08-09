"""
IMPL-20260809-06 — ARCH-20260809-03: Gestión runtime de API Keys de proveedores IA.

Módulo responsable de:
  1. Cifrado/descifrado AES-256-GCM de las API keys de BD.
  2. Resolución runtime de keys con precedencia BD → env var y caché TTL.
  3. Exposición de `key_resolver` singleton + `KeyResolution` dataclass.

Diseño:
  - Feature flag `AI_KEYS_FROM_DB_ENABLED` (default "false" → comportamiento idéntico
    al actual, sin tocar producción).
  - Precedencia: BD si flag on + row enabled + descifra OK; si no, env var (fallback).
  - Caché TTL 60s + invalidación explícita en PUT/DELETE → rotación inmediata sin reinicio.
  - Refactor obligatorio de los `__init__` de GeminiBase/M3VisionBase/FeatherlessVisionBase
    para que lean keys vía resolver en cada `call_*` (sin esto, rotación no toma efecto).
  - keys descifradas NUNCA se loguean ni salen del proceso backend (sólo `keySuffix`
    - últimos 4 chars - para identificación visual).
"""
from __future__ import annotations

import asyncio
import base64
import logging
import os
import time
from dataclasses import dataclass
from typing import Any, Dict, Optional

from cryptography.hazmat.primitives.ciphers.aead import AESGCM


logger = logging.getLogger(__name__)

# Lista canónica de proveedores soportados.
CANONICAL_PROVIDERS = ("gemini", "m3", "dr7")

# Longitudes esperadas para AES-256-GCM.
_GCM_KEY_BYTES = 32      # AES-256
_GCM_NONCE_BYTES = 12    # estándar GCM
_GCM_TAG_BYTES = 16      # estándar GCM


# ---------------------------------------------------------------------------
# Configuración de feature flag + master key (cifrado)
# ---------------------------------------------------------------------------
def is_ai_keys_from_db_enabled() -> bool:
    """
    Lee AI_KEYS_FROM_DB_ENABLED de env (con fallback tolerante a whitespace
    accidental). Default False — preserva comportamiento actual.

    SPEC §D8 / ADR §D8: este flag es el interruptor maestro del rollout.
    Mientras esté en false, el resolver retorna siempre env vars (sin leer BD),
    garantizando cero cambio observable.
    """
    raw = os.environ.get("AI_KEYS_FROM_DB_ENABLED", "")
    return raw.strip().lower() == "true"


def _load_encryption_key() -> bytes:
    """
    Carga ENCRYPTION_KEY desde env var. Espera base64 de 32 bytes (AES-256).

    Lanza RuntimeError si está ausente o malformada — esto fuerza una configuración
    correcta ANTES de cualquier escritura de secretos. La lectura puede degradarse
    a env var (CB-2 / SPEC §10), pero `PUT` retorna 503 explícito si falta.
    """
    b64 = os.environ.get("ENCRYPTION_KEY", "").strip()
    if not b64:
        raise RuntimeError(
            "ENCRYPTION_KEY no configurada — no se pueden cifrar/descifrar secretos IA"
        )
    try:
        key = base64.b64decode(b64, validate=True)
    except Exception as e:
        raise RuntimeError(f"ENCRYPTION_KEY no es base64 válido: {e}") from e
    if len(key) != _GCM_KEY_BYTES:
        raise RuntimeError(
            f"ENCRYPTION_KEY debe ser 32 bytes (AES-256); recibidos {len(key)}"
        )
    return key


# ---------------------------------------------------------------------------
# Cifrado AES-256-GCM
# ---------------------------------------------------------------------------
def encrypt_key(plaintext: str, master_key: bytes) -> tuple[bytes, bytes, bytes]:
    """
    Cifra `plaintext` con AES-256-GCM. Retorna (ciphertext, nonce, tag).

    La lib cryptography devuelve ciphertext||tag concatenados cuando se usa AESGCM.encrypt;
    separamos los últimos 16 bytes como tag para almacenarlos en columnas separadas
    (BC + robustez de esquema).
    """
    if plaintext is None:
        raise ValueError("plaintext no puede ser None")
    aesgcm = AESGCM(master_key)
    nonce = os.urandom(_GCM_NONCE_BYTES)
    blob = aesgcm.encrypt(nonce, plaintext.encode("utf-8"), associated_data=None)
    ciphertext, tag = blob[:-_GCM_TAG_BYTES], blob[-_GCM_TAG_BYTES:]
    return ciphertext, nonce, tag


def decrypt_key(
    ciphertext: bytes, nonce: bytes, tag: bytes, master_key: bytes
) -> str:
    """
    Descifra con AES-256-GCM. Laza InvalidTag (cryptography.exceptions.InvalidTag)
    si tag o ciphertext fueron alterados — el resolver captura y cae a env var.
    """
    if not (ciphertext and nonce and tag):
        raise ValueError("ciphertext/nonce/tag son obligatorios")
    aesgcm = AESGCM(master_key)
    plaintext = aesgcm.decrypt(nonce, ciphertext + tag, associated_data=None)
    return plaintext.decode("utf-8")


# ---------------------------------------------------------------------------
# KeyResolution dataclass (contrato del resolver)
# ---------------------------------------------------------------------------
@dataclass(frozen=True)
class KeyResolution:
    """Resultado normalizado de resolver.resolve(provider)."""

    provider: str
    api_key: str
    base_url: Optional[str]
    default_model: Optional[str]
    source: str  # "db" | "env"
    warning: Optional[str] = None  # ver SPEC §5 tabla de warnings

    def to_dict(self) -> Dict[str, Any]:
        """Serializa sin la key en claro. Para diagnóstico sí incluye la key
        (es interna del backend, no sale del proceso). El caller decide."""
        return {
            "provider": self.provider,
            "apiKey": self.api_key,
            "baseUrl": self.base_url,
            "defaultModel": self.default_model,
            "source": self.source,
            "warning": self.warning,
        }


# ---------------------------------------------------------------------------
# KeyResolver singleton
# ---------------------------------------------------------------------------
class KeyResolver:
    """
    SPEC §5 — Algoritmo resolve(provider):
      1. Si flag off → env var (source="env", warning="flag_off").
      2. Si flag on: lee caché TTL; si fresca → retornar.
      3. Si no: consulta BD.
         - Sin row → env var (source="env", warning="row_missing").
         - enabled=false → env var (source="env", warning="row_disabled").
         - descifrado falla → env var (source="env", warning="decrypt_error").
         - descifrado OK → (source="db", sin warning).
      4. Llena caché (incluso fallbacks — evita golpear BD por inferencia).
      5. BD caída → env var (source="env", warning="db_unavailable").

    Singleton global `key_resolver` — se inyecta opcionalmente en las services.
    Tests pueden sobrescribir `key_resolver` con un mock vía `set_key_resolver()`.
    """

    def __init__(self, ttl_seconds: int = 60) -> None:
        self.ttl = ttl_seconds
        self._cache: Dict[str, tuple[float, KeyResolution]] = {}
        self._lock = asyncio.Lock()
        # Master key se carga lazy para no romper import si env está ausente en tests.
        self._master_key: Optional[bytes] = None
        self._master_key_error: Optional[str] = None

    # -- master key helpers -------------------------------------------------
    def _get_master_key(self) -> Optional[bytes]:
        """Carga lazy de ENCRYPTION_KEY. Retorna None si está ausente."""
        if self._master_key is not None:
            return self._master_key
        try:
            self._master_key = _load_encryption_key()
            self._master_key_error = None
            return self._master_key
        except RuntimeError as e:
            self._master_key_error = str(e)
            return None

    # -- env helpers --------------------------------------------------------
    @staticmethod
    def _env_value(provider: str) -> tuple[str, Optional[str], Optional[str]]:
        """
        Lee env vars para un proveedor. Retorna (api_key, base_url, default_model).

        Mapeo:
          - gemini: GEMINI_API_KEY + GEMINI_BASE_URL (no aplica) + GEMINI_MODEL_EXTRACTION
          - m3:     M3_API_KEY + M3_BASE_URL + M3_DEFAULT_MODEL
          - dr7:    DR7_API_KEY + DR7_BASE_URL + DR7_MODEL
        """
        if provider == "gemini":
            api_key = (os.environ.get("GEMINI_API_KEY") or "").strip()
            base_url = None  # Gemini v1beta URL no se overridea en runtime
            default_model = (
                os.environ.get("GEMINI_MODEL_EXTRACTION")
                or os.environ.get("GEMINI_MODEL")
                or "gemini-2.5-flash"
            )
            return api_key, base_url, default_model
        if provider == "m3":
            api_key = (os.environ.get("M3_API_KEY") or "").strip()
            base_url = (
                os.environ.get("M3_BASE_URL") or "https://api.minimax.io/v1"
            )
            default_model = (
                os.environ.get("M3_DEFAULT_MODEL") or "MiniMax-M3"
            )
            return api_key, base_url, default_model
        if provider == "dr7":
            api_key = (os.environ.get("DR7_API_KEY") or "").strip()
            base_url = (
                os.environ.get("DR7_BASE_URL")
                or "https://dr7.ai/api/v1/medical/chat/completions"
            )
            default_model = os.environ.get("DR7_MODEL") or "medgemma-4b-it"
            return api_key, base_url, default_model
        return "", None, None

    def _env_resolution(self, provider: str, warning: Optional[str]) -> KeyResolution:
        api_key, base_url, default_model = self._env_value(provider)
        return KeyResolution(
            provider=provider,
            api_key=api_key,
            base_url=base_url,
            default_model=default_model,
            source="env",
            warning=warning,
        )

    # -- prisma lookup ------------------------------------------------------
    async def _lookup_db(self, provider: str):
        """Lee ai_provider_keys para `provider`. Retorna row o None.
        Captura cualquier excepción de Prisma para que caiga a env var (CB-3).
        """
        try:
            from app.services.prisma_client import get_prisma_client
            prisma = get_prisma_client()
        except Exception as e:
            logger.warning(
                "KeyResolver: prisma client no disponible (%s) — fallback a env var",
                type(e).__name__,
            )
            raise
        try:
            # Prisma Python model name follows snake_case from @@map → 'aiproviderkey'.
            return await prisma.aiproviderkey.find_unique(where={"provider": provider})
        except Exception as e:
            logger.warning(
                "KeyResolver: BD caída consultando %s (%s) — fallback a env var",
                provider,
                type(e).__name__,
            )
            raise

    # -- resolve principal --------------------------------------------------
    async def resolve(self, provider: str) -> KeyResolution:
        if provider not in CANONICAL_PROVIDERS:
            # Proveedor desconocido: no inventar key. Retornar env vacía con warning.
            return self._env_resolution(provider, warning="unknown_provider")

        # 1. Flag off → env var (comportamiento idéntico al actual).
        if not is_ai_keys_from_db_enabled():
            return self._env_resolution(provider, warning="flag_off")

        # 2-4. Caché + BD con lock para evitar stampede en concurrencia.
        async with self._lock:
            now = time.monotonic()
            cached = self._cache.get(provider)
            if cached is not None:
                ts, value = cached
                if now - ts < self.ttl:
                    return value

            # 3. Lookup BD
            row = None
            try:
                row = await self._lookup_db(provider)
            except Exception:
                resolution = self._env_resolution(
                    provider, warning="db_unavailable"
                )
                self._cache[provider] = (now, resolution)
                return resolution

            if row is None:
                resolution = self._env_resolution(
                    provider, warning="row_missing"
                )
                self._cache[provider] = (now, resolution)
                return resolution

            if not getattr(row, "enabled", True):
                resolution = self._env_resolution(
                    provider, warning="row_disabled"
                )
                self._cache[provider] = (now, resolution)
                return resolution

            master_key = self._get_master_key()
            if master_key is None:
                # ENCRYPTION_KEY ausente — degradar a env var con warning claro.
                logger.warning(
                    "KeyResolver: ENCRYPTION_KEY ausente; no se puede descifrar "
                    "row de %s — fallback a env var",
                    provider,
                )
                resolution = self._env_resolution(
                    provider, warning="encryption_key_missing"
                )
                self._cache[provider] = (now, resolution)
                return resolution

            try:
                # IMPL-20260809-07 (fix): Prisma Python devuelve los campos BYTEA
                # como base64 strings (no bytes crudos). Decodificar antes de pasar a decrypt_key.
                import base64 as _b64
                api_key = decrypt_key(
                    _b64.b64decode(row.keyCiphertext),
                    _b64.b64decode(row.keyNonce),
                    _b64.b64decode(row.keyTag),
                    master_key,
                )
            except Exception as e:
                # CB-1: tag alterado / ciphertext corrupto.
                logger.warning(
                    "KeyResolver: descifrado de %s falló (%s) — fallback a env var",
                    provider,
                    type(e).__name__,
                )
                resolution = self._env_resolution(
                    provider, warning="decrypt_error"
                )
                self._cache[provider] = (now, resolution)
                return resolution

            resolution = KeyResolution(
                provider=provider,
                api_key=api_key,
                base_url=row.baseUrl,
                default_model=row.defaultModel,
                source="db",
                warning=None,
            )
            self._cache[provider] = (now, resolution)
            return resolution

    # -- invalidación -------------------------------------------------------
    def invalidate(self, provider: str) -> None:
        """Elimina la entrada de caché para forzar re-lookup en próxima resolve.
        SPEC §5.2: PUT/DELETE llaman esto tras commit → rotación inmediata."""
        self._cache.pop(provider, None)

    def invalidate_all(self) -> None:
        """Útil para tests."""
        self._cache.clear()


# Singleton global. Tests pueden sobrescribirlo con `set_key_resolver()`.
key_resolver = KeyResolver()


def set_key_resolver(resolver: KeyResolver) -> None:
    """Inyecta un resolver alternativo (para tests)."""
    global key_resolver
    key_resolver = resolver


def get_key_resolver() -> KeyResolver:
    """Acceso al singleton (útil para tests que sólo quieren resetear caché)."""
    return key_resolver