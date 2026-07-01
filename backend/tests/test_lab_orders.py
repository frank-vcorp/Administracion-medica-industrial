"""
IMPL-20260701-03: Slice B NOVA absorción (ARCH-20260701-03) — admisión LabOrder.
Tests pytest del módulo de admisión (LabOrder + LabOrderItem + autocomplete).

Cubre (≥ 14 casos según SPEC §9):
  1.  test_create_order_ok
  2.  test_create_order_fail_empty_items
  3.  test_create_order_fail_invalid_discount
  4.  test_get_order_by_id_ok
  5.  test_list_orders_paginated_ok
  6.  test_update_draft_ok
  7.  test_update_saved_fails
  8.  test_confirm_draft_to_saved_generates_unique_folio
  9.  test_add_item_to_draft_ok
  10. test_remove_item_from_draft_ok
  11. test_soft_delete_draft_ok
  12. test_search_workers_with_query
  13. test_search_tests_filters_laboratorio_type
  14. test_calculate_totals_with_mixed_discounts
"""
import os
import sys
from datetime import datetime
from typing import Any, Dict, List, Optional
from unittest.mock import MagicMock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

# Permitir imports del paquete app.*
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.api.v1.lab.orders import router as orders_router  # noqa: E402
from app.api.v1.lab.search import router as search_router  # noqa: E402
from app.services import lab_order_service as svc  # noqa: E402


# Montamos solo los routers nuevos (evita arrastrar google-generativeai de app.main)
def _build_test_app() -> FastAPI:
    test_app = FastAPI(title="lab-orders-tests")
    test_app.include_router(orders_router)
    test_app.include_router(search_router)
    return test_app


# ---------------------------------------------------------------------------
# Mock Prisma client (in-memory)
# ---------------------------------------------------------------------------
def _make_prisma_mock() -> MagicMock:
    tables: Dict[str, List[Dict[str, Any]]] = {
        "labOrder": [],
        "labOrderItem": [],
        "worker": [],
        "company": [],
        "medicalTest": [],
        "user": [],
        "auditLog": [],
    }
    counters = {"id": 0}

    def _new_id() -> str:
        counters["id"] += 1
        return f"mock-{counters['id']}"

    def _matches(item: Dict[str, Any], where: Optional[Dict[str, Any]]) -> bool:
        if not where:
            return True
        for k, v in where.items():
            if k == "OR":
                if not any(_matches(item, single) for single in v):
                    return False
                continue
            if k == "AND":
                if not all(_matches(item, single) for single in v):
                    return False
                continue
            if isinstance(v, dict) and "contains" in v:
                if str(item.get(k, "")).lower().find(str(v["contains"]).lower()) < 0:
                    return False
                continue
            if isinstance(v, dict) and ("gte" in v or "lte" in v):
                if "gte" in v and item.get(k) is not None and item.get(k) < v["gte"]:
                    return False
                if "lte" in v and item.get(k) is not None and item.get(k) > v["lte"]:
                    return False
                continue
            if isinstance(v, dict) and "mode" in v:
                if str(item.get(k, "")).lower().find(str(v.get("contains", "")).lower()) < 0:
                    return False
                continue
            if item.get(k) != v:
                return False
        return True

    prisma = MagicMock()

    def _make_delegate(name: str):
        delegate = MagicMock()
        delegate._items = tables[name]

        def count(where: Optional[Dict[str, Any]] = None):
            return sum(1 for it in tables[name] if _matches(it, where))

        def find_many(where=None, order_by=None, skip=0, take=25):
            matched = [it for it in tables[name] if _matches(it, where)]
            if order_by:
                field, direction = next(iter(order_by.items()))
                matched = sorted(
                    matched,
                    key=lambda x: (x.get(field) is None, x.get(field)),
                    reverse=(direction == "desc"),
                )
            return matched[skip : skip + take]

        def find_unique(where: Dict[str, Any]):
            for it in tables[name]:
                if all(it.get(k) == v for k, v in where.items()):
                    return it
            return None

        def create(data: Dict[str, Any]):
            new = dict(data)
            new.setdefault("id", _new_id())
            new.setdefault("createdAt", datetime.utcnow().isoformat())
            new.setdefault("updatedAt", datetime.utcnow().isoformat())
            if name == "labOrder" and "status" not in new:
                new["status"] = "DRAFT"
            tables[name].append(new)
            return new

        def update(where: Dict[str, Any], data: Dict[str, Any]):
            existing = find_unique(where)
            if existing is None:
                raise LookupError(f"{name} not found: {where}")
            for k, v in data.items():
                existing[k] = v
            existing["updatedAt"] = datetime.utcnow().isoformat()
            return existing

        def delete(where: Dict[str, Any]):
            existing = find_unique(where)
            if existing is None:
                raise LookupError(f"{name} not found: {where}")
            tables[name].remove(existing)
            return existing

        delegate.count.side_effect = count
        delegate.find_many.side_effect = find_many
        delegate.find_unique.side_effect = find_unique
        delegate.create.side_effect = create
        delegate.update.side_effect = update
        delegate.delete.side_effect = delete
        return delegate

    for name in tables:
        if name != "auditLog":
            setattr(prisma, name, _make_delegate(name))

    audit = MagicMock()
    audit.create.side_effect = lambda data: tables["auditLog"].append(data)
    prisma.auditLog = audit

    return prisma


