"""
IMPL-20260707-18: Fase 2 NOVA absorción (ARCH-20260707-17) — D Trazabilidad.

Servicio para el timeline de LabTraceEvent:
  - list_trace: GET /lab/orders/{id}/trace
  - record_event: POST /lab/orders/{id}/trace (evento manual)
  - helper auto_record_lifecycle: usado por server actions del frontend
    para registrar SAMPLE_RECEIVED al confirmar la orden y VALIDATED al
    validar LabResults.

Diseño:
  - Trabaja contra un cliente Prisma inyectable (set_prisma_client) — mismo
    patrón que lab_order_service y lab_result_service.
  - Permite tests sin DB real con un MagicMock.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from app.schemas.lab_trace import LabTraceEventType

# ---------------------------------------------------------------------------
# Prisma client injection (mismo patrón que el resto de la familia lab_*)
# ---------------------------------------------------------------------------
_prisma = None


def set_prisma_client(client: Any) -> None:
    global _prisma
    _prisma = client


def get_prisma() -> Any:
    if _prisma is None:
        raise RuntimeError(
            "Prisma client no inyectado. "
            "Llamar set_prisma_client() desde main.py o inyectar mock en tests."
        )
    return _prisma


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _now() -> datetime:
    return datetime.utcnow()


def _value_of(obj: Any, key: str, default: Any = None) -> Any:
    if obj is None:
        return default
    if isinstance(obj, dict):
        return obj.get(key, default)
    return getattr(obj, key, default)


def _serialize_row(row: Any) -> Dict[str, Any]:
    """Convierte un LabTraceEvent (con include user) en dict JSON-friendly."""
    if row is None:
        return {}
    base: Dict[str, Any]
    if isinstance(row, dict):
        base = dict(row)
    else:
        base = {k: getattr(row, k, None) for k in (
            "id", "labOrderId", "event", "timestamp", "userId", "notes", "location",
        )}
    ts = base.get("timestamp")
    if isinstance(ts, datetime):
        base["timestamp"] = ts.isoformat()
    user = base.pop("user", None)
    if user is None and "user" in base:
        base.pop("user", None)
    if user is not None:
        if isinstance(user, dict):
            base["userFullName"] = user.get("fullName")
        else:
            base["userFullName"] = getattr(user, "fullName", None)
    else:
        base["userFullName"] = None
    return base


# ---------------------------------------------------------------------------
# list_trace
# ---------------------------------------------------------------------------
async def list_trace(
    lab_order_id: str,
    prisma: Any,
) -> Dict[str, Any]:
    """Devuelve el timeline completo de eventos para una LabOrder, ordenado
    cronológicamente (ASC por timestamp)."""
    rows = await prisma.labtraceevent.find_many(
        where={"labOrderId": lab_order_id},
        include={"user": True},
        order_by={"timestamp": "asc"},
    )
    serialized = [_serialize_row(r) for r in (rows or [])]
    return {"labOrderId": lab_order_id, "total": len(serialized), "rows": serialized}


# ---------------------------------------------------------------------------
# record_event (manual)
# ---------------------------------------------------------------------------
VALID_EVENTS: List[str] = [e.value for e in LabTraceEventType]


async def record_event(
    lab_order_id: str,
    event: str,
    current_user: Dict[str, str],
    prisma: Any,
    notes: Optional[str] = None,
    location: Optional[str] = None,
) -> Dict[str, Any]:
    """Registra un evento manual en el timeline. Lanza ValueError si el evento
    no es válido o la LabOrder no existe."""
    if event not in VALID_EVENTS:
        raise ValueError(f"event inválido: {event}. Permitidos: {VALID_EVENTS}")
    order = await prisma.laborder.find_unique(where={"id": lab_order_id})
    if order is None:
        raise LookupError(f"LabOrder {lab_order_id} no existe")
    user_id = current_user.get("id") if isinstance(current_user, dict) else None

    now = _now()
    created = await prisma.labtraceevent.create(
        data={
            "labOrderId": lab_order_id,
            "event": event,
            "timestamp": now,
            "userId": user_id,
            "notes": notes,
            "location": location,
        }
    )
    return _serialize_row(created)


# ---------------------------------------------------------------------------
# auto_record_lifecycle — helper idempotente
# ---------------------------------------------------------------------------
async def auto_record_lifecycle(
    lab_order_id: str,
    event: str,
    current_user: Dict[str, str],
    prisma: Any,
    notes: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """Registra un evento automático del ciclo de vida de la LabOrder.
    Si ya existe un evento del mismo tipo para la misma orden, NO duplica
    (idempotente: protege contra registros múltiples por re-renders /
    re-validaciones). Retorna la fila creada o None si ya existía.

    Usos:
      - SAMPLE_RECEIVED: al confirmar LabOrder (DRAFT → SAVED).
      - VALIDATED: al pasar un LabResult a VALIDATED.
    """
    if event not in VALID_EVENTS:
        raise ValueError(f"event inválido: {event}")
    try:
        order = await prisma.laborder.find_unique(where={"id": lab_order_id})
    except Exception:
        order = None
    if order is None:
        return None
    try:
        existing = await prisma.labtraceevent.find_first(
            where={"labOrderId": lab_order_id, "event": event}
        )
    except Exception:
        existing = None
    if existing is not None:
        return None  # ya registrado
    return await record_event(
        lab_order_id=lab_order_id,
        event=event,
        current_user=current_user,
        prisma=prisma,
        notes=notes,
    )
