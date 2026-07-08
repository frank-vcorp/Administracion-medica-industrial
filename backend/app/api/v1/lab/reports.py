"""
IMPL-20260708-19: Fase 3 NOVA absorción (ARCH-20260707-17) — F Reportes PDF.

Rutas REST para los 3 PDFs imprimibles:
  - GET /api/v1/lab/reports/etiquetas/{orderId}
  - GET /api/v1/lab/reports/resultados/{orderId}
  - GET /api/v1/lab/reports/recibos/{orderId}

Retornan `application/pdf` (Response binario) con Content-Disposition
attachment para forzar descarga / impresión directa.
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

from app.services import lab_order_service as order_svc
from app.services import lab_report_service as svc

router = APIRouter(prefix="/api/v1/lab/reports", tags=["lab-reports"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _pdf_response(pdf_bytes: bytes, filename: str) -> Response:
    """Envuelve bytes PDF en una Response con headers correctos."""
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Content-Length": str(len(pdf_bytes)),
            "Cache-Control": "no-cache",
        },
    )


def _attr(obj, key, default=None):
    """Lee atributo o key indistintamente (dict u objeto)."""
    if obj is None:
        return default
    if isinstance(obj, dict):
        return obj.get(key, default)
    return getattr(obj, key, default)


def _serialize(obj, keys):
    """Normaliza un objeto Prisma (dict o model) a dict con subset de keys."""
    if obj is None:
        return {}
    if isinstance(obj, dict):
        return {k: obj.get(k) for k in keys}
    return {k: getattr(obj, k, None) for k in keys}


async def _load_full_order(order_id: str):
    """Carga la LabOrder con TODOS los includes necesarios para los 3 PDFs.

    A diferencia de order_svc.get_order_full (que es minimal), aquí
    precargamos: worker, company, items (con medicalTest), results por item
    (con analyte + unit), y cashMovements (con user).
    """
    prisma = order_svc.get_prisma()
    try:
        order = await prisma.laborder.find_unique(where={"id": order_id})
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Prisma no disponible: {e}")
    if order is None:
        raise HTTPException(status_code=404, detail=f"LabOrder {order_id} no existe")

    base_keys = (
        "id", "folio", "branch", "workerId", "doctorName", "doctorClave",
        "status", "urgency", "subtotal", "ivaPct", "iva", "total",
        "isCourtesy", "courtesyType", "createdAt", "confirmedAt",
        "companyId", "medicalEventId",
    )
    out = _serialize(order, base_keys)

    # Worker (paciente)
    worker_id = _attr(order, "workerId")
    if worker_id:
        w = await prisma.worker.find_unique(where={"id": worker_id})
        if w:
            out["worker"] = {
                "id": _attr(w, "id"),
                "firstName": _attr(w, "firstName"),
                "lastName": _attr(w, "lastName"),
                "universalId": _attr(w, "universalId"),
            }

    # Company
    company_id = _attr(order, "companyId")
    if company_id:
        c = await prisma.company.find_unique(where={"id": company_id})
        if c:
            out["company"] = {"id": _attr(c, "id"), "name": _attr(c, "name")}

    # Items + medicalTest + results + analyte + unit
    items_rows = await prisma.laborderitem.find_many(where={"labOrderId": order_id})
    items_out = []
    for it in items_rows:
        it_d = _serialize(it, (
            "id", "labOrderId", "medicalTestId", "price",
            "discountAmount", "discountPct", "amount", "resultStatus",
        ))
        mt_id = _attr(it, "medicalTestId")
        if mt_id:
            mt = await prisma.medicaltest.find_unique(where={"id": mt_id})
            if mt:
                it_d["medicalTest"] = {
                    "id": _attr(mt, "id"),
                    "code": _attr(mt, "code"),
                    "name": _attr(mt, "name"),
                }
        # results con analyte + unit
        it_id = _attr(it, "id")
        results_rows = await prisma.labresult.find_many(where={"labOrderItemId": it_id})
        results_out = []
        for r in results_rows:
            r_d = {
                "id": _attr(r, "id"),
                "valueNumber": _attr(r, "valueNumber"),
                "valueText": _attr(r, "valueText"),
                "isOutOfRange": _attr(r, "isOutOfRange", False),
                "isCritical": _attr(r, "isCritical", False),
                "status": _attr(r, "status"),
            }
            analyte_id = _attr(r, "analyteId")
            if analyte_id:
                a = await prisma.labanalyte.find_unique(where={"id": analyte_id})
                if a:
                    r_d["analyte"] = {
                        "id": _attr(a, "id"),
                        "name": _attr(a, "name"),
                        "code": _attr(a, "code"),
                    }
            unit_id = _attr(r, "unitId")
            if unit_id:
                u = await prisma.labunit.find_unique(where={"id": unit_id})
                if u:
                    r_d["unit"] = {"id": _attr(u, "id"), "symbol": _attr(u, "symbol")}
            results_out.append(r_d)
        it_d["results"] = results_out
        items_out.append(it_d)
    out["items"] = items_out

    # Cash movements (con user)
    cash_rows = await prisma.labcashmovement.find_many(
        where={"labOrderId": order_id}, order={"createdAt": "asc"}
    )
    cash_out = []
    for c in cash_rows:
        c_d = {
            "id": _attr(c, "id"),
            "amount": _attr(c, "amount"),
            "method": _attr(c, "method"),
            "reference": _attr(c, "reference"),
            "currency": _attr(c, "currency"),
            "createdAt": _attr(c, "createdAt"),
            "userId": _attr(c, "userId"),
        }
        cuid = _attr(c, "userId")
        if cuid:
            u = await prisma.user.find_unique(where={"id": cuid})
            if u:
                c_d["user"] = {"id": _attr(u, "id"), "fullName": _attr(u, "fullName")}
        cash_out.append(c_d)
    out["cashMovements"] = cash_out

    return out


# ---------------------------------------------------------------------------
# GET /reports/etiquetas/{orderId}
# ---------------------------------------------------------------------------
@router.get("/etiquetas/{order_id}")
async def get_etiquetas_pdf(order_id: str):
    order = await _load_full_order(order_id)
    try:
        pdf_bytes = await svc.build_etiquetas_pdf(order)
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"{type(e).__name__}: {e}")
    folio = _attr(order, "folio")
    name = f"etiquetas_{folio or order_id}.pdf"
    return _pdf_response(pdf_bytes, name)


# ---------------------------------------------------------------------------
# GET /reports/resultados/{orderId}
# ---------------------------------------------------------------------------
@router.get("/resultados/{order_id}")
async def get_resultados_pdf(order_id: str):
    order = await _load_full_order(order_id)
    try:
        pdf_bytes = await svc.build_resultados_pdf(order)
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"{type(e).__name__}: {e}")
    folio = _attr(order, "folio")
    name = f"resultados_{folio or order_id}.pdf"
    return _pdf_response(pdf_bytes, name)


# ---------------------------------------------------------------------------
# GET /reports/recibos/{orderId}
# ---------------------------------------------------------------------------
@router.get("/recibos/{order_id}")
async def get_recibo_pdf(order_id: str):
    order = await _load_full_order(order_id)
    try:
        pdf_bytes = await svc.build_recibo_pdf(order)
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"{type(e).__name__}: {e}")
    folio = _attr(order, "folio")
    name = f"recibo_{folio or order_id}.pdf"
    return _pdf_response(pdf_bytes, name)