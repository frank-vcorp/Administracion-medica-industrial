"""
IMPL-20260707-16: Slice C NOVA absorción (ARCH-20260707-16) — LabResult.
Tests pytest del módulo de captura de resultados + ciclo de vida P/R/A/V
+ worklist + integración papeleta.

Cubre (≥ 12 casos según SPEC §9):
   1.  test_create_results_bulk_ok
   2.  test_create_results_bulk_validates_value_required
   3.  test_create_results_bulk_marks_out_of_range
   4.  test_create_results_bulk_marks_critical
   5.  test_get_result_with_audit_returns_history
   6.  test_update_result_recomputes_out_of_range
   7.  test_transition_pending_to_reported
   8.  test_transition_reported_to_authorized
   9.  test_transition_authorized_to_validated
  10.  test_transition_invalidate_requires_reason
  11.  test_transition_illegal_reported_to_validated
  12.  test_worklist_returns_analytes_with_existing_result
  13.  test_link_lab_order_item_to_event_test
  14.  test_calculate_age_in_months
  15.  test_validate_value_against_range_numeric
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

# Permitir imports del paquete app.*
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.api.v1.lab.results import router as results_router  # noqa: E402
from app.services import lab_result_service as svc  # noqa: E402
from app.schemas.lab_results import LabResultTransitionAction  # noqa: E402


def _build_test_app() -> FastAPI:
    test_app = FastAPI(title="lab-results-tests")
    test_app.include_router(results_router)
    return test_app


# ---------------------------------------------------------------------------
# Mock Prisma client (in-memory) — patrón Slice B con tablas adicionales
# ---------------------------------------------------------------------------
def _make_prisma_mock() -> MagicMock:
    tables: Dict[str, List[Dict[str, Any]]] = {
        "laborder": [],
        "laborderitem": [],
        "labresult": [],
        "labanalyte": [],
        "labreferencerange": [],
        "labresultaudit": [],
        "labunit": [],
        "medicaltest": [],
        "user": [],
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

        async def count(where: Optional[Dict[str, Any]] = None):
            return sum(1 for it in tables[name] if _matches(it, where))

        async def find_many(where=None, order_by=None, order=None, skip=0, take=25):
            matched = [it for it in tables[name] if _matches(it, where)]
            order_clause = order or order_by
            if order_clause:
                field, direction = next(iter(order_clause.items()))
                matched = sorted(
                    matched,
                    key=lambda x: (x.get(field) is None, x.get(field)),
                    reverse=(direction == "desc"),
                )
            return matched[skip : skip + take]

        async def find_unique(where: Dict[str, Any]):
            for it in tables[name]:
                if all(it.get(k) == v for k, v in where.items()):
                    return it
            return None

        async def find_first(where: Optional[Dict[str, Any]] = None, order=None, order_by=None):
            matched = [it for it in tables[name] if _matches(it, where)]
            order_clause = order or order_by
            if order_clause:
                field, direction = next(iter(order_clause.items()))
                matched = sorted(
                    matched,
                    key=lambda x: (x.get(field) is None, x.get(field)),
                    reverse=(direction == "desc"),
                )
            return matched[0] if matched else None

        async def create(data: Dict[str, Any]):
            new = dict(data)
            new.setdefault("id", _new_id())
            new.setdefault("createdAt", datetime.utcnow().isoformat())
            new.setdefault("updatedAt", datetime.utcnow().isoformat())
            tables[name].append(new)
            return new

        async def update(where: Dict[str, Any], data: Dict[str, Any]):
            existing = await find_unique(where)
            if existing is None:
                raise LookupError(f"{name} not found: {where}")
            for k, v in data.items():
                existing[k] = v
            existing["updatedAt"] = datetime.utcnow().isoformat()
            return existing

        async def delete(where: Dict[str, Any]):
            existing = await find_unique(where)
            if existing is None:
                raise LookupError(f"{name} not found: {where}")
            tables[name].remove(existing)
            return existing

        delegate.count.side_effect = count
        delegate.find_many.side_effect = find_many
        delegate.find_unique.side_effect = find_unique
        delegate.find_first.side_effect = find_first
        delegate.create.side_effect = create
        delegate.update.side_effect = update
        delegate.delete.side_effect = delete
        return delegate

    for name in tables:
        setattr(prisma, name, _make_delegate(name))

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
def _seed_order(worker_id: str = "w-1") -> str:
    """Crea una LabOrder + 1 LabOrderItem + 1 MedicalTest para tests."""
    asyncio.run(
        svc.get_prisma().laborder.create(
            data={
                "id": "ord-1",
                "folio": 100,
                "workerId": worker_id,
                "doctorName": "Dr. Test",
                "status": "SAVED",
            }
        )
    )
    asyncio.run(
        svc.get_prisma().medicaltest.create(
            data={"id": "test-1", "code": "BH", "name": "Biometría Hemática", "categoryId": "cat-1"}
        )
    )
    asyncio.run(
        svc.get_prisma().laborderitem.create(
            data={
                "id": "item-1",
                "labOrderId": "ord-1",
                "medicalTestId": "test-1",
                "price": 100,
                "amount": 100,
                "resultStatus": "P",
            }
        )
    )
    return "ord-1"


def _seed_analyte(
    analyte_id: str = "an-1",
    code: str = "HGB",
    name: str = "Hemoglobina",
    test_id: str = "test-1",
) -> str:
    asyncio.run(
        svc.get_prisma().labanalyte.create(
            data={
                "id": analyte_id,
                "medicalTestId": test_id,
                "code": code,
                "name": name,
                "dataType": "NUMERIC",
                "orderIndex": 0,
                "active": True,
            }
        )
    )
    return analyte_id


def _seed_range(
    analyte_id: str = "an-1",
    range_id: str = "rng-1",
    vmin: float = 12,
    vmax: float = 17,
    crit_low: Optional[float] = None,
    crit_high: Optional[float] = None,
    sex: str = "A",
) -> str:
    asyncio.run(
        svc.get_prisma().labreferencerange.create(
            data={
                "id": range_id,
                "analyteId": analyte_id,
                "sex": sex,
                "valueMin": vmin,
                "valueMax": vmax,
                "criticalLow": crit_low,
                "criticalHigh": crit_high,
            }
        )
    )
    return range_id


def _create_via_service(prisma_mock, items: list) -> dict:
    return asyncio.run(
        svc.create_lab_results_bulk(
            items=items,
            current_user={"id": "user-admin", "role": "ADMIN"},
            prisma=prisma_mock,
        )
    )


# ---------------------------------------------------------------------------
# 1. Bulk create OK
# ---------------------------------------------------------------------------
def test_create_results_bulk_ok(client, prisma_mock):
    _seed_order()
    _seed_analyte()
    _seed_range()
    resp = client.post(
        "/api/v1/lab/results",
        json={
            "items": [
                {
                    "labOrderItemId": "item-1",
                    "analyteId": "an-1",
                    "valueNumber": 14.5,
                }
            ]
        },
        headers={"x-ami-userid": "u-admin"},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["created"] == 1
    assert len(body["ids"]) == 1
    assert body["errors"] == []
    # Verificar persistencia
    res = asyncio.run(svc.get_prisma().labresult.find_first())
    assert res["valueNumber"] == 14.5
    assert res["status"] == "PENDING"
    assert res["isOutOfRange"] is False


# ---------------------------------------------------------------------------
# 2. Bulk create requiere valor
# ---------------------------------------------------------------------------
def test_create_results_bulk_validates_value_required(client, prisma_mock):
    _seed_order()
    _seed_analyte()
    _seed_range()
    resp = client.post(
        "/api/v1/lab/results",
        json={
            "items": [
                {"labOrderItemId": "item-1", "analyteId": "an-1"}
            ]
        },
        headers={"x-ami-userid": "u-admin"},
    )
    # 422 (Pydantic) o 400 (service ValueError) según la fase que detecte el error.
    assert resp.status_code in (400, 422)


# ---------------------------------------------------------------------------
# 3. Out-of-range detectado
# ---------------------------------------------------------------------------
def test_create_results_bulk_marks_out_of_range(client, prisma_mock):
    _seed_order()
    _seed_analyte()
    _seed_range(vmin=12, vmax=17)
    resp = client.post(
        "/api/v1/lab/results",
        json={
            "items": [
                {
                    "labOrderItemId": "item-1",
                    "analyteId": "an-1",
                    "valueNumber": 20.0,  # fuera de rango
                }
            ]
        },
        headers={"x-ami-userid": "u-admin"},
    )
    assert resp.status_code == 200
    res = asyncio.run(svc.get_prisma().labresult.find_first())
    assert res["isOutOfRange"] is True
    # Verificar audit con OUT_OF_RANGE_DETECTED
    audits = asyncio.run(svc.get_prisma().labresultaudit.find_many())
    actions = [a["action"] for a in audits]
    assert "CREATE" in actions
    assert "OUT_OF_RANGE_DETECTED" in actions


# ---------------------------------------------------------------------------
# 4. Crítico detectado
# ---------------------------------------------------------------------------
def test_create_results_bulk_marks_critical(client, prisma_mock):
    _seed_order()
    _seed_analyte()
    _seed_range(vmin=12, vmax=17, crit_low=5, crit_high=20)
    resp = client.post(
        "/api/v1/lab/results",
        json={
            "items": [
                {
                    "labOrderItemId": "item-1",
                    "analyteId": "an-1",
                    "valueNumber": 22.0,  # >= criticalHigh
                }
            ]
        },
        headers={"x-ami-userid": "u-admin"},
    )
    assert resp.status_code == 200
    res = asyncio.run(svc.get_prisma().labresult.find_first())
    assert res["isCritical"] is True


# ---------------------------------------------------------------------------
# 5. Get con audit
# ---------------------------------------------------------------------------
def test_get_result_with_audit_returns_history(client, prisma_mock):
    _seed_order()
    _seed_analyte()
    _seed_range()
    _create_via_service(prisma_mock, [{"labOrderItemId": "item-1", "analyteId": "an-1", "valueNumber": 14}])
    res = asyncio.run(svc.get_prisma().labresult.find_first())
    out = asyncio.run(svc.get_result_with_audit(res["id"], prisma=svc.get_prisma()))
    assert out is not None
    assert "auditEvents" in out
    assert len(out["auditEvents"]) >= 1
    assert out["auditEvents"][0]["action"] == "CREATE"


# ---------------------------------------------------------------------------
# 6. Update recalcula out-of-range
# ---------------------------------------------------------------------------
def test_update_result_recomputes_out_of_range(client, prisma_mock):
    _seed_order()
    _seed_analyte()
    _seed_range(vmin=12, vmax=17)
    _create_via_service(prisma_mock, [{"labOrderItemId": "item-1", "analyteId": "an-1", "valueNumber": 14}])
    res = asyncio.run(svc.get_prisma().labresult.find_first())
    out = asyncio.run(
        svc.update_lab_result(
            result_id=res["id"],
            data={"valueNumber": 25.0},
            current_user={"id": "u-admin", "role": "ADMIN"},
            prisma=svc.get_prisma(),
        )
    )
    assert out["isOutOfRange"] is True


# ---------------------------------------------------------------------------
# 7. PENDING → REPORTED
# ---------------------------------------------------------------------------
def test_transition_pending_to_reported(client, prisma_mock):
    _seed_order()
    _seed_analyte()
    _seed_range()
    _create_via_service(prisma_mock, [{"labOrderItemId": "item-1", "analyteId": "an-1", "valueNumber": 14}])
    res = asyncio.run(svc.get_prisma().labresult.find_first())
    out = asyncio.run(
        svc.transition_lab_result(
            result_id=res["id"],
            action=LabResultTransitionAction.REPORT,
            reason=None,
            current_user={"id": "u-admin", "role": "ADMIN"},
            prisma=svc.get_prisma(),
        )
    )
    assert out["status"] == "REPORTED"
    assert out["reportedById"] == "u-admin"


# ---------------------------------------------------------------------------
# 8. REPORTED → AUTHORIZED
# ---------------------------------------------------------------------------
def test_transition_reported_to_authorized(client, prisma_mock):
    _seed_order()
    _seed_analyte()
    _seed_range()
    _create_via_service(prisma_mock, [{"labOrderItemId": "item-1", "analyteId": "an-1", "valueNumber": 14}])
    res = asyncio.run(svc.get_prisma().labresult.find_first())
    asyncio.run(
        svc.transition_lab_result(
            result_id=res["id"], action=LabResultTransitionAction.REPORT,
            reason=None, current_user={"id": "u-admin", "role": "ADMIN"},
            prisma=svc.get_prisma(),
        )
    )
    out = asyncio.run(
        svc.transition_lab_result(
            result_id=res["id"], action=LabResultTransitionAction.AUTHORIZE,
            reason=None, current_user={"id": "u-validator", "role": "ADMIN"},
            prisma=svc.get_prisma(),
        )
    )
    assert out["status"] == "AUTHORIZED"
    assert out["authorizedById"] == "u-validator"


# ---------------------------------------------------------------------------
# 9. AUTHORIZED → VALIDATED
# ---------------------------------------------------------------------------
def test_transition_authorized_to_validated(client, prisma_mock):
    _seed_order()
    _seed_analyte()
    _seed_range()
    _create_via_service(prisma_mock, [{"labOrderItemId": "item-1", "analyteId": "an-1", "valueNumber": 14}])
    res = asyncio.run(svc.get_prisma().labresult.find_first())
    for act in [LabResultTransitionAction.REPORT, LabResultTransitionAction.AUTHORIZE]:
        asyncio.run(
            svc.transition_lab_result(
                result_id=res["id"], action=act, reason=None,
                current_user={"id": "u-admin", "role": "ADMIN"},
                prisma=svc.get_prisma(),
            )
        )
    out = asyncio.run(
        svc.transition_lab_result(
            result_id=res["id"], action=LabResultTransitionAction.VALIDATE,
            reason=None, current_user={"id": "u-final", "role": "ADMIN"},
            prisma=svc.get_prisma(),
        )
    )
    assert out["status"] == "VALIDATED"
    assert out["validatedById"] == "u-final"


# ---------------------------------------------------------------------------
# 10. Invalidate requiere motivo ≥5 chars
# ---------------------------------------------------------------------------
def test_transition_invalidate_requires_reason(client, prisma_mock):
    _seed_order()
    _seed_analyte()
    _seed_range()
    _create_via_service(prisma_mock, [{"labOrderItemId": "item-1", "analyteId": "an-1", "valueNumber": 14}])
    res = asyncio.run(svc.get_prisma().labresult.find_first())
    with pytest.raises(ValueError):
        asyncio.run(
            svc.transition_lab_result(
                result_id=res["id"], action=LabResultTransitionAction.INVALIDATE,
                reason="ab", current_user={"id": "u-admin", "role": "ADMIN"},
                prisma=svc.get_prisma(),
            )
        )


# ---------------------------------------------------------------------------
# 11. Transición ilegal
# ---------------------------------------------------------------------------
def test_transition_illegal_reported_to_validated(client, prisma_mock):
    _seed_order()
    _seed_analyte()
    _seed_range()
    _create_via_service(prisma_mock, [{"labOrderItemId": "item-1", "analyteId": "an-1", "valueNumber": 14}])
    res = asyncio.run(svc.get_prisma().labresult.find_first())
    asyncio.run(
        svc.transition_lab_result(
            result_id=res["id"], action=LabResultTransitionAction.REPORT,
            reason=None, current_user={"id": "u-admin", "role": "ADMIN"},
            prisma=svc.get_prisma(),
        )
    )
    # REPORTED → VALIDATED es ilegal (debe pasar por AUTHORIZED)
    with pytest.raises(ValueError):
        asyncio.run(
            svc.transition_lab_result(
                result_id=res["id"], action=LabResultTransitionAction.VALIDATE,
                reason=None, current_user={"id": "u-admin", "role": "ADMIN"},
                prisma=svc.get_prisma(),
            )
        )


# ---------------------------------------------------------------------------
# 12. Worklist retorna analitos + resultado existente
# ---------------------------------------------------------------------------
def test_worklist_returns_analytes_with_existing_result(client, prisma_mock):
    _seed_order()
    _seed_analyte(code="HGB", name="Hemoglobina")
    _seed_range()
    _create_via_service(prisma_mock, [{"labOrderItemId": "item-1", "analyteId": "an-1", "valueNumber": 14}])
    out = asyncio.run(svc.get_worklist(order_id="ord-1", prisma=svc.get_prisma()))
    assert out["orderId"] == "ord-1"
    assert len(out["items"]) == 1
    item = out["items"][0]
    assert item["medicalTestCode"] == "BH"
    assert len(item["analytes"]) == 1
    a = item["analytes"][0]
    assert a["code"] == "HGB"
    assert a["rangeMin"] == 12
    assert a["rangeMax"] == 17
    assert a["existingValueNumber"] == 14
    assert a["existingStatus"] == "PENDING"


# ---------------------------------------------------------------------------
# 13. Link LabOrderItem ↔ EventTest
# ---------------------------------------------------------------------------
def test_link_lab_order_item_to_event_test(client, prisma_mock):
    _seed_order()
    # Link directo al servicio (solo escribe en laborderitem, no requiere eventtest table).
    out = asyncio.run(
        svc.link_lab_order_item_to_event_test(
            item_id="item-1",
            event_test_id="et-99",
            current_user={"id": "u-admin", "role": "ADMIN"},
            prisma=svc.get_prisma(),
        )
    )
    assert out["eventTestId"] == "et-99"


# ---------------------------------------------------------------------------
# 14. calculate_age_in_months
# ---------------------------------------------------------------------------
def test_calculate_age_in_months():
    from datetime import datetime as dt

    # Hace 30 meses
    bd = dt(2023, 1, 1)
    sample = dt(2025, 7, 1)
    months = svc.calculate_age_in_months(bd, sample)
    assert months == 30

    # Fecha futura → 0 meses (clamp)
    bd = dt(2026, 1, 1)
    sample = dt(2025, 1, 1)
    months = svc.calculate_age_in_months(bd, sample)
    assert months == 0


# ---------------------------------------------------------------------------
# 15. validate_value_against_range
# ---------------------------------------------------------------------------
def test_validate_value_against_range_numeric():
    # En rango
    r = svc.validate_value_against_range(value=14, value_text=None, range_min=12, range_max=17)
    assert r["isOutOfRange"] is False
    assert r["isCritical"] is False
    # Fuera de rango
    r = svc.validate_value_against_range(value=20, value_text=None, range_min=12, range_max=17)
    assert r["isOutOfRange"] is True
    # Crítico bajo
    r = svc.validate_value_against_range(value=3, value_text=None, range_min=12, range_max=17, critical_low=5)
    assert r["isCritical"] is True
    # Crítico alto
    r = svc.validate_value_against_range(value=22, value_text=None, range_min=12, range_max=17, critical_high=20)
    assert r["isCritical"] is True