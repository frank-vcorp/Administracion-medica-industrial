"""
IMPL-20260708-19: Fase 3 NOVA absorción (ARCH-20260707-17) — G Caja y Cortesías.

Tests pytest para los endpoints de caja y cortesías:
  - POST   /api/v1/lab/orders/{id}/payments
  - GET    /api/v1/lab/orders/{id}/payments
  - POST   /api/v1/lab/orders/{id}/courtesy
  - DELETE /api/v1/lab/orders/{id}/courtesy
  - GET    /api/v1/lab/cash-closing

Cubre ≥ 6 casos:
  1. register_payment_creates_row
  2. register_payment_rejects_zero_amount
  3. list_payments_aggregates_paid_total
  4. list_payments_404_for_missing_order
  5. mark_courtesy_creates_courtesy_and_updates_order
  6. mark_courtesy_idempotent
  7. clear_courtesy_removes
  8. cash_closing_aggregates_by_method
  9. cash_closing_separates_courtesy_orders
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

from app.api.v1.lab.cash import router as cash_router  # noqa: E402
from app.services import lab_cash_service as svc  # noqa: E402


# ---------------------------------------------------------------------------
# Mock Prisma client (en memoria)
# ---------------------------------------------------------------------------
def _make_prisma_mock() -> MagicMock:
    tables: Dict[str, List[Dict[str, Any]]] = {
        "laborder": [],
        "labcashmovement": [],
        "courtesy": [],
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
        for rel_name in include.keys():
            if rel_name in ("include", "where", "orderBy", "order_by", "take", "skip"):
                continue
            fk_map = {
                "user": ("user", "id", "userId"),
                "labOrder": ("laborder", "id", "labOrderId"),
                "approvedBy": ("user", "id", "approvedById"),
            }
            if rel_name not in fk_map:
                continue
            target_table, target_key, fk_col = fk_map[rel_name]
            fk_value = item.get(fk_col)
            if fk_value is not None:
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
            if isinstance(v, dict):
                # Normalizar fechas (string ISO vs datetime)
                if "gte" in v:
                    item_v = item.get(k)
                    gte_v = v["gte"]
                    if item_v is None:
                        return False
                    if isinstance(item_v, str) and isinstance(gte_v, datetime):
                        # convertir item_v a datetime si es ISO
                        try:
                            item_v = datetime.fromisoformat(item_v.replace("Z", "+00:00"))
                        except (ValueError, AttributeError):
                            return False
                    if item_v < gte_v:
                        return False
                if "lte" in v:
                    item_v = item.get(k)
                    lte_v = v["lte"]
                    if item_v is None:
                        return False
                    if isinstance(item_v, str) and isinstance(lte_v, datetime):
                        try:
                            item_v = datetime.fromisoformat(item_v.replace("Z", "+00:00"))
                        except (ValueError, AttributeError):
                            return False
                    if item_v > lte_v:
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

        async def create(data: Dict[str, Any], include=None):
            new = dict(data)
            new.setdefault("id", _new_id())
            if name == "labcashmovement":
                new.setdefault("createdAt", datetime.utcnow().isoformat())
                new.setdefault("currency", "MXN")
            if name == "courtesy":
                new.setdefault("createdAt", datetime.utcnow().isoformat())
            tables[name].append(new)
            return _apply_includes(new, include)

        async def update(where: Dict[str, Any], data: Dict[str, Any]):
            for it in tables[name]:
                if _matches(it, where):
                    it.update(data)
                    return dict(it)
            return None

        async def delete(where: Dict[str, Any]):
            for it in list(tables[name]):
                if _matches(it, where):
                    tables[name].remove(it)
                    return it
            return None

        delegate.find_many.side_effect = find_many
        delegate.find_unique.side_effect = find_unique
        delegate.create.side_effect = create
        delegate.update.side_effect = update
        delegate.delete.side_effect = delete
        return delegate

    for name in tables:
        setattr(prisma, name, _make_delegate(name))

    return prisma


def _build_test_app() -> FastAPI:
    test_app = FastAPI(title="lab-cash-tests")
    test_app.include_router(cash_router)
    return test_app


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------
@pytest.fixture
def prisma_mock():
    return _make_prisma_mock()


@pytest.fixture
def client(prisma_mock):
    svc.set_prisma_client(prisma_mock)
    return TestClient(_build_test_app())


# ---------------------------------------------------------------------------
# Seeders
# ---------------------------------------------------------------------------
def _seed_order(prisma: MagicMock, pid: str = "ord-1", total: float = 116.0, is_courtesy: bool = False):
    prisma.laborder._items.append({
        "id": pid,
        "folio": 1,
        "branch": "MATRIZ",
        "workerId": "w-1",
        "doctorName": "Dr Test",
        "status": "SAVED",
        "urgency": "NORMAL",
        "subtotal": 100.0,
        "ivaPct": 16.0,
        "iva": 16.0,
        "total": total,
        "isCourtesy": is_courtesy,
        "createdAt": "2026-07-07T10:00:00",
    })


def _seed_user(prisma: MagicMock, uid: str = "u-1", full_name: str = "Cajero"):
    prisma.user._items.append({"id": uid, "fullName": full_name})


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------
def test_register_payment_creates_row(client, prisma_mock):
    _seed_order(prisma_mock)
    _seed_user(prisma_mock)
    resp = client.post(
        "/api/v1/lab/orders/ord-1/payments",
        json={"amount": 50.0, "method": "CASH", "reference": None},
        headers={"x-ami-userid": "u-1"},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["amount"] == 50.0
    assert body["method"] == "CASH"
    assert body["labOrderId"] == "ord-1"
    assert body["userId"] == "u-1"
    assert len(prisma_mock.labcashmovement._items) == 1


def test_register_payment_rejects_zero_amount(client, prisma_mock):
    _seed_order(prisma_mock)
    resp = client.post(
        "/api/v1/lab/orders/ord-1/payments",
        json={"amount": 0, "method": "CASH"},
        headers={"x-ami-userid": "u-1"},
    )
    # Pydantic v2 valida gt=0 → 422
    assert resp.status_code == 422


def test_register_payment_404_for_missing_order(client, prisma_mock):
    resp = client.post(
        "/api/v1/lab/orders/ghost/payments",
        json={"amount": 50.0, "method": "CASH"},
        headers={"x-ami-userid": "u-1"},
    )
    assert resp.status_code == 404


def test_list_payments_aggregates_paid_total(client, prisma_mock):
    _seed_order(prisma_mock, total=200.0)
    _seed_user(prisma_mock)
    # 3 pagos: 50 + 80 + 30 = 160. saldo = 200 - 160 = 40
    for amt in (50.0, 80.0, 30.0):
        resp = client.post(
            "/api/v1/lab/orders/ord-1/payments",
            json={"amount": amt, "method": "CASH"},
            headers={"x-ami-userid": "u-1"},
        )
        assert resp.status_code == 200, resp.text

    resp = client.get("/api/v1/lab/orders/ord-1/payments")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["total"] == 3
    assert body["paidTotal"] == 160.0
    assert body["orderTotal"] == 200.0
    assert body["balance"] == 40.0


def test_list_payments_404_for_missing_order(client, prisma_mock):
    resp = client.get("/api/v1/lab/orders/ghost/payments")
    assert resp.status_code == 404


def test_mark_courtesy_creates_courtesy_and_updates_order(client, prisma_mock):
    _seed_order(prisma_mock)
    _seed_user(prisma_mock)
    resp = client.post(
        "/api/v1/lab/orders/ord-1/courtesy",
        json={"reason": "Convenio corporativo VIP"},
        headers={"x-ami-userid": "u-1"},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["reason"] == "Convenio corporativo VIP"
    assert body["labOrderId"] == "ord-1"
    assert body["approvedById"] == "u-1"
    # La LabOrder ahora es cortesía
    order = next(o for o in prisma_mock.laborder._items if o["id"] == "ord-1")
    assert order["isCourtesy"] is True
    assert "VIP" in order["courtesyType"]


def test_mark_courtesy_is_idempotent(client, prisma_mock):
    _seed_order(prisma_mock)
    _seed_user(prisma_mock)
    # 1ra llamada crea
    r1 = client.post(
        "/api/v1/lab/orders/ord-1/courtesy",
        json={"reason": "Cortesía inicial"},
        headers={"x-ami-userid": "u-1"},
    )
    assert r1.status_code == 200
    first_id = r1.json()["id"]
    # 2da llamada retorna la MISMA (no duplica)
    r2 = client.post(
        "/api/v1/lab/orders/ord-1/courtesy",
        json={"reason": "Otro intento"},
        headers={"x-ami-userid": "u-1"},
    )
    assert r2.status_code == 200
    assert r2.json()["id"] == first_id
    assert len(prisma_mock.courtesy._items) == 1


def test_clear_courtesy_removes(client, prisma_mock):
    _seed_order(prisma_mock)
    _seed_user(prisma_mock)
    # Marcar primero
    client.post(
        "/api/v1/lab/orders/ord-1/courtesy",
        json={"reason": "Para quitar"},
        headers={"x-ami-userid": "u-1"},
    )
    assert len(prisma_mock.courtesy._items) == 1
    # Quitar
    resp = client.delete("/api/v1/lab/orders/ord-1/courtesy")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["removed"] is True
    assert len(prisma_mock.courtesy._items) == 0
    # La orden vuelve a NO ser cortesía
    order = next(o for o in prisma_mock.laborder._items if o["id"] == "ord-1")
    assert order["isCourtesy"] is False


def test_clear_courtesy_returns_removed_false_when_none(client, prisma_mock):
    _seed_order(prisma_mock)
    resp = client.delete("/api/v1/lab/orders/ord-1/courtesy")
    assert resp.status_code == 200
    assert resp.json()["removed"] is False


def test_cash_closing_aggregates_by_method(prisma_mock):
    """Test unit del servicio: agrega por método y separa cortesía."""
    _seed_order(prisma_mock, "ord-A", total=100.0, is_courtesy=False)
    _seed_order(prisma_mock, "ord-B", total=200.0, is_courtesy=False)
    _seed_order(prisma_mock, "ord-C", total=300.0, is_courtesy=True)  # cortesía, NO suma a billed
    _seed_user(prisma_mock)

    # 4 pagos: 100 cash + 50 card + 80 cash + 200 transfer (en ord-C pero ord-C es cortesía → igual cuenta como collected)
    seed_data = [
        ("p-1", "ord-A", 100.0, "CASH"),
        ("p-2", "ord-B", 50.0, "CARD"),
        ("p-3", "ord-B", 80.0, "CASH"),
        ("p-4", "ord-C", 200.0, "TRANSFER"),
    ]
    for pid, oid, amt, method in seed_data:
        prisma_mock.labcashmovement._items.append({
            "id": pid,
            "labOrderId": oid,
            "amount": amt,
            "method": method,
            "reference": None,
            "currency": "MXN",
            "userId": "u-1",
            "createdAt": datetime.utcnow().isoformat(),
        })

    result = asyncio.run(svc.cash_closing(None, None, prisma=prisma_mock))

    assert result["paymentsCount"] == 4
    assert result["totalOrders"] == 3  # 3 órdenes distintas
    assert result["billedOrders"] == 2  # ord-A y ord-B
    assert result["courtesyOrders"] == 1  # ord-C
    assert result["totalBilled"] == 300.0  # 100 + 200
    assert result["totalCollected"] == 430.0  # 100+50+80+200
    assert result["balancePending"] == 0.0  # 300 - 430 = negativo → max 0

    # byMethod (rows son CashClosingMethodTotal, soporta dict-like)
    methods = {}
    for row in result["byMethod"]:
        m = row["method"] if isinstance(row, dict) else row.method
        methods[m] = row if isinstance(row, dict) else {"count": row.count, "total": row.total}
    assert methods["CASH"]["count"] == 2
    assert methods["CASH"]["total"] == 180.0
    assert methods["CARD"]["count"] == 1
    assert methods["CARD"]["total"] == 50.0
    assert methods["TRANSFER"]["count"] == 1
    assert methods["TRANSFER"]["total"] == 200.0


def test_cash_closing_empty_returns_zeros(client, prisma_mock):
    resp = client.get("/api/v1/lab/cash-closing")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["totalOrders"] == 0
    assert body["paymentsCount"] == 0
    assert body["totalBilled"] == 0.0
    assert body["totalCollected"] == 0.0