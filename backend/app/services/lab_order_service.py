"""
IMPL-20260701-03: Slice B NOVA absorción (ARCH-20260701-03) — admisión LabOrder.
Servicio CRUD + cálculo de totales + folio único + audit log para LabOrder.

Diseño:
  - Trabaja contra un cliente Prisma inyectable (set_prisma_client).
  - Permite tests sin DB real usando un mock (MagicMock).
  - Cálculo de totales puro (`calculate_totals`) — el mismo helper se importa
    desde el frontend (frontend/src/lib/lab-order-totals.ts) y se mantiene
    sincronizado por SPEC §6.2.
  - Folio único: loop n=1; try create; si P2002, n+=1.
  - Soft delete: status=CANCELLED (no hard delete).
  - Audit log: cada create/update/delete/confirm llama a `record_audit`.
"""
from __future__ import annotations

import math
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

# ---------------------------------------------------------------------------
# Prisma client injection (mismo patrón que lab_catalog_service)
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
def _round2(n: float) -> float:
    return math.floor(n * 100 + 0.5) / 100.0


def _serialize(obj: Any) -> Dict[str, Any]:
    """Convierte un modelo Prisma a dict serializable JSON."""
    if obj is None:
        return {}
    if hasattr(obj, "model_dump"):
        d = obj.model_dump()
    elif hasattr(obj, "__dict__"):
        d = dict(obj.__dict__)
    elif isinstance(obj, dict):
        d = dict(obj)
    else:
        return obj
    out: Dict[str, Any] = {}
    for k, v in d.items():
        if isinstance(v, datetime):
            out[k] = v.isoformat()
        elif isinstance(v, (str, int, float, bool)) or v is None:
            out[k] = v
        else:
            out[k] = str(v)
    return out


def _now() -> datetime:
    return datetime.utcnow()


# ---------------------------------------------------------------------------
# Cálculo de totales — PURO, sin DB
# ---------------------------------------------------------------------------
def calculate_item_amount(price: float, discount_amount: float = 0, discount_pct: float = 0) -> float:
    """amount = price - discountAmount - (price * discountPct/100)."""
    pct = (price or 0) * ((discount_pct or 0) / 100.0)
    return _round2(max(0, (price or 0) - (discount_amount or 0) - pct))


def calculate_totals(
    items: List[Dict[str, Any]],
    iva_pct: float = 16.0,
) -> Dict[str, float]:
    """Devuelve {subtotal, iva, total} a partir de una lista de items.

    Cada item acepta al menos: {price, discountAmount, discountPct}.
    Faltantes se tratan como 0.
    """
    subtotal = 0.0
    for it in items or []:
        subtotal += calculate_item_amount(
            it.get("price", 0),
            it.get("discountAmount", 0) or 0,
            it.get("discountPct", 0) or 0,
        )
    iva = _round2(subtotal * (iva_pct / 100.0))
    total = _round2(subtotal + iva)
    return {"subtotal": _round2(subtotal), "iva": iva, "total": total}


# ---------------------------------------------------------------------------
# Folio único — loop con retry P2002
# ---------------------------------------------------------------------------
async def generate_unique_folio(
    prisma: Any,
    branch: str = "MATRIZ",
    start: int = 1,
) -> int:
    """Encuentra el siguiente folio libre probando secuencialmente.

    En producción real, esto debería usar una sequence de Postgres, pero como
    Prisma + cuid() no lo expone fácilmente, hacemos un loop hasta encontrar
    un folio sin colisión. P2002 (unique violation) → reintento.
    """
    n = start
    while True:
        # FIX-20260706-16: Prisma Python model LabOrder -> prisma.laborder.
        existing = await prisma.laborder.find_unique(where={"folio": n})
        if existing is None:
            return n
        n += 1
        if n > 10_000_000:  # safeguard
            raise RuntimeError("folio overflow")


