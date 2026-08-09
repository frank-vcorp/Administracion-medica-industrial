"""
IMPL-20260809-06 — ARCH-20260809-03: Tests del KeyResolver + crypto.

Cubre (SPEC §9 / §10):
  - test_encrypt_decrypt_roundtrip
  - test_encrypt_key_tamper_detection (CB-1)
  - test_resolve_flag_off_returns_env_with_warning_flag_off
  - test_resolve_flag_on_db_row_present_returns_db
  - test_resolve_flag_on_db_row_missing_returns_env_with_warning_row_missing
  - test_resolve_flag_on_db_row_disabled_returns_env_with_warning_row_disabled
  - test_resolve_db_unavailable_returns_env_with_warning_db_unavailable
  - test_resolve_encryption_key_missing_returns_env_with_warning
  - test_resolve_cache_ttl_expiry
  - test_resolve_invalidate_clears_cache
  - test_loading_encryption_key_missing_raises
  - test_loading_encryption_key_wrong_length_raises
  - test_keys_never_logged_in_clear (sanity)
"""
import os
import sys
import asyncio
import base64
import time
from pathlib import Path
from unittest.mock import MagicMock, AsyncMock

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.services.ai.keys import (
    CANONICAL_PROVIDERS,
    KeyResolver,
    decrypt_key,
    encrypt_key,
    get_key_resolver,
    is_ai_keys_from_db_enabled,
    _load_encryption_key,
)
from app.services.ai.prediagnostic import _resolve_dr7_config
from cryptography.exceptions import InvalidTag


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _master_key_bytes() -> bytes:
    """Raw 32-byte AES-256 master key (BEFORE base64 encoding)."""
    return b"\x42" * 32


def _master_key_b64() -> str:
    return base64.b64encode(_master_key_bytes()).decode()


@pytest.fixture
def master_key_env(monkeypatch):
    """Set ENCRYPTION_KEY (base64-encoded) + reset flag."""
    monkeypatch.setenv("ENCRYPTION_KEY", _master_key_b64())
    monkeypatch.setenv("AI_KEYS_FROM_DB_ENABLED", "false")
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.delenv("M3_API_KEY", raising=False)
    monkeypatch.delenv("DR7_API_KEY", raising=False)


@pytest.fixture
def resolver(master_key_env):
    """Resolver con caché vacía."""
    r = KeyResolver()
    r.invalidate_all()
    return r


def _make_db_row(provider="m3", api_key="sk-from-db-9f3a", enabled=True,
                 base_url=None, default_model=None, master_key=None):
    """Genera un row con una key ya cifrada (helper). Acepta master_key
    explícito para tests que necesitan cifrar antes de mutar env vars."""
    mk = master_key if master_key is not None else _load_encryption_key()
    ct, n, t = encrypt_key(api_key, mk)
    # IMPL-20260809-07: Prisma Python devuelve BYTEA como base64 strings.
    # El resolver hace b64decode internamente, así que los mocks deben usar base64.
    import base64 as _b64_test
    row = MagicMock()
    row.provider = provider
    row.keyCiphertext = _b64_test.b64encode(ct).decode("ascii")
    row.keyNonce = _b64_test.b64encode(n).decode("ascii")
    row.keyTag = _b64_test.b64encode(t).decode("ascii")
    row.baseUrl = base_url
    row.defaultModel = default_model
    row.enabled = enabled
    row.updatedAt = None
    row.updatedBy = None
    return row


def _mock_prisma(row=None):
    prisma = MagicMock()
    prisma.aiproviderkey = MagicMock()
    prisma.aiproviderkey.find_unique = AsyncMock(return_value=row)
    return prisma


def _arun(coro):
    """Helper: ejecuta una coroutine en un event loop desechable (sin pytest-asyncio)."""
    return asyncio.run(coro)