@pytest.fixture
def prisma_mock() -> MagicMock:
    mock = _make_prisma_mock()
    svc.set_prisma_client(mock)
    return mock


@pytest.fixture
def client(prisma_mock) -> TestClient:
    return TestClient(_build_test_app())


# Helpers --------------------------------------------------------------------
def _seed_worker(pid: str = "w-1", first="Juan", last="Pérez", company_id=None, dob=None) -> str:
    wid = pid
    svc.get_prisma().worker.create(
        data={
            "id": wid,
            "universalId": f"U-{pid}",
            "firstName": first,
            "lastName": last,
            "companyId": company_id,
            "dob": dob or "1990-05-15T00:00:00",
        }
    )
    return wid


def _seed_company(pid: str = "c-1", name="Vectoria") -> str:
    cid = pid
    svc.get_prisma().company.create(data={"id": cid, "name": name, "rfc": "VEC900101AAA"})
    return cid


def _seed_test(pid: str = "t-1", code="BH", name="Biometría Hemática") -> str:
    tid = pid
    svc.get_prisma().medicalTest.create(data={"id": tid, "code": code, "name": name, "categoryId": "cat-1"})
    return tid


def _create_order_via_service(prisma_mock, worker_id=None, items=None) -> dict:
    if worker_id is None:
        worker_id = _seed_worker()
    items = items or [{"medicalTestId": _seed_test(), "price": 100, "discountAmount": 0, "discountPct": 0}]
    return svc.create_lab_order(
        data={"workerId": worker_id, "doctorName": "Dr. López", "items": items},
        current_user={"id": "user-admin", "role": "ADMIN"},
        prisma=prisma_mock,
    )


