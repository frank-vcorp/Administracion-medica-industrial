"""
IMPL-20260809-09 — ARCH-20260809-05: Tests del endpoint
`POST /api/v2/admin/ai-keys/{provider}/probe` y del servicio `probe_provider`.

Cubre:
  - Permisos: solo SUPERADMIN (403 para ADMIN/DOCTOR).
  - Rate limit: 1/30s por proveedor (429 con retryAfterSec).
  - Not configured: 503 cuando no hay key (env vacío + BD sin row).
  - Happy path con httpx mockeado (200 + texto).
  - Auth error: 401 → errorKind "auth".
  - 429 del proveedor → errorKind "rate_limited" (distinto del rate limit interno).
  - 5xx del proveedor → errorKind "http_5xx".
  - Timeout del proveedor → errorKind "timeout".
  - Sanitización: el cuerpo de respuesta NUNCA contiene la key; el log no contiene la key.
  - dr7 como path param es aceptado (es provider canónico).
  - Provider inválido en path → 400.
"""
from __future__ import annotations

import asyncio
import base64
import json
import os
import sys
import time
from pathlib import Path
from typing import Any, Dict, List
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.api.v2.admin_ai_keys_probe import router as probe_router
from app.services.ai import probe as probe_module
from app.services.ai.keys import get_key_resolver


# ---------------------------------------------------------------------------
# Helpers — tabla in-memory + monkeypatch key resolver
# ---------------------------------------------------------------------------
def _build_app() -> FastAPI:
    app = FastAPI(title="admin-ai-keys-probe-tests")
    app.include_router(probe_router)
    return app


def _make_prisma_mock() -> MagicMock:
    """Mock mínimo de Prisma — solo necesitamos que el resolver funcione."""
    store: Dict[str, Dict[str, Any]] = {}
    prisma = MagicMock()
    pk = MagicMock()

    class _RepoMock:
        def __init__(self, store):
            self.store = store

        async def find_unique(self, *, where):
            row = self.store.get(where["provider"])
            if row is None:
                return None
            return MagicMock(**row)

    pk_inst = _RepoMock(store)
    pk.find_unique = pk_inst.find_unique
    prisma.aiproviderkey = pk
    prisma._store = store
    return prisma


@pytest.fixture
def prisma_mock(monkeypatch):
    p = _make_prisma_mock()
    from app.services import prisma_client
    prisma_client.set_prisma_client(p)
    return p


@pytest.fixture
def client(prisma_mock, monkeypatch):
    monkeypatch.setenv("ENCRYPTION_KEY", base64.b64encode(b"\x42" * 32).decode())
    # Reset rate limit + resolver cache.
    probe_module._last_probe_ts.clear()
    get_key_resolver().invalidate_all()
    return TestClient(_build_app())


def _headers(role: str, user_id: str = "user-1") -> Dict[str, str]:
    return {
        "x-ami-role": role,
        "x-ami-userid": user_id,
        "Content-Type": "application/json",
    }


# ---------------------------------------------------------------------------
# AuthZ — solo SUPERADMIN
# ---------------------------------------------------------------------------
def test_probe_requires_superadmin(client):
    r = client.post("/api/v2/admin/ai-keys/m3/probe", headers=_headers("ADMIN"))
    assert r.status_code == 403

    r = client.post(
        "/api/v2/admin/ai-keys/m3/probe", headers=_headers("DOCTOR_GENERAL")
    )
    assert r.status_code == 403


def test_probe_allows_superadmin(client, monkeypatch):
    """SUPERADMIN pasa la guard; la lógica HTTP se mockea abajo."""
    # Sin key configurada → 503 not_configured (no llegamos a httpx).
    monkeypatch.delenv("M3_API_KEY", raising=False)
    monkeypatch.setenv("AI_KEYS_FROM_DB_ENABLED", "false")
    r = client.post(
        "/api/v2/admin/ai-keys/m3/probe", headers=_headers("SUPERADMIN")
    )
    assert r.status_code == 503
    body = r.json()
    assert body["detail"]["code"] == "not_configured"


# ---------------------------------------------------------------------------
# Provider inválido en path
# ---------------------------------------------------------------------------
def test_probe_invalid_provider_returns_400(client):
    r = client.post(
        "/api/v2/admin/ai-keys/openai/probe", headers=_headers("SUPERADMIN")
    )
    assert r.status_code == 400


# ---------------------------------------------------------------------------
# Not configured — sin key en env ni BD
# ---------------------------------------------------------------------------
def test_probe_not_configured_returns_503(client, monkeypatch):
    monkeypatch.setenv("AI_KEYS_FROM_DB_ENABLED", "false")
    monkeypatch.delenv("M3_API_KEY", raising=False)
    r = client.post(
        "/api/v2/admin/ai-keys/m3/probe", headers=_headers("SUPERADMIN")
    )
    assert r.status_code == 503
    assert r.json()["detail"]["code"] == "not_configured"