# ---------------------------------------------------------------------------
# 1. Crypto roundtrip + tamper
# ---------------------------------------------------------------------------
def test_encrypt_decrypt_roundtrip(master_key_env):
    mk = _master_key_bytes()
    plaintext = "sk-test-ABCDEFGH-1234"
    ct, n, t = encrypt_key(plaintext, mk)
    assert isinstance(ct, (bytes, bytearray))
    assert isinstance(n, (bytes, bytearray)) and len(n) == 12
    assert isinstance(t, (bytes, bytearray)) and len(t) == 16
    assert decrypt_key(ct, n, t, mk) == plaintext


def test_encrypt_key_tamper_detection(master_key_env):
    """CB-1: alterar el tag lanza InvalidTag."""
    mk = _master_key_bytes()
    ct, n, t = encrypt_key("sk-real-key-1234", mk)
    bad_tag = bytes(b ^ 0xFF for b in t)  # flip every byte
    with pytest.raises(InvalidTag):
        decrypt_key(ct, n, bad_tag, mk)


def test_loading_encryption_key_missing_raises(monkeypatch):
    monkeypatch.delenv("ENCRYPTION_KEY", raising=False)
    with pytest.raises(RuntimeError, match="ENCRYPTION_KEY no configurada"):
        _load_encryption_key()


def test_loading_encryption_key_wrong_length_raises(monkeypatch):
    # 16 bytes (AES-128) — debe rechazar
    bad = base64.b64encode(b"\x42" * 16).decode()
    monkeypatch.setenv("ENCRYPTION_KEY", bad)
    with pytest.raises(RuntimeError, match="debe ser 32 bytes"):
        _load_encryption_key()


def test_loading_encryption_key_invalid_base64_raises(monkeypatch):
    monkeypatch.setenv("ENCRYPTION_KEY", "***not-base64***")
    with pytest.raises(RuntimeError, match="no es base64 válido"):
        _load_encryption_key()


# ---------------------------------------------------------------------------
# 2. Feature flag off → env var (cero cambio observable)
# ---------------------------------------------------------------------------
def test_resolve_flag_off_returns_env_with_warning_flag_off(monkeypatch, resolver):
    monkeypatch.setenv("AI_KEYS_FROM_DB_ENABLED", "false")
    monkeypatch.setenv("GEMINI_API_KEY", "env-key-gemini")
    monkeypatch.setenv("M3_API_KEY", "env-key-m3")
    monkeypatch.setenv("DR7_API_KEY", "env-key-dr7")

    for prov, expected in [
        ("gemini", "env-key-gemini"),
        ("m3", "env-key-m3"),
        ("dr7", "env-key-dr7"),
    ]:
        resolution = _arun(resolver.resolve(prov))
        assert resolution.api_key == expected
        assert resolution.source == "env"
        assert resolution.warning == "flag_off"


def test_is_ai_keys_from_db_enabled_default_is_false(monkeypatch):
    monkeypatch.delenv("AI_KEYS_FROM_DB_ENABLED", raising=False)
    assert is_ai_keys_from_db_enabled() is False

    monkeypatch.setenv("AI_KEYS_FROM_DB_ENABLED", "true")
    assert is_ai_keys_from_db_enabled() is True

    monkeypatch.setenv("AI_KEYS_FROM_DB_ENABLED", "True ")  # con whitespace + mixed case
    assert is_ai_keys_from_db_enabled() is True

    monkeypatch.setenv("AI_KEYS_FROM_DB_ENABLED", "FALSE")
    assert is_ai_keys_from_db_enabled() is False


