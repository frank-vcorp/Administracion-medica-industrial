"""
IMPL-20260809-06 — ARCH-20260809-03: Tests de los endpoints admin
`/api/v2/admin/ai-keys` (GET/PUT/DELETE).

Cubre SPEC §6.1-§6.3 + AC-4 / AC-5 / AC-8 / AC-9 / AC-11:
  - test_get_requires_admin_or_superadmin
  - test_put_requires_superadmin
  - test_delete_requires_superadmin
  - test_put_unknown_provider_returns_400
  - test_put_empty_apikey_returns_400
  - test_put_missing_encryption_key_returns_503
  - test_put_roundtrip_then_get_returns_masked_suffix
  - test_put_writes_audit_log_with_masked_suffix_no_full_key
  - test_put_invalidate_cache
  - test_delete_row_missing_returns_404
  - test_delete_writes_audit_log
  - test_delete_invalidate_cache
"""
import os
import sys
import base64
import json
from pathlib import Path
from typing import Any, Dict, List
from unittest.mock import MagicMock, AsyncMock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.api.v2.admin_ai_keys import router as admin_ai_keys_router
from app.services import prisma_client
from app.services.ai.keys import (
    CANONICAL_PROVIDERS,
    KeyResolver,
    decrypt_key,
    encrypt_key,
    get_key_resolver,
)


# ---------------------------------------------------------------------------
# Helpers — tabla in-memory estilo lab_catalogs.test_lab_catalogs
# ---------------------------------------------------------------------------
def _build_app() -> FastAPI:
    test_app = FastAPI(title="admin-ai-keys-tests")
    test_app.include_router(admin_ai_keys_router)
    return test_app


def _make_prisma_mock() -> MagicMock:
    """
    Mock Prisma con tabla 'aiproviderkey' in-memory.
    Persiste writes para que GET tras PUT refleje el cambio.
    """
    store: Dict[str, Dict[str, Any]] = {}
    auditlog: List[Dict[str, Any]] = []

    prisma = MagicMock()
    pk = MagicMock()
    al = MagicMock()

    # AsyncMock en Python 3.14 pasa el mock como self al side_effect cuando se
    # accede como atributo de otro mock. Usamos clases para que self explícito
    # funcione.
    class _RepoMock:
        def __init__(self, store):
            self.store = store

        async def find_unique(self, *, where):
            row = self.store.get(where["provider"])
            if row is None:
                return None
            return MagicMock(**row)

        async def find_many(self):
            return [MagicMock(**r) for r in self.store.values()]

        async def create(self, data=None, **kwargs):
            if data is None:
                data = kwargs
            provider = data["provider"]
            self.store[provider] = {
                "provider": provider,
                "keyCiphertext": bytes(data["keyCiphertext"]),
                "keyNonce": bytes(data["keyNonce"]),
                "keyTag": bytes(data["keyTag"]),
                "baseUrl": data.get("baseUrl"),
                "defaultModel": data.get("defaultModel"),
                "enabled": data.get("enabled", True),
                "updatedBy": data.get("updatedBy"),
                "updatedAt": data.get("updatedAt"),
            }
            return MagicMock(**self.store[provider])

        async def update(self, where, data=None, **kwargs):
            if data is None:
                # Soporte para `update(where={...}, data={...})` (kwargs).
                if "data" in kwargs:
                    data = kwargs["data"]
            provider = where["provider"]
            existing = self.store.get(provider, {})
            existing.update({
                "keyCiphertext": bytes(data["keyCiphertext"]),
                "keyNonce": bytes(data["keyNonce"]),
                "keyTag": bytes(data["keyTag"]),
                "baseUrl": data.get("baseUrl", existing.get("baseUrl")),
                "defaultModel": data.get("defaultModel", existing.get("defaultModel")),
                "enabled": data.get("enabled", True),
                "updatedBy": data.get("updatedBy"),
            })
            self.store[provider] = existing
            return MagicMock(**existing)

        async def delete(self, where, **kwargs):
            self.store.pop(where["provider"], None)
            return MagicMock()

    class _AuditMock:
        def __init__(self, log):
            self.log = log

        async def create(self, data=None, **kwargs):
            if data is None:
                data = kwargs
            self.log.append(data)
            return MagicMock()

    pk_inst = _RepoMock(store)
    al_inst = _AuditMock(auditlog)

    # IMPORTANTE: pk_inst.find_unique es un bound method — al pasarlo como
    # side_effect NO debe recibir self (ya viene bound). Pero como estamos
    # reemplazando atributos en `pk` (un MagicMock), necesitamos que las
    # llamadas se redirijan al método real. Una forma simple: usar
    # `wraps=pk_inst` o asignar las funciones directamente:
    pk.find_unique = pk_inst.find_unique
    pk.find_many = pk_inst.find_many
    pk.create = pk_inst.create
    pk.update = pk_inst.update
    pk.delete = pk_inst.delete
    al.create = al_inst.create

    prisma.aiproviderkey = pk
    prisma.auditlog = al
    prisma._store = store
    prisma._auditlog = auditlog
    return prisma