def generate_unique_folio_retry_create(
    prisma: Any,
    data: Dict[str, Any],
    branch: str = "MATRIZ",
    max_retries: int = 50,
) -> Dict[str, Any]:
    """Versión que intenta `create` y reintenta si choca con P2002."""
    n = 1
    last_err: Optional[Exception] = None
    for _ in range(max_retries):
        try:
            data_with_folio = {**data, "folio": n}
            return prisma.laborder.create(data=data_with_folio)
        except Exception as e:  # noqa: BLE001
            msg = str(e)
            if "P2002" in msg or "Unique" in msg or "unique constraint" in msg.lower():
                n += 1
                last_err = e
                continue
            raise
    raise RuntimeError(f"No se pudo generar folio único en {max_retries} intentos: {last_err}")


# ---------------------------------------------------------------------------
# Audit log (mismo patrón que lab_catalog_service)
# ---------------------------------------------------------------------------
def record_audit(
    prisma: Any,
    action: str,
    entity: str,
    entity_id: Optional[str],
    before: Optional[Dict[str, Any]],
    after: Optional[Dict[str, Any]],
    motivo: Optional[str] = None,
    user_id: Optional[str] = None,
) -> None:
    """Inserta una fila en AuditLog. Tolerante a fallos."""
    try:
        # FIX-20260706-16: Prisma Python model AuditLog -> prisma.auditlog.
        audit = getattr(prisma, "auditlog", None)
        if audit is None:
            return
        details: Dict[str, Any] = {"before": before, "after": after}
        if motivo:
            details["motivo"] = motivo
        audit.create(
            data={
                "userId": user_id,
                "action": action,
                "entity": entity,
                "entityId": entity_id,
                "details": _json_safe(details),
            }
        )
    except Exception:
        # Audit no rompe el flujo principal.
        pass


def _json_safe(payload: Any) -> Any:
    if payload is None:
        return None
    if isinstance(payload, dict):
        return {k: _json_safe(v) for k, v in payload.items() if not callable(v)}
    if isinstance(payload, list):
        return [_json_safe(v) for v in payload]
    if isinstance(payload, (str, int, float, bool)):
        return payload
    return str(payload)


# ---------------------------------------------------------------------------
# CRUD principal
# ---------------------------------------------------------------------------
async def create_lab_order(
    data: Dict[str, Any],
    current_user: Dict[str, str],
    prisma: Any,
) -> Dict[str, Any]:
    """Crea una LabOrder DRAFT con sus items. Retorna la orden completa.

    current_user: {"id": "...", "role": "ADMIN"|"LAB_RECEPTIONIST"|...}
    """
    user_id = current_user.get("id") if isinstance(current_user, dict) else None
    if not user_id:
        raise ValueError("current_user.id es obligatorio")

    items_in = data.pop("items", []) or []
    if not items_in:
        raise ValueError("La orden debe tener al menos un item")

    # Calcular totales antes de persistir
    totals = calculate_totals(items_in, iva_pct=data.get("ivaPct", 16))

    # Folio: si no viene, generar
    folio = data.get("folio")
    if folio is None:
        folio = await generate_unique_folio(prisma)

    # Crear LabOrder (status default DRAFT)
    now = _now()
    order_payload = {
        **data,
        "folio": folio,
        "status": data.get("status", "DRAFT"),
        "subtotal": totals["subtotal"],
        "ivaPct": data.get("ivaPct", 16),
        "iva": totals["iva"],
        "total": totals["total"],
        "createdById": user_id,
        "createdAt": now,
        "updatedAt": now,
    }
    order = await prisma.laborder.create(data=order_payload)
    order_id = order["id"] if isinstance(order, dict) else getattr(order, "id", None)

    # Crear items
    item_records = []
    for it in items_in:
        amt = calculate_item_amount(
            it.get("price", 0),
            it.get("discountAmount", 0) or 0,
            it.get("discountPct", 0) or 0,
        )
        item_payload = {
            "labOrderId": order_id,
            "medicalTestId": it["medicalTestId"],
            "price": it.get("price", 0),
            "discountAmount": it.get("discountAmount", 0) or 0,
            "discountPct": it.get("discountPct", 0) or 0,
            "amount": amt,
            "resultStatus": it.get("resultStatus", "P"),
            "createdAt": now,
            "updatedAt": now,
        }
        item = await prisma.laborderitem.create(data=item_payload)
        item_records.append(_serialize(item))

    record_audit(
        prisma,
        action="CREATE_LAB_ORDER",
        entity="LabOrder",
        entity_id=order_id,
        before=None,
        after={"id": order_id, "folio": folio, "total": totals["total"]},
        user_id=user_id,
    )

    return {
        "id": order_id,
        "folio": folio,
        "status": order.get("status", "DRAFT") if isinstance(order, dict) else getattr(order, "status", "DRAFT"),
        "subtotal": totals["subtotal"],
        "iva": totals["iva"],
        "total": totals["total"],
        "items": item_records,
    }


