"""
IMPL-20260707-18: Fase 2 NOVA absorción (ARCH-20260707-17) — D Trazabilidad.
Tests pytest para LabTraceEvent (CRUD + ciclo de vida).

Cubre (≥ 6 casos):
  1.  test_record_event_creates_trace_row
  2.  test_record_event_rejects_invalid_event_type
  3.  test_record_event_404_for_missing_order
  4.  test_list_trace_returns_chronological_order
  5.  test_list_trace_404_for_missing_order
  6.  test_auto_record_lifecycle_is_idempotent
  7.  test_auto_record_lifecycle_skips_unknown_order
  8.  test_list_trace_includes_user_fullname
"""
import os
import sys
import asyncio
from datetime import datetime
from typing import Any, Dict, List, Optional
from unittest.mock import MagicMock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.api.v1.lab.trace import router as trace_router  # noqa: E402
from app.services import lab_trace_service as svc  # noqa: E402


# ---------------------------------------------------------------------------
# Mock Prisma client (en memoria)
# ---------------------------------------------------------------------------
def _make_prisma_mock() -> MagicMock:
    tables: Dict[str, List[Dict[str, Any]]] = {
        "laborder": [],
        "labtraceevent": [],
        "user": [],
    }
    counters = {"id": 0}

    def _new_id() -> str:
        counters["id"] += 1
        return f"mock-{counters['id']}"

    def _apply_includes(item: Dict[str, Any], include) -> Dict[str, Any]:
        if not include:
            return dict(item)
        result = dict(item)
        if not isinstance(include, dict):
            return result
        for rel_name, sub_include in include.items():
            if rel_name in ("include", "where", "orderBy", "order_by", "take", "skip"):
                continue
            fk_map = {
                "user": ("user", "id", "userId"),
            }
            if rel_name not in fk_map:
                continue
            target_table, target_key, fk_col = fk_map[rel_name]
            if target_table not in tables:
                continue
            real_sub_include = sub_include
            if isinstance(sub_include, dict) and "include" in sub_include:
                real_sub_include = sub_include["include"]
            if fk_col is not None:
                fk_value = item.get(fk_col)
                if fk_value is None:
                    result[rel_name] = None
                else:
                    rel_row = next(
                        (r for r in tables[target_table] if r.get(target_key) == fk_value),
                        None,
                    )
                    result[rel_name] = rel_row
        return result

    def _matches(item: Dict[str, Any], where: Optional[Dict[str, Any]]) -> bool:
        if not where:
            return True
        for k, v in where.items():
            if isinstance(v, dict) and not any(op in v for op in ("in", "include", "where", "orderBy")):
                if not all(item.get(fk) == fv for fk, fv in v.items()):
                    return False
                continue
            if k == "in" and not isinstance(v, dict):
                continue
            if isinstance(v, dict) and "in" in v:
                if item.get(k) not in v["in"]:
                    return False
                continue
            if item.get(k) != v:
                return False
        return True

    prisma = MagicMock()

    def _make_delegate(name: str):
        delegate = MagicMock()
        delegate._items = tables[name]

        async def find_many(where=None, order_by=None, order=None, include=None, **_):
            matched = [it for it in tables[name] if _matches(it, where)]
            order_clause = order or order_by
            if order_clause:
                field, direction = next(iter(order_clause.items()))
                matched = sorted(
                    matched,
                    key=lambda x: (x.get(field) is None, x.get(field)),
                    reverse=(direction == "desc"),
                )
            return [_apply_includes(r, include) for r in matched]

        async def find_unique(where: Dict[str, Any], include=None, **_):
            for it in tables[name]:
                if _matches(it, where):
                    return _apply_includes(it, include)
            return None

        async def find_first(where: Dict[str, Any], include=None, **_):
            for it in tables[name]:
                if _matches(it, where):
                    return _apply_includes(it, include)
            return None

        async def create(data: Dict[str, Any]):
            new = dict(data)
            new.setdefault("id", _new_id())
            new.setdefault("timestamp", datetime.utcnow().isoformat())
            tables[name].append(new)
            return new

        delegate.find_many.side_effect = find_many
        delegate.find_unique.side_effect = find_unique
        delegate.find_first.side_effect = find_first
        delegate.create.side_effect = create
        return delegate

    for name in tables:
        setattr(prisma, name, _make_delegate(name))

    return prisma


def _build_test_app() -> FastAPI:
    test_app = FastAPI(title="lab-trace-tests")
    test_app.include_router(trace_router)
    return test_app


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------
@pytest.fixture
def prisma_mock() -> MagicMock:
    mock = _make_prisma_mock()
    svc.set_prisma_client(mock)
    return mock


@pytest.fixture
def client(prisma_mock) -> TestClient:
    return TestClient(_build_test_app())


# ---------------------------------------------------------------------------
# Seeders
# ---------------------------------------------------------------------------
def _seed_order(prisma: MagicMock, pid: str = "ord-1", worker_id: str = "w-1", status: str = "DRAFT"):
    asyncio.run(
        prisma.laborder.create(
            data={
                "id": pid,
                "folio": 1,
                "branch": "MATRIZ",
                "workerId": worker_id,
                "doctorName": "Dr Test",
                "status": status,
                "createdById": "u-1",
            }
        )
    )
    return pid


