"""
IMPL-20260630-06: Slice A NOVA absorción (ARCH-20260630-02).
Servicio CRUD + paginación DataTables-compatible para los 8 mods LIS.

Diseño:
  - Trabaja contra un cliente Prisma inyectable (set_prisma_client).
  - Permite tests sin DB real usando un mock (MagicMock o AsyncMock).
  - Paginación: max length=100 (SPEC §4.1).
  - Búsqueda: campo genérico `search` aplica ILIKE sobre code/name/symbol.
  - Soft delete: DELETE pone active=False (no hard delete), preservando
    integridad referencial con MedicalTest / LabOrder (futuros slices).
  - Audit log: cada create/update/delete llama a `record_audit`.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

# ---------------------------------------------------------------------------
# Dispatcher: nombre del modelo Prisma → operaciones CRUD
# ---------------------------------------------------------------------------
# FIX-20260706-16 (Slice 2): Prisma Python usa snake_case para nombres de modelos.
# Model `LabUnit` -> prisma.labunit. Los field names del schema (workerId, etc.)
# mantienen camelCase.
MOD_TO_MODEL = {
    "unidades": "labunit",
    "muestras": "labsample",
    "recipientes": "labcontainer",
    "metodologias": "labmethod",
    "lugares_proceso": "labprocessarea",
    "clasificaciones": "labclassification",
    "indicaciones": "labindication",
    "departamentos": "labdepartment",
}


# Columnas permitidas para búsqueda textual genérica por mod.
MOD_TO_SEARCH_FIELDS: Dict[str, List[str]] = {
    "unidades": ["symbol", "name"],
    "muestras": ["code", "name"],
    "recipientes": ["code", "name"],
    "metodologias": ["code", "name", "principle"],
    "lugares_proceso": ["code", "name"],
    "clasificaciones": ["code", "name"],
    "indicaciones": ["code", "text"],
    "departamentos": ["code", "name"],
}

# Columnas permitidas para ordenamiento por mod (DataTables column index → field).
MOD_TO_ORDER_FIELDS: Dict[str, List[str]] = {
    "unidades": ["symbol", "name", "system", "active", "createdAt"],
    "muestras": ["code", "name", "preservation", "minVolume", "active", "createdAt"],
    "recipientes": ["code", "name", "color", "cap", "active", "createdAt"],
    "metodologias": ["code", "name", "principle", "active", "createdAt"],
    "lugares_proceso": ["code", "name", "departmentId", "active", "createdAt"],
    "clasificaciones": ["code", "name", "color", "sortOrder", "active", "createdAt"],
    "indicaciones": ["code", "text", "active", "createdAt"],
    "departamentos": ["code", "name", "active", "createdAt"],
}

MAX_PAGE_LENGTH = 100
DEFAULT_PAGE_LENGTH = 25


# ---------------------------------------------------------------------------
# Inyección de Prisma client (sigue el patrón de app/api/reports.py)
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
def _serialize(obj: Any) -> Dict[str, Any]:
    """Convierte un modelo Prisma a dict serializable JSON."""
    if obj is None:
        return {}
    if hasattr(obj, "model_dump"):
        d = obj.model_dump()
    elif hasattr(obj, "__dict__"):
        d = dict(obj.__dict__)
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


def _cap_length(length: int) -> int:
    return max(1, min(int(length or DEFAULT_PAGE_LENGTH), MAX_PAGE_LENGTH))


def _normalize_order(mod: str, col: int, direction: str) -> Tuple[str, str]:
    """Devuelve (field, 'asc'|'desc') garantizando que la columna es válida."""
    fields = MOD_TO_ORDER_FIELDS.get(mod, ["createdAt"])
    if col < 0 or col >= len(fields):
        col = len(fields) - 1  # fallback a createdAt
    field = fields[col]
    direction = "desc" if (direction or "").lower() == "desc" else "asc"
    return field, direction


# ---------------------------------------------------------------------------
# API pública del servicio
# ---------------------------------------------------------------------------
async def list_catalog(
    mod: str,
    draw: int,
    start: int,
    length: int,
    search: Optional[str] = None,
    order_column: int = 0,
    order_dir: str = "asc",
    only_active: bool = False,
) -> Dict[str, Any]:
    """Server-side DataTables-compatible.

    Returns:
        {"draw": int, "recordsTotal": int, "recordsFiltered": int, "data": list}
    """
    prisma = get_prisma()
    model_name = MOD_TO_MODEL[mod]
    delegate = getattr(prisma, model_name)

    where: Dict[str, Any] = {}
    if only_active:
        where["active"] = True

    total = await delegate.count(where=where)

    filtered_where = dict(where)
    if search:
        search_fields = MOD_TO_SEARCH_FIELDS.get(mod, [])
        if search_fields:
            # Prisma "OR" con contains (case-insensitive en PostgreSQL via mode)
            filtered_where["OR"] = [
                {f: {"contains": search, "mode": "insensitive"}} for f in search_fields
            ]

    records_filtered = await delegate.count(where=filtered_where)

    order_field, order_dir_norm = _normalize_order(mod, order_column, order_dir)
    order_clause = {order_field: order_dir_norm}

    page_length = _cap_length(length)
    page_start = max(0, int(start or 0))

    rows = await delegate.find_many(
        where=filtered_where,
        order=order_clause,
        skip=page_start,
        take=page_length,
    )

    return {
        "draw": int(draw or 1),
        "recordsTotal": total,
        "recordsFiltered": records_filtered,
        "data": [_serialize(r) for r in rows],
    }


async def get_catalog_item(mod: str, item_id: str) -> Optional[Dict[str, Any]]:
    prisma = get_prisma()
    model_name = MOD_TO_MODEL[mod]
    delegate = getattr(prisma, model_name)
    obj = await delegate.find_unique(where={"id": item_id})
    return _serialize(obj) if obj else None


async def create_catalog_item(mod: str, values: Dict[str, Any], user_id: Optional[str] = None) -> Dict[str, Any]:
    prisma = get_prisma()
    model_name = MOD_TO_MODEL[mod]
    delegate = getattr(prisma, model_name)

    data = dict(values)
    if "active" not in data:
        data["active"] = True
    if user_id:
        data["createdById"] = user_id

    obj = await delegate.create(data=data)
    obj_id = obj["id"] if isinstance(obj, dict) else getattr(obj, "id", None)
    record_audit(prisma, action=f"CREATE_{mod.upper().rstrip('S')}", entity=model_name, entity_id=obj_id, before=None, after=_serialize(obj), user_id=user_id)
    return _serialize(obj)


async def update_catalog_item(mod: str, item_id: str, values: Dict[str, Any], user_id: Optional[str] = None) -> Dict[str, Any]:
    prisma = get_prisma()
    model_name = MOD_TO_MODEL[mod]
    delegate = getattr(prisma, model_name)

    before = await delegate.find_unique(where={"id": item_id})
    if before is None:
        raise LookupError(f"{mod}/{item_id} no existe")

    data = {k: v for k, v in values.items() if v is not None}
    obj = await delegate.update(where={"id": item_id}, data=data)
    obj_id = obj["id"] if isinstance(obj, dict) else getattr(obj, "id", None)
    record_audit(prisma, action=f"UPDATE_{mod.upper().rstrip('S')}", entity=model_name, entity_id=obj_id, before=_serialize(before), after=_serialize(obj), user_id=user_id)
    return _serialize(obj)


async def delete_catalog_item(mod: str, item_id: str, user_id: Optional[str] = None) -> Dict[str, Any]:
    """Soft delete: pone active=False."""
    return await update_catalog_item(mod, item_id, {"active": False}, user_id=user_id)


def record_audit(prisma: Any, action: str, entity: str, entity_id: str, before: Optional[Dict[str, Any]], after: Optional[Dict[str, Any]], user_id: Optional[str] = None) -> None:
    """Inserta una fila en AuditLog. Tolerante a fallos (no rompe el flujo principal)."""
    try:
        # FIX-20260706-16: Prisma Python model AuditLog -> prisma.auditlog.
        audit = getattr(prisma, "auditlog", None)
        if audit is None:
            return
        details = {
            "mod": action.replace("CREATE_", "").replace("UPDATE_", "").replace("DELETE_", "").lower(),
            "before": before,
            "after": after,
        }
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
        # Audit es observabilidad; no debe romper el flujo.
        pass


def _json_safe(payload: Any) -> Any:
    """Prisma requiere JSON serializable para campos Json."""
    if payload is None:
        return None
    if isinstance(payload, dict):
        return {k: _json_safe(v) for k, v in payload.items() if not callable(v)}
    if isinstance(payload, list):
        return [_json_safe(v) for v in payload]
    if isinstance(payload, (str, int, float, bool)):
        return payload
    return str(payload)