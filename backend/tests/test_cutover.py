"""
IMPL-20260708-FINAL — Tests pytest para el endpoint de cutover.

Cubre ≥ 2 casos:
  1. test_get_cutover_status_returns_slices
  2. test_get_cutover_status_pending_slices_present
  3. test_get_cutover_status_nova_not_deprecated_until_all_done
"""
from __future__ import annotations

import os
import sys
from typing import Any, Dict

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

BACKEND_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
)
sys.path.insert(0, BACKEND_DIR)
sys.path.insert(0, os.path.join(BACKEND_DIR, "app"))

from app.api.v1.lab.cutover import router as cutover_router  # noqa: E402


def _build_app() -> FastAPI:
    test_app = FastAPI(title="lab-cutover-tests")
    test_app.include_router(cutover_router)
    return test_app


@pytest.fixture
def client():
    return TestClient(_build_app())


# ----------------------------------------------------------------------------
# 1. El endpoint devuelve los 9 slices
# ----------------------------------------------------------------------------
def test_get_cutover_status_returns_slices(client):
    """El status devuelve los 9 slices del roadmap."""
    resp = client.get("/api/v1/lab/cutover-status")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert "slices" in body
    assert "ready" in body
    assert "completed" in body
    assert "pending" in body
    assert "nova_deprecated" in body
    assert "next_actions" in body
    # 9 slices esperados
    expected_slices = {"A", "B-v2", "C", "D", "E", "F", "G", "H", "I"}
    assert set(body["slices"].keys()) == expected_slices
    # Cada slice tiene un status válido
    for k, v in body["slices"].items():
        assert v in ("closed", "partial", "in_progress", "pending"), \
            f"Slice {k} tiene status inválido: {v}"


# ----------------------------------------------------------------------------
# 2. Slices pendientes se reportan correctamente
# ----------------------------------------------------------------------------
def test_get_cutover_status_pending_slices_present(client):
    """En este momento, H e I deben estar pendientes (parcial/in_progress)."""
    resp = client.get("/api/v1/lab/cutover-status")
    body = resp.json()
    # Completed debe incluir los slices cerrados
    completed = set(body["completed"])
    pending = set(body["pending"])
    # Fases 1-3 cerradas
    assert "A" in completed
    assert "B-v2" in completed
    assert "C" in completed
    assert "D" in completed
    assert "E" in completed
    assert "F" in completed
    assert "G" in completed
    # Fase 4 en curso
    assert "H" in pending or body["slices"]["H"] in ("partial", "in_progress")
    assert "I" in pending or body["slices"]["I"] in ("partial", "in_progress")
    # ready=false mientras haya pendiente
    assert body["ready"] is False
    assert body["nova_deprecated"] is False
    # next_actions no vacío
    assert isinstance(body["next_actions"], list)
    assert len(body["next_actions"]) > 0


# ----------------------------------------------------------------------------
# 3. nova_deprecated=true solo cuando todos los slices están closed
# ----------------------------------------------------------------------------
def test_get_cutover_status_nova_not_deprecated_until_all_done():
    """Validar la lógica de ready/nova_deprecated."""
    from app.api.v1.lab.cutover import _build_response, SLICES_STATUS
    # Guardar estado original
    original = dict(SLICES_STATUS)

    try:
        # Forzar todo a closed → ready=true, nova_deprecated=true
        for k in SLICES_STATUS:
            SLICES_STATUS[k] = "closed"
        resp = _build_response()
        assert resp["ready"] is True
        assert resp["nova_deprecated"] is True
        assert resp["pending"] == []
        assert resp["next_actions"] == []

        # Forzar uno a in_progress → ready=false
        SLICES_STATUS["H"] = "in_progress"
        resp = _build_response()
        assert resp["ready"] is False
        assert resp["nova_deprecated"] is False
        assert "H" in resp["pending"]
        assert len(resp["next_actions"]) > 0
    finally:
        # Restaurar estado original
        SLICES_STATUS.clear()
        SLICES_STATUS.update(original)