def _seed_user(prisma: MagicMock, pid: str = "u-1", full_name: str = "Dr. Test"):
    asyncio.run(
        prisma.user.create(
            data={"id": pid, "fullName": full_name, "email": f"{pid}@x.com", "role": "ADMIN"}
        )
    )
    return pid


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------
def test_record_event_creates_trace_row(client, prisma_mock):
    _seed_order(prisma_mock)
    _seed_user(prisma_mock, "u-1", "Dr. A")
    resp = client.post(
        "/api/v1/lab/orders/ord-1/trace",
        json={"event": "SAMPLE_RECEIVED", "notes": "Muestra ok", "location": "Mostrador 1"},
        headers={"x-ami-userid": "u-1"},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["event"] == "SAMPLE_RECEIVED"
    assert body["labOrderId"] == "ord-1"
    assert body["notes"] == "Muestra ok"
    assert body["location"] == "Mostrador 1"
    assert body["userId"] == "u-1"
    # Persistido en la tabla
    assert len(prisma_mock.labtraceevent._items) == 1


def test_record_event_rejects_invalid_event_type(client, prisma_mock):
    _seed_order(prisma_mock)
    resp = client.post(
        "/api/v1/lab/orders/ord-1/trace",
        json={"event": "INVALID_EVENT"},
        headers={"x-ami-userid": "u-1"},
    )
    # Pydantic v2 rechaza enums desconocidos con 422; el backstop de servicio
    # cubre llamadas internas (server actions) que no pasan por Pydantic.
    assert resp.status_code == 422


def test_record_event_404_for_missing_order(client, prisma_mock):
    resp = client.post(
        "/api/v1/lab/orders/nope/trace",
        json={"event": "SAMPLE_RECEIVED"},
        headers={"x-ami-userid": "u-1"},
    )
    assert resp.status_code == 404
    assert "no existe" in resp.json()["detail"]


def test_list_trace_returns_chronological_order(client, prisma_mock):
    _seed_order(prisma_mock)
    # Insertar 3 eventos con timestamps ISO 8601 válidos
    for i, ev in enumerate(["SAMPLE_RECEIVED", "PROCESS_STARTED", "ANALYSIS_DONE"]):
        asyncio.run(
            prisma_mock.labtraceevent.create(
                data={
                    "labOrderId": "ord-1",
                    "event": ev,
                    "timestamp": f"2026-07-07T10:00:0{i}",
                    "userId": None,
                }
            )
        )
    resp = client.get("/api/v1/lab/orders/ord-1/trace", headers={"x-ami-userid": "u-1"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 3
    assert body["rows"][0]["event"] == "SAMPLE_RECEIVED"
    assert body["rows"][1]["event"] == "PROCESS_STARTED"
    assert body["rows"][2]["event"] == "ANALYSIS_DONE"


def test_list_trace_404_for_missing_order(client, prisma_mock):
    resp = client.get("/api/v1/lab/orders/nope/trace", headers={"x-ami-userid": "u-1"})
    assert resp.status_code == 404


def test_auto_record_lifecycle_is_idempotent(client, prisma_mock):
    _seed_order(prisma_mock)
    _seed_user(prisma_mock)
    # Primer registro: crea fila
    first = asyncio.run(
        svc.auto_record_lifecycle(
            lab_order_id="ord-1",
            event="SAMPLE_RECEIVED",
            current_user={"id": "u-1", "role": "ADMIN"},
            prisma=prisma_mock,
        )
    )
    assert first is not None
    assert first["event"] == "SAMPLE_RECEIVED"
    # Segundo registro del mismo evento: NO duplica
    second = asyncio.run(
        svc.auto_record_lifecycle(
            lab_order_id="ord-1",
            event="SAMPLE_RECEIVED",
            current_user={"id": "u-1", "role": "ADMIN"},
            prisma=prisma_mock,
        )
    )
    assert second is None
    # Solo 1 fila persistida
    assert len(prisma_mock.labtraceevent._items) == 1


def test_auto_record_lifecycle_skips_unknown_order(prisma_mock):
    res = asyncio.run(
        svc.auto_record_lifecycle(
            lab_order_id="ghost",
            event="VALIDATED",
            current_user={"id": "u-1", "role": "ADMIN"},
            prisma=prisma_mock,
        )
    )
    assert res is None
    assert len(prisma_mock.labtraceevent._items) == 0


def test_list_trace_includes_user_fullname(client, prisma_mock):
    _seed_order(prisma_mock)
    _seed_user(prisma_mock, "u-7", "Dr. House")
    asyncio.run(
        prisma_mock.labtraceevent.create(
            data={
                "labOrderId": "ord-1",
                "event": "VALIDATED",
                "timestamp": "2026-07-07T12:00:00",
                "userId": "u-7",
            }
        )
    )
    resp = client.get("/api/v1/lab/orders/ord-1/trace", headers={"x-ami-userid": "u-1"})
    body = resp.json()
    assert body["rows"][0]["userId"] == "u-7"
    assert body["rows"][0]["userFullName"] == "Dr. House"