# ---------------------------------------------------------------------------
# 3. Flag on + BD row presente → devuelve BD (con caché)
# ---------------------------------------------------------------------------
def test_resolve_flag_on_db_row_present_returns_db(monkeypatch, master_key_env, resolver):
    monkeypatch.setenv("AI_KEYS_FROM_DB_ENABLED", "true")
    monkeypatch.setenv("M3_API_KEY", "env-key-m3-fallback")
    monkeypatch.setenv("M3_BASE_URL", "https://env.example.com/v1")

    row = _make_db_row(
        provider="m3",
        api_key="sk-DB-rotated-abc9",
        base_url="https://db.example.com/v1",
        default_model="MiniMax-DB-Model",
    )
    prisma = _mock_prisma(row=row)

    from app.services import prisma_client
    prisma_client.set_prisma_client(prisma)

    resolution = _arun(resolver.resolve("m3"))
    assert resolution.api_key == "sk-DB-rotated-abc9"
    assert resolution.base_url == "https://db.example.com/v1"
    assert resolution.default_model == "MiniMax-DB-Model"
    assert resolution.source == "db"
    assert resolution.warning is None


def test_resolve_flag_on_db_row_missing_returns_env_with_warning_row_missing(
    monkeypatch, master_key_env, resolver
):
    monkeypatch.setenv("AI_KEYS_FROM_DB_ENABLED", "true")
    monkeypatch.setenv("GEMINI_API_KEY", "env-gemini-fallback")
    prisma = _mock_prisma(row=None)
    from app.services import prisma_client
    prisma_client.set_prisma_client(prisma)

    resolution = _arun(resolver.resolve("gemini"))
    assert resolution.api_key == "env-gemini-fallback"
    assert resolution.source == "env"
    assert resolution.warning == "row_missing"


def test_resolve_flag_on_db_row_disabled_returns_env_with_warning_row_disabled(
    monkeypatch, master_key_env, resolver
):
    monkeypatch.setenv("AI_KEYS_FROM_DB_ENABLED", "true")
    monkeypatch.setenv("DR7_API_KEY", "env-dr7")
    row = _make_db_row(provider="dr7", api_key="sk-from-db-disabled", enabled=False)
    prisma = _mock_prisma(row=row)
    from app.services import prisma_client
    prisma_client.set_prisma_client(prisma)

    resolution = _arun(resolver.resolve("dr7"))
    assert resolution.source == "env"
    assert resolution.warning == "row_disabled"


def test_resolve_db_unavailable_returns_env_with_warning_db_unavailable(
    monkeypatch, master_key_env, resolver
):
    monkeypatch.setenv("AI_KEYS_FROM_DB_ENABLED", "true")
    monkeypatch.setenv("M3_API_KEY", "env-m3")
    prisma = MagicMock()
    prisma.aiproviderkey = MagicMock()
    prisma.aiproviderkey.find_unique = AsyncMock(
        side_effect=RuntimeError("BD caída (simulado)")
    )
    from app.services import prisma_client
    prisma_client.set_prisma_client(prisma)

    resolution = _arun(resolver.resolve("m3"))
    assert resolution.source == "env"
    assert resolution.warning == "db_unavailable"
    assert resolution.api_key == "env-m3"


def test_resolve_encryption_key_missing_returns_env_with_warning(
    monkeypatch, master_key_env, resolver
):
    """Si flag on + ENCRYPTION_KEY ausente → fallback env con warning claro."""
    monkeypatch.setenv("AI_KEYS_FROM_DB_ENABLED", "true")
    monkeypatch.delenv("ENCRYPTION_KEY", raising=False)
    monkeypatch.setenv("GEMINI_API_KEY", "env-gemini-no-master")
    # Cifrar la key ANTES de borrar env var (usando master_key_env vigente).
    row = _make_db_row(
        provider="gemini", api_key="sk-cant-decrypt",
        master_key=_master_key_bytes(),
    )
    prisma = _mock_prisma(row=row)
    from app.services import prisma_client
    prisma_client.set_prisma_client(prisma)

    # El resolver lazy-loads master key — forzamos reset para tomar el nuevo env.
    resolver._master_key = None
    resolver._master_key_error = None
    resolution = _arun(resolver.resolve("gemini"))
    assert resolution.source == "env"
    assert resolution.warning == "encryption_key_missing"