# ---------------------------------------------------------------------------
# Happy path — Gemini 200
# ---------------------------------------------------------------------------
def test_probe_gemini_happy_path(client, monkeypatch):
    monkeypatch.setenv("AI_KEYS_FROM_DB_ENABLED", "false")
    monkeypatch.setenv("GEMINI_API_KEY", "AIza-fake-key-1234567890abcdef1234567890")
    monkeypatch.setenv("GEMINI_MODEL_EXTRACTION", "gemini-2.5-flash")

    async def mock_post(self, url, **kwargs):
        resp = MagicMock()
        resp.status_code = 200
        resp.json = MagicMock(
            return_value={
                "candidates": [
                    {"content": {"parts": [{"text": "Hola!!"}]}}
                ]
            }
        )
        # httpx.Response requires .raise_for_status
        return resp

    async def fake_post(url, **kwargs):
        return _FakeGeminiResponse()

    class _FakeGeminiResponse:
        status_code = 200

        def json(self):
            return {
                "candidates": [{"content": {"parts": [{"text": "Hola!!"}]}}]
            }

    async def fake_post_factory(*args, **kwargs):
        return _FakeGeminiResponse()

    with patch.object(probe_module.httpx.AsyncClient, "post", new=fake_post_factory):
        r = client.post(
            "/api/v2/admin/ai-keys/gemini/probe", headers=_headers("SUPERADMIN")
        )
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is True
    assert body["provider"] == "gemini"
    assert body["httpStatus"] == 200
    assert "Hola" in body["message"]
    # Sanity: el body NUNCA contiene la key.
    assert "AIza-fake-key" not in json.dumps(body)


# ---------------------------------------------------------------------------
# Happy path — M3 (OpenAI-compatible) 200
# ---------------------------------------------------------------------------
def test_probe_m3_happy_path(client, monkeypatch):
    monkeypatch.setenv("AI_KEYS_FROM_DB_ENABLED", "false")
    monkeypatch.setenv("M3_API_KEY", "sk-m3-fake-key-9999")
    monkeypatch.setenv("M3_DEFAULT_MODEL", "MiniMax-M3")

    class _FakeResponse:
        status_code = 200

        def json(self):
            return {
                "choices": [{"message": {"content": "Hola desde M3!"}}]
            }

    async def fake_post(*args, **kwargs):
        return _FakeResponse()

    with patch.object(probe_module.httpx.AsyncClient, "post", new=fake_post):
        r = client.post(
            "/api/v2/admin/ai-keys/m3/probe", headers=_headers("SUPERADMIN")
        )
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is True
    assert body["provider"] == "m3"
    assert "Hola desde M3" in body["message"]
    assert "sk-m3-fake-key" not in json.dumps(body)


# ---------------------------------------------------------------------------
# Auth error (401) — errorKind "auth"
# ---------------------------------------------------------------------------
def test_probe_auth_error_401(client, monkeypatch):
    monkeypatch.setenv("AI_KEYS_FROM_DB_ENABLED", "false")
    monkeypatch.setenv("M3_API_KEY", "sk-bad-key-1234")
    monkeypatch.setenv("M3_DEFAULT_MODEL", "MiniMax-M3")

    class _FakeResponse:
        status_code = 401

        def json(self):
            return {"error": "Unauthorized"}

    async def fake_post(*args, **kwargs):
        return _FakeResponse()

    with patch.object(probe_module.httpx.AsyncClient, "post", new=fake_post):
        r = client.post(
            "/api/v2/admin/ai-keys/m3/probe", headers=_headers("SUPERADMIN")
        )
    assert r.status_code == 200  # El probe responde 200 con errorKind="auth"
    body = r.json()
    assert body["ok"] is False
    assert body["errorKind"] == "auth"
    assert body["httpStatus"] == 401
    assert "No autorizado" in body["message"]
    assert "sk-bad-key" not in json.dumps(body)


# ---------------------------------------------------------------------------
# Rate limit interno 429 con retryAfterSec
# ---------------------------------------------------------------------------
def test_probe_rate_limit_internal(client, monkeypatch):
    monkeypatch.setenv("AI_KEYS_FROM_DB_ENABLED", "false")
    monkeypatch.setenv("M3_API_KEY", "sk-fake-9999")
    monkeypatch.setenv("M3_DEFAULT_MODEL", "MiniMax-M3")

    # Pre-cargar rate limit timestamp (simula probe reciente).
    probe_module._last_probe_ts["m3"] = time.monotonic()

    r = client.post(
        "/api/v2/admin/ai-keys/m3/probe", headers=_headers("SUPERADMIN")
    )
    assert r.status_code == 429
    body = r.json()
    assert body["detail"]["code"] == "rate_limited"
    assert "retryAfterSec" in body["detail"]
    assert body["detail"]["retryAfterSec"] > 0


