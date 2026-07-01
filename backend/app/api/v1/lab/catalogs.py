"""
IMPL-20260630-06: Slice A NOVA absorción (ARCH-20260630-02).
API REST para los 8 mods de catálogos LIS.

Endpoint único parametrizado por `?mod=<X>`:
  GET    /api/v1/lab/catalogs?mod=<X>&draw&start&length&search[value]&order[0][column]&order[0][dir]
  POST   /api/v1/lab/catalogs?mod=<X>     (body: JSON con los campos del mod)
  GET    /api/v1/lab/catalogs/{mod}/{id}
  PATCH  /api/v1/lab/catalogs/{mod}/{id}  (body: JSON parcial)
  DELETE /api/v1/lab/catalogs/{mod}/{id}  (soft delete: active=false)

Soporta los 8 mods: unidades, muestras, recipientes, metodologias,
lugares_proceso, clasificaciones, indicaciones, departamentos.
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException, Query, Request

from app.schemas.lab_catalogs import (
    LabCatalogMod,
    LabClassificationCreate,
    LabClassificationUpdate,
    LabContainerCreate,
    LabContainerUpdate,
    LabDepartmentCreate,
    LabDepartmentUpdate,
    LabIndicationCreate,
    LabIndicationUpdate,
    LabMethodCreate,
    LabMethodUpdate,
    LabProcessAreaCreate,
    LabProcessAreaUpdate,
    LabSampleCreate,
    LabSampleUpdate,
    LabUnitCreate,
    LabUnitUpdate,
)
from app.services import lab_catalog_service as svc

router = APIRouter(prefix="/api/v1/lab", tags=["lab-catalogs"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
CREATE_SCHEMAS = {
    LabCatalogMod.UNIDADES: LabUnitCreate,
    LabCatalogMod.MUESTRAS: LabSampleCreate,
    LabCatalogMod.RECIPIENTES: LabContainerCreate,
    LabCatalogMod.METODOLOGIAS: LabMethodCreate,
    LabCatalogMod.LUGARES_PROCESO: LabProcessAreaCreate,
    LabCatalogMod.CLASIFICACIONES: LabClassificationCreate,
    LabCatalogMod.INDICACIONES: LabIndicationCreate,
    LabCatalogMod.DEPARTAMENTOS: LabDepartmentCreate,
}

UPDATE_SCHEMAS = {
    LabCatalogMod.UNIDADES: LabUnitUpdate,
    LabCatalogMod.MUESTRAS: LabSampleUpdate,
    LabCatalogMod.RECIPIENTES: LabContainerUpdate,
    LabCatalogMod.METODOLOGIAS: LabMethodUpdate,
    LabCatalogMod.LUGARES_PROCESO: LabProcessAreaUpdate,
    LabCatalogMod.CLASIFICACIONES: LabClassificationUpdate,
    LabCatalogMod.INDICACIONES: LabIndicationUpdate,
    LabCatalogMod.DEPARTAMENTOS: LabDepartmentUpdate,
}


def _extract_user_id(request: Request) -> Optional[str]:
    """Permite extraer un userId para audit log sin acoplar a la auth AMI.
    Próximos slices integrarán el JWT AMI (LAB_ADMIN / ADMIN)."""
    return request.headers.get("x-ami-userid") or request.headers.get("x-user-id")


def _require_mod(mod_raw: str) -> LabCatalogMod:
    return LabCatalogMod.parse(mod_raw)


# ---------------------------------------------------------------------------
# GET (listar, paginado server-side DataTables-compatible)
# ---------------------------------------------------------------------------
@router.get("/catalogs")
def list_catalogs(
    mod: str = Query(..., description="Mod del catálogo: unidades | muestras | ..."),
    draw: int = Query(1, ge=0),
    start: int = Query(0, ge=0),
    length: int = Query(25, ge=1, le=100),
    onlyActive: bool = Query(False),
    # DataTables params
    search_value: Optional[str] = Query(None, alias="search[value]"),
    order_0_column: int = Query(0, alias="order[0][column]"),
    order_0_dir: str = Query("asc", alias="order[0][dir]"),
):
    mod_enum = _require_mod(mod)
    try:
        return svc.list_catalog(
            mod=mod_enum.value,
            draw=draw,
            start=start,
            length=length,
            search=search_value,
            order_column=order_0_column,
            order_dir=order_0_dir,
            only_active=onlyActive,
        )
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))


# ---------------------------------------------------------------------------
# POST (crear)
# ---------------------------------------------------------------------------
@router.post("/catalogs")
def create_catalog_item(mod: str = Query(...), payload: dict = ..., request: Request = None):
    mod_enum = _require_mod(mod)
    schema = CREATE_SCHEMAS[mod_enum]
    try:
        validated = schema(**payload)
    except Exception as e:
        raise HTTPException(status_code=422, detail=str(e))
    try:
        item = svc.create_catalog_item(
            mod_enum.value,
            validated.model_dump(),
            user_id=_extract_user_id(request) if request else None,
        )
    except LookupError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except Exception as e:
        # Unique constraint, etc.
        raise HTTPException(status_code=400, detail=str(e))
    return {"id": item.get("id"), "ok": True, "item": item}


# ---------------------------------------------------------------------------
# GET / PATCH / DELETE /{mod}/{id}
# ---------------------------------------------------------------------------
@router.get("/catalogs/{mod}/{item_id}")
def get_catalog_item(mod: str, item_id: str):
    mod_enum = _require_mod(mod)
    item = svc.get_catalog_item(mod_enum.value, item_id)
    if item is None:
        raise HTTPException(status_code=404, detail=f"{mod_enum.value}/{item_id} no existe")
    return item


@router.patch("/catalogs/{mod}/{item_id}")
def update_catalog_item(mod: str, item_id: str, payload: dict, request: Request):
    mod_enum = _require_mod(mod)
    schema = UPDATE_SCHEMAS[mod_enum]
    try:
        validated = schema(**payload)
    except Exception as e:
        raise HTTPException(status_code=422, detail=str(e))
    try:
        item = svc.update_catalog_item(
            mod_enum.value,
            item_id,
            validated.model_dump(exclude_none=True),
            user_id=_extract_user_id(request),
        )
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"ok": True, "item": item}


@router.delete("/catalogs/{mod}/{item_id}")
def delete_catalog_item(mod: str, item_id: str, request: Request):
    mod_enum = _require_mod(mod)
    try:
        item = svc.delete_catalog_item(
            mod_enum.value, item_id, user_id=_extract_user_id(request)
        )
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return {"ok": True, "item": item}