"""
IMPL-20260707-18: Fase 2 NOVA absorción (ARCH-20260707-17) — D Trazabilidad.

Endpoints REST para el timeline de LabTraceEvent:

  GET  /api/v1/lab/orders/{id}/trace  → lista cronológica
  POST /api/v1/lab/orders/{id}/trace  → registra evento manual
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request

from app.schemas.lab_trace import (
    LabTraceTimelineResponse,
    RecordTraceEventRequest,
)
from app.services import lab_trace_service as svc

router = APIRouter(prefix="/api/v1/lab/orders", tags=["lab-trace"])


def _extract_user(request: Request) -> dict:
    user_id = request.headers.get("x-ami-userid") or request.headers.get("x-user-id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Falta X-AMI-UserId")
    return {"id": user_id, "role": "ADMIN"}


# ---------------------------------------------------------------------------
# GET /orders/{id}/trace
# ---------------------------------------------------------------------------
@router.get("/{order_id}/trace")
async def get_order_trace(order_id: str):
    try:
        prisma = svc.get_prisma()
    except Exception:
        raise HTTPException(status_code=503, detail="Prisma client no disponible")
    try:
        # Verificar que la LabOrder existe
        order = await prisma.laborder.find_unique(where={"id": order_id})
        if order is None:
            raise HTTPException(status_code=404, detail=f"LabOrder {order_id} no existe")
        result = await svc.list_trace(lab_order_id=order_id, prisma=prisma)
        return LabTraceTimelineResponse(**result)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"{type(e).__name__}: {e}")


# ---------------------------------------------------------------------------
# POST /orders/{id}/trace
# ---------------------------------------------------------------------------
@router.post("/{order_id}/trace")
async def post_order_trace(
    order_id: str,
    payload: RecordTraceEventRequest,
    request: Request,
):
    user = _extract_user(request)
    try:
        prisma = svc.get_prisma()
    except Exception:
        raise HTTPException(status_code=503, detail="Prisma client no disponible")
    try:
        row = await svc.record_event(
            lab_order_id=order_id,
            event=payload.event.value,
            current_user=user,
            prisma=prisma,
            notes=payload.notes,
            location=payload.location,
        )
        return row
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
