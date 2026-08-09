"""
IMPL-20260809-09 — ARCH-20260809-05: Tests del endpoint
`GET/PUT /api/v2/admin/app-config/extraction-default-provider`.

Cubre AC-9/AC-10/AC-11/AC-13/AC-14 + permisos + optimistic locking + audit.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any, Dict, List
from unittest.mock import MagicMock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.api.v2.admin_app_config import router as app_config_router
from app.services import prisma_client
from app.services.ai import app_config as app_config_module
from app.services.ai.app_config import (
    EXTRACTION_DEFAULT_PROVIDER_KEY,
    EXTRACTION_DEFAULT_PROVIDER_FALLBACK,
    EXTRACTION_DEFAULT_PROVIDER_VALID,
    get_app_config_store,
    get_extraction_default_provider,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _build_app() -> FastAPI:
    app = FastAPI(title="admin-app-config-tests")
    app.include_router(app_config_router)
    return app


def _make_prisma_mock() -> MagicMock:
    store: Dict[str, Dict[str, Any]] = {}
    auditlog: List[Dict[str, Any]] = []

    prisma = MagicMock()
    ac = MagicMock()
    al = MagicMock()

    class _ConfigMock:
        def __init__(self, store):
            self.store = store

        async def find_unique(self, *, where):
            row = self.store.get(where["key"])
            if row is None:
                return None
            return MagicMock(**row)

        async def create(self, data=None, **kwargs):
            if data is None:
                data = kwargs
            from datetime import datetime, timezone
            now = datetime.now(timezone.utc)
            self.store[data["key"]] = {
                "key": data["key"],
                "value": data["value"],
                "updatedBy": data.get("updatedBy"),
                "updatedAt": now,
            }
            return MagicMock(**self.store[data["key"]])

        async def update(self, where, data=None, **kwargs):
            if data is None:
                if "data" in kwargs:
                    data = kwargs["data"]
            key = where["key"]
            existing = self.store.get(key, {})
            from datetime import datetime, timezone
            existing.update({
                "value": data.get("value", existing.get("value")),
                "updatedBy": data.get("updatedBy", existing.get("updatedBy")),
                "updatedAt": datetime.now(timezone.utc),
            })
            self.store[key] = existing
            return MagicMock(**existing)

    class _AuditMock:
        def __init__(self, log):
            self.log = log

        async def create(self, data=None, **kwargs):
            if data is None:
                data = kwargs
            self.log.append(data)
            return MagicMock()

    ac_inst = _ConfigMock(store)
    al_inst = _AuditMock(auditlog)

    ac.find_unique = ac_inst.find_unique
    ac.create = ac_inst.create
    ac.update = ac_inst.update
    al.create = al_inst.create

    prisma.appconfig = ac
    prisma.auditlog = al
    prisma._store = store
    prisma._auditlog = auditlog
    return prisma


@pytest.fixture
def prisma_mock(monkeypatch):
    p = _make_prisma_mock()
    prisma_client.set_prisma_client(p)
    # Reset cache del store.
    get_app_config_store().invalidate_all()
    return p


@pytest.fixture
def client(prisma_mock):
    return TestClient(_build_app())


def _headers(role: str, user_id: str = "user-1") -> Dict[str, str]:
    return {
        "x-ami-role": role,
        "x-ami-userid": user_id,
        "Content-Type": "application/json",
    }


# ---------------------------------------------------------------------------
# AuthZ — GET ADMIN/SUPERADMIN, PUT solo SUPERADMIN
# ---------------------------------------------------------------------------
def test_get_requires_admin_or_superadmin(client):
    r = client.get(
        "/api/v2/admin/app-config/extraction-default-provider",
        headers=_headers("DOCTOR_GENERAL"),
    )
    assert r.status_code == 403


def test_get_allows_admin(client):
    r = client.get(
        "/api/v2/admin/app-config/extraction-default-provider",
        headers=_headers("ADMIN"),
    )
    assert r.status_code == 200
    body = r.json()
    assert body["provider"] == "gemini"
    assert body["source"] == "default"
    assert body["updatedAt"] is None


def test_get_allows_superadmin(client):
    r = client.get(
        "/api/v2/admin/app-config/extraction-default-provider",
        headers=_headers("SUPERADMIN"),
    )
    assert r.status_code == 200


def test_put_requires_superadmin(client):
    r = client.put(
        "/api/v2/admin/app-config/extraction-default-provider",
        headers=_headers("ADMIN"),
        json={"provider": "m3"},
    )
    assert r.status_code == 403


# ---------------------------------------------------------------------------
# GET sin row → fallback "gemini" + source="default"
# ---------------------------------------------------------------------------
def test_get_without_row_returns_default(client):
    r = client.get(
        "/api/v2/admin/app-config/extraction-default-provider",
        headers=_headers("ADMIN"),
    )
    assert r.status_code == 200
    body = r.json()
    assert body["provider"] == "gemini"
    assert body["source"] == "default"
    assert body["updatedAt"] is None


# ---------------------------------------------------------------------------
# PUT roundtrip + audit + source="db"
# ---------------------------------------------------------------------------
def test_put_creates_row_and_returns_db_source(client, prisma_mock):
    r = client.put(
        "/api/v2/admin/app-config/extraction-default-provider",
        headers=_headers("SUPERADMIN", user_id="super-9"),
        json={"provider": "m3"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["provider"] == "m3"
    assert body["source"] == "db"
    assert body["updatedAt"] is not None

    # Verificar row persistido.
    stored = prisma_mock._store.get(EXTRACTION_DEFAULT_PROVIDER_KEY)
    assert stored is not None
    assert stored["value"] == {"provider": "m3"}
    assert stored["updatedBy"] == "super-9"

    # AuditLog escrito.
    audit_entries = prisma_mock._auditlog
    assert len(audit_entries) == 1
    entry = audit_entries[0]
    assert entry["action"] == "extraction_default_provider_updated"
    assert entry["entity"] == "AppConfig"
    assert entry["entityId"] == EXTRACTION_DEFAULT_PROVIDER_KEY
    assert entry["details"]["previous"] is None
    assert entry["details"]["current"] == "m3"
    assert entry["details"]["source"] == "ui"


def test_put_updates_existing_row_with_previous(client, prisma_mock):
    """PUT cuando ya hay row → previous y current distintos en audit."""
    # Primer PUT → m3.
    client.put(
        "/api/v2/admin/app-config/extraction-default-provider",
        headers=_headers("SUPERADMIN"),
        json={"provider": "m3"},
    )
    # Reset cache (PUT lo invalidó pero por si).
    get_app_config_store().invalidate_all()

    # Segundo PUT → gemini.
    r = client.put(
        "/api/v2/admin/app-config/extraction-default-provider",
        headers=_headers("SUPERADMIN"),
        json={"provider": "gemini"},
    )
    assert r.status_code == 200

    # Audit: debe haber 2 entries; la segunda con previous="m3", current="gemini".
    audit_entries = prisma_mock._auditlog
    assert len(audit_entries) == 2
    last = audit_entries[-1]
    assert last["details"]["previous"] == "m3"
    assert last["details"]["current"] == "gemini"


# ---------------------------------------------------------------------------
# PUT provider inválido → 400
# ---------------------------------------------------------------------------
def test_put_dr7_rejected_with_400(client):
    r = client.put(
        "/api/v2/admin/app-config/extraction-default-provider",
        headers=_headers("SUPERADMIN"),
        json={"provider": "dr7"},
    )
    assert r.status_code == 400
    assert "dr7 is clinical-only" in r.json()["detail"]


def test_put_unknown_provider_returns_400(client):
    r = client.put(
        "/api/v2/admin/app-config/extraction-default-provider",
        headers=_headers("SUPERADMIN"),
        json={"provider": "openai"},
    )
    assert r.status_code == 400


# ---------------------------------------------------------------------------
# Optimistic locking 409
# ---------------------------------------------------------------------------
def test_put_conflict_on_stale_expected_updated_at(client, prisma_mock):
    """expectedUpdatedAt desactualizado → 409 con currentUpdatedAt."""
    # Crear row inicial.
    r1 = client.put(
        "/api/v2/admin/app-config/extraction-default-provider",
        headers=_headers("SUPERADMIN"),
        json={"provider": "m3"},
    )
    assert r1.status_code == 200

    # Intentar PUT con expectedUpdatedAt muy antiguo.
    r2 = client.put(
        "/api/v2/admin/app-config/extraction-default-provider",
        headers=_headers("SUPERADMIN"),
        json={"provider": "gemini", "expectedUpdatedAt": "2000-01-01T00:00:00+00:00"},
    )
    assert r2.status_code == 409
    body = r2.json()
    assert body["detail"]["code"] == "conflict"
    assert "currentUpdatedAt" in body["detail"]


# ---------------------------------------------------------------------------
# GET tras PUT → muestra el nuevo valor (caché invalidada)
# ---------------------------------------------------------------------------
def test_get_after_put_returns_new_value(client, prisma_mock):
    client.put(
        "/api/v2/admin/app-config/extraction-default-provider",
        headers=_headers("SUPERADMIN"),
        json={"provider": "m3"},
    )
    r = client.get(
        "/api/v2/admin/app-config/extraction-default-provider",
        headers=_headers("ADMIN"),
    )
    assert r.status_code == 200
    body = r.json()
    assert body["provider"] == "m3"
    assert body["source"] == "db"


# ---------------------------------------------------------------------------
# Servicio get_extraction_default_provider (con caché)
# ---------------------------------------------------------------------------
def test_get_extraction_default_provider_fallback_when_empty():
    """Sin row en BD y caché vacía → fallback gemini."""
    import asyncio
    prisma_mock = _make_prisma_mock()
    prisma_client.set_prisma_client(prisma_mock)
    get_app_config_store().invalidate_all()
    provider, source = asyncio.run(get_extraction_default_provider())
    assert provider == "gemini"
    assert source == "default"


def test_get_extraction_default_provider_from_db():
    """Con row en BD → lee el valor (sin necesidad de caché fresca)."""
    import asyncio
    prisma_mock = _make_prisma_mock()
    prisma_client.set_prisma_client(prisma_mock)
    get_app_config_store().invalidate_all()
    # Setear row directamente.
    prisma_mock._store[EXTRACTION_DEFAULT_PROVIDER_KEY] = {
        "key": EXTRACTION_DEFAULT_PROVIDER_KEY,
        "value": {"provider": "m3"},
        "updatedBy": None,
        "updatedAt": None,
    }
    provider, source = asyncio.run(get_extraction_default_provider())
    assert provider == "m3"
    assert source == "db"


def test_get_extraction_default_provider_invalid_value_falls_back():
    """Valor inválido en BD (dr7) → fallback gemini."""
    import asyncio
    prisma_mock = _make_prisma_mock()
    prisma_client.set_prisma_client(prisma_mock)
    get_app_config_store().invalidate_all()
    prisma_mock._store[EXTRACTION_DEFAULT_PROVIDER_KEY] = {
        "key": EXTRACTION_DEFAULT_PROVIDER_KEY,
        "value": {"provider": "dr7"},
        "updatedBy": None,
        "updatedAt": None,
    }
    provider, source = asyncio.run(get_extraction_default_provider())
    assert provider == "gemini"
    assert source == "default"


# ---------------------------------------------------------------------------
# Caché TTL — invalidación tras escritura
# ---------------------------------------------------------------------------
def test_cache_invalidated_after_put(client, prisma_mock):
    """PUT invalida caché → siguiente get lee valor fresco."""
    import asyncio
    # Vaciar caché y pre-poblar con valor stale.
    get_app_config_store().invalidate_all()
    prisma_mock._store[EXTRACTION_DEFAULT_PROVIDER_KEY] = {
        "key": EXTRACTION_DEFAULT_PROVIDER_KEY,
        "value": {"provider": "m3"},
        "updatedBy": None,
        "updatedAt": None,
    }
    # Cargar caché.
    provider, source = asyncio.run(get_extraction_default_provider())
    assert provider == "m3"

    # PUT para cambiar a gemini.
    r = client.put(
        "/api/v2/admin/app-config/extraction-default-provider",
        headers=_headers("SUPERADMIN"),
        json={"provider": "gemini"},
    )
    assert r.status_code == 200

    # El siguiente get DEBE leer fresco (caché invalidada).
    provider, source = asyncio.run(get_extraction_default_provider())
    assert provider == "gemini"
    assert source == "db"


# ---------------------------------------------------------------------------
# Sincrónico (usado por /api/v2/ai/status)
# ---------------------------------------------------------------------------
def test_sync_getter_returns_fallback_when_cache_empty():
    """Sin caché ni BD → fallback gemini (no rompe el status público)."""
    get_app_config_store().invalidate_all()
    provider, source = app_config_module.get_extraction_default_provider_sync()
    assert provider == "gemini"
    assert source == "default"


def test_sync_getter_returns_cached_value():
    """Si la caché tiene valor fresco → lo retorna (sin golpear BD)."""
    store = get_app_config_store()
    store.invalidate_all()
    # Setear caché manualmente.
    import time
    store._cache[EXTRACTION_DEFAULT_PROVIDER_KEY] = (
        time.monotonic(),
        {"provider": "m3"},
    )
    provider, source = app_config_module.get_extraction_default_provider_sync()
    assert provider == "m3"
    assert source == "db"
    # Cleanup
    store.invalidate_all()


# ---------------------------------------------------------------------------
# IMPL-20260810-01 — fix B† ARCH-20260809-06 §7.4 (priming en PUT + warmup).
# Cubre hallazgo QA-20260809-01 #1: el `PUT` solo invalidaba la caché y la sync
# caía a "gemini" indefinidamente tras un cambio por UI. Estos tests blindan
# el priming + warmup + red de seguridad.
# ---------------------------------------------------------------------------
def test_put_primes_cache_next_sync_read_fresh(client, prisma_mock):
    """
    AC-7 (caché primeada): tras PUT {provider:"m3"}, la sync retorna ("m3","db")
    SIN llamar la async entre medias. Este test habría atrapado el bug original
    donde `put_extraction_default` solo invalidaba la caché (sin priming).
    """
    import asyncio
    get_app_config_store().invalidate_all()

    # 1) PUT a "m3" como SUPERADMIN.
    r = client.put(
        "/api/v2/admin/app-config/extraction-default-provider",
        headers=_headers("SUPERADMIN"),
        json={"provider": "m3"},
    )
    assert r.status_code == 200

    # 2) Lectura SÍNCRONA directa (sin await de async entre medias).
    # Debe retornar ("m3", "db") porque el PUT primeó la caché.
    provider, source = app_config_module.get_extraction_default_provider_sync()
    assert provider == "m3"
    assert source == "db"

    # 3) Limpieza.
    get_app_config_store().invalidate_all()


def test_put_then_put_back_to_gemini_primes_correctly(client, prisma_mock):
    """
    AC-8: PUT m3 → PUT gemini → sync retorna ("gemini","db") fresco.
    Verifica que el priming se aplica en cada PUT (no solo el primero).
    """
    import asyncio
    get_app_config_store().invalidate_all()

    # Primer PUT → m3.
    r1 = client.put(
        "/api/v2/admin/app-config/extraction-default-provider",
        headers=_headers("SUPERADMIN"),
        json={"provider": "m3"},
    )
    assert r1.status_code == 200
    p, s = app_config_module.get_extraction_default_provider_sync()
    assert (p, s) == ("m3", "db")

    # Segundo PUT → gemini (volviendo al default).
    r2 = client.put(
        "/api/v2/admin/app-config/extraction-default-provider",
        headers=_headers("SUPERADMIN"),
        json={"provider": "gemini"},
    )
    assert r2.status_code == 200
    p, s = app_config_module.get_extraction_default_provider_sync()
    assert (p, s) == ("gemini", "db")

    # Limpieza.
    get_app_config_store().invalidate_all()


def test_lifespan_warmup_primes_cache_on_startup(prisma_mock):
    """
    §7.4-(W): el warmup al startup (que llama `await get_extraction_default_provider()`
    tras `connect_prisma_client()`) deja la caché caliente. Tras el warmup, la sync
    retorna el valor de BD sin necesidad de un GET async intermedio. Cura cold-start.

    Aquí simulamos el warmup llamando directamente al helper async, ya que
    levantar el lifespan completo (con init_prisma + connect + 5 inyecciones)
    es fragile en pytest; lo que importa es el contrato "warmup llama la async,
    la async deja la caché caliente".
    """
    import asyncio
    store = get_app_config_store()
    store.invalidate_all()

    # Pre-poblar BD con row {provider:"m3"} (escenario cold-start).
    prisma_mock._store[EXTRACTION_DEFAULT_PROVIDER_KEY] = {
        "key": EXTRACTION_DEFAULT_PROVIDER_KEY,
        "value": {"provider": "m3"},
        "updatedBy": None,
        "updatedAt": None,
    }

    # 1) Pre-warmup: sync cae a fallback (caché vacía).
    p, s = app_config_module.get_extraction_default_provider_sync()
    assert (p, s) == (EXTRACTION_DEFAULT_PROVIDER_FALLBACK, "default")

    # 2) Simular el warmup del lifespan.
    asyncio.run(get_extraction_default_provider())

    # 3) Post-warmup: la sync retorna "m3" desde la caché caliente.
    p, s = app_config_module.get_extraction_default_provider_sync()
    assert p == "m3"
    assert s == "db"

    # Limpieza.
    store.invalidate_all()


def test_sync_getter_fallback_when_put_failed_and_cache_empty(client, prisma_mock):
    """
    Red de seguridad (§7.5): si por alguna razón el priming no ocurre (ej. PUT
    falló antes del commit) y la caché está vacía, la sync retorna
    ("gemini","default") sin excepción. No hay I/O ni bloqueo.
    """
    import asyncio
    get_app_config_store().invalidate_all()

    # Forzar fallo del PUT (provider inválido) — el priming NO se ejecuta.
    r = client.put(
        "/api/v2/admin/app-config/extraction-default-provider",
        headers=_headers("SUPERADMIN"),
        json={"provider": "openai"},  # inválido → 400 antes del priming
    )
    assert r.status_code == 400

    # Sync sigue retornando fallback "gemini" sin lanzar excepción.
    provider, source = app_config_module.get_extraction_default_provider_sync()
    assert provider == "gemini"
    assert source == "default"


def test_concurrent_sync_reads_after_invalidate_no_thundering_herd(client, prisma_mock):
    """
    §7.5: tras `invalidate(KEY)` (sin priming), 50 hilos llaman la sync
    concurrentemente. Todos retornan ("gemini","default") SIN I/O, sin excepción,
    sin contención ni thundering herd. Documenta que la sync no hace I/O.
    """
    import threading
    from app.services.ai import app_config as app_config_module
    from app.services.ai.app_config import (
        EXTRACTION_DEFAULT_PROVIDER_FALLBACK,
        EXTRACTION_DEFAULT_PROVIDER_KEY,
        get_app_config_store,
    )

    store = get_app_config_store()
    store.invalidate_all()

    # Forzar el escenario: invalidar SIN primar.
    store.invalidate(EXTRACTION_DEFAULT_PROVIDER_KEY)

    results: list = []
    errors: list = []

    def _reader():
        try:
            results.append(
                app_config_module.get_extraction_default_provider_sync()
            )
        except Exception as e:
            errors.append(e)

    threads = [threading.Thread(target=_reader) for _ in range(50)]
    for t in threads:
        t.start()
    for t in threads:
        t.join(timeout=5)

    assert errors == [], f"sync no debe lanzar excepciones: {errors}"
    assert len(results) == 50
    for r in results:
        assert r == (EXTRACTION_DEFAULT_PROVIDER_FALLBACK, "default")


def test_prime_helper_writes_fresh_value():
    """
    Test unitario del helper `AppConfigStore.prime(key, value)` añadido por
    el fix B†. Garantiza que `prime()` deja la caché en estado fresco
    (timestamp actual) y la sync lo lee inmediatamente.
    """
    import time
    store = get_app_config_store()
    store.invalidate_all()

    # Primar directamente.
    store.prime(EXTRACTION_DEFAULT_PROVIDER_KEY, {"provider": "m3"})

    # Verificar que el timestamp es fresco (caché no expirada).
    cached = store._cache.get(EXTRACTION_DEFAULT_PROVIDER_KEY)
    assert cached is not None
    ts, value = cached
    assert value == {"provider": "m3"}
    assert (time.monotonic() - ts) < store.ttl

    # La sync debe leerlo inmediatamente.
    p, s = app_config_module.get_extraction_default_provider_sync()
    assert (p, s) == ("m3", "db")

    # Limpieza.
    store.invalidate_all()