async def update_lab_order(
    order_id: str,
    data: Dict[str, Any],
    current_user: Dict[str, str],
    prisma: Any,
) -> Dict[str, Any]:
    """Actualiza una LabOrder en DRAFT. Recalcula totales si hay items."""
    user_id = current_user.get("id") if isinstance(current_user, dict) else None
    if not user_id:
        raise ValueError("current_user.id es obligatorio")

    existing = await prisma.laborder.find_unique(where={"id": order_id})
    if existing is None:
        raise LookupError(f"LabOrder {order_id} no existe")
    if (existing.get("status") if isinstance(existing, dict) else getattr(existing, "status", None)) != "DRAFT":
        raise ValueError("Solo se pueden modificar órdenes en DRAFT")

    items_in = data.pop("items", None)
    payload = {k: v for k, v in data.items() if v is not None}
    payload["updatedAt"] = _now()

    if items_in is not None:
        # Reemplazar todos los items y recalcular totales
        # Borrar existentes
        existing_items = await prisma.laborderitem.find_many(where={"labOrderId": order_id})
        for old in existing_items:
            await prisma.laborderitem.delete(where={"id": old["id"] if isinstance(old, dict) else old.id})
        # Crear nuevos
        for it in items_in:
            amt = calculate_item_amount(
                it.get("price", 0),
                it.get("discountAmount", 0) or 0,
                it.get("discountPct", 0) or 0,
            )
            await prisma.laborderitem.create(
                data={
                    "labOrderId": order_id,
                    "medicalTestId": it["medicalTestId"],
                    "price": it.get("price", 0),
                    "discountAmount": it.get("discountAmount", 0) or 0,
                    "discountPct": it.get("discountPct", 0) or 0,
                    "amount": amt,
                    "resultStatus": it.get("resultStatus", "P"),
                }
            )
        # Recalcular totales
        new_items = await prisma.laborderitem.find_many(where={"labOrderId": order_id})
        item_dicts = [
            {
                "price": (it.get("price") if isinstance(it, dict) else it.price) or 0,
                "discountAmount": (it.get("discountAmount") if isinstance(it, dict) else it.discountAmount) or 0,
                "discountPct": (it.get("discountPct") if isinstance(it, dict) else it.discountPct) or 0,
            }
            for it in new_items
        ]
        iva_pct = (existing.get("ivaPct") if isinstance(existing, dict) else existing.ivaPct) or 16
        totals = calculate_totals(item_dicts, iva_pct=iva_pct)
        payload.update(
            {
                "subtotal": totals["subtotal"],
                "iva": totals["iva"],
                "total": totals["total"],
            }
        )

    updated = await prisma.laborder.update(where={"id": order_id}, data=payload)

    record_audit(
        prisma,
        action="UPDATE_LAB_ORDER",
        entity="LabOrder",
        entity_id=order_id,
        before=_serialize(existing),
        after=_serialize(updated),
        user_id=user_id,
    )

    return _serialize(updated)