@pytest.fixture
def prisma_mock(monkeypatch):
    p = _make_prisma_mock()
    prisma_client.set_prisma_client(p)
    return p


@pytest.fixture
def client(prisma_mock, monkeypatch):
    """TestClient con ENCRYPTION_KEY válida."""
    monkeypatch.setenv("ENCRYPTION_KEY", base64.b64encode(b"\x42" * 32).decode())
    # Reset resolver cache
    get_key_resolver().invalidate_all()
    return TestClient(_build_app())


def _headers(role: str, user_id: str = "user-test-1") -> Dict[str, str]:
    return {
        "x-ami-role": role,
        "x-ami-userid": user_id,
        "Content-Type": "application/json",
    }


# ---------------------------------------------------------------------------
# AuthZ — header x-ami-role
# ---------------------------------------------------------------------------
def test_get_requires_admin_or_superadmin(client):
    r = client.get("/api/v2/admin/ai-keys", headers=_headers("DOCTOR_GENERAL"))
    assert r.status_code == 403
    body = r.json()
    assert "ADMIN" in body["detail"]


def test_get_allows_admin(client):
    r = client.get("/api/v2/admin/ai-keys", headers=_headers("ADMIN"))
    assert r.status_code == 200
    body = r.json()
    assert "providers" in body
    assert len(body["providers"]) == len(CANONICAL_PROVIDERS)
    # Sin filas en BD, los 3 providers aparecen con present=false.
    for p in body["providers"]:
        assert p["present"] is False
        assert p["keySuffix"] is None


def test_get_allows_superadmin(client):
    r = client.get("/api/v2/admin/ai-keys", headers=_headers("SUPERADMIN"))
    assert r.status_code == 200


def test_put_requires_superadmin(client):
    r = client.put(
        "/api/v2/admin/ai-keys/m3",
        headers=_headers("ADMIN"),
        json={"apiKey": "sk-new-key"},
    )
    assert r.status_code == 403


def test_delete_requires_superadmin(client):
    r = client.delete(
        "/api/v2/admin/ai-keys/m3",
        headers=_headers("ADMIN"),
    )
    assert r.status_code == 403


# ---------------------------------------------------------------------------
# Validación de payload
# ---------------------------------------------------------------------------
def test_put_unknown_provider_returns_400(client):
    r = client.put(
        "/api/v2/admin/ai-keys/openai",
        headers=_headers("SUPERADMIN"),
        json={"apiKey": "sk-x"},
    )
    assert r.status_code == 400
    assert "openai" in r.json()["detail"]


def test_put_empty_apikey_returns_400(client):
    r = client.put(
        "/api/v2/admin/ai-keys/m3",
        headers=_headers("SUPERADMIN"),
        json={"apiKey": ""},
    )
    assert r.status_code == 400


def test_put_missing_encryption_key_returns_503(client, monkeypatch):
    """AC-8 / CB-2: ENCRYPTION_KEY ausente → 503."""
    monkeypatch.delenv("ENCRYPTION_KEY", raising=False)
    # Forzar reset del master key cacheado en el resolver (no-op acá, pero por simetría).
    get_key_resolver()._master_key = None
    # El endpoint llama _load_encryption_key directamente → RuntimeError → 503.
    r = client.put(
        "/api/v2/admin/ai-keys/m3",
        headers=_headers("SUPERADMIN"),
        json={"apiKey": "sk-x"},
    )
    assert r.status_code == 503
    assert "ENCRYPTION_KEY" in r.json()["detail"]


# ---------------------------------------------------------------------------
# Roundtrip cifrado + audit log
# ---------------------------------------------------------------------------
def test_put_roundtrip_then_get_returns_masked_suffix(client, prisma_mock):
    """PUT cifra con AES-256-GCM → GET devuelve keySuffix con últimos 4 chars
    y NUNCA la key completa."""
    api_key = "sk-rotated-DBkey-9999"
    r = client.put(
        "/api/v2/admin/ai-keys/m3",
        headers=_headers("SUPERADMIN"),
        json={
            "apiKey": api_key,
            "baseUrl": "https://db.example.com/v1",
            "defaultModel": "M3-DB-Model",
        },
    )
    assert r.status_code == 200
    body = r.json()
    assert body["provider"] == "m3"
    assert body["present"] is True
    assert body["keySuffix"] == "9999"
    assert body["baseUrl"] == "https://db.example.com/v1"
    assert body["source"] == "db"

    # GET — la respuesta NO contiene la key completa.
    r2 = client.get("/api/v2/admin/ai-keys", headers=_headers("ADMIN"))
    assert r2.status_code == 200
    body2 = r2.json()
    raw = json.dumps(body2)
    assert api_key not in raw, "La respuesta no debe contener la key completa"
    assert "9999" in raw  # el suffix sí puede aparecer (es el dato público)


