"""
IMPL-20260707-16: Slice C NOVA absorción (ARCH-20260707-16) — LabResult.

API REST para captura de resultados + ciclo de vida P/R/A/V + worklist
+ integración papeleta vía EventTest.

Prefijo: /api/v1/lab
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException, Query, Request

from app.schemas.lab_results import (
    LabResultBulkCreate,
    LabResultCreate,
    LabResultTransitionAction,
    LabResultTransitionRequest,
    LabResultUpdate,
    LinkLabOrderItemEventTestRequest,
)
from app.services import lab_result_service as svc

router = APIRouter(prefix="/api/v1/lab/results", tags=["lab-results"])


def _extract_user(request: Request) -> dict:
    user_id = request.headers.get("x-ami-userid") or request.headers.get("x-user-id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Falta X-AMI-UserId")
    return {"id": user_id, "role": "ADMIN"}


# ---------------------------------------------------------------------------
# GET /results — DataTables paginado
# ---------------------------------------------------------------------------
@router.get("")
async def list_results(
    draw: int = Query(1, ge=0),
    start: int = Query(0, ge=0),
    length: int = Query(25, ge=1, le=100),
    search_value: Optional[str] = Query(None, alias="search[value]"),
    status: Optional[str] = Query(None),
    dateFrom: Optional[str] = Query(None),
    dateTo: Optional[str] = Query(None),
    orderId: Optional[str] = Query(None),
    workerId: Optional[str] = Query(None),
):
    try:
        return await svc.get_results_paginated(
            prisma=svc.get_prisma(),
            draw=draw,
            start=start,
            length=length,
            search=search_value,
            status=status,
            date_from=dateFrom,
            date_to=dateTo,
            order_id=orderId,
            worker_id=workerId,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"{type(e).__name__}: {e}")


# ---------------------------------------------------------------------------
# POST /results — bulk create
# ---------------------------------------------------------------------------
@router.post("")
async def create_results(payload: LabResultBulkCreate, request: Request):
    user = _extract_user(request)
    try:
        items = [it.model_dump(exclude_none=True) for it in payload.items]
        return await svc.create_lab_results_bulk(
            items=items,
            current_user=user,
            prisma=svc.get_prisma(),
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ---------------------------------------------------------------------------
# GET /results/{id} — con audit log
# ---------------------------------------------------------------------------
@router.get("/{result_id}")
async def get_result(result_id: str):
    res = await svc.get_result_with_audit(result_id, prisma=svc.get_prisma())
    if res is None:
        raise HTTPException(status_code=404, detail=f"LabResult {result_id} no existe")
    return res


# ---------------------------------------------------------------------------
# PATCH /results/{id}
# ---------------------------------------------------------------------------
@router.patch("/{result_id}")
async def update_result(result_id: str, payload: LabResultUpdate, request: Request):
    user = _extract_user(request)
    try:
        return await svc.update_lab_result(
            result_id=result_id,
            data=payload.model_dump(exclude_none=True),
            current_user=user,
            prisma=svc.get_prisma(),
        )
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ---------------------------------------------------------------------------
# Acciones de transición (POST /results/{id}/{action})
# ---------------------------------------------------------------------------
@router.post("/{result_id}/report")
async def report_result(result_id: str, request: Request):
    user = _extract_user(request)
    try:
        return await svc.transition_lab_result(
            result_id=result_id,
            action=LabResultTransitionAction.REPORT,
            reason=None,
            current_user=user,
            prisma=svc.get_prisma(),
        )
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{result_id}/authorize")
async def authorize_result(
    result_id: str,
    payload: LabResultTransitionRequest = LabResultTransitionRequest(),
    request: Request = None,
):
    user = _extract_user(request) if request else {"id": "system", "role": "ADMIN"}
    try:
        return await svc.transition_lab_result(
            result_id=result_id,
            action=LabResultTransitionAction.AUTHORIZE,
            reason=payload.reason,
            current_user=user,
            prisma=svc.get_prisma(),
        )
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{result_id}/validate")
async def validate_result(
    result_id: str,
    payload: LabResultTransitionRequest = LabResultTransitionRequest(),
    request: Request = None,
):
    user = _extract_user(request) if request else {"id": "system", "role": "ADMIN"}
    try:
        return await svc.transition_lab_result(
            result_id=result_id,
            action=LabResultTransitionAction.VALIDATE,
            reason=payload.reason,
            current_user=user,
            prisma=svc.get_prisma(),
        )
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{result_id}/invalidate")
async def invalidate_result(
    result_id: str,
    payload: LabResultTransitionRequest,
    request: Request,
):
    user = _extract_user(request)
    try:
        return await svc.transition_lab_result(
            result_id=result_id,
            action=LabResultTransitionAction.INVALIDATE,
            reason=payload.reason,
            current_user=user,
            prisma=svc.get_prisma(),
        )
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ---------------------------------------------------------------------------
# GET /orders/{orderId}/worklist — hoja de trabajo
# ---------------------------------------------------------------------------
@router.get("/orders/{order_id}/worklist")
async def worklist(order_id: str):
    try:
        return await svc.get_worklist(order_id=order_id, prisma=svc.get_prisma())
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))


# ---------------------------------------------------------------------------
# PATCH /orders-items/{itemId}/event-test — vincular LabOrderItem ↔ EventTest
# ---------------------------------------------------------------------------
@router.patch("/orders-items/{item_id}/event-test")
async def link_item_event_test(
    item_id: str,
    payload: LinkLabOrderItemEventTestRequest,
    request: Request,
):
    user = _extract_user(request)
    try:
        return await svc.link_lab_order_item_to_event_test(
            item_id=item_id,
            event_test_id=payload.eventTestId,
            current_user=user,
            prisma=svc.get_prisma(),
        )
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))