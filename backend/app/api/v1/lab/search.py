"""
IMPL-20260701-03: Slice B NOVA absorción (ARCH-20260701-03) — admisión LabOrder.
API REST para autocomplete de admisión: workers, doctors, companies, tests.

Endpoint base: /api/v1/lab/search
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from app.services import lab_order_service as svc

router = APIRouter(prefix="/api/v1/lab/search", tags=["lab-search"])


# ---------------------------------------------------------------------------
# GET /search/workers?q=...
# ---------------------------------------------------------------------------
@router.get("/workers")
def search_workers(q: str = Query("", max_length=120), limit: int = Query(10, ge=1, le=25)):
    try:
        return svc.search_workers(prisma=svc.get_prisma(), q=q, limit=limit)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# GET /search/doctors?q=...
# ---------------------------------------------------------------------------
@router.get("/doctors")
def search_doctors(q: str = Query("", max_length=120)):
    return svc.search_doctors(q=q)


# ---------------------------------------------------------------------------
# GET /search/companies?q=...
# ---------------------------------------------------------------------------
@router.get("/companies")
def search_companies(q: str = Query("", max_length=120), limit: int = Query(10, ge=1, le=25)):
    try:
        return svc.search_companies(prisma=svc.get_prisma(), q=q, limit=limit)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# GET /search/tests?q=...
# ---------------------------------------------------------------------------
@router.get("/tests")
def search_tests(q: str = Query("", max_length=120), limit: int = Query(10, ge=1, le=25)):
    try:
        return svc.search_tests(prisma=svc.get_prisma(), q=q, limit=limit)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