def test_put_writes_audit_log_with_masked_suffix_no_full_key(client, prisma_mock):
    """AC-9: PUT escribe AuditLog con maskedKeySuffix y SIN la key completa."""
    api_key = "sk-audit-DBkey-7777"
    client.put(
        "/api/v2/admin/ai-keys/gemini",
        headers=_headers("SUPERADMIN", user_id="super-admin-99"),
        json={"apiKey": api_key},
    )
    audit_entries = prisma_mock._auditlog
    assert len(audit_entries) == 1
    entry = audit_entries[0]
    assert entry["action"] == "ai_key_updated"
    assert entry["entity"] == "AIProviderKey"
    assert entry["entityId"] == "gemini"
    details = entry["details"]
    assert details["maskedKeySuffix"] == "7777"
    assert details["provider"] == "gemini"
    # La key completa NO debe estar en details ni en entry.
    raw = json.dumps(entry)
    assert api_key not in raw


def test_put_invalidate_cache(client, prisma_mock, monkeypatch):
    """PUT invalida caché del resolver → la siguiente resolve no usa valor stale."""
    # Activar flag on ANTES de poblar caché (necesario para que el resolver consulte BD).
    monkeypatch.setenv("AI_KEYS_FROM_DB_ENABLED", "true")
    monkeypatch.setenv("GEMINI_API_KEY", "env-gemini-fallback")

    # Insertar fila directamente con key inicial.
    mk = base64.b64decode(os.environ["ENCRYPTION_KEY"])
    ct, n, t = encrypt_key("sk-initial-key", mk)
    prisma_mock._store["gemini"] = {
        "provider": "gemini",
        "keyCiphertext": ct, "keyNonce": n, "keyTag": t,
        "baseUrl": None, "defaultModel": None, "enabled": True,
        "updatedBy": None, "updatedAt": None,
    }
    # Cargar caché con valor inicial.
    import asyncio
    resolver = get_key_resolver()
    resolver._master_key = None  # reset lazy cache para que relea env
    resolver.invalidate_all()
    initial = asyncio.run(resolver.resolve("gemini"))
    assert initial.api_key == "sk-initial-key"

    # PUT con nueva key (flag on para que el resolver lea de BD).
    r = client.put(
        "/api/v2/admin/ai-keys/gemini",
        headers=_headers("SUPERADMIN"),
        json={"apiKey": "sk-rotated-NEWkey-2222"},
    )
    assert r.status_code == 200
    # La caché debe haberse invalidado: la próxima resolve lee de BD.
    rotated = asyncio.run(resolver.resolve("gemini"))
    assert rotated.api_key == "sk-rotated-NEWkey-2222"
    assert rotated.source == "db"


# ---------------------------------------------------------------------------
# DELETE
# ---------------------------------------------------------------------------
def test_delete_row_missing_returns_404(client):
    r = client.delete(
        "/api/v2/admin/ai-keys/dr7",
        headers=_headers("SUPERADMIN"),
    )
    assert r.status_code == 404


def test_delete_writes_audit_log(client, prisma_mock):
    api_key = "sk-todelete-DBkey-1111"
    client.put(
        "/api/v2/admin/ai-keys/dr7",
        headers=_headers("SUPERADMIN", user_id="super-1"),
        json={"apiKey": api_key},
    )
    r = client.delete(
        "/api/v2/admin/ai-keys/dr7",
        headers=_headers("SUPERADMIN", user_id="super-1"),
    )
    assert r.status_code == 200
    body = r.json()
    assert body["provider"] == "dr7"
    assert body["present"] is False
    assert body["source"] == "env"

    audit_entries = prisma_mock._auditlog
    delete_entries = [e for e in audit_entries if e["action"] == "ai_key_deleted"]
    assert len(delete_entries) == 1
    assert delete_entries[0]["entityId"] == "dr7"


def test_delete_invalidate_cache(client, prisma_mock, monkeypatch):
    """DELETE invalida caché → la próxima resolve cae a env var."""
    monkeypatch.setenv("AI_KEYS_FROM_DB_ENABLED", "true")
    monkeypatch.setenv("M3_API_KEY", "env-m3-fallback")
    api_key = "sk-deleted-row-3333"
    client.put(
        "/api/v2/admin/ai-keys/m3",
        headers=_headers("SUPERADMIN"),
        json={"apiKey": api_key},
    )

    import asyncio
    resolver = get_key_resolver()
    resolver._master_key = None
    resolver.invalidate_all()
    # Pre-calentar caché: la fila recién creada con la key.
    pre = asyncio.run(resolver.resolve("m3"))
    assert pre.api_key == api_key

    r = client.delete(
        "/api/v2/admin/ai-keys/m3",
        headers=_headers("SUPERADMIN"),
    )
    assert r.status_code == 200
    # Caché invalidada: la próxima resolve debe consultar BD, no devolver valor stale.
    # Como la fila ya no existe, retornará env var con warning row_missing.
    post = asyncio.run(resolver.resolve("m3"))
    assert post.source == "env"
    assert post.warning == "row_missing"