def test_resolve_db_corrupt_ciphertext_falls_back_to_env_with_warning_decrypt_error(
    monkeypatch, master_key_env, resolver
):
    """CB-1: ciphertext/tag alterado en BD → resolver cae a env var."""
    monkeypatch.setenv("AI_KEYS_FROM_DB_ENABLED", "true")
    monkeypatch.setenv("M3_API_KEY", "env-m3-fallback")
    row = _make_db_row(provider="m3", api_key="sk-original")
    # Corromper el ciphertext: XOR cada byte del base64-decoded ciphertext, re-encode.
    import base64 as _b64_corrupt
    ct_raw = _b64_corrupt.b64decode(row.keyCiphertext)
    ct_corrupt = bytes(b ^ 0xFF for b in ct_raw)
    row.keyCiphertext = _b64_corrupt.b64encode(ct_corrupt).decode("ascii")
    prisma = _mock_prisma(row=row)
    from app.services import prisma_client
    prisma_client.set_prisma_client(prisma)

    resolution = _arun(resolver.resolve("m3"))
    assert resolution.source == "env"
    assert resolution.warning == "decrypt_error"
    assert resolution.api_key == "env-m3-fallback"


# ---------------------------------------------------------------------------
# 4. Caché TTL + invalidación
# ---------------------------------------------------------------------------
def test_resolve_cache_ttl_expiry(monkeypatch, master_key_env):
    monkeypatch.setenv("AI_KEYS_FROM_DB_ENABLED", "true")
    monkeypatch.setenv("GEMINI_API_KEY", "env-gemini")
    prisma = MagicMock()
    prisma.aiproviderkey = MagicMock()

    row = _make_db_row(provider="gemini", api_key="sk-ttl-test")
    prisma.aiproviderkey.find_unique = AsyncMock(return_value=row)
    from app.services import prisma_client
    prisma_client.set_prisma_client(prisma)

    r = KeyResolver(ttl_seconds=2)  # TTL muy corto para test
    r.invalidate_all()

    # 1ª llamada: cache miss → BD
    first = _arun(r.resolve("gemini"))
    assert first.source == "db"
    assert first.api_key == "sk-ttl-test"

    # 2ª llamada inmediata: cache hit (no consulta BD)
    prisma.aiproviderkey.find_unique.reset_mock()
    second = _arun(r.resolve("gemini"))
    assert second.api_key == "sk-ttl-test"
    prisma.aiproviderkey.find_unique.assert_not_called()

    # 3ª llamada tras TTL: cache miss de nuevo
    time.sleep(2.1)
    prisma.aiproviderkey.find_unique.reset_mock()
    third = _arun(r.resolve("gemini"))
    assert third.source == "db"
    prisma.aiproviderkey.find_unique.assert_called_once()


def test_resolve_invalidate_clears_cache(monkeypatch, master_key_env):
    monkeypatch.setenv("AI_KEYS_FROM_DB_ENABLED", "true")
    monkeypatch.setenv("M3_API_KEY", "env-m3")
    prisma = MagicMock()
    prisma.aiproviderkey = MagicMock()
    row = _make_db_row(provider="m3", api_key="sk-new-rotated")
    prisma.aiproviderkey.find_unique = AsyncMock(return_value=row)
    from app.services import prisma_client
    prisma_client.set_prisma_client(prisma)

    r = KeyResolver(ttl_seconds=60)
    r.invalidate_all()

    # 1ª llamada: cache miss → consulta BD
    res1 = _arun(r.resolve("m3"))
    assert res1.api_key == "sk-new-rotated"
    prisma.aiproviderkey.find_unique.assert_called_once()

    # 2ª llamada sin invalidar → cache hit (no consulta)
    prisma.aiproviderkey.find_unique.reset_mock()
    res2 = _arun(r.resolve("m3"))
    prisma.aiproviderkey.find_unique.assert_not_called()
    assert res2.api_key == "sk-new-rotated"

    # Invalidar y llamar de nuevo → reconsulta BD
    r.invalidate("m3")
    prisma.aiproviderkey.find_unique.reset_mock()
    res3 = _arun(r.resolve("m3"))
    prisma.aiproviderkey.find_unique.assert_called_once()
    assert res3.api_key == "sk-new-rotated"


