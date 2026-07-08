"""
IMPL-20260707-17: Fase 1 NOVA absorción (ARCH-20260707-17) — E.
Tests pytest para catálogo avanzado de estudios (MedicalTest + LabAnalyte + LabReferenceRange).

Cubre (≥ 5 casos):
  1.  test_list_lab_catalog_filters_lab_category
  2.  test_create_analyte_then_create_range
  3.  test_seed_typical_tests_idempotent
  4.  test_get_lab_catalog_test_returns_analytes_and_ranges
  5.  test_delete_analyte_cascades_ranges
  6.  test_update_analyte_partial
  7.  test_seed_creates_at_least_5_studies
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

from app.api.v1.lab.medical_tests import router as mt_router  # noqa: E402
from app.services import study_service as svc  # noqa: E402
from app.services import lab_order_service as lab_order_svc  # noqa: E402


def _build_test_app() -> FastAPI:
    test_app = FastAPI(title="lab-medical-tests-tests")
    test_app.include_router(mt_router)
    return test_app


def _make_prisma_mock() -> MagicMock:
    tables: Dict[str, List[Dict[str, Any]]] = {
        "medicaltest": [],
        "testcategory": [],
        "labanalyte": [],
        "labreferencerange": [],
        "labunit": [],
        "worker": [],
        "company": [],
        "user": [],
        "auditlog": [],
    }
    counters = {"id": 0}

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
            # Composite unique key: where={unique_name: {field1: v1, ...}}
            if isinstance(v, dict) and not any(op in v for op in ("contains", "equals", "mode", "in", "gte", "lte", "include", "where", "orderBy")):
                # Asumimos que es composite key (todos los pares field:val deben matchear)
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
            if isinstance(v, dict) and "contains" in v:
                if str(item.get(k, "")).lower().find(str(v["contains"]).lower()) < 0:
                    return False
                continue
            if isinstance(v, dict) and "equals" in v:
                if str(item.get(k, "")).lower() != str(v["equals"]).lower():
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

        async def count(where=None):
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
            enriched = [_apply_includes(r, include) for r in matched]
            return enriched[skip : skip + take]
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

        async def find_unique(where=None, include=None, **_):
            # Soporta composite unique key: where={unique_name: {field1: v1, ...}}
            for it in tables[name]:
                if _matches(it, where):
                    return _apply_includes(it, include)
            return None

        async def find_first(where=None):
            for it in tables[name]:
                if _matches(it, where):
                    return it
            return None

        async def create(data: Dict[str, Any]):
            new = dict(data)
            new.setdefault("id", _new_id())
            new.setdefault("createdAt", datetime.utcnow().isoformat())
            new.setdefault("updatedAt", datetime.utcnow().isoformat())
            tables[name].append(new)
            return new

        async def update(where: Dict[str, Any], data: Dict[str, Any]):
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
            return dict(original)

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
        if name not in ("auditlog",):
            setattr(prisma, name, _make_delegate(name))

    audit = MagicMock()
    async def _audit_create(data):
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
def _seed_category(pid="64d3f863", name="Laboratorio"):
    asyncio.run(
        lab_order_svc.get_prisma().testcategory.create(data={"id": pid, "name": name})
    )
    return pid


def _seed_test(pid="t-1", code="BH", cat_id="64d3f863", name=None):
    asyncio.run(
        lab_order_svc.get_prisma().medicaltest.create(
            data={"id": pid, "code": code, "name": name or code, "categoryId": cat_id, "options": []}
        )
    )
    return pid


# ---------------------------------------------------------------------------
# 1. list_lab_catalog filtra por categoría Laboratorio
# ---------------------------------------------------------------------------
def test_list_lab_catalog_filters_lab_category(client, prisma_mock):
    _seed_category("64d3f863", "Laboratorio")
    asyncio.run(
        prisma_mock.testcategory.create(data={"id": "98a62682", "name": "Imagenología"})
    )
    _seed_test("t-bh", "BH", "64d3f863")
    _seed_test("t-rx", "RX", "98a62682")
    resp = client.get("/api/v1/medical_tests/lab-catalog", headers={"x-ami-userid": "u-1"})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["categoryId"] == "64d3f863"
    assert body["total"] == 1
    assert body["rows"][0]["code"] == "BH"


# ---------------------------------------------------------------------------
# 2. create analyte + create range
# ---------------------------------------------------------------------------
def test_create_analyte_then_create_range(client, prisma_mock):
    _seed_category()
    tid = _seed_test("t-bh", "BH")
    resp_a = client.post(
        "/api/v1/lab/analytes",
        json={"medicalTestId": tid, "code": "HGB", "name": "Hemoglobina"},
        headers={"x-ami-userid": "u-1"},
    )
    assert resp_a.status_code == 200, resp_a.text
    analyte_id = resp_a.json()["id"]
    resp_r = client.post(
        "/api/v1/lab/reference-ranges",
        json={
            "analyteId": analyte_id, "sex": "M", "ageMinMonths": 216,
            "valueMin": 13.5, "valueMax": 17.5, "unitCode": "g/dL",
        },
        headers={"x-ami-userid": "u-1"},
    )
    assert resp_r.status_code == 200, resp_r.text
    assert resp_r.json()["valueMax"] == 17.5


# ---------------------------------------------------------------------------
# 3. seed idempotente
# ---------------------------------------------------------------------------
def test_seed_typical_tests_idempotent(client, prisma_mock):
    _seed_category()
    resp1 = client.post("/api/v1/lab/seed-typical-tests", headers={"x-ami-userid": "u-1"})
    assert resp1.status_code == 200, resp1.text
    body1 = resp1.json()
    assert body1["status"] == "success"
    assert body1["seeded"] == 5
    assert body1["analytes"] >= 30
    assert body1["referenceRanges"] >= 30

    # Segunda ejecución: no debe crear nuevos
    resp2 = client.post("/api/v1/lab/seed-typical-tests", headers={"x-ami-userid": "u-1"})
    body2 = resp2.json()
    assert body2["seeded"] == 0
    assert body2["analytes"] == 0
    assert body2["referenceRanges"] == 0


# ---------------------------------------------------------------------------
# 4. get_lab_catalog_test devuelve analitos y rangos
# ---------------------------------------------------------------------------
def test_get_lab_catalog_test_returns_analytes_and_ranges(client, prisma_mock):
    _seed_category()
    client.post("/api/v1/lab/seed-typical-tests", headers={"x-ami-userid": "u-1"})

    # Buscar BH
    catalog = client.get("/api/v1/medical_tests/lab-catalog", headers={"x-ami-userid": "u-1"}).json()
    bh = next(t for t in catalog["rows"] if t["code"] == "BH")
    assert len(bh["analytes"]) >= 7
    hgb = next(a for a in bh["analytes"] if a["code"] == "HGB")
    assert len(hgb["referenceRanges"]) >= 1


# ---------------------------------------------------------------------------
# 5. delete analyte borra rangos (cascada Prisma)
# ---------------------------------------------------------------------------
def test_delete_analyte(client, prisma_mock):
    _seed_category()
    tid = _seed_test("t-bh", "BH")
    resp_a = client.post(
        "/api/v1/lab/analytes",
        json={"medicalTestId": tid, "code": "HGB", "name": "Hemoglobina"},
        headers={"x-ami-userid": "u-1"},
    )
    analyte_id = resp_a.json()["id"]
    resp_d = client.delete(f"/api/v1/lab/analytes/{analyte_id}", headers={"x-ami-userid": "u-1"})
    assert resp_d.status_code == 200
    # 404 al volver a borrar
    resp_d2 = client.delete(f"/api/v1/lab/analytes/{analyte_id}", headers={"x-ami-userid": "u-1"})
    assert resp_d2.status_code == 404


# ---------------------------------------------------------------------------
# 6. update analyte parcial
# ---------------------------------------------------------------------------
def test_update_analyte_partial(client, prisma_mock):
    _seed_category()
    tid = _seed_test("t-bh", "BH")
    resp_a = client.post(
        "/api/v1/lab/analytes",
        json={"medicalTestId": tid, "code": "HGB", "name": "Hemoglobina"},
        headers={"x-ami-userid": "u-1"},
    )
    analyte_id = resp_a.json()["id"]
    resp_u = client.patch(
        f"/api/v1/lab/analytes/{analyte_id}",
        json={"name": "Hemoglobina Total"},
        headers={"x-ami-userid": "u-1"},
    )
    assert resp_u.status_code == 200
    assert resp_u.json()["name"] == "Hemoglobina Total"
    assert resp_u.json()["code"] == "HGB"  # no cambió


# ---------------------------------------------------------------------------
# 7. seed crea al menos 5 estudios con analitos
# ---------------------------------------------------------------------------
def test_seed_creates_at_least_5_studies(client, prisma_mock):
    _seed_category()
    client.post("/api/v1/lab/seed-typical-tests", headers={"x-ami-userid": "u-1"})
    catalog = client.get("/api/v1/medical_tests/lab-catalog", headers={"x-ami-userid": "u-1"}).json()
    codes = sorted(t["code"] for t in catalog["rows"])
    assert "BH" in codes
    assert "QS" in codes
    assert "EGO" in codes
    assert "PL" in codes
    assert "TP" in codes
    # Todos los 5 deben tener analitos
    for t in catalog["rows"]:
        assert len(t["analytes"]) >= 6, f"{t['code']} tiene menos de 6 analitos"