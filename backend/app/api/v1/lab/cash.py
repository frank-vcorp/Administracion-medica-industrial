"""
IMPL-20260708-19: Fase 3 NOVA absorción (ARCH-20260707-17) — G Caja y Cortesías.

Rutas REST:
  - POST   /api/v1/lab/orders/{id}/payments
  - GET    /api/v1/lab/orders/{id}/payments
  - POST   /api/v1/lab/orders/{id}/courtesy
  - DELETE /api/v1/lab/orders/{id}/courtesy
  - GET    /api/v1/lab/cash-closing?dateFrom=&dateTo=
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException, Query, Request

from app.schemas.lab_cash import (
    CashClosingReport,
    ListPaymentsResponse,
    MarkCourtesyRequest,
    PaymentRow,
    RegisterPaymentRequest,
)
from app.services import lab_cash_service as svc

router = APIRouter(prefix="/api/v1/lab", tags=["lab-cash"])


def _extract_user(request: Request) -> dict:
    user_id = request.headers.get("x-ami-userid") or request.headers.get("x-user-id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Falta X-AMI-UserId")
    return {"id": user_id, "role": "ADMIN"}


# ---------------------------------------------------------------------------
# Payments
# ---------------------------------------------------------------------------
@router.post("/orders/{order_id}/payments")
async def register_payment_endpoint(order_id: str, payload: RegisterPaymentRequest, request: Request):
    user = _extract_user(request)
    try:
        result = await svc.register_payment(
            lab_order_id=order_id,
            amount=payload.amount,
            method=payload.method,
            current_user=user,
            prisma=svc.get_prisma(),
            reference=payload.reference,
            currency=payload.currency,
        )
        return PaymentRow(**result)
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/orders/{order_id}/payments")
async def list_payments_endpoint(order_id: str):
    try:
        result = await svc.list_payments(order_id, prisma=svc.get_prisma())
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"{type(e).__name__}: {e}")
    return ListPaymentsResponse(**result)


# ---------------------------------------------------------------------------
# Courtesy
# ---------------------------------------------------------------------------
@router.post("/orders/{order_id}/courtesy")
async def mark_courtesy_endpoint(order_id: str, payload: MarkCourtesyRequest, request: Request):
    user = _extract_user(request)
    try:
        result = await svc.mark_courtesy(
            lab_order_id=order_id,
            reason=payload.reason,
            current_user=user,
            prisma=svc.get_prisma(),
        )
        return result
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/orders/{order_id}/courtesy")
async def clear_courtesy_endpoint(order_id: str):
    try:
        result = await svc.clear_courtesy(order_id, prisma=svc.get_prisma())
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"{type(e).__name__}: {e}")


# ---------------------------------------------------------------------------
# Cash closing (report)
# ---------------------------------------------------------------------------
@router.get("/cash-closing")
async def cash_closing_endpoint(
    dateFrom: Optional[str] = Query(None),
    dateTo: Optional[str] = Query(None),
):
    try:
        result = await svc.cash_closing(
            date_from=dateFrom,
            date_to=dateTo,
            prisma=svc.get_prisma(),
        )
        return CashClosingReport(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"{type(e).__name__}: {e}")