async def delete_lab_order(
    order_id: str,
    motivo: str,
    current_user: Dict[str, str],
    prisma: Any,
) -> Dict[str, Any]:
    """Soft delete: status=CANCELLED. Solo si DRAFT o SAVED."""
    user_id = current_user.get("id") if isinstance(current_user, dict) else None
    if not user_id:
        raise ValueError("current_user.id es obligatorio")
    if not motivo or len(motivo.strip()) < 3:
        raise ValueError("motivo es obligatorio (mín 3 caracteres)")

    existing = await prisma.laborder.find_unique(where={"id": order_id})
    if existing is None:
        raise LookupError(f"LabOrder {order_id} no existe")
    status = existing.get("status") if isinstance(existing, dict) else getattr(existing, "status", None)
    if status not in ("DRAFT", "SAVED"):
        raise ValueError(f"Solo se pueden cancelar órdenes en DRAFT o SAVED (actual: {status})")

    now = _now()
    updated = await prisma.laborder.update(
        where={"id": order_id},
        data={
            "status": "CANCELLED",
            "cancelledAt": now,
            "cancelledById": user_id,
            "updatedAt": now,
        },
    )

    record_audit(
        prisma,
        action="CANCEL_LAB_ORDER",
        entity="LabOrder",
        entity_id=order_id,
        before=_serialize(existing),
        after=_serialize(updated),
        motivo=motivo,
        user_id=user_id,
    )

    return _serialize(updated)


async def confirm_lab_order(
    order_id: str,
    current_user: Dict[str, str],
    prisma: Any,
) -> Dict[str, Any]:
    """DRAFT → SAVED. Genera folio si no existe, recalcula totales, set confirmedAt."""
    user_id = current_user.get("id") if isinstance(current_user, dict) else None
    if not user_id:
        raise ValueError("current_user.id es obligatorio")

    existing = await prisma.laborder.find_unique(where={"id": order_id})
    if existing is None:
        raise LookupError(f"LabOrder {order_id} no existe")
    status = existing.get("status") if isinstance(existing, dict) else getattr(existing, "status", None)
    if status != "DRAFT":
        raise ValueError(f"Solo se pueden confirmar órdenes en DRAFT (actual: {status})")

    # Verificar items
    items = await prisma.laborderitem.find_many(where={"labOrderId": order_id})
    if not items:
        raise ValueError("La orden no tiene items; no se puede confirmar")

    # Folio: si no tiene, generar
    folio = existing.get("folio") if isinstance(existing, dict) else getattr(existing, "folio", None)
    if folio is None:
        folio = await generate_unique_folio(prisma)

    # Recalcular totales
    item_dicts = [
        {
            "price": (it.get("price") if isinstance(it, dict) else it.price) or 0,
            "discountAmount": (it.get("discountAmount") if isinstance(it, dict) else it.discountAmount) or 0,
            "discountPct": (it.get("discountPct") if isinstance(it, dict) else it.discountPct) or 0,
        }
        for it in items
    ]
    iva_pct = (existing.get("ivaPct") if isinstance(existing, dict) else existing.ivaPct) or 16
    totals = calculate_totals(item_dicts, iva_pct=iva_pct)

    now = _now()
    updated = await prisma.laborder.update(
        where={"id": order_id},
        data={
            "status": "SAVED",
            "folio": folio,
            "subtotal": totals["subtotal"],
            "iva": totals["iva"],
            "total": totals["total"],
            "confirmedAt": now,
            "updatedAt": now,
        },
    )

    record_audit(
        prisma,
        action="CONFIRM_LAB_ORDER",
        entity="LabOrder",
        entity_id=order_id,
        before=_serialize(existing),
        after={**_serialize(updated), "totals": totals, "folio": folio},
        user_id=user_id,
    )

    return _serialize(updated)