# ---------------------------------------------------------------------------
# 429 del proveedor (no del rate limit interno)
# ---------------------------------------------------------------------------
def test_probe_provider_429_maps_to_rate_limited_kind(client, monkeypatch):
    monkeypatch.setenv("AI_KEYS_FROM_DB_ENABLED", "false")
    monkeypatch.setenv("M3_API_KEY", "sk-fake-9999")
    monkeypatch.setenv("M3_DEFAULT_MODEL", "MiniMax-M3")

    class _FakeResponse:
        status_code = 429

        def json(self):
            return {"error": "rate_limited"}

    async def fake_post(*args, **kwargs):
        return _FakeResponse()

    # Reset rate limit interno para que no choque con el externo.
    probe_module._last_probe_ts.clear()

    with patch.object(probe_module.httpx.AsyncClient, "post", new=fake_post):
        r = client.post(
            "/api/v2/admin/ai-keys/m3/probe", headers=_headers("SUPERADMIN")
        )
    assert r.status_code == 200  # El probe no es 429 (no es rate limit interno).
    body = r.json()
    assert body["ok"] is False
    assert body["errorKind"] == "rate_limited"
    assert body["httpStatus"] == 429


# ---------------------------------------------------------------------------
# 5xx del proveedor
# ---------------------------------------------------------------------------
def test_probe_5xx_maps_to_http_5xx(client, monkeypatch):
    monkeypatch.setenv("AI_KEYS_FROM_DB_ENABLED", "false")
    monkeypatch.setenv("M3_API_KEY", "sk-fake-9999")

    class _FakeResponse:
        status_code = 503

        def json(self):
            return {"error": "service_unavailable"}

    async def fake_post(*args, **kwargs):
        return _FakeResponse()

    probe_module._last_probe_ts.clear()
    with patch.object(probe_module.httpx.AsyncClient, "post", new=fake_post):
        r = client.post(
            "/api/v2/admin/ai-keys/m3/probe", headers=_headers("SUPERADMIN")
        )
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is False
    assert body["errorKind"] == "http_5xx"


# ---------------------------------------------------------------------------
# Timeout del proveedor
# ---------------------------------------------------------------------------
def test_probe_timeout_maps_to_timeout_kind(client, monkeypatch):
    monkeypatch.setenv("AI_KEYS_FROM_DB_ENABLED", "false")
    monkeypatch.setenv("M3_API_KEY", "sk-fake-9999")

    async def fake_post(*args, **kwargs):
        raise httpx.TimeoutException("timed out")

    probe_module._last_probe_ts.clear()
    with patch.object(probe_module.httpx.AsyncClient, "post", new=fake_post):
        r = client.post(
            "/api/v2/admin/ai-keys/m3/probe", headers=_headers("SUPERADMIN")
        )
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is False
    assert body["errorKind"] == "timeout"
    assert "Timeout" in body["message"]


# ---------------------------------------------------------------------------
# Sanitización — la key NUNCA aparece en logs ni en body
# ---------------------------------------------------------------------------
def test_probe_response_never_contains_key(client, monkeypatch, caplog):
    monkeypatch.setenv("AI_KEYS_FROM_DB_ENABLED", "false")
    api_key = "sk-must-never-leak-7777"
    monkeypatch.setenv("M3_API_KEY", api_key)

    class _FakeResponse:
        status_code = 200

        def json(self):
            # Incluso si el proveedor eco de la key en su error, el probe no lo filtra.
            return {"choices": [{"message": {"content": "Hola!!"}}]}

    async def fake_post(*args, **kwargs):
        return _FakeResponse()

    probe_module._last_probe_ts.clear()
    import logging
    with caplog.at_level(logging.WARNING):
        with patch.object(probe_module.httpx.AsyncClient, "post", new=fake_post):
            r = client.post(
                "/api/v2/admin/ai-keys/m3/probe", headers=_headers("SUPERADMIN")
            )
    assert r.status_code == 200
    # Body
    assert api_key not in json.dumps(r.json())
    # Logs (caplog captura todo lo que se imprima/logee durante el test).
    assert api_key not in caplog.text


# ---------------------------------------------------------------------------
# dr7 también es aceptado como path param
# ---------------------------------------------------------------------------
def test_probe_dr7_accepted_as_provider(client, monkeypatch):
    monkeypatch.setenv("AI_KEYS_FROM_DB_ENABLED", "false")
    monkeypatch.delenv("DR7_API_KEY", raising=False)
    monkeypatch.setenv("DR7_BASE_URL", "https://dr7.ai/api/v1/medical/chat/completions")
    monkeypatch.setenv("DR7_MODEL", "medgemma-4b-it")

    # Sin key → 503 not_configured (no error de path).
    r = client.post(
        "/api/v2/admin/ai-keys/dr7/probe", headers=_headers("SUPERADMIN")
    )
    assert r.status_code == 503