def test_resolve_unknown_provider_returns_env_with_warning(master_key_env):
    """Proveedor fuera del set canónico no rompe el resolver."""
    resolver = KeyResolver()
    resolution = _arun(resolver.resolve("openai"))
    assert resolution.source == "env"
    assert resolution.warning == "unknown_provider"
    assert resolution.api_key == ""


# ---------------------------------------------------------------------------
# 5. _refresh_keys en bases GeminiBase/M3/Featherless (sincronía con flag)
# ---------------------------------------------------------------------------
def test_geminibase_refresh_keys_with_flag_off_is_noop(monkeypatch):
    """Con flag off, `_refresh_keys` no consulta BD ni cambia api_key."""
    monkeypatch.setenv("AI_KEYS_FROM_DB_ENABLED", "false")
    monkeypatch.setenv("GEMINI_API_KEY", "env-gemini-key-original")

    from app.services.ai.base import GeminiBase
    g = GeminiBase(api_key="ctor-key")
    g._refresh_keys()
    assert g.key_source == "env"
    assert g.key_resolution_warning == "flag_off"
    # api_key conservado del ctor (no del env, porque se pasó explícito).
    assert g.api_key == "ctor-key"


def test_m3base_refresh_keys_with_flag_off_is_noop(monkeypatch):
    monkeypatch.setenv("AI_KEYS_FROM_DB_ENABLED", "false")
    monkeypatch.setenv("M3_API_KEY", "env-m3-key")

    from app.services.ai.base import M3VisionBase
    m = M3VisionBase(api_key="ctor-m3")
    m._refresh_keys()
    assert m.key_source == "env"
    assert m.api_key == "ctor-m3"  # preserva ctor explícito


def test_geminibase_refresh_keys_with_flag_on_fetches_db(monkeypatch, master_key_env):
    """Con flag on, refresh consulta BD y sobrescribe api_key."""
    monkeypatch.setenv("AI_KEYS_FROM_DB_ENABLED", "true")
    monkeypatch.setenv("GEMINI_API_KEY", "env-gemini")
    row = _make_db_row(provider="gemini", api_key="sk-DB-rotated")
    prisma = _mock_prisma(row=row)
    from app.services import prisma_client
    prisma_client.set_prisma_client(prisma)

    from app.services.ai.base import GeminiBase
    g = GeminiBase(api_key="env-gemini")
    g._refresh_keys()
    assert g.key_source == "db"
    assert g.api_key == "sk-DB-rotated"
    assert g.key_resolution_warning is None


# ---------------------------------------------------------------------------
# 6. PrediagnosticService lee DR7 via resolver
# ---------------------------------------------------------------------------
def test_prediagnostic_uses_resolved_dr7_config(monkeypatch, master_key_env):
    """Cuando flag off, _resolve_dr7_config() usa env vars + warning flag_off."""
    monkeypatch.setenv("AI_KEYS_FROM_DB_ENABLED", "false")
    monkeypatch.setenv("DR7_API_KEY", "env-dr7")
    monkeypatch.setenv("DR7_MODEL", "medgemma-test")
    cfg = _resolve_dr7_config()
    assert cfg["api_key"] == "env-dr7"
    assert cfg["model"] == "medgemma-test"
    assert cfg["key_source"] == "env"
    assert cfg["warning"] == "flag_off"


def test_prediagnostic_dr7_module_constants_still_preserved(master_key_env):
    """Retrocompat: DR7_API_KEY/DR7_BASE_URL/DR7_MODEL siguen disponibles
    como constantes de módulo (tests legacy las parchean)."""
    from app.services.ai import prediagnostic
    assert hasattr(prediagnostic, "DR7_API_KEY")
    assert hasattr(prediagnostic, "MEDGEMMA_ENABLED")