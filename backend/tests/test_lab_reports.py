"""
IMPL-20260708-19: Fase 3 NOVA absorción (ARCH-20260707-17) — F Reportes PDF.

Tests pytest para los 3 endpoints de PDF imprimibles:
  - GET /api/v1/lab/reports/etiquetas/{orderId}
  - GET /api/v1/lab/reports/resultados/{orderId}
  - GET /api/v1/lab/reports/recibos/{orderId}

Verifica que cada endpoint retorne un PDF válido (magic bytes `%PDF-`)
y Content-Disposition correcto. Cubre ≥ 4 casos.
"""
import os
import sys
import asyncio
from typing import Any, Dict, List, Optional
from unittest.mock import MagicMock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.api.v1.lab.reports import router as reports_router  # noqa: E402


# Magic bytes de un PDF válido
PDF_MAGIC = b"%PDF-"


# ---------------------------------------------------------------------------
# Mock Prisma client (en memoria)
# ---------------------------------------------------------------------------
def _make_prisma_mock() -> MagicMock:
    tables: Dict[str, List[Dict[str, Any]]] = {
        "laborder": [],
        "laborderitem": [],
        "labresult": [],
        "labanalyte": [],
        "labunit": [],
        "medicaltest": [],
        "worker": [],
        "company": [],
        "user": [],
        "labcashmovement": [],
    }

    def _apply_includes(item: Dict[str, Any], include) -> Dict[str, Any]:
        if not include:
            return dict(item)
        result = dict(item)
        if not isinstance(include, dict):
            return result
        for rel_name in include.keys():
            if rel_name in ("include", "where", "orderBy", "order_by", "take", "skip"):
                continue
            if rel_name == "worker":
                wid = item.get("workerId")
                if wid is not None:
                    w = next((r for r in tables["worker"] if r.get("id") == wid), None)
                    result["worker"] = w
            elif rel_name == "company":
                cid = item.get("companyId")
                if cid is not None:
                    c = next((r for r in tables["company"] if r.get("id") == cid), None)
                    result["company"] = c
            elif rel_name == "labOrder":
                oid = item.get("labOrderId")
                if oid is not None:
                    o = next((r for r in tables["laborder"] if r.get("id") == oid), None)
                    result["labOrder"] = o
            elif rel_name == "user":
                uid = item.get("userId")
                if uid is not None:
                    u = next((r for r in tables["user"] if r.get("id") == uid), None)
                    result["user"] = u
            elif rel_name == "medicalTest":
                tid = item.get("medicalTestId")
                if tid is not None:
                    t = next((r for r in tables["medicaltest"] if r.get("id") == tid), None)
                    result["medicalTest"] = t
            elif rel_name == "analyte":
                aid = item.get("analyteId")
                if aid is not None:
                    a = next((r for r in tables["labanalyte"] if r.get("id") == aid), None)
                    result["analyte"] = a
            elif rel_name == "unit":
                uid2 = item.get("unitId")
                if uid2 is not None:
                    u2 = next((r for r in tables["labunit"] if r.get("id") == uid2), None)
                    result["unit"] = u2
        return result

    def _matches(item: Dict[str, Any], where: Optional[Dict[str, Any]]) -> bool:
        if not where:
            return True
        for k, v in where.items():
            if isinstance(v, dict):
                if "gte" in v and not (item.get(k) is not None and item.get(k) >= v["gte"]):
                    return False
                if "lte" in v and not (item.get(k) is not None and item.get(k) <= v["lte"]):
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

        delegate.find_many.side_effect = find_many
        delegate.find_unique.side_effect = find_unique
        return delegate

    for name in tables:
        setattr(prisma, name, _make_delegate(name))

    return prisma


def _build_test_app() -> FastAPI:
    test_app = FastAPI(title="lab-reports-tests")
    test_app.include_router(reports_router)
    return test_app


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------
@pytest.fixture
def prisma_mock():
    return _make_prisma_mock()


@pytest.fixture
def client(prisma_mock):
    # Inyectar el mock en lab_order_service (la fuente canónica de prisma
    # que el router de reports consume vía get_order_full o _load_full_order).
    from app.services import lab_order_service as order_svc
    order_svc.set_prisma_client(prisma_mock)
    return TestClient(_build_test_app())


# ---------------------------------------------------------------------------
# Seeders
# ---------------------------------------------------------------------------
def _seed_order(prisma: MagicMock, pid: str = "ord-1", status: str = "SAVED"):
    prisma.laborder._items.append({
        "id": pid,
        "folio": 1,
        "branch": "MATRIZ",
        "workerId": "w-1",
        "doctorName": "Dr Test",
        "doctorClave": "TST",
        "status": status,
        "urgency": "NORMAL",
        "subtotal": 100.0,
        "ivaPct": 16.0,
        "iva": 16.0,
        "total": 116.0,
        "isCourtesy": False,
        "createdAt": "2026-07-07T10:00:00",
    })


def _seed_worker(prisma: MagicMock, wid: str = "w-1"):
    prisma.worker._items.append({
        "id": wid,
        "firstName": "Juan",
        "lastName": "Pérez",
        "universalId": "UNI-001",
    })


def _seed_company(prisma: MagicMock, cid: str = "c-1"):
    prisma.company._items.append({"id": cid, "name": "ACME S.A."})


