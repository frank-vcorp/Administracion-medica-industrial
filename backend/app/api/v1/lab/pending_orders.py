"""
IMPL-20260707-17: Fase 1 NOVA absorción (ARCH-20260707-17) — B-v2.

Endpoints de bandeja de papeletas + trigger SAMPLE_TAKEN.

  GET  /api/v1/lab/pending-orders?branchId=X
  POST /api/v1/event_tests/{id}/sample
  POST /api/v1/lab/auto-generate-from-event
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException, Query, Request

from app.schemas.pending_orders import (
    MarkSampleTakenRequest,
    TriggerAutoGenerateRequest,
    TriggerAutoGenerateResponse,
)
from app.services import pending_order_service as svc

router = APIRouter(tags=["lab-pending-orders"])


def _extract_user(request: Request) -> dict:
    """Extrae user info del header X-AMI-UserId (placeholder hasta integrar JWT AMI)."""
    user_id = request.headers.get("x-ami-userid") or request.headers.get("x-user-id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Falta X-AMI-UserId")
    return {"id": user_id, "role": "ADMIN"}


# ---------------------------------------------------------------------------
# GET /lab/pending-orders — bandeja
# ---------------------------------------------------------------------------
@router.get("/api/v1/lab/pending-orders")
async def list_pending_orders(
    branchId: Optional[str] = Query(None, alias="branchId"),
    categoryId: Optional[str] = Query(None, alias="categoryId"),
):
    try:
        from app.services.lab_order_service import get_prisma as get_orders_prisma
        prisma = get_orders_prisma()
    except Exception:
        raise HTTPException(status_code=503, detail="Prisma client no disponible")
    try:
        result = await svc.list_pending_orders(
            branch_id=branchId,
            prisma=prisma,
            category_id=categoryId or "64d3f863",
        )
        return {
            "branchId": branchId,
            "categoryId": categoryId or "64d3f863",
            "total": result["total"],
            "rows": result["rows"],
        }
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"{type(e).__name__}: {e}")


# ---------------------------------------------------------------------------
# POST /event_tests/{id}/sample — marca SAMPLE_TAKEN + trigger
# ---------------------------------------------------------------------------
@router.post("/api/v1/event_tests/{event_test_id}/sample")
async def mark_event_test_sample_taken(
    event_test_id: str,
    request: Request,
    payload: Optional[MarkSampleTakenRequest] = None,
):
    user = _extract_user(request)
    try:
        from app.services.lab_order_service import get_prisma as get_orders_prisma
        prisma = get_orders_prisma()
    except Exception:
        raise HTTPException(status_code=503, detail="Prisma client no disponible")
    try:
        notes = payload.notes if payload else None
        return await svc.mark_event_test_sample_taken(
            event_test_id=event_test_id,
            current_user=user,
            prisma=prisma,
            notes=notes,
        )
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ---------------------------------------------------------------------------
# POST /lab/auto-generate-from-event — trigger explícito
# ---------------------------------------------------------------------------
@router.post("/api/v1/lab/auto-generate-from-event")
async def auto_generate_lab_order_from_event(
    payload: TriggerAutoGenerateRequest,
    request: Request,
):
    user = _extract_user(request)
    try:
        from app.services.lab_order_service import get_prisma as get_orders_prisma
        prisma = get_orders_prisma()
    except Exception:
        raise HTTPException(status_code=503, detail="Prisma client no disponible")
    try:
        result = await svc.auto_generate_lab_order_from_event(
            medical_event_id=payload.medicalEventId,
            current_user=user,
            prisma=prisma,
        )
        return TriggerAutoGenerateResponse(**result)
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))