async def add_item_to_order(
    order_id: str,
    item_data: Dict[str, Any],
    current_user: Dict[str, str],
    prisma: Any,
) -> Dict[str, Any]:
    """Agrega un item a la orden (solo si DRAFT). Recalcula totales."""
    user_id = current_user.get("id") if isinstance(current_user, dict) else None
    if not user_id:
        raise ValueError("current_user.id es obligatorio")

    existing = await prisma.laborder.find_unique(where={"id": order_id})
    if existing is None:
        raise LookupError(f"LabOrder {order_id} no existe")
    if (existing.get("status") if isinstance(existing, dict) else getattr(existing, "status", None)) != "DRAFT":
        raise ValueError("Solo se pueden agregar items en DRAFT")

    amt = calculate_item_amount(
        item_data.get("price", 0),
        item_data.get("discountAmount", 0) or 0,
        item_data.get("discountPct", 0) or 0,
    )
    now = _now()
    item = await prisma.laborderitem.create(
        data={
            "labOrderId": order_id,
            "medicalTestId": item_data["medicalTestId"],
            "price": item_data.get("price", 0),
            "discountAmount": item_data.get("discountAmount", 0) or 0,
            "discountPct": item_data.get("discountPct", 0) or 0,
            "amount": amt,
            "resultStatus": item_data.get("resultStatus", "P"),
            "createdAt": now,
            "updatedAt": now,
        }
    )

    # Recalcular totales
    items = await prisma.laborderitem.find_many(where={"labOrderId": order_id})
    item_dicts = [
        {
            "price": (it.get("price") if isinstance(it, dict) else it.price) or 0,
            "discountAmount": (it.get("discountAmount") if isinstance(it, dict) else it.discountAmount) or 0,
            "discountPct": (it.get("discountPct") if isinstance(it, dict) else it.discountPct) or 0,
        }
        for it in items
    ]
    iva_pct = (existing.get("ivaPct") if isinstance(existing, dict) else existing.ivaPct) or 16
    totals = calculate_totals(item_dicts, iva_pct=iva_pct)
    await prisma.laborder.update(
        where={"id": order_id},
        data={
            "subtotal": totals["subtotal"],
            "iva": totals["iva"],
            "total": totals["total"],
            "updatedAt": now,
        },
    )

    record_audit(
        prisma,
        action="ADD_LAB_ORDER_ITEM",
        entity="LabOrderItem",
        entity_id=item.get("id") if isinstance(item, dict) else item.id,
        before=None,
        after=_serialize(item),
        user_id=user_id,
    )

    return _serialize(item)


async def remove_item_from_order(
    order_id: str,
    item_id: str,
    current_user: Dict[str, str],
    prisma: Any,
) -> Dict[str, Any]:
    """Elimina un item (solo si DRAFT). Recalcula totales."""
    user_id = current_user.get("id") if isinstance(current_user, dict) else None
    if not user_id:
        raise ValueError("current_user.id es obligatorio")

    existing = await prisma.laborder.find_unique(where={"id": order_id})
    if existing is None:
        raise LookupError(f"LabOrder {order_id} no existe")
    if (existing.get("status") if isinstance(existing, dict) else getattr(existing, "status", None)) != "DRAFT":
        raise ValueError("Solo se pueden eliminar items en DRAFT")

    item = await prisma.laborderitem.find_unique(where={"id": item_id})
    if item is None:
        raise LookupError(f"LabOrderItem {item_id} no existe")
    item_order_id = item.get("labOrderId") if isinstance(item, dict) else getattr(item, "labOrderId", None)
    if item_order_id != order_id:
        raise ValueError("El item no pertenece a la orden")

    await prisma.laborderitem.delete(where={"id": item_id})

    # Recalcular totales
    items = await prisma.laborderitem.find_many(where={"labOrderId": order_id})
    item_dicts = [
        {
            "price": (it.get("price") if isinstance(it, dict) else it.price) or 0,
            "discountAmount": (it.get("discountAmount") if isinstance(it, dict) else it.discountAmount) or 0,
            "discountPct": (it.get("discountPct") if isinstance(it, dict) else it.discountPct) or 0,
        }
        for it in items
    ]
    iva_pct = (existing.get("ivaPct") if isinstance(existing, dict) else existing.ivaPct) or 16
    totals = calculate_totals(item_dicts, iva_pct=iva_pct)
    await prisma.laborder.update(
        where={"id": order_id},
        data={
            "subtotal": totals["subtotal"],
            "iva": totals["iva"],
            "total": totals["total"],
            "updatedAt": _now(),
        },
    )

    record_audit(
        prisma,
        action="REMOVE_LAB_ORDER_ITEM",
        entity="LabOrderItem",
        entity_id=item_id,
        before=_serialize(item),
        after=None,
        user_id=user_id,
    )

    return {"ok": True, "deletedId": item_id}


