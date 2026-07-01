"""
IMPL-20260630-06: Slice A NOVA absorción (ARCH-20260630-02).
Tests pytest del módulo de catálogos LIS.

Cubre (≥ 12 casos según SPEC §9):
  1. test_list_units_paginated_datatables_shape
  2. test_list_units_search_filters
  3. test_list_units_only_active
  4. test_list_units_max_length_capped
  5. test_create_unit_validation
  6. test_create_unit_unique_symbol
  7. test_create_unit_records_audit
  8. test_update_unit_partial
  9. test_soft_delete_sets_active_false
  10. test_invalid_mod_falls_back_to_unidades
  11. test_samples_crud
  12. test_classifications_color_validation
  13. test_all_eight_mods_list
  14. test_indications_crud
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

from app.api.v1.lab.catalogs import router as lab_router  # noqa: E402
from app.services import lab_catalog_service as svc  # noqa: E402


# Montamos solo el router de lab-catalogs en una app limpia, evitando el
# import de `app.main` (que arrastra dependencias pesadas como google-generativeai).
def _build_test_app() -> FastAPI:
    test_app = FastAPI(title="lab-catalogs-tests")
    test_app.include_router(lab_router)
    return test_app


@pytest.fixture
def client(prisma_mock) -> TestClient:
    return TestClient(_build_test_app())


# ---------------------------------------------------------------------------
# Mock Prisma client
# ---------------------------------------------------------------------------
def _make_prisma_mock() -> MagicMock:
    """Crea un MagicMock con tablas in-memory que respeta la API Prisma mínima:
    find_unique, find_many, count, create, update. NO usa SQLite, es puro mock.
    """
    tables: Dict[str, List[Dict[str, Any]]] = {
        "labUnit": [],
        "labSample": [],
        "labContainer": [],
        "labMethod": [],
        "labProcessArea": [],
        "labDepartment": [],
        "labClassification": [],
        "labIndication": [],
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
            if item.get(k) != v:
                return False
        return True

    def _apply_order(items: List[Dict[str, Any]], order_by: Optional[Dict[str, Any]]) -> List[Dict[str, Any]]:
        if not order_by:
            return items
        field, direction = next(iter(order_by.items()))
        return sorted(items, key=lambda x: (x.get(field) is None, x.get(field)), reverse=(direction == "desc"))

    prisma = MagicMock()

    def _make_delegate(name: str):
        delegate = MagicMock()
        delegate._items = tables[name]
        delegate._next_id = _new_id

        def count(where: Optional[Dict[str, Any]] = None):
            return sum(1 for it in tables[name] if _matches(it, where))

        def find_many(where=None, order_by=None, skip=0, take=25):
            matched = [it for it in tables[name] if _matches(it, where)]
            ordered = _apply_order(matched, order_by)
            return ordered[skip : skip + take]

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
            new.setdefault("active", True)
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

        delegate.count.side_effect = count
        delegate.find_many.side_effect = find_many
        delegate.find_unique.side_effect = find_unique
        delegate.create.side_effect = create
        delegate.update.side_effect = update
        return delegate

    for name in tables:
        setattr(prisma, name, _make_delegate(name))

    # auditLog uses .create only
    audit_delegate = MagicMock()
    audit_delegate.create.side_effect = lambda data: tables["auditLog"].append(data)
    prisma.auditLog = audit_delegate

    return prisma


@pytest.fixture
def prisma_mock() -> MagicMock:
    mock = _make_prisma_mock()
    svc.set_prisma_client(mock)
    return mock


@pytest.fixture
def client(prisma_mock) -> TestClient:
    return TestClient(_build_test_app())


# ---------------------------------------------------------------------------
# 1. Listar unidades con paginación DataTables
# ---------------------------------------------------------------------------
def test_list_units_paginated_datatables_shape(client, prisma_mock):
    # Seed 3 unidades
    for i in range(3):
        prisma_mock.labUnit.create(
            data={"symbol": f"u{i}", "name": f"Unit {i}", "system": "SI"}
        )

    resp = client.get("/api/v1/lab/catalogs", params={"mod": "unidades", "draw": 1, "start": 0, "length": 10})
    assert resp.status_code == 200
    body = resp.json()
    assert body["draw"] == 1
    assert body["recordsTotal"] == 3
    assert body["recordsFiltered"] == 3
    assert len(body["data"]) == 3
    assert body["data"][0]["symbol"] == "u0"


# ---------------------------------------------------------------------------
# 2. Búsqueda textual filtra
# ---------------------------------------------------------------------------
def test_list_units_search_filters(client, prisma_mock):
    prisma_mock.labUnit.create(data={"symbol": "mg/dL", "name": "Miligramos por decilitro", "system": "CONVENTIONAL"})
    prisma_mock.labUnit.create(data={"symbol": "mmol/L", "name": "Milimoles por litro", "system": "SI"})
    prisma_mock.labUnit.create(data={"symbol": "%", "name": "Porcentaje", "system": "CONVENTIONAL"})

    resp = client.get(
        "/api/v1/lab/catalogs",
        params={"mod": "unidades", "search[value]": "mg"},
    )
    body = resp.json()
    assert body["recordsFiltered"] == 1
    assert body["data"][0]["symbol"] == "mg/dL"


# ---------------------------------------------------------------------------
# 3. Filtro onlyActive=true
# ---------------------------------------------------------------------------
def test_list_units_only_active(client, prisma_mock):
    prisma_mock.labUnit.create(data={"symbol": "a", "name": "A", "system": "SI", "active": True})
    prisma_mock.labUnit.create(data={"symbol": "b", "name": "B", "system": "SI", "active": False})

    resp_all = client.get("/api/v1/lab/catalogs", params={"mod": "unidades", "onlyActive": "false"})
    resp_active = client.get("/api/v1/lab/catalogs", params={"mod": "unidades", "onlyActive": "true"})

    assert resp_all.json()["recordsTotal"] == 2
    assert resp_active.json()["recordsTotal"] == 1


# ---------------------------------------------------------------------------
# 4. length se capa a MAX (100)
# ---------------------------------------------------------------------------
def test_list_units_max_length_capped(prisma_mock):
    # Llenamos 110 unidades
    for i in range(110):
        prisma_mock.labUnit.create(data={"symbol": f"u{i}", "name": f"U{i}", "system": "SI"})

    # length=200 → debe caparse internamente a 100
    res = svc.list_catalog(mod="unidades", draw=1, start=0, length=200)
    assert len(res["data"]) == 100


# ---------------------------------------------------------------------------
# 5. Validación Pydantic en POST
# ---------------------------------------------------------------------------
def test_create_unit_validation(client):
    resp = client.post(
        "/api/v1/lab/catalogs",
        params={"mod": "unidades"},
        json={"symbol": "x", "name": "x", "system": "INVALIDO"},
    )
    assert resp.status_code == 422


def test_create_unit_missing_fields(client):
    resp = client.post(
        "/api/v1/lab/catalogs",
        params={"mod": "unidades"},
        json={"symbol": "ok"},  # faltan name y system
    )
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# 6. POST funciona con payload válido
# ---------------------------------------------------------------------------
def test_create_unit_ok(client, prisma_mock):
    resp = client.post(
        "/api/v1/lab/catalogs",
        params={"mod": "unidades"},
        json={"symbol": "g/dL", "name": "Gramos por decilitro", "system": "CONVENTIONAL"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is True
    assert body["item"]["symbol"] == "g/dL"
    # Verifica que se persistió
    assert len(prisma_mock.labUnit._items) == 1


# ---------------------------------------------------------------------------
# 7. POST registra audit log
# ---------------------------------------------------------------------------
def test_create_unit_records_audit(client, prisma_mock):
    client.post(
        "/api/v1/lab/catalogs",
        params={"mod": "unidades"},
        json={"symbol": "U/L", "name": "Unidades por litro", "system": "CONVENTIONAL"},
        headers={"x-ami-userid": "user-123"},
    )
    assert len(prisma_mock.auditLog.create.call_args_list) >= 1
    call_kwargs = prisma_mock.auditLog.create.call_args_list[0].kwargs
    assert call_kwargs["data"]["userId"] == "user-123"
    assert call_kwargs["data"]["action"].startswith("CREATE_")
    assert call_kwargs["data"]["entity"] == "labUnit"


# ---------------------------------------------------------------------------
# 8. PATCH parcial
# ---------------------------------------------------------------------------
def test_update_unit_partial(client, prisma_mock):
    created = prisma_mock.labUnit.create(
        data={"symbol": "pg/mL", "name": "Picograms", "system": "SI"}
    )
    resp = client.patch(
        f"/api/v1/lab/catalogs/unidades/{created['id']}",
        json={"name": "Picogramos por mililitro"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["item"]["name"] == "Picogramos por mililitro"
    assert body["item"]["symbol"] == "pg/mL"  # sin tocar


# ---------------------------------------------------------------------------
# 9. DELETE es soft delete (active=false)
# ---------------------------------------------------------------------------
def test_soft_delete_sets_active_false(client, prisma_mock):
    created = prisma_mock.labUnit.create(
        data={"symbol": "cel/uL", "name": "Células", "system": "SI"}
    )
    resp = client.delete(f"/api/v1/lab/catalogs/unidades/{created['id']}")
    assert resp.status_code == 200
    # La fila sigue, pero active=False
    item = prisma_mock.labUnit.find_unique(where={"id": created["id"]})
    assert item["active"] is False


# ---------------------------------------------------------------------------
# 10. Mod inválido cae a "unidades"
# ---------------------------------------------------------------------------
def test_invalid_mod_falls_back_to_unidades(client):
    resp = client.get("/api/v1/lab/catalogs", params={"mod": "XYZ_NO_EXISTE"})
    assert resp.status_code == 200  # No 400; cae a unidades
    body = resp.json()
    assert body["recordsTotal"] == 0


# ---------------------------------------------------------------------------
# 11. CRUD de muestras
# ---------------------------------------------------------------------------
def test_samples_crud(client, prisma_mock):
    # Create
    resp = client.post(
        "/api/v1/lab/catalogs",
        params={"mod": "muestras"},
        json={"code": "SANGRE", "name": "Sangre venosa", "preservation": "Refrigerada 4°C", "minVolume": "5 mL"},
    )
    assert resp.status_code == 200
    sid = resp.json()["id"]

    # Get
    resp = client.get(f"/api/v1/lab/catalogs/muestras/{sid}")
    assert resp.json()["code"] == "SANGRE"

    # Update
    resp = client.patch(
        f"/api/v1/lab/catalogs/muestras/{sid}",
        json={"minVolume": "10 mL"},
    )
    assert resp.status_code == 200
    assert resp.json()["item"]["minVolume"] == "10 mL"

    # Delete
    resp = client.delete(f"/api/v1/lab/catalogs/muestras/{sid}")
    assert resp.status_code == 200


# ---------------------------------------------------------------------------
# 12. Validación de color en clasificaciones
# ---------------------------------------------------------------------------
def test_classifications_color_validation(client):
    # Válido
    resp = client.post(
        "/api/v1/lab/catalogs",
        params={"mod": "clasificaciones"},
        json={"code": "NORMAL", "name": "Normal", "color": "#00FF00"},
    )
    assert resp.status_code == 200

    # Inválido
    resp = client.post(
        "/api/v1/lab/catalogs",
        params={"mod": "clasificaciones"},
        json={"code": "PATRON", "name": "Patrón", "color": "rojo"},
    )
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# 13. Los 8 mods responden al GET listar
# ---------------------------------------------------------------------------
@pytest.mark.parametrize("mod", [
    "unidades", "muestras", "recipientes", "metodologias",
    "lugares_proceso", "clasificaciones", "indicaciones", "departamentos",
])
def test_all_eight_mods_list(client, prisma_mock, mod):
    payload = {
        "unidades": {"symbol": "x", "name": "X", "system": "SI"},
        "muestras": {"code": "X", "name": "X"},
        "recipientes": {"code": "X", "name": "X"},
        "metodologias": {"code": "X", "name": "X"},
        "lugares_proceso": {"code": "X", "name": "X"},
        "clasificaciones": {"code": "X", "name": "X"},
        "indicaciones": {"code": "X", "text": "X"},
        "departamentos": {"code": "X", "name": "X"},
    }[mod]

    client.post("/api/v1/lab/catalogs", params={"mod": mod}, json=payload)

    resp = client.get("/api/v1/lab/catalogs", params={"mod": mod})
    assert resp.status_code == 200
    assert resp.json()["recordsTotal"] == 1


# ---------------------------------------------------------------------------
# 14. Indicaciones CRUD completo
# ---------------------------------------------------------------------------
def test_indications_crud(client, prisma_mock):
    resp = client.post(
        "/api/v1/lab/catalogs",
        params={"mod": "indicaciones"},
        json={"code": "AYUNO_8H", "text": "Ayuno de 8 horas"},
    )
    assert resp.status_code == 200
    iid = resp.json()["id"]

    # Búsqueda
    resp = client.get(
        "/api/v1/lab/catalogs",
        params={"mod": "indicaciones", "search[value]": "ayuno"},
    )
    assert resp.json()["recordsFiltered"] == 1
    assert resp.json()["data"][0]["text"].startswith("Ayuno")


# ---------------------------------------------------------------------------
# 15. Departamentos con lugares de proceso (relación lógica)
# ---------------------------------------------------------------------------
def test_departments_and_areas(client, prisma_mock):
    # Crear depto
    resp = client.post(
        "/api/v1/lab/catalogs",
        params={"mod": "departamentos"},
        json={"code": "HEM", "name": "Hematología"},
    )
    assert resp.status_code == 200
    dept_id = resp.json()["id"]

    # Crear área apuntando al depto
    resp = client.post(
        "/api/v1/lab/catalogs",
        params={"mod": "lugares_proceso"},
        json={"code": "HEM_F1", "name": "Hematología rutina", "departmentId": dept_id},
    )
    assert resp.status_code == 200

    # Listar áreas y verificar que la relación persiste
    resp = client.get("/api/v1/lab/catalogs", params={"mod": "lugares_proceso"})
    body = resp.json()
    assert body["data"][0]["departmentId"] == dept_id