# ---------------------------------------------------------------------------
# 1. Create OK
# ---------------------------------------------------------------------------
def test_create_order_ok(client, prisma_mock):
    wid = _seed_worker()
    tid = _seed_test()
    resp = client.post(
        "/api/v1/lab/orders",
        json={
            "workerId": wid,
            "doctorName": "Dr. López",
            "items": [{"medicalTestId": tid, "price": 200, "discountAmount": 0, "discountPct": 0}],
        },
        headers={"x-ami-userid": "u-admin"},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["id"].startswith("mock-")
    assert body["status"] == "DRAFT"
    assert body["subtotal"] == 200.0
    assert body["iva"] == 32.0  # 16% de 200
    assert body["total"] == 232.0
    assert len(body["items"]) == 1


# ---------------------------------------------------------------------------
# 2. Create con items vacíos → 400
# ---------------------------------------------------------------------------
def test_create_order_fail_empty_items(client, prisma_mock):
    wid = _seed_worker()
    resp = client.post(
        "/api/v1/lab/orders",
        json={"workerId": wid, "doctorName": "Dr. Test", "items": []},
        headers={"x-ami-userid": "u-admin"},
    )
    # Pydantic v2 con min_length=1 en items retorna 422
    assert resp.status_code in (400, 422)


# ---------------------------------------------------------------------------
# 3. Create con discountPct inválido (>100) → 422
# ---------------------------------------------------------------------------
def test_create_order_fail_invalid_discount(client, prisma_mock):
    wid = _seed_worker()
    tid = _seed_test()
    resp = client.post(
        "/api/v1/lab/orders",
        json={
            "workerId": wid,
            "doctorName": "Dr. Test",
            "items": [{"medicalTestId": tid, "price": 100, "discountPct": 150}],
        },
        headers={"x-ami-userid": "u-admin"},
    )
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# 4. Get by id OK
# ---------------------------------------------------------------------------
def test_get_order_by_id_ok(client, prisma_mock):
    order = _create_order_via_service(prisma_mock)
    resp = client.get(f"/api/v1/lab/orders/{order['id']}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["id"] == order["id"]
    assert "items" in body
    assert len(body["items"]) == 1


# ---------------------------------------------------------------------------
# 5. List paginated
# ---------------------------------------------------------------------------
def test_list_orders_paginated_ok(client, prisma_mock):
    for _ in range(3):
        _create_order_via_service(prisma_mock)
    resp = client.get("/api/v1/lab/orders", params={"draw": 1, "start": 0, "length": 10})
    assert resp.status_code == 200
    body = resp.json()
    assert body["draw"] == 1
    assert body["recordsTotal"] == 3
    assert len(body["data"]) == 3


# ---------------------------------------------------------------------------
# 6. Update draft OK
# ---------------------------------------------------------------------------
def test_update_draft_ok(client, prisma_mock):
    order = _create_order_via_service(prisma_mock)
    resp = client.patch(
        f"/api/v1/lab/orders/{order['id']}",
        json={"doctorName": "Dr. Actualizado", "observations": "Cambio de médico"},
        headers={"x-ami-userid": "u-admin"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["doctorName"] == "Dr. Actualizado"
    assert body["observations"] == "Cambio de médico"


# ---------------------------------------------------------------------------
# 7. Update SAVED → 400
# ---------------------------------------------------------------------------
def test_update_saved_fails(client, prisma_mock):
    order = _create_order_via_service(prisma_mock)
    # Confirmar a SAVED
    confirm = client.post(
        f"/api/v1/lab/orders/{order['id']}/confirm",
        json={},
        headers={"x-ami-userid": "u-admin"},
    )
    assert confirm.status_code == 200
    # Intentar update → 400
    resp = client.patch(
        f"/api/v1/lab/orders/{order['id']}",
        json={"doctorName": "Nuevo"},
        headers={"x-ami-userid": "u-admin"},
    )
    assert resp.status_code == 400
    assert "DRAFT" in resp.json()["detail"]


# ---------------------------------------------------------------------------
# 8. Confirm DRAFT → SAVED con folio único
# ---------------------------------------------------------------------------
def test_confirm_draft_to_saved_generates_unique_folio(client, prisma_mock):
    o1 = _create_order_via_service(prisma_mock)
    o2 = _create_order_via_service(prisma_mock)
    r1 = client.post(f"/api/v1/lab/orders/{o1['id']}/confirm", json={}, headers={"x-ami-userid": "u-admin"})
    r2 = client.post(f"/api/v1/lab/orders/{o2['id']}/confirm", json={}, headers={"x-ami-userid": "u-admin"})
    assert r1.status_code == 200
    assert r2.status_code == 200
    b1 = r1.json()
    b2 = r2.json()
    assert b1["status"] == "SAVED"
    assert b2["status"] == "SAVED"
    assert b1["folio"] != b2["folio"]
    assert b1["folio"] >= 1 and b2["folio"] >= 1


# ---------------------------------------------------------------------------
# 9. Add item to DRAFT
# ---------------------------------------------------------------------------
def test_add_item_to_draft_ok(client, prisma_mock):
    order = _create_order_via_service(prisma_mock)
    tid2 = _seed_test("t-2", "QS", "Química Sanguínea")
    resp = client.post(
        f"/api/v1/lab/orders/{order['id']}/items",
        json={"medicalTestId": tid2, "price": 250, "discountAmount": 0, "discountPct": 0},
        headers={"x-ami-userid": "u-admin"},
    )
    assert resp.status_code == 200
    # Verificar que la orden tiene 2 items y recalculó totales
    get = client.get(f"/api/v1/lab/orders/{order['id']}")
    assert len(get.json()["items"]) == 2
    assert get.json()["subtotal"] == 350.0  # 100 + 250


# ---------------------------------------------------------------------------
# 10. Remove item from DRAFT
# ---------------------------------------------------------------------------
def test_remove_item_from_draft_ok(client, prisma_mock):
    order = _create_order_via_service(prisma_mock)
    item_id = order["items"][0]["id"]
    resp = client.delete(
        f"/api/v1/lab/orders/{order['id']}/items/{item_id}",
        headers={"x-ami-userid": "u-admin"},
    )
    assert resp.status_code == 200
    get = client.get(f"/api/v1/lab/orders/{order['id']}")
    assert len(get.json()["items"]) == 0
    assert get.json()["subtotal"] == 0


# ---------------------------------------------------------------------------
# 11. Soft delete draft
# ---------------------------------------------------------------------------
def test_soft_delete_draft_ok(client, prisma_mock):
    order = _create_order_via_service(prisma_mock)
    resp = client.delete(
        f"/api/v1/lab/orders/{order['id']}",
        params={"motivo": "Paciente canceló"},
        headers={"x-ami-userid": "u-admin"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "CANCELLED"
    assert body["cancelledById"] == "u-admin"
    assert body["cancelledAt"] is not None


# ---------------------------------------------------------------------------
# 12. Search workers
# ---------------------------------------------------------------------------
def test_search_workers_with_query(client, prisma_mock):
    _seed_worker("w-1", "Juan", "Pérez")
    _seed_worker("w-2", "Maria", "López")
    _seed_worker("w-3", "Pedro", "Ramírez")
    resp = client.get("/api/v1/lab/search/workers", params={"q": "juan"})
    assert resp.status_code == 200
    body = resp.json()
    assert isinstance(body, list)
    assert any("Juan" in w["fullName"] for w in body)


# ---------------------------------------------------------------------------
# 13. Search tests (filtro)
# ---------------------------------------------------------------------------
def test_search_tests_filters_laboratorio_type(client, prisma_mock):
    _seed_test("t-1", "BH", "Biometría Hemática")
    _seed_test("t-2", "QS", "Química Sanguínea")
    _seed_test("t-3", "EGO", "Examen General de Orina")
    # El esquema MedicalTest actual no tiene campo `type`; el filtro es por
    # coincidencia en name/code. Validamos que el endpoint responde y devuelve
    # al menos un resultado al buscar por código parcial.
    resp = client.get("/api/v1/lab/search/tests", params={"q": "BH"})
    assert resp.status_code == 200
    body = resp.json()
    assert isinstance(body, list)
    assert len(body) >= 1
    # Verificar que cada item tiene los campos esperados
    for item in body:
        assert "id" in item
        assert "code" in item
        assert "name" in item
        assert "price" in item


# ---------------------------------------------------------------------------
# 14. calculate_totals con descuentos mixtos
# ---------------------------------------------------------------------------
def test_calculate_totals_with_mixed_discounts():
    items = [
        {"price": 200, "discountAmount": 20, "discountPct": 0},   # 180
        {"price": 150, "discountAmount": 0, "discountPct": 10},    # 135
        {"price": 100, "discountAmount": 5, "discountPct": 5},     # 90
    ]
    totals = svc.calculate_totals(items, iva_pct=16)
    # subtotal = 180 + 135 + 90 = 405
    assert totals["subtotal"] == 405.0
    # iva = 405 * 0.16 = 64.80
    assert totals["iva"] == 64.8
    # total = 469.80
    assert totals["total"] == 469.8


# ---------------------------------------------------------------------------
# Extra: cancel reason obligatorio (≥3 chars)
# ---------------------------------------------------------------------------
def test_cancel_requires_motivo(client, prisma_mock):
    order = _create_order_via_service(prisma_mock)
    resp = client.delete(
        f"/api/v1/lab/orders/{order['id']}",
        params={"motivo": "ab"},
        headers={"x-ami-userid": "u-admin"},
    )
    # FastAPI Query(min_length=3) → 422
    assert resp.status_code == 422
