"""
IMPL-20260707-17: Fase 1 NOVA absorción (ARCH-20260707-17) — B-v2.
Tests pytest para bandeja de papeletas + trigger SAMPLE_TAKEN + auto-generate.

Cubre (≥ 10 casos):
  1.  test_list_pending_orders_empty
  2.  test_list_pending_orders_returns_only_lab_category
  3.  test_list_pending_orders_excludes_already_drafted
  4.  test_list_pending_orders_includes_doctor_name
  5.  test_mark_sample_taken_creates_lab_order_for_lab_test
  6.  test_mark_sample_taken_is_idempotent
  7.  test_mark_sample_taken_does_not_trigger_for_non_lab_test
  8.  test_mark_sample_taken_404_for_missing_event_test
  9.  test_auto_generate_returns_existing_draft
  10. test_auto_generate_creates_new_draft_with_items
  11. test_auto_generate_404_for_missing_event
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

from app.api.v1.lab.pending_orders import router as pending_router  # noqa: E402
from app.services import pending_order_service as svc  # noqa: E402
from app.services import lab_order_service as lab_order_svc  # noqa: E402


def _build_test_app() -> FastAPI:
    test_app = FastAPI(title="lab-pending-orders-tests")
    test_app.include_router(pending_router)
    return test_app


# ---------------------------------------------------------------------------
# Mock Prisma client (en memoria) — FIX-20260706-16: snake_case
# ---------------------------------------------------------------------------
def _make_prisma_mock() -> MagicMock:
    tables: Dict[str, List[Dict[str, Any]]] = {
        "medicalevent": [],
        "eventtest": [],
        "worker": [],
        "company": [],
        "user": [],
        "branch": [],
        "medicaltest": [],
        "testcategory": [],
        "laborder": [],
        "laborderitem": [],
        "auditlog": [],
    }
    counters = {"id": 0}

    def _apply_includes(item: Dict[str, Any], include) -> Dict[str, Any]:
        """Aplica includes mockeados: lookup simple por FK."""
        if not include:
            return dict(item)
        result = dict(item)
        if not isinstance(include, dict):
            return result
        for rel_name, sub_include in include.items():
            # Patrón Prisma: {"include": {...}} o {"where": ..., "include": ...}
            if rel_name in ("include", "where", "orderBy", "order_by", "take", "skip"):
                continue
            fk_map = {
                "test": ("medicaltest", "id", "testId"),
                "event": ("medicalevent", "id", "eventId"),
                "worker": ("worker", "id", "workerId"),
                "company": ("company", "id", "companyId"),
                "branch": ("branch", "id", "branchId"),
                "intakeCreatedByUser": ("user", "id", "intakeCreatedByUserId"),
                "medicalTest": ("medicaltest", "id", "medicalTestId"),
                "defaultUnit": ("labunit", "id", "defaultUnitId"),
                "unit": ("labunit", "id", "unitId"),
                "analytes": ("labanalyte", "medicalTestId", None),
                "referenceRanges": ("labreferencerange", "analyteId", None),
                "labOrder": ("laborder", "id", "labOrderId"),
            }
            if rel_name not in fk_map:
                continue
            target_table, target_key, fk_col = fk_map[rel_name]
            if target_table not in tables:
                continue
            # Determinar sub-include real (puede venir como {include: {...}})
            real_sub_include = sub_include
            if isinstance(sub_include, dict) and "include" in sub_include:
                real_sub_include = sub_include["include"]
            if fk_col is not None:
                # Single relation (belongs-to)
                fk_value = item.get(fk_col)
                if fk_value is None:
                    result[rel_name] = None
                else:
                    rel_row = next(
                        (r for r in tables[target_table] if r.get(target_key) == fk_value),
                        None,
                    )
                    if rel_row is not None and isinstance(real_sub_include, dict):
                        result[rel_name] = _apply_includes(rel_row, real_sub_include)
                    else:
                        result[rel_name] = rel_row
            else:
                # Has-many: target_key es la FK en el child (ej: analyte.medicalTestId)
                # Necesitamos comparar con el PK del parent (item["id"])
                fk_value = item.get("id")
                rel_rows = [r for r in tables[target_table] if r.get(target_key) == fk_value]
                if isinstance(real_sub_include, dict):
                    rel_rows = [_apply_includes(r, real_sub_include) for r in rel_rows]
                result[rel_name] = rel_rows
        return result

    def _new_id() -> str:
        counters["id"] += 1
        return f"mock-{counters['id']}"

    def _matches(item: Dict[str, Any], where: Optional[Dict[str, Any]]) -> bool:
        if not where:
            return True
        for k, v in where.items():
            # Composite unique key pattern
            if isinstance(v, dict) and not any(op in v for op in ("contains", "equals", "mode", "in", "gte", "lte", "include", "where", "orderBy")):
                if not all(item.get(fk) == fv for fk, fv in v.items()):
                    return False
                continue
            if k == "OR":
                if not any(_matches(item, single) for single in v):
                    return False
                continue
            if k == "AND":
                if not all(_matches(item, single) for single in v):
                    return False
                continue
            if k == "in" and not isinstance(v, dict):
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

        async def count(where: Optional[Dict[str, Any]] = None):
            return sum(1 for it in tables[name] if _matches(it, where))

        async def find_many(where=None, order_by=None, order=None, skip=0, take=25, include=None, **_):
            matched = [it for it in tables[name] if _matches(it, where)]
            order_clause = order or order_by
            if order_clause:
                field, direction = next(iter(order_clause.items()))
                matched = sorted(
                    matched,
                    key=lambda x: (x.get(field) is None, x.get(field)),
                    reverse=(direction == "desc"),
                )
            # Aplicar includes a cada row
            enriched_rows = [_apply_includes(r, include) for r in matched]
            return enriched_rows[skip : skip + take]

        async def find_unique(where: Dict[str, Any], include=None, **_):
            for it in tables[name]:
                if _matches(it, where):
                    return _apply_includes(it, include)
            return None

        async def find_first(where: Dict[str, Any]):
            for it in tables[name]:
                if _matches(it, where):
                    return it
            return None

        async def create(data: Dict[str, Any]):
            new = dict(data)
            new.setdefault("id", _new_id())
            new.setdefault("createdAt", datetime.utcnow().isoformat())
            new.setdefault("updatedAt", datetime.utcnow().isoformat())
            if name == "laborder" and "status" not in new:
                new["status"] = "DRAFT"
            tables[name].append(new)
            return new

        async def update(where: Dict[str, Any], data: Dict[str, Any]):
            # Buscar el row ORIGINAL en tables (no la versión enriquecida)
            original = None
            for it in tables[name]:
                if all(it.get(k) == v for k, v in where.items()):
                    original = it
                    break
            if original is None:
                raise LookupError(f"{name} not found: {where}")
            for k, v in data.items():
                original[k] = v
            original["updatedAt"] = datetime.utcnow().isoformat()
            return _apply_includes(original, None)

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
        if name != "auditlog":
            setattr(prisma, name, _make_delegate(name))

    audit = MagicMock()
    async def _audit_create(data: Dict[str, Any]):
        tables["auditlog"].append(data)
        return data
    audit.create.side_effect = _audit_create
    prisma.auditlog = audit

    return prisma


@pytest.fixture
def prisma_mock() -> MagicMock:
    mock = _make_prisma_mock()
    lab_order_svc.set_prisma_client(mock)
    return mock


@pytest.fixture
def client(prisma_mock) -> TestClient:
    return TestClient(_build_test_app())


# Helpers --------------------------------------------------------------------
def _seed_worker(pid="w-1", company_id=None, first="Juan", last="Pérez"):
    wid = pid
    asyncio.run(
        lab_order_svc.get_prisma().worker.create(
            data={
                "id": wid,
                "universalId": f"U-{pid}",
                "firstName": first,
                "lastName": last,
                "companyId": company_id,
                "dob": "1990-05-15T00:00:00",
            }
        )
    )
    return wid


def _seed_company(pid="c-1", name="Vectoria"):
    asyncio.run(
        lab_order_svc.get_prisma().company.create(data={"id": pid, "name": name, "rfc": "VEC900101AAA"})
    )
    return pid


def _seed_user(pid="u-1", full_name="Dr. Smith"):
    asyncio.run(
        lab_order_svc.get_prisma().user.create(
            data={"id": pid, "fullName": full_name, "email": f"{pid}@x.com", "role": "ADMIN"}
        )
    )
    return pid


def _seed_branch(pid="b-1", name="MATRIZ"):
    asyncio.run(
        lab_order_svc.get_prisma().branch.create(data={"id": pid, "name": name})
    )
    return pid


def _seed_category(pid="64d3f863", name="Laboratorio"):
    asyncio.run(
        lab_order_svc.get_prisma().testcategory.create(data={"id": pid, "name": name})
    )
    return pid


def _seed_test(pid="t-1", code="BH", cat_id="64d3f863"):
    asyncio.run(
        lab_order_svc.get_prisma().medicaltest.create(
            data={"id": pid, "code": code, "name": code, "categoryId": cat_id, "options": []}
        )
    )
    return pid


def _seed_medical_event(
    pid="e-1",
    worker_id=None,
    branch_id=None,
    intake_user_id=None,
    status="IN_PROGRESS",
):
    if worker_id is None:
        worker_id = _seed_worker()
    if branch_id is None:
        branch_id = _seed_branch()
    asyncio.run(
        lab_order_svc.get_prisma().medicalevent.create(
            data={
                "id": pid,
                "workerId": worker_id,
                "branchId": branch_id,
                "intakeCreatedByUserId": intake_user_id,
                "status": status,
            }
        )
    )
    return pid


def _seed_event_test(
    pid="et-1",
    event_id=None,
    test_id=None,
    test_name="BH",
    status="SAMPLE_TAKEN",
):
    if event_id is None:
        event_id = _seed_medical_event()
    if test_id is None:
        test_id = _seed_test()
    asyncio.run(
        lab_order_svc.get_prisma().eventtest.create(
            data={
                "id": pid,
                "eventId": event_id,
                "testId": test_id,
                "testNameSnapshot": test_name,
                "status": status,
            }
        )
    )
    return pid


# ---------------------------------------------------------------------------
# 1. Bandeja vacía
# ---------------------------------------------------------------------------
def test_list_pending_orders_empty(client, prisma_mock):
    _seed_category()
    _seed_test()
    resp = client.get("/api/v1/lab/pending-orders", headers={"x-ami-userid": "u-1"})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["total"] == 0
    assert body["rows"] == []


# ---------------------------------------------------------------------------
# 2. Solo devuelve cat=Laboratorio
# ---------------------------------------------------------------------------
def test_list_pending_orders_returns_only_lab_category(client, prisma_mock):
    cat_lab = _seed_category("64d3f863", "Laboratorio")
    asyncio.run(
        prisma_mock.testcategory.create(data={"id": "98a62682", "name": "Imagenología"})
    )
    t_bh = _seed_test("t-bh", "BH", "64d3f863")
    t_rx = _seed_test("t-rx", "RX", "98a62682")
    wid = _seed_worker()
    eid = _seed_medical_event("e-lab", worker_id=wid)
    _seed_event_test("et-lab-1", event_id=eid, test_id=t_bh, test_name="BH", status="SAMPLE_TAKEN")
    _seed_event_test("et-rx-1", event_id=eid, test_id=t_rx, test_name="RX", status="SAMPLE_TAKEN")

    resp = client.get("/api/v1/lab/pending-orders", headers={"x-ami-userid": "u-1"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1
    row = body["rows"][0]
    assert row["medicalEventId"] == "e-lab"
    assert len(row["eventTests"]) == 1
    assert row["eventTests"][0]["medicalTestCode"] == "BH"


# ---------------------------------------------------------------------------
# 3. Excluye EventTests que ya tienen LabOrder DRAFT
# ---------------------------------------------------------------------------
def test_list_pending_orders_excludes_already_drafted(client, prisma_mock):
    _seed_category()
    t_bh = _seed_test("t-bh", "BH", "64d3f863")
    wid = _seed_worker()
    eid = _seed_medical_event("e-2", worker_id=wid)
    etid = _seed_event_test("et-2", event_id=eid, test_id=t_bh, status="SAMPLE_TAKEN")

    # Crear LabOrder DRAFT manualmente con eventTestId apuntando
    asyncio.run(prisma_mock.laborder.create(data={
        "folio": 1, "branch": "MATRIZ", "workerId": wid, "doctorName": "Dr",
        "status": "DRAFT", "createdById": "u-1",
    }))
    order_id = prisma_mock.laborder._items[0]["id"]
    asyncio.run(prisma_mock.laborderitem.create(data={
        "labOrderId": order_id, "medicalTestId": t_bh, "eventTestId": etid,
        "price": 0, "amount": 0, "resultStatus": "P",
    }))

    resp = client.get("/api/v1/lab/pending-orders", headers={"x-ami-userid": "u-1"})
    body = resp.json()
    assert body["total"] == 0


# ---------------------------------------------------------------------------
# 4. Incluye nombre del médico (intakeCreatedByUser)
# ---------------------------------------------------------------------------
def test_list_pending_orders_includes_doctor_name(client, prisma_mock):
    _seed_category()
    t_bh = _seed_test("t-bh", "BH", "64d3f863")
    uid = _seed_user("u-doc", "Dr. House")
    wid = _seed_worker()
    eid = _seed_medical_event("e-3", worker_id=wid, intake_user_id=uid)
    _seed_event_test("et-3", event_id=eid, test_id=t_bh, status="SAMPLE_TAKEN")

    resp = client.get("/api/v1/lab/pending-orders", headers={"x-ami-userid": "u-1"})
    body = resp.json()
    assert body["total"] == 1
    assert body["rows"][0]["doctorName"] == "Dr. House"


# ---------------------------------------------------------------------------
# 5. mark sample taken crea LabOrder para test de Laboratorio
# ---------------------------------------------------------------------------
def test_mark_sample_taken_creates_lab_order_for_lab_test(client, prisma_mock):
    _seed_category()
    t_bh = _seed_test("t-bh", "BH", "64d3f863")
    wid = _seed_worker()
    eid = _seed_medical_event("e-4", worker_id=wid)
    etid = _seed_event_test("et-4", event_id=eid, test_id=t_bh, status="PENDING")

    resp = client.post(
        f"/api/v1/event_tests/{etid}/sample",
        json={"notes": "ok"},
        headers={"x-ami-userid": "u-1"},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["status"] == "SAMPLE_TAKEN"
    assert body["triggeredLabOrder"] is not None
    assert body["triggeredLabOrder"]["itemsCount"] == 1
    assert body["triggeredLabOrder"]["alreadyExisted"] is False

    # Verificar que la LabOrder se creó
    assert len(prisma_mock.laborder._items) == 1
    assert prisma_mock.laborder._items[0]["medicalEventId"] == eid
    assert prisma_mock.laborder._items[0]["status"] == "DRAFT"


# ---------------------------------------------------------------------------
# 6. Idempotente
# ---------------------------------------------------------------------------
def test_mark_sample_taken_is_idempotent(client, prisma_mock):
    _seed_category()
    t_bh = _seed_test("t-bh", "BH", "64d3f863")
    wid = _seed_worker()
    eid = _seed_medical_event("e-5", worker_id=wid)
    etid = _seed_event_test("et-5", event_id=eid, test_id=t_bh, status="SAMPLE_TAKEN")

    resp = client.post(f"/api/v1/event_tests/{etid}/sample", headers={"x-ami-userid": "u-1"})
    body = resp.json()
    assert body["alreadyTaken"] is True
    # NO debe crear nueva LabOrder
    assert len(prisma_mock.laborder._items) == 0


# ---------------------------------------------------------------------------
# 7. NO crea LabOrder si el test no es de categoría Laboratorio
# ---------------------------------------------------------------------------
def test_mark_sample_taken_does_not_trigger_for_non_lab_test(client, prisma_mock):
    _seed_category("64d3f863", "Laboratorio")
    asyncio.run(prisma_mock.testcategory.create(data={"id": "98a62682", "name": "Imagenología"}))
    t_rx = _seed_test("t-rx", "RX", "98a62682")
    wid = _seed_worker()
    eid = _seed_medical_event("e-6", worker_id=wid)
    etid = _seed_event_test("et-6", event_id=eid, test_id=t_rx, status="PENDING")

    resp = client.post(f"/api/v1/event_tests/{etid}/sample", headers={"x-ami-userid": "u-1"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["triggeredLabOrder"] is None
    assert body["status"] == "SAMPLE_TAKEN"
    assert len(prisma_mock.laborder._items) == 0


# ---------------------------------------------------------------------------
# 8. 404 si no existe el EventTest
# ---------------------------------------------------------------------------
def test_mark_sample_taken_404_for_missing_event_test(client, prisma_mock):
    resp = client.post(
        "/api/v1/event_tests/does-not-exist/sample",
        headers={"x-ami-userid": "u-1"},
    )
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# 9. auto-generate retorna DRAFT existente (idempotencia)
# ---------------------------------------------------------------------------
def test_auto_generate_returns_existing_draft(client, prisma_mock):
    _seed_category()
    t_bh = _seed_test("t-bh", "BH", "64d3f863")
    wid = _seed_worker()
    eid = _seed_medical_event("e-7", worker_id=wid)
    etid = _seed_event_test("et-7", event_id=eid, test_id=t_bh, status="SAMPLE_TAKEN")

    # Pre-crear LabOrder DRAFT
    asyncio.run(prisma_mock.laborder.create(data={
        "folio": 1, "branch": "MATRIZ", "workerId": wid, "doctorName": "Dr",
        "status": "DRAFT", "createdById": "u-1",
    }))
    order_id = prisma_mock.laborder._items[0]["id"]
    asyncio.run(prisma_mock.laborderitem.create(data={
        "labOrderId": order_id, "medicalTestId": t_bh, "eventTestId": etid,
        "price": 0, "amount": 0, "resultStatus": "P",
    }))

    resp = client.post(
        "/api/v1/lab/auto-generate-from-event",
        json={"medicalEventId": eid},
        headers={"x-ami-userid": "u-1"},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["alreadyExisted"] is True
    assert body["labOrderId"] == order_id
    # No debe duplicar la LabOrder
    assert len(prisma_mock.laborder._items) == 1


# ---------------------------------------------------------------------------
# 10. auto-generate crea nueva LabOrder con items
# ---------------------------------------------------------------------------
def test_auto_generate_creates_new_draft_with_items(client, prisma_mock):
    _seed_category()
    t_bh = _seed_test("t-bh", "BH", "64d3f863")
    t_qs = _seed_test("t-qs", "QS", "64d3f863")
    wid = _seed_worker()
    eid = _seed_medical_event("e-8", worker_id=wid)
    _seed_event_test("et-bh", event_id=eid, test_id=t_bh, test_name="BH", status="SAMPLE_TAKEN")
    _seed_event_test("et-qs", event_id=eid, test_id=t_qs, test_name="QS", status="SAMPLE_TAKEN")

    resp = client.post(
        "/api/v1/lab/auto-generate-from-event",
        json={"medicalEventId": eid},
        headers={"x-ami-userid": "u-1"},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["alreadyExisted"] is False
    assert body["itemsCount"] == 2
    assert body["status"] == "DRAFT"
    assert len(prisma_mock.laborder._items) == 1
    assert len(prisma_mock.laborderitem._items) == 2


# ---------------------------------------------------------------------------
# 11. 404 si MedicalEvent no existe
# ---------------------------------------------------------------------------
def test_auto_generate_404_for_missing_event(client, prisma_mock):
    resp = client.post(
        "/api/v1/lab/auto-generate-from-event",
        json={"medicalEventId": "does-not-exist"},
        headers={"x-ami-userid": "u-1"},
    )
    assert resp.status_code == 404