def _seed_test(prisma: MagicMock, tid: str = "mt-1"):
    prisma.medicaltest._items.append({"id": tid, "code": "BH", "name": "Biometría Hemática"})


def _seed_item(prisma: MagicMock, iid: str = "li-1", order_id: str = "ord-1", test_id: str = "mt-1"):
    prisma.laborderitem._items.append({
        "id": iid,
        "labOrderId": order_id,
        "medicalTestId": test_id,
        "price": 100.0,
        "discountAmount": 0.0,
        "discountPct": 0.0,
        "amount": 100.0,
        "resultStatus": "P",
    })


def _seed_analyte(prisma: MagicMock, aid: str = "a-1"):
    prisma.labanalyte._items.append({"id": aid, "code": "HGB", "name": "Hemoglobina"})


def _seed_unit(prisma: MagicMock, uid: str = "u-1"):
    prisma.labunit._items.append({"id": uid, "symbol": "g/dL"})


def _seed_result(prisma: MagicMock, rid: str = "r-1", item_id: str = "li-1",
                 analyte_id: str = "a-1", unit_id: str = "u-1", value: float = 14.5):
    prisma.labresult._items.append({
        "id": rid,
        "labOrderItemId": item_id,
        "analyteId": analyte_id,
        "valueNumber": value,
        "valueText": None,
        "unitId": unit_id,
        "isOutOfRange": False,
        "isCritical": False,
        "status": "REPORTED",
    })


def _seed_payment(prisma: MagicMock, pid: str = "p-1", order_id: str = "ord-1",
                  amount: float = 50.0, method: str = "CASH"):
    prisma.labcashmovement._items.append({
        "id": pid,
        "labOrderId": order_id,
        "amount": amount,
        "method": method,
        "reference": None,
        "currency": "MXN",
        "userId": "u-1",
        "createdAt": "2026-07-07T11:00:00",
    })
    prisma.user._items.append({"id": "u-1", "fullName": "Cajero 1"})


def _seed_full_order(prisma: MagicMock):
    """Carga una orden completa para que los 3 PDFs tengan datos."""
    _seed_order(prisma)
    _seed_worker(prisma)
    _seed_company(prisma)
    _seed_test(prisma)
    _seed_item(prisma)
    _seed_analyte(prisma)
    _seed_unit(prisma)
    _seed_result(prisma)
    _seed_payment(prisma)


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------
def test_etiquetas_pdf_returns_valid_pdf(client, prisma_mock):
    _seed_full_order(prisma_mock)
    resp = client.get("/api/v1/lab/reports/etiquetas/ord-1")
    assert resp.status_code == 200, resp.text
    assert resp.headers["content-type"] == "application/pdf"
    body = resp.content
    assert body[:5] == PDF_MAGIC, f"No inicia con %PDF-: {body[:10]}"
    assert len(body) > 100, "PDF demasiado pequeño"
    cd = resp.headers.get("content-disposition", "")
    assert "etiquetas" in cd
    assert "ord-1" in cd or "1.pdf" in cd


def test_resultados_pdf_returns_valid_pdf(client, prisma_mock):
    _seed_full_order(prisma_mock)
    resp = client.get("/api/v1/lab/reports/resultados/ord-1")
    assert resp.status_code == 200, resp.text
    assert resp.headers["content-type"] == "application/pdf"
    body = resp.content
    assert body[:5] == PDF_MAGIC
    assert len(body) > 100
    cd = resp.headers.get("content-disposition", "")
    assert "resultados" in cd


def test_recibo_pdf_returns_valid_pdf(client, prisma_mock):
    _seed_full_order(prisma_mock)
    resp = client.get("/api/v1/lab/reports/recibos/ord-1")
    assert resp.status_code == 200, resp.text
    assert resp.headers["content-type"] == "application/pdf"
    body = resp.content
    assert body[:5] == PDF_MAGIC
    assert len(body) > 100
    cd = resp.headers.get("content-disposition", "")
    assert "recibo" in cd


def test_pdfs_return_404_for_missing_order(client, prisma_mock):
    # No seed nada
    for path in ("etiquetas", "resultados", "recibos"):
        resp = client.get(f"/api/v1/lab/reports/{path}/ghost-{path}")
        assert resp.status_code == 404, f"{path}: {resp.status_code} {resp.text}"
        assert "no existe" in resp.json()["detail"]


def test_pdfs_handle_minimal_order_without_items(client, prisma_mock):
    """Una orden SIN items ni pagos ni resultados debe generar PDFs válidos."""
    _seed_order(prisma_mock)
    _seed_worker(prisma_mock)
    # company / items / results / payments vacíos
    for path in ("etiquetas", "resultados", "recibos"):
        resp = client.get(f"/api/v1/lab/reports/{path}/ord-1")
        assert resp.status_code == 200, f"{path}: {resp.status_code} {resp.text}"
        assert resp.content[:5] == PDF_MAGIC, f"{path}: no inicia con %PDF-"


def test_etiquetas_filename_uses_folio(client, prisma_mock):
    """El filename debe incluir el folio cuando existe."""
    _seed_full_order(prisma_mock)
    resp = client.get("/api/v1/lab/reports/etiquetas/ord-1")
    cd = resp.headers.get("content-disposition", "")
    # folio=1 → filename = etiquetas_1.pdf
    assert "etiquetas_1.pdf" in cd, f"filename esperado 'etiquetas_1.pdf', got '{cd}'"