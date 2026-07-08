"""
IMPL-20260708-19: Fase 3 NOVA absorción (ARCH-20260707-17) — G Caja y Cortesías.

Schemas Pydantic para:
  - POST /api/v1/lab/orders/{id}/payments  → RegisterPaymentRequest
  - GET  /api/v1/lab/orders/{id}/payments  → ListPaymentsResponse
  - POST /api/v1/lab/orders/{id}/courtesy  → MarkCourtesyRequest
  - GET  /api/v1/lab/cash-closing          → CashClosingReport
"""
from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------
class PaymentMethod(str, Enum):
    CASH = "CASH"
    CARD = "CARD"
    TRANSFER = "TRANSFER"
    CHECK = "CHECK"
    OTHER = "OTHER"


# ---------------------------------------------------------------------------
# Payment
# ---------------------------------------------------------------------------
class RegisterPaymentRequest(BaseModel):
    """Body para POST /lab/orders/{id}/payments."""
    amount: float = Field(..., gt=0, description="Monto del pago (MXN)")
    method: PaymentMethod = Field(..., description="Forma de pago")
    reference: Optional[str] = Field(None, max_length=200, description="Últimos 4 dígitos, SPEI ref, cheque #, etc.")
    currency: Optional[str] = Field("MXN", max_length=8)


class PaymentRow(BaseModel):
    """Fila de un pago registrado."""
    id: str
    labOrderId: str
    amount: float
    method: PaymentMethod
    reference: Optional[str] = None
    currency: str = "MXN"
    userId: str
    userFullName: Optional[str] = None
    createdAt: datetime


class ListPaymentsResponse(BaseModel):
    labOrderId: str
    total: int
    rows: List[PaymentRow]
    paidTotal: float
    orderTotal: float
    balance: float


# ---------------------------------------------------------------------------
# Courtesy
# ---------------------------------------------------------------------------
class MarkCourtesyRequest(BaseModel):
    """Body para POST /lab/orders/{id}/courtesy."""
    reason: str = Field(..., min_length=3, max_length=500, description="Motivo de la cortesía")


class CourtesyRow(BaseModel):
    id: str
    labOrderId: str
    reason: str
    approvedById: str
    approvedByFullName: Optional[str] = None
    createdAt: datetime


# ---------------------------------------------------------------------------
# Cash closing
# ---------------------------------------------------------------------------
class CashClosingMethodTotal(BaseModel):
    method: PaymentMethod
    count: int
    total: float


class CashClosingReport(BaseModel):
    """Reporte de cierre de caja por rango de fechas."""
    dateFrom: str
    dateTo: str
    totalOrders: int
    courtesyOrders: int
    billedOrders: int
    totalBilled: float  # suma de subtotal+iva de órdenes NO cortesía
    totalCollected: float  # suma de LabCashMovement (excluyendo cortesía)
    balancePending: float  # totalBilled - totalCollected
    byMethod: List[CashClosingMethodTotal]
    paymentsCount: int
    generatedAt: datetime