"""
IMPL-20260708-19: Fase 3 NOVA absorción (ARCH-20260707-17) — G Caja y Cortesías.

Servicio de caja y cortesías:
  - register_payment: POST /lab/orders/{id}/payments
  - list_payments:    GET /lab/orders/{id}/payments
  - mark_courtesy:    POST /lab/orders/{id}/courtesy
  - clear_courtesy:   DELETE /lab/orders/{id}/courtesy
  - cash_closing:     GET /lab/cash-closing?dateFrom=&dateTo=

Patrón: Prisma client inyectable (mismo que lab_order_service, lab_trace_service).
"""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from app.schemas.lab_cash import (
    CashClosingMethodTotal,
    CashClosingReport,
    PaymentMethod,
)


# ---------------------------------------------------------------------------
# Prisma client injection
# ---------------------------------------------------------------------------
_prisma = None


def set_prisma_client(client: Any) -> None:
    global _prisma
    _prisma = client


def get_prisma() -> Any:
    if _prisma is None:
        raise RuntimeError("Prisma client no inyectado. Llamar set_prisma_client() desde main.py o inyectar mock en tests.")
    return _prisma


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _now() -> datetime:
    return datetime.utcnow()


def _serialize_payment(p: Any) -> Dict[str, Any]:
    if p is None:
        return {}
    if isinstance(p, dict):
        base = dict(p)
    else:
        base = {k: getattr(p, k, None) for k in (
            "id", "labOrderId", "amount", "method", "reference", "currency",
            "userId", "createdAt",
        )}
    ts = base.get("createdAt")
    if isinstance(ts, datetime):
        base["createdAt"] = ts.isoformat()
    user = base.pop("user", None) if "user" in base else None
    if user is None:
        base["userFullName"] = None
    else:
        base["userFullName"] = user.get("fullName") if isinstance(user, dict) else getattr(user, "fullName", None)
    # Asegurar tipos
    if base.get("amount") is not None:
        try:
            base["amount"] = float(base["amount"])
        except (TypeError, ValueError):
            pass
    return base


def _serialize_courtesy(c: Any) -> Dict[str, Any]:
    if c is None:
        return {}
    if isinstance(c, dict):
        base = dict(c)
    else:
        base = {k: getattr(c, k, None) for k in (
            "id", "labOrderId", "reason", "approvedById", "createdAt",
        )}
    ts = base.get("createdAt")
    if isinstance(ts, datetime):
        base["createdAt"] = ts.isoformat()
    approved_by = base.pop("approvedBy", None) if "approvedBy" in base else None
    if approved_by is None:
        base["approvedByFullName"] = None
    else:
        base["approvedByFullName"] = (
            approved_by.get("fullName") if isinstance(approved_by, dict)
            else getattr(approved_by, "fullName", None)
        )
    return base


def _to_float(value: Any) -> float:
    if value is None:
        return 0.0
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


# ---------------------------------------------------------------------------
# register_payment
# ---------------------------------------------------------------------------
async def register_payment(
    lab_order_id: str,
    amount: float,
    method: PaymentMethod,
    current_user: Dict[str, str],
    prisma: Any,
    reference: Optional[str] = None,
    currency: Optional[str] = "MXN",
) -> Dict[str, Any]:
    """Registra un pago parcial sobre una LabOrder.

    Raises:
        LookupError: si la LabOrder no existe.
        ValueError: si el monto es <= 0.
    """
    if amount is None or float(amount) <= 0:
        raise ValueError("amount debe ser > 0")
    user_id = current_user.get("id") if isinstance(current_user, dict) else None
    if not user_id:
        raise ValueError("Falta current_user.id")

    order = await prisma.laborder.find_unique(where={"id": lab_order_id})
    if order is None:
        raise LookupError(f"LabOrder {lab_order_id} no existe")

    created = await prisma.labcashmovement.create(
        data={
            "labOrderId": lab_order_id,
            "amount": float(amount),
            "method": method.value,
            "reference": reference,
            "currency": currency or "MXN",
            "userId": user_id,
        },
        include={"user": True},
    )
    return _serialize_payment(created)


# ---------------------------------------------------------------------------
# list_payments
# ---------------------------------------------------------------------------
async def list_payments(lab_order_id: str, prisma: Any) -> Dict[str, Any]:
    order = await prisma.laborder.find_unique(where={"id": lab_order_id})
    if order is None:
        raise LookupError(f"LabOrder {lab_order_id} no existe")
    rows = await prisma.labcashmovement.find_many(
        where={"labOrderId": lab_order_id},
        include={"user": True},
        order={"createdAt": "asc"},
    )
    serialized = [_serialize_payment(r) for r in (rows or [])]
    paid_total = sum(_to_float(r.get("amount")) for r in serialized)
    order_total = _to_float(order.get("total") if isinstance(order, dict) else getattr(order, "total", 0))
    return {
        "labOrderId": lab_order_id,
        "total": len(serialized),
        "rows": serialized,
        "paidTotal": round(paid_total, 2),
        "orderTotal": round(order_total, 2),
        "balance": round(max(0.0, order_total - paid_total), 2),
    }


# ---------------------------------------------------------------------------
# mark_courtesy / clear_courtesy
# ---------------------------------------------------------------------------
async def mark_courtesy(
    lab_order_id: str,
    reason: str,
    current_user: Dict[str, str],
    prisma: Any,
) -> Dict[str, Any]:
    user_id = current_user.get("id") if isinstance(current_user, dict) else None
    if not user_id:
        raise ValueError("Falta current_user.id")
    order = await prisma.laborder.find_unique(where={"id": lab_order_id})
    if order is None:
        raise LookupError(f"LabOrder {lab_order_id} no existe")
    # Idempotente: si ya existe, retornar la actual
    existing = await prisma.courtesy.find_unique(where={"labOrderId": lab_order_id})
    if existing is not None:
        return _serialize_courtesy(existing)
    created = await prisma.courtesy.create(
        data={
            "labOrderId": lab_order_id,
            "reason": reason,
            "approvedById": user_id,
        },
        include={"approvedBy": True},
    )
    # Marcar la LabOrder como cortesía (isCourtesy=true) para que aparezca
    # en el reporte correctamente. NO borramos cashMovements existentes.
    try:
        await prisma.laborder.update(
            where={"id": lab_order_id},
            data={"isCourtesy": True, "courtesyType": reason[:200]},
        )
    except Exception:
        pass  # No romper el flujo por un fallo secundario
    return _serialize_courtesy(created)


async def clear_courtesy(lab_order_id: str, prisma: Any) -> Dict[str, Any]:
    existing = await prisma.courtesy.find_unique(where={"labOrderId": lab_order_id})
    if existing is None:
        return {"removed": False, "labOrderId": lab_order_id}
    await prisma.courtesy.delete(where={"id": existing.id if hasattr(existing, "id") else existing["id"]})
    try:
        await prisma.laborder.update(
            where={"id": lab_order_id},
            data={"isCourtesy": False, "courtesyType": None},
        )
    except Exception:
        pass
    return {"removed": True, "labOrderId": lab_order_id}


# ---------------------------------------------------------------------------
# cash_closing
# ---------------------------------------------------------------------------
async def cash_closing(
    date_from: Optional[str],
    date_to: Optional[str],
    prisma: Any,
) -> Dict[str, Any]:
    """Genera reporte de cierre de caja.

    date_from / date_to son ISO strings (YYYY-MM-DD). Si no se pasan,
    se usa el día actual (UTC).
    """
    now = _now()
    if date_to:
        try:
            end_dt = datetime.fromisoformat(date_to.replace("Z", "+00:00"))
        except ValueError:
            end_dt = now
    else:
        end_dt = now
    if date_from:
        try:
            start_dt = datetime.fromisoformat(date_from.replace("Z", "+00:00"))
        except ValueError:
            start_dt = end_dt - timedelta(days=1)
    else:
        start_dt = end_dt - timedelta(days=1)

    # Traer LabCashMovement en rango
    payments_rows = await prisma.labcashmovement.find_many(
        where={"createdAt": {"gte": start_dt, "lte": end_dt}},
        include={"labOrder": True},
    )
    payments_count = len(payments_rows or [])
    by_method: Dict[str, Dict[str, float]] = {}
    total_collected = 0.0
    seen_order_ids: set = set()
    courtesy_orders: set = set()
    billed_orders: set = set()
    total_billed = 0.0
    for p in payments_rows or []:
        method = p.method if hasattr(p, "method") else (p.get("method") if isinstance(p, dict) else None)
        amount = _to_float(getattr(p, "amount", 0) if hasattr(p, "amount") else (p.get("amount") if isinstance(p, dict) else 0))
        if method is None:
            method = "OTHER"
        if method not in by_method:
            by_method[method] = {"count": 0, "total": 0.0}
        by_method[method]["count"] += 1
        by_method[method]["total"] += amount
        total_collected += amount
        # LabOrder asociada
        order = (
            p.get("labOrder") if isinstance(p, dict)
            else getattr(p, "labOrder", None)
        )
        if order is not None:
            oid = (
                order.get("id") if isinstance(order, dict)
                else getattr(order, "id", None)
            )
            if oid:
                seen_order_ids.add(oid)
                is_courtesy = (
                    order.get("isCourtesy", False) if isinstance(order, dict)
                    else getattr(order, "isCourtesy", False)
                )
                if is_courtesy:
                    courtesy_orders.add(oid)
                elif oid not in billed_orders:
                    billed_orders.add(oid)
                    order_total = (
                        order.get("total", 0) if isinstance(order, dict)
                        else getattr(order, "total", 0)
                    )
                    total_billed += _to_float(order_total)
                # Si la orden ya estaba en billed_orders, no la sumamos de nuevo.

    # Ordenar por método
    by_method_rows: List[CashClosingMethodTotal] = []
    for m in ("CASH", "CARD", "TRANSFER", "CHECK", "OTHER"):
        if m in by_method:
            by_method_rows.append(
                CashClosingMethodTotal(
                    method=PaymentMethod(m),
                    count=int(by_method[m]["count"]),
                    total=round(by_method[m]["total"], 2),
                )
            )

    return {
        "dateFrom": start_dt.isoformat(),
        "dateTo": end_dt.isoformat(),
        "totalOrders": len(seen_order_ids),
        "courtesyOrders": len(courtesy_orders),
        "billedOrders": len(billed_orders),
        "totalBilled": round(total_billed, 2),
        "totalCollected": round(total_collected, 2),
        "balancePending": round(max(0.0, total_billed - total_collected), 2),
        "byMethod": by_method_rows,
        "paymentsCount": payments_count,
        "generatedAt": now.isoformat(),
    }