"""
IMPL-20260701-03: Slice B NOVA absorción (ARCH-20260701-03) — admisión LabOrder.
API REST para LabOrder (CRUD + items + confirm + cancel).

Endpoint base: /api/v1/lab/orders
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException, Query, Request

from app.schemas.lab_orders import (
    LabOrderCancelRequest,
    LabOrderConfirm,
    LabOrderCreate,
    LabOrderItemCreate,
    LabOrderUpdate,
)
from app.services import lab_order_service as svc

router = APIRouter(prefix="/api/v1/lab/orders", tags=["lab-orders"])


def _extract_user(request: Request) -> dict:
    """Extrae user info del header X-AMI-UserId (placeholder hasta integrar JWT AMI)."""
    user_id = request.headers.get("x-ami-userid") or request.headers.get("x-user-id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Falta X-AMI-UserId")
    return {"id": user_id, "role": "ADMIN"}


# ---------------------------------------------------------------------------
# POST /orders — crear DRAFT
# ---------------------------------------------------------------------------
@router.post("")
async def create_order(payload: LabOrderCreate, request: Request):
    user = _extract_user(request)
    try:
        result = await svc.create_lab_order(
            data=payload.model_dump(exclude_none=True),
            current_user=user,
            prisma=svc.get_prisma(),
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return result


# ---------------------------------------------------------------------------
# GET /orders — listar paginado (DataTables)
# ---------------------------------------------------------------------------
@router.get("")
async def list_orders(
    draw: int = Query(1, ge=0),
    start: int = Query(0, ge=0),
    length: int = Query(25, ge=1, le=100),
    search_value: Optional[str] = Query(None, alias="search[value]"),
    status: Optional[str] = Query(None),
    dateFrom: Optional[str] = Query(None),
    dateTo: Optional[str] = Query(None),
):
    try:
        return await svc.list_orders_paginated(
            prisma=svc.get_prisma(),
            draw=draw,
            start=start,
            length=length,
            search=search_value,
            status=status,
            date_from=dateFrom,
            date_to=dateTo,
        )
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"{type(e).__name__}: {e}")


# ---------------------------------------------------------------------------
# GET /orders/{id} — full con items
# ---------------------------------------------------------------------------
@router.get("/{order_id}")
async def get_order(order_id: str):
    order = await svc.get_order_full(order_id, prisma=svc.get_prisma())
    if order is None:
        raise HTTPException(status_code=404, detail=f"LabOrder {order_id} no existe")
    return order


# ---------------------------------------------------------------------------
# PATCH /orders/{id} — actualizar (solo DRAFT)
# ---------------------------------------------------------------------------
@router.patch("/{order_id}")
async def update_order(order_id: str, payload: LabOrderUpdate, request: Request):
    user = _extract_user(request)
    try:
        return await svc.update_lab_order(
            order_id=order_id,
            data=payload.model_dump(exclude_none=True),
            current_user=user,
            prisma=svc.get_prisma(),
        )
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ---------------------------------------------------------------------------
# DELETE /orders/{id}?motivo=X — soft delete
# ---------------------------------------------------------------------------
@router.delete("/{order_id}")
async def cancel_order(order_id: str, motivo: str = Query(..., min_length=3), request: Request = None):
    user = _extract_user(request) if request else {"id": "system", "role": "ADMIN"}
    try:
        return await svc.delete_lab_order(
            order_id=order_id,
            motivo=motivo,
            current_user=user,
            prisma=svc.get_prisma(),
        )
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ---------------------------------------------------------------------------
# POST /orders/{id}/confirm — DRAFT → SAVED
# ---------------------------------------------------------------------------
@router.post("/{order_id}/confirm")
async def confirm_order(order_id: str, _payload: LabOrderConfirm = LabOrderConfirm(), request: Request = None):
    user = _extract_user(request) if request else {"id": "system", "role": "ADMIN"}
    try:
        return await svc.confirm_lab_order(
            order_id=order_id,
            current_user=user,
            prisma=svc.get_prisma(),
        )
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ---------------------------------------------------------------------------
# POST /orders/{id}/items — agregar item
# ---------------------------------------------------------------------------
@router.post("/{order_id}/items")
async def add_item(order_id: str, payload: LabOrderItemCreate, request: Request):
    user = _extract_user(request)
    try:
        return await svc.add_item_to_order(
            order_id=order_id,
            item_data=payload.model_dump(exclude_none=True),
            current_user=user,
            prisma=svc.get_prisma(),
        )
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ---------------------------------------------------------------------------
# DELETE /orders/{id}/items/{itemId} — eliminar item
# ---------------------------------------------------------------------------
@router.delete("/{order_id}/items/{item_id}")
async def remove_item(order_id: str, item_id: str, request: Request):
    user = _extract_user(request)
    try:
        return await svc.remove_item_from_order(
            order_id=order_id,
            item_id=item_id,
            current_user=user,
            prisma=svc.get_prisma(),
        )
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
