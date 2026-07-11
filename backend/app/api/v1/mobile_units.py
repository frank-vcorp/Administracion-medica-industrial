"""
IMPL-20260711-01 — Router FastAPI para MobileUnit (ARCH-20260711-01).
Ref: context/SPECs/SPEC_ARCH-20260711-01-MODULO-UNIDADES-MOVILES.md

Prefijo: /api/v1/mobile-units
"""
from __future__ import annotations

from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException, Request, UploadFile, File

from app.services import mobile_unit_service as svc

router = APIRouter(prefix="/api/v1/mobile-units", tags=["mobile-units"])


def _user(request: Request) -> Dict[str, Any]:
    """Extrae user info del header X-AMI-UserId (placeholder hasta integrar JWT AMI)."""
    user_id = request.headers.get("x-ami-userid") or request.headers.get("x-user-id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Falta X-AMI-UserId")
    role = request.headers.get("x-ami-role") or "ADMIN"
    return {"id": user_id, "role": role}


def _prisma():
    return svc.get_prisma()


# ---------------------------------------------------------------------------
# List / detail / create / update / delete
# ---------------------------------------------------------------------------
@router.get("")
async def list_mobile_units(status: Optional[str] = None):
    return await svc.list_mobile_units(_prisma(), status=status)


@router.get("/{unit_id}")
async def get_mobile_unit(unit_id: str):
    try:
        return await svc.get_mobile_unit(_prisma(), unit_id)
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("")
async def create_mobile_unit(payload: Dict[str, Any], request: Request):
    user = _user(request)
    try:
        return await svc.create_mobile_unit(_prisma(), payload, user)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("/{unit_id}")
async def update_mobile_unit(unit_id: str, payload: Dict[str, Any]):
    try:
        return await svc.update_mobile_unit(_prisma(), unit_id, payload)
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{unit_id}")
async def delete_mobile_unit(unit_id: str):
    try:
        return await svc.delete_mobile_unit(_prisma(), unit_id)
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))


# ---------------------------------------------------------------------------
# Imagen (S3 + fallback local)
# ---------------------------------------------------------------------------
@router.post("/{unit_id}/image")
async def upload_image(unit_id: str, file: UploadFile = File(...)):
    if file.content_type not in ("image/jpeg", "image/png"):
        raise HTTPException(status_code=400, detail="Tipo de archivo no permitido. Solo image/jpeg o image/png.")
    contents = await file.read()
    if len(contents) > 5 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="La imagen excede 5MB.")

    safe_filename = (file.filename or f"image-{unit_id}.jpg").replace(" ", "_")
    try:
        return await svc.upload_mobile_unit_image(
            _prisma(), unit_id, contents, safe_filename, file.content_type
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete("/{unit_id}/image")
async def delete_image(unit_id: str):
    try:
        return await svc.delete_mobile_unit_image(_prisma(), unit_id)
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))


# ---------------------------------------------------------------------------
# Disponibilidad / reprogramación de mantenimientos
# ---------------------------------------------------------------------------
@router.get("/{unit_id}/availability")
async def validate_availability(
    unit_id: str,
    start_date: str,
    end_date: str,
    exclude_project_id: Optional[str] = None,
):
    try:
        from datetime import datetime

        s = svc._parse_date(start_date)
        e = svc._parse_date(end_date)
        if s is None or e is None:
            raise ValueError("start_date y end_date son obligatorias (ISO 8601).")
        if s > e:
            raise ValueError("start_date debe ser <= end_date.")
        return await svc.validate_unit_availability(_prisma(), unit_id, s, e, exclude_project_id)
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))


@router.post("/{unit_id}/suggest-maintenance-dates")
async def suggest_dates(
    unit_id: str,
    payload: Dict[str, Any],
):
    try:
        start_after = svc._parse_date(payload.get("startAfter"))
        window = int(payload.get("searchWindowDays", 60))
        max_s = int(payload.get("maxSuggestions", 3))
        if start_after is None:
            raise ValueError("'startAfter' es obligatorio.")
        return await svc.suggest_maintenance_dates(_prisma(), unit_id, start_after, window, max_s)
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
