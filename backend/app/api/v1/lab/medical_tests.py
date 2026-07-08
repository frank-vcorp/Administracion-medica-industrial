"""
IMPL-20260707-17: Fase 1 NOVA absorción (ARCH-20260707-17) — E.

CRUD + listado de catálogo avanzado de estudios de laboratorio:
MedicalTest (filtrados por categoría Laboratorio) + LabAnalyte + LabReferenceRange.

Endpoints:
  GET    /api/v1/medical_tests/lab-catalog
  GET    /api/v1/medical_tests/lab-catalog/{testId}
  POST   /api/v1/lab/analytes
  PATCH  /api/v1/lab/analytes/{id}
  DELETE /api/v1/lab/analytes/{id}
  POST   /api/v1/lab/reference-ranges
  PATCH  /api/v1/lab/reference-ranges/{id}
  DELETE /api/v1/lab/reference-ranges/{id}
  POST   /api/v1/lab/seed-typical-tests
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query, Request

from app.schemas.pending_orders import (
    LAB_CATEGORY_ID,
    LabAnalyteCreate,
    LabAnalyteUpdate,
    LabCatalogResponse,
    LabCatalogTest,
    LabCatalogAnalyte,
    LabCatalogReferenceRange,
    LabReferenceRangeCreate,
    LabReferenceRangeUpdate,
    SeedResult,
)
from app.services import study_service as svc

router = APIRouter(tags=["lab-medical-tests"])


def _extract_user(request: Request) -> dict:
    user_id = request.headers.get("x-ami-userid") or request.headers.get("x-user-id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Falta X-AMI-UserId")
    return {"id": user_id, "role": "ADMIN"}


def _get_prisma():
    try:
        from app.services.lab_order_service import get_prisma as get_orders_prisma
        return get_orders_prisma()
    except Exception:
        raise HTTPException(status_code=503, detail="Prisma client no disponible")


# ---------------------------------------------------------------------------
# GET /medical_tests/lab-catalog
# ---------------------------------------------------------------------------
@router.get("/api/v1/medical_tests/lab-catalog")
async def list_lab_catalog(
    search: Optional[str] = Query(None),
    categoryId: Optional[str] = Query(None, alias="categoryId"),
):
    prisma = _get_prisma()
    try:
        result = await svc.list_lab_catalog(
            prisma=prisma,
            search=search,
            category_id=categoryId or LAB_CATEGORY_ID,
        )
        return LabCatalogResponse(
            categoryId=categoryId or LAB_CATEGORY_ID,
            total=result["total"],
            rows=result["rows"],
        )
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"{type(e).__name__}: {e}")


@router.get("/api/v1/medical_tests/lab-catalog/{test_id}")
async def get_lab_catalog_test(test_id: str):
    prisma = _get_prisma()
    try:
        result = await svc.get_lab_catalog_test(test_id=test_id, prisma=prisma)
        if result is None:
            raise HTTPException(status_code=404, detail=f"MedicalTest {test_id} no existe")
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# LabAnalyte CRUD
# ---------------------------------------------------------------------------
@router.post("/api/v1/lab/analytes")
async def create_analyte(payload: LabAnalyteCreate, request: Request):
    user = _extract_user(request)
    prisma = _get_prisma()
    try:
        return await svc.create_analyte(
            data=payload.model_dump(exclude_none=True),
            current_user=user,
            prisma=prisma,
        )
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("/api/v1/lab/analytes/{analyte_id}")
async def update_analyte(analyte_id: str, payload: LabAnalyteUpdate, request: Request):
    user = _extract_user(request)
    prisma = _get_prisma()
    try:
        return await svc.update_analyte(
            analyte_id=analyte_id,
            data=payload.model_dump(exclude_none=True),
            current_user=user,
            prisma=prisma,
        )
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/api/v1/lab/analytes/{analyte_id}")
async def delete_analyte(analyte_id: str, request: Request):
    user = _extract_user(request)
    prisma = _get_prisma()
    try:
        return await svc.delete_analyte(
            analyte_id=analyte_id,
            current_user=user,
            prisma=prisma,
        )
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))


# ---------------------------------------------------------------------------
# LabReferenceRange CRUD
# ---------------------------------------------------------------------------
@router.post("/api/v1/lab/reference-ranges")
async def create_reference_range(payload: LabReferenceRangeCreate, request: Request):
    user = _extract_user(request)
    prisma = _get_prisma()
    try:
        return await svc.create_reference_range(
            data=payload.model_dump(exclude_none=True),
            current_user=user,
            prisma=prisma,
        )
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("/api/v1/lab/reference-ranges/{range_id}")
async def update_reference_range(range_id: str, payload: LabReferenceRangeUpdate, request: Request):
    user = _extract_user(request)
    prisma = _get_prisma()
    try:
        return await svc.update_reference_range(
            range_id=range_id,
            data=payload.model_dump(exclude_none=True),
            current_user=user,
            prisma=prisma,
        )
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/api/v1/lab/reference-ranges/{range_id}")
async def delete_reference_range(range_id: str, request: Request):
    user = _extract_user(request)
    prisma = _get_prisma()
    try:
        return await svc.delete_reference_range(
            range_id=range_id,
            current_user=user,
            prisma=prisma,
        )
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))


# ---------------------------------------------------------------------------
# Seed endpoint
# ---------------------------------------------------------------------------
@router.post("/api/v1/lab/seed-typical-tests")
async def seed_typical_tests(request: Request):
    user = _extract_user(request)
    prisma = _get_prisma()
    try:
        result = await svc.seed_typical_tests(
            current_user=user,
            prisma=prisma,
            category_id=LAB_CATEGORY_ID,
        )
        return SeedResult(**result)
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"{type(e).__name__}: {e}")