"""
IMPL-20260711-01 — Router FastAPI para MaintenanceRecord (ARCH-20260711-01).
Ref: context/SPECs/SPEC_ARCH-20260711-01-MODULO-UNIDADES-MOVILES.md

Prefijo: /api/v1/maintenance
"""
from __future__ import annotations

from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException, Request

from app.services import mobile_unit_service as svc

router = APIRouter(prefix="/api/v1/maintenance", tags=["maintenance"])


def _user(request: Request) -> Dict[str, Any]:
    user_id = request.headers.get("x-ami-userid") or request.headers.get("x-user-id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Falta X-AMI-UserId")
    role = request.headers.get("x-ami-role") or "ADMIN"
    return {"id": user_id, "role": role}


def _prisma():
    return svc.get_prisma()


# ---------------------------------------------------------------------------
# Mantenimientos por unidad
# ---------------------------------------------------------------------------
@router.get("/unit/{unit_id}")
async def list_records(unit_id: str, status: Optional[str] = None):
    return await svc.list_maintenance_records(_prisma(), unit_id, status=status)


@router.post("/unit/{unit_id}")
async def create_record(unit_id: str, payload: Dict[str, Any], request: Request):
    user = _user(request)
    try:
        return await svc.create_maintenance_record(_prisma(), unit_id, payload, user)
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("/{record_id}")
async def update_record(record_id: str, payload: Dict[str, Any]):
    try:
        return await svc.update_maintenance_record(_prisma(), record_id, payload)
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{record_id}/reprogram")
async def reprogram_record(
    record_id: str,
    payload: Dict[str, Any],
):
    new_date = payload.get("newDate")
    if not new_date:
        raise HTTPException(status_code=400, detail="'newDate' es obligatorio (ISO 8601).")
    reason = payload.get("reason")
    try:
        return await svc.reprogram_maintenance(_prisma(), record_id, new_date, reason)
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))


@router.post("/{record_id}/complete")
async def complete_record(record_id: str, payload: Dict[str, Any], request: Request):
    user = _user(request)
    try:
        return await svc.complete_maintenance(_prisma(), record_id, payload, user)
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