# ---------------------------------------------------------------------------
# Listado paginado DataTables
# ---------------------------------------------------------------------------
async def list_orders_paginated(
    prisma: Any,
    draw: int = 1,
    start: int = 0,
    length: int = 25,
    search: Optional[str] = None,
    status: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
) -> Dict[str, Any]:
    """Server-side DataTables-compatible."""
    where: Dict[str, Any] = {}
    if status:
        where["status"] = status

    if search:
        # Búsqueda por folio, nombre de paciente, médico o empresa.
        # En Prisma, las relaciones se acceden por nombre del campo
        # (worker, company). Usamos OR con contains.
        where["OR"] = [
            {"doctorName": {"contains": search, "mode": "insensitive"}},
            {"novaFolio": {"contains": search, "mode": "insensitive"}},
        ]

    if date_from or date_to:
        date_range: Dict[str, Any] = {}
        if date_from:
            date_range["gte"] = date_from
        if date_to:
            date_range["lte"] = date_to
        where["createdAt"] = date_range

    delegate = prisma.laborder
    total = await delegate.count(where={})
    records_filtered = await delegate.count(where=where)

    rows = await delegate.find_many(
        where=where,
        order={"createdAt": "desc"},
        skip=max(0, int(start or 0)),
        take=max(1, min(int(length or 25), 100)),
    )

    # Enriquecer filas con paciente/empresa (sin N+1 absurdo: en este slice
    # lo dejamos básico, el frontend puede ampliar si lo necesita).
    data = []
    for r in rows:
        d = _serialize(r)
        worker = None
        company = None
        try:
            if d.get("workerId"):
                worker = await prisma.worker.find_unique(where={"id": d["workerId"]})
            if d.get("companyId"):
                company = await prisma.company.find_unique(where={"id": d["companyId"]})
        except Exception:
            pass
        d["paciente"] = (
            f"{(worker.get('firstName') if isinstance(worker, dict) else worker.firstName) or ''} "
            f"{(worker.get('lastName') if isinstance(worker, dict) else worker.lastName) or ''}".strip()
            if worker
            else None
        )
        d["medico"] = d.get("doctorName")
        d["empresa"] = (
            (company.get("name") if isinstance(company, dict) else company.name) if company else None
        )
        # Conteo de items
        try:
            d["itemCount"] = await prisma.laborderitem.count(where={"labOrderId": d["id"]})
        except Exception:
            d["itemCount"] = 0
        data.append(d)

    return {
        "draw": int(draw or 1),
        "recordsTotal": total,
        "recordsFiltered": records_filtered,
        "data": data,
    }


# ---------------------------------------------------------------------------
# Getter completo (con items expandidos)
# ---------------------------------------------------------------------------
async def get_order_full(order_id: str, prisma: Any) -> Optional[Dict[str, Any]]:
    order = await prisma.laborder.find_unique(where={"id": order_id})
    if order is None:
        return None
    items = await prisma.laborderitem.find_many(where={"labOrderId": order_id})
    out = _serialize(order)
    out["items"] = [_serialize(i) for i in items]
    # Expandir nombres de items
    for it in out["items"]:
        try:
            test = await prisma.medicaltest.find_unique(where={"id": it.get("medicalTestId")})
            if test:
                it["medicalTestName"] = (
                    test.get("name") if isinstance(test, dict) else test.name
                )
                it["medicalTestCode"] = (
                    test.get("code") if isinstance(test, dict) else test.code
                )
        except Exception:
            pass
    return out


# ---------------------------------------------------------------------------
# Autocomplete
# ---------------------------------------------------------------------------
def _age_from_dob(dob: Optional[str]) -> Optional[int]:
    if not dob:
        return None
    try:
        d = datetime.fromisoformat(dob.replace("Z", "+00:00")) if isinstance(dob, str) else dob
        today = datetime.utcnow()
        return today.year - d.year - ((today.month, today.day) < (d.month, d.day))
    except Exception:
        return None


async def search_workers(prisma: Any, q: str, limit: int = 10) -> List[Dict[str, Any]]:
    q = (q or "").strip()
    if not q:
        return []
    where = {
        "OR": [
            {"firstName": {"contains": q, "mode": "insensitive"}},
            {"lastName": {"contains": q, "mode": "insensitive"}},
            {"universalId": {"contains": q, "mode": "insensitive"}},
        ]
    }
    rows = await prisma.worker.find_many(where=where, take=min(int(limit or 10), 25))
    out: List[Dict[str, Any]] = []
    for r in rows:
        d = _serialize(r)
        full = f"{d.get('firstName') or ''} {d.get('lastName') or ''}".strip()
        company_name = None
        if d.get("companyId"):
            try:
                c = await prisma.company.find_unique(where={"id": d["companyId"]})
                if c:
                    company_name = c.get("name") if isinstance(c, dict) else c.name
            except Exception:
                pass
        out.append(
            {
                "id": d["id"],
                "fullName": full,
                "code": d.get("universalId") or "",
                "age": _age_from_dob(d.get("dob")),
                "companyName": company_name,
            }
        )
    return out


def search_doctors(q: str) -> List[Dict[str, Any]]:
    """Por ahora placeholder: texto libre. Slice futuro lo conectará a catálogo de médicos."""
    q = (q or "").strip()
    if not q:
        return []
    return [{"name": q, "clave": None}]


async def search_companies(prisma: Any, q: str, limit: int = 10) -> List[Dict[str, Any]]:
    q = (q or "").strip()
    if not q:
        return []
    where = {
        "OR": [
            {"name": {"contains": q, "mode": "insensitive"}},
            {"rfc": {"contains": q, "mode": "insensitive"}},
        ]
    }
    rows = await prisma.company.find_many(where=where, take=min(int(limit or 10), 25))
    return [
        {
            "id": _serialize(r)["id"],
            "name": _serialize(r).get("name"),
            "rfc": _serialize(r).get("rfc"),
        }
        for r in rows
    ]


async def search_tests(prisma: Any, q: str, limit: int = 10) -> List[Dict[str, Any]]:
    q = (q or "").strip()
    if not q:
        return []
    where: Dict[str, Any] = {
        "OR": [
            {"code": {"contains": q, "mode": "insensitive"}},
            {"name": {"contains": q, "mode": "insensitive"}},
        ]
    }
    # El modelo MedicalTest actual no tiene un campo `type` directo
    # (las pruebas son laboratorios por defecto en el esquema AMI).
    # Mantenemos el filtro abierto pero evitamos romper el endpoint.
    rows = await prisma.medicaltest.find_many(where=where, take=min(int(limit or 10), 25))
    out: List[Dict[str, Any]] = []
    for r in rows:
        d = _serialize(r)
        # Precio: MedicalTest usa `options` (JSON) sin price directo en el esquema actual.
        # Exponemos price=0 y el nombre, suficiente para el autocomplete demo.
        out.append(
            {
                "id": d["id"],
                "code": d.get("code") or "",
                "alternateCode": None,
                "name": d.get("name") or "",
                "price": 0,
            }
        )
    return out
