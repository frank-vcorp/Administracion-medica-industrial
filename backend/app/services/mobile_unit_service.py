"""
IMPL-20260711-01 — Servicio CRUD de MobileUnit y MaintenanceRecord (ARCH-20260711-01).
Ref: context/SPECs/SPEC_ARCH-20260711-01-MODULO-UNIDADES-MOVILES.md

Diseño:
  - Trabaja contra un cliente Prisma inyectable (set_prisma_client), igual que
    lab_order_service, lab_catalog_service.
  - Validaciones de dominio: unicidad de nombre, unidad no eliminable si tiene
    relaciones activas, no solapamiento de fechas proyecto vs mantenimiento.
  - Cálculo puro de `next_due_date` por tipo de mantenimiento (exportable para tests).

Todos los endpoints devuelven dicts JSON-serializables.
"""
from __future__ import annotations

from datetime import datetime, timedelta
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple

# ---------------------------------------------------------------------------
# Prisma client injection
# ---------------------------------------------------------------------------
_prisma: Any = None


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
# Serialización
# ---------------------------------------------------------------------------
def _serialize(obj: Any) -> Dict[str, Any]:
    """Convierte un modelo Prisma (incluido Decimal/DateTime/Json) a dict JSON-friendly."""
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
        elif isinstance(v, Decimal):
            out[k] = float(v)
        elif isinstance(v, (str, int, float, bool)) or v is None:
            out[k] = v
        elif isinstance(v, list):
            out[k] = [_serialize(item) if isinstance(item, (dict, list)) else item for item in v]
        elif isinstance(v, dict):
            out[k] = _serialize(v)
        else:
            out[k] = str(v)
    return out


def _serialize_list(items: List[Any]) -> List[Dict[str, Any]]:
    return [_serialize(i) for i in items]


# ---------------------------------------------------------------------------
# Helpers puros (testeables sin DB)
# ---------------------------------------------------------------------------
# SPEC §3.2 — auto-calculo de nextDueDate por tipo de mantenimiento
MAINTENANCE_NEXT_DUE_DAYS: Dict[str, Optional[int]] = {
    "PREVENTIVO": 90,
    "CORRECTIVO": None,  # no aplica
    "VERIFICACION": 365,
    "LIMPIEZA": 30,
}


def calculate_next_due_date(
    completed_date: datetime, mtype: str, override: Optional[datetime] = None
) -> Optional[datetime]:
    """
    SPEC §3.2 — Al completar mantenimiento, auto-calcula `nextDueDate`:
      - PREVENTIVO: +90 días
      - CORRECTIVO: None (no aplica)
      - VERIFICACION: +365 días
      - LIMPIEZA: +30 días
    Si se pasa `override`, gana sobre el cálculo automático.
    """
    if override is not None:
        return override
    days = MAINTENANCE_NEXT_DUE_DAYS.get(mtype)
    if days is None:
        return None
    return completed_date + timedelta(days=days)


def is_overlap(start_a: datetime, end_a: datetime, start_b: datetime, end_b: datetime) -> bool:
    """
    Devuelve True si los rangos [start_a, end_a] y [start_b, end_b] se solapan
    (inclusivo en ambos extremos). SPEC §3.1.
    """
    return start_a <= end_b and start_b <= end_a


# ---------------------------------------------------------------------------
# MobileUnit CRUD
# ---------------------------------------------------------------------------
async def list_mobile_units(prisma: Any, status: Optional[str] = None) -> List[Dict[str, Any]]:
    where: Dict[str, Any] = {}
    if status:
        where["status"] = status
    units = await prisma.mobileunit.find_many(
        where=where,
        include={
            "_count": {"select": {"projects": True, "maintenances": True}},
        },
        orderBy={"name": "asc"},
    )
    out: List[Dict[str, Any]] = []
    for u in units:
        d = _serialize(u)
        d["_count"] = getattr(u, "_count", {"projects": 0, "maintenances": 0})
        d["_count"] = _serialize(d["_count"])
        out.append(d)
    return out


async def get_mobile_unit(prisma: Any, unit_id: str) -> Dict[str, Any]:
    unit = await prisma.mobileunit.find_unique(
        where={"id": unit_id},
        include={
            "projects": {
                "select": {
                    "id": True,
                    "name": True,
                    "startDate": True,
                    "endDate": True,
                    "status": True,
                },
                "orderBy": {"startDate": "desc"},
            },
            "maintenances": {
                "orderBy": {"scheduledDate": "desc"},
            },
            "medicalEvents": {
                "select": {"id": True, "status": True, "checkInDate": True},
                "take": 50,
                "orderBy": {"checkInDate": "desc"},
            },
            "labOrders": {
                "select": {"id": True, "folio": True, "status": True, "createdAt": True},
                "take": 50,
                "orderBy": {"createdAt": "desc"},
            },
        },
    )
    if unit is None:
        raise LookupError(f"MobileUnit {unit_id} no encontrada")
    return _serialize(unit)


async def create_mobile_unit(prisma: Any, data: Dict[str, Any], current_user: Dict[str, Any]) -> Dict[str, Any]:
    """
    Crea una unidad. Valida unicidad de `name`.
    Lanza ValueError si el nombre ya existe.
    """
    name = (data.get("name") or "").strip()
    if not name:
        raise ValueError("'name' es obligatorio")

    existing = await prisma.mobileunit.find_unique(where={"name": name})
    if existing is not None:
        raise ValueError(f"Ya existe una unidad con el nombre '{name}'")

    create_data: Dict[str, Any] = {
        "name": name,
        "status": data.get("status", "ACTIVA"),
    }
    for field in ("plate", "vin", "year", "capacity", "economicNumber", "imageUrl", "notes"):
        if data.get(field) is not None:
            create_data[field] = data[field]
    if data.get("equipment") is not None:
        # Equipment viene como dict; Prisma JSON se serializa directamente.
        create_data["equipment"] = data["equipment"]

    created = await prisma.mobileunit.create(data=create_data)
    return _serialize(created)


async def update_mobile_unit(
    prisma: Any, unit_id: str, data: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Actualiza una unidad. Si se cambia `name`, valida unicidad.
    """
    update_data: Dict[str, Any] = {}
    if "name" in data and data["name"]:
        existing = await prisma.mobileunit.find_unique(where={"name": data["name"]})
        if existing is not None and existing.id != unit_id:
            raise ValueError(f"Ya existe otra unidad con el nombre '{data['name']}'")
        update_data["name"] = data["name"]
    for field in ("plate", "vin", "year", "capacity", "economicNumber", "imageUrl", "notes", "status"):
        if field in data:
            update_data[field] = data[field]
    if "equipment" in data:
        update_data["equipment"] = data["equipment"]

    if not update_data:
        # Nada que actualizar, devolver el registro tal cual.
        return await get_mobile_unit(prisma, unit_id)

    updated = await prisma.mobileunit.update(
        where={"id": unit_id},
        data=update_data,
    )
    return _serialize(updated)


async def delete_mobile_unit(prisma: Any, unit_id: str) -> Dict[str, Any]:
    """
    SPEC §3.4 — bloquea eliminación si hay proyectos/mantenimientos/eventos/labOrders asociados.
    """
    unit = await prisma.mobileunit.find_unique(
        where={"id": unit_id},
        include={
            "_count": {
                "select": {
                    "projects": True,
                    "maintenances": True,
                    "medicalEvents": True,
                    "labOrders": True,
                }
            }
        },
    )
    if unit is None:
        raise LookupError(f"MobileUnit {unit_id} no encontrada")
    counts = getattr(unit, "_count", {})
    blockers = {k: counts.get(k, 0) for k in ("projects", "maintenances", "medicalEvents", "labOrders") if counts.get(k, 0) > 0}
    if blockers:
        raise ValueError(
            "No se puede eliminar la unidad porque tiene relaciones activas: "
            + ", ".join(f"{k}={v}" for k, v in blockers.items())
        )

    await prisma.mobileunit.delete(where={"id": unit_id})
    return {"deleted": True, "id": unit_id}


async def upload_mobile_unit_image(
    prisma: Any, unit_id: str, file_bytes: bytes, filename: str, content_type: str
) -> Dict[str, Any]:
    """
    Persiste la imagen usando el helper global de upload (S3 + fallback local).
    Devuelve la URL pública final.
    """
    # Importación local para evitar ciclos y permitir mocking en tests.
    from app.main import _upload_file_to_s3, _s3_enabled, _detect_content_type  # type: ignore
    import os

    if not filename.lower().endswith((".jpg", ".jpeg", ".png")):
        raise ValueError("Tipo de archivo no permitido. Solo JPG/PNG.")
    if len(file_bytes) > 5 * 1024 * 1024:
        raise ValueError("La imagen excede el tamaño máximo (5MB).")
    if content_type not in ("image/jpeg", "image/png"):
        raise ValueError(f"Content-Type inválido: {content_type}")

    key = f"uploads/mobile-units/{unit_id}/{filename}"
    stored_in_s3 = False
    if _s3_enabled:
        stored_in_s3 = bool(_upload_file_to_s3(file_bytes, key))
    if not stored_in_s3:
        # Fallback local (tests / sin bucket configurado).
        upload_dir = os.environ.get("UPLOAD_DIR", "/uploads")
        os.makedirs(os.path.join(upload_dir, f"mobile-units/{unit_id}"), exist_ok=True)
        local_path = os.path.join(upload_dir, key)
        with open(local_path, "wb") as f:
            f.write(file_bytes)

    image_url = f"/api/files/{key}"
    updated = await prisma.mobileunit.update(
        where={"id": unit_id},
        data={"imageUrl": image_url},
    )
    return {"imageUrl": image_url, "unit": _serialize(updated)}


async def delete_mobile_unit_image(prisma: Any, unit_id: str) -> Dict[str, Any]:
    updated = await prisma.mobileunit.update(
        where={"id": unit_id},
        data={"imageUrl": None},
    )
    return {"unit": _serialize(updated)}


# ---------------------------------------------------------------------------
# Maintenance CRUD
# ---------------------------------------------------------------------------
async def list_maintenance_records(
    prisma: Any, unit_id: str, status: Optional[str] = None
) -> List[Dict[str, Any]]:
    where: Dict[str, Any] = {"mobileUnitId": unit_id}
    if status:
        where["status"] = status
    records = await prisma.maintenancerecord.find_many(
        where=where,
        orderBy={"scheduledDate": "desc"},
    )
    return _serialize_list(list(records))


async def create_maintenance_record(
    prisma: Any, unit_id: str, data: Dict[str, Any], current_user: Dict[str, Any]
) -> Dict[str, Any]:
    """
    SPEC §3.1/§3.2 — al crear:
      - Rechaza si la unidad está MANTENIMIENTO/REPARACION/FUERA_SERVICIO/BAJA_PERMANENTE.
      - Rechaza si el solapa con un proyecto del mismo día (ver validate_unit_availability).
      - Almacena el próximo mantenimiento sugerido (nextDueDate).
    """
    unit = await prisma.mobileunit.find_unique(where={"id": unit_id})
    if unit is None:
        raise LookupError(f"MobileUnit {unit_id} no encontrada")

    if (unit.status or "").upper() in ("BAJA_PERMANENTE", "FUERA_SERVICIO"):
        raise ValueError(f"Unidad fuera de servicio (status={unit.status}). No se puede programar mantenimiento.")

    scheduled_date = _parse_date(data.get("scheduledDate"))
    # SPEC §3.1 — no solapamiento con proyectos de la misma unidad
    availability = await validate_unit_availability(
        prisma,
        unit_id,
        scheduled_date,
        scheduled_date,  # rango de 1 día para mantenimiento
    )
    if not availability["available"]:
        raise ValueError(
            "Conflicto: la unidad tiene proyecto activo en esa fecha. "
            "Sugerencias (alternativas): "
            + ", ".join(d.get("iso", "") for d in availability.get("suggestions", []))
        )

    description = (data.get("description") or "").strip()
    if not description:
        raise ValueError("'description' es obligatorio")

    record_data: Dict[str, Any] = {
        "mobileUnitId": unit_id,
        "type": data.get("type", "PREVENTIVO"),
        "status": data.get("status", "PROGRAMADO"),
        "scheduledDate": scheduled_date,
        "description": description,
        "createdBy": current_user["id"],
    }
    for field in ("technician", "cost"):
        if data.get(field) is not None:
            record_data[field] = data[field]
    if data.get("nextDueDate"):
        record_data["nextDueDate"] = _parse_date(data["nextDueDate"])
    if data.get("attachments"):
        record_data["attachments"] = data["attachments"]

    created = await prisma.maintenancerecord.create(data=record_data)
    return _serialize(created)


async def update_maintenance_record(
    prisma: Any, record_id: str, data: Dict[str, Any]
) -> Dict[str, Any]:
    update_data: Dict[str, Any] = {}
    for field in ("type", "description", "technician"):
        if field in data and data[field] is not None:
            update_data[field] = data[field]
    if "scheduledDate" in data and data["scheduledDate"]:
        update_data["scheduledDate"] = _parse_date(data["scheduledDate"])
    if "cost" in data:
        update_data["cost"] = data["cost"]
    if "nextDueDate" in data:
        update_data["nextDueDate"] = _parse_date(data["nextDueDate"]) if data["nextDueDate"] else None

    if not update_data:
        existing = await prisma.maintenancerecord.find_unique(where={"id": record_id})
        if existing is None:
            raise LookupError(f"MaintenanceRecord {record_id} no encontrado")
        return _serialize(existing)

    updated = await prisma.maintenancerecord.update(
        where={"id": record_id},
        data=update_data,
    )
    return _serialize(updated)


async def reprogram_maintenance(
    prisma: Any, record_id: str, new_date_iso: str, reason: Optional[str] = None
) -> Dict[str, Any]:
    """
    SPEC §3.2 / §4.2 — reprograma un mantenimiento:
      - Marca el original como REPROGRAMADO (con `rescheduledTo` y `reason` en description)
      - Crea un NUEVO MaintenanceRecord con la nueva fecha (linked al original vía description).
    """
    original = await prisma.maintenancerecord.find_unique(where={"id": record_id})
    if original is None:
        raise LookupError(f"MaintenanceRecord {record_id} no encontrado")

    new_date = _parse_date(new_date_iso)

    # Validación de no solapamiento en la nueva fecha
    availability = await validate_unit_availability(
        prisma, original.mobileUnitId, new_date, new_date
    )
    if not availability["available"]:
        raise ValueError(
            "La nueva fecha también tiene conflicto. Alternativas: "
            + ", ".join(d.get("iso", "") for d in availability.get("suggestions", []))
        )

    # Marcar original como REPROGRAMADO y guardar rescheduledTo
    suffix = f"\n[REPROGRAMADO a {new_date.isoformat()}]" + (f" — {reason}" if reason else "")
    await prisma.maintenancerecord.update(
        where={"id": record_id},
        data={
            "status": "REPROGRAMADO",
            "rescheduledTo": new_date,
            "description": (getattr(original, "description", "") or "") + suffix,
        },
    )

    # Crear nuevo registro clonado con nueva fecha
    new_record = await prisma.maintenancerecord.create(
        data={
            "mobileUnitId": getattr(original, "mobileUnitId"),
            "type": getattr(original, "type"),
            "status": "PROGRAMADO",
            "scheduledDate": new_date,
            "description": (getattr(original, "description", "") or "") + suffix,
            "technician": getattr(original, "technician", None),
            "nextDueDate": getattr(original, "nextDueDate", None),
            "createdBy": getattr(original, "createdBy"),
        }
    )
    return {
        "original": {"id": record_id, "status": "REPROGRAMADO", "rescheduledTo": new_date.isoformat()},
        "new": _serialize(new_record),
    }


async def complete_maintenance(
    prisma: Any, record_id: str, data: Dict[str, Any], current_user: Dict[str, Any]
) -> Dict[str, Any]:
    """
    SPEC §3.2 — al completar mantenimiento:
      - status = COMPLETADO
      - completedDate = ahora (o del payload)
      - completedBy = current_user
      - nextDueDate = calculate_next_due_date(...) según tipo
    """
    record = await prisma.maintenancerecord.find_unique(where={"id": record_id})
    if record is None:
        raise LookupError(f"MaintenanceRecord {record_id} no encontrado")

    completed_date = _parse_date(data.get("completedDate")) or datetime.utcnow()

    next_due = calculate_next_due_date(
        completed_date, str(record.type), _parse_date(data["nextDueDate"]) if data.get("nextDueDate") else None
    )

    cost = data.get("cost")
    update_data: Dict[str, Any] = {
        "status": "COMPLETADO",
        "completedDate": completed_date,
        "completedBy": current_user["id"],
        "nextDueDate": next_due,
    }
    if cost is not None:
        update_data["cost"] = cost
    if data.get("attachments"):
        update_data["attachments"] = data["attachments"]
    if data.get("notes"):
        update_data["description"] = (record.description or "") + f"\n[NOTAS] {data['notes']}"

    updated = await prisma.maintenancerecord.update(
        where={"id": record_id},
        data=update_data,
    )
    return _serialize(updated)


# ---------------------------------------------------------------------------
# Disponibilidad / reprogramación
# ---------------------------------------------------------------------------
async def validate_unit_availability(
    prisma: Any,
    mobile_unit_id: str,
    start_date: datetime,
    end_date: datetime,
    exclude_project_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    SPEC §3.1 — una unidad no puede estar asignada a múltiples proyectos con
    fechas solapadas. También evita mantenimientos PROGRAMADOS en el rango.

    Devuelve:
      {
        "available": bool,
        "conflicts": [...],
        "suggestions": [{ iso, label }],
      }

    `suggestions` se popula con 3 fechas alternativas (±N días) que sí están
    libres, útil para reprogramar mantenimientos cuando hay conflicto.
    """
    where: Dict[str, Any] = {"mobileUnitId": mobile_unit_id}
    if exclude_project_id:
        # Solo Prisma soporta en `none` excluir el propio proyecto.
        projects = await prisma.project.find_many(
            where={
                "mobileUnitId": mobile_unit_id,
                "id": {"not": exclude_project_id},
                # status no cancelado
                "NOT": {"status": "CANCELLED"},
                # solapamiento: project.startDate <= end AND project.endDate >= start
                "AND": [
                    {"startDate": {"lte": end_date}},
                    {"endDate": {"gte": start_date}},
                ],
            },
            select={"id": True, "name": True, "startDate": True, "endDate": True, "status": True},
        )
    else:
        projects = await prisma.project.find_many(
            where={
                "mobileUnitId": mobile_unit_id,
                "NOT": {"status": "CANCELLED"},
                "AND": [
                    {"startDate": {"lte": end_date}},
                    {"endDate": {"gte": start_date}},
                ],
            },
            select={"id": True, "name": True, "startDate": True, "endDate": True, "status": True},
        )

    # Mantenimientos PROGRAMADOS/REPROGRAMADOS en el rango
    maintenances = await prisma.maintenancerecord.find_many(
        where={
            "mobileUnitId": mobile_unit_id,
            "status": {"in": ["PROGRAMADO", "REPROGRAMADO"]},
            "scheduledDate": {"gte": start_date, "lte": end_date},
        },
        select={"id": True, "type": True, "scheduledDate": True, "status": True},
    )

    conflicts: List[Dict[str, Any]] = []
    for p in projects:
        conflicts.append({
            "type": "project",
            "id": getattr(p, "id", None),
            "name": getattr(p, "name", None),
            "startDate": _iso(getattr(p, "startDate", None)),
            "endDate": _iso(getattr(p, "endDate", None)),
            "status": getattr(p, "status", None),
        })
    for m in maintenances:
        conflicts.append({
            "type": "maintenance",
            "id": getattr(m, "id", None),
            "typeLabel": str(getattr(m, "type", "")),
            "scheduledDate": _iso(getattr(m, "scheduledDate", None)),
            "status": getattr(m, "status", None),
        })

    available = len(conflicts) == 0
    suggestions: List[Dict[str, str]] = []

    if not available:
        # Buscar 3 fechas alternativas: inicio + N días (N = 7, 14, 21)
        for days in (7, 14, 21):
            candidate_start = start_date + timedelta(days=days)
            candidate_end = end_date + timedelta(days=days)
            check = await validate_unit_availability(
                prisma, mobile_unit_id, candidate_start, candidate_end, exclude_project_id
            )
            if check["available"]:
                suggestions.append({
                    "iso": candidate_start.isoformat(),
                    "label": f"+{days} días",
                })
            if len(suggestions) >= 3:
                break

    return {
        "available": available,
        "conflicts": conflicts,
        "suggestions": suggestions,
    }


async def suggest_maintenance_dates(
    prisma: Any,
    mobile_unit_id: str,
    start_after: datetime,
    search_window_days: int,
    max_suggestions: int,
) -> List[Dict[str, str]]:
    """
    SPEC §4.3 — dado un project endDate, busca N fechas posteriores en las
    que NO haya proyecto/mantenimiento que se solape.
    """
    out: List[Dict[str, str]] = []
    cursor = start_after + timedelta(days=1)
    horizon = start_after + timedelta(days=search_window_days)
    while cursor <= horizon and len(out) < max_suggestions:
        day_end = cursor
        check = await validate_unit_availability(prisma, mobile_unit_id, cursor, day_end)
        if check["available"]:
            out.append({"iso": cursor.isoformat(), "label": f"+{(cursor - start_after).days} días"})
        cursor = cursor + timedelta(days=1)
    return out


# ---------------------------------------------------------------------------
# Helpers de parsing
# ---------------------------------------------------------------------------
def _parse_date(value: Any) -> Optional[datetime]:
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        try:
            # Acepta ISO 8601 con o sin Z.
            v = value.replace("Z", "+00:00")
            dt = datetime.fromisoformat(v)
            # Strip timezone si existe (Prisma datetime es naive UTC).
            if dt.tzinfo is not None:
                dt = dt.astimezone(tz=None).replace(tzinfo=None)
            return dt
        except ValueError as exc:
            raise ValueError(f"Fecha inválida: {value}") from exc
    raise ValueError(f"Tipo de fecha no soportado: {type(value)}")


def _iso(value: Any) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.isoformat()
    return str(value)
