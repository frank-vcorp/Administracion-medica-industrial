"""
IMPL-20260809-09 — ARCH-20260809-05: Endpoints admin para configuración
runtime vía AppConfig (selector de proveedor de extracción predeterminado).

Prefijo: /api/v2/admin/app-config
Roles:
  - GET: ADMIN o SUPERADMIN → 200.
  - PUT: SUPERADMIN → 200; resto → 403.

El `x-ami-role`/`x-ami-userid` sigue el patrón defense-in-depth de
admin_ai_keys.py y maintenance.py:22.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException, Request

from app.services import prisma_client as _pc
from app.services.ai.app_config import (
    EXTRACTION_DEFAULT_PROVIDER_FALLBACK,
    EXTRACTION_DEFAULT_PROVIDER_KEY,
    EXTRACTION_DEFAULT_PROVIDER_VALID,
    get_app_config_store,
    get_extraction_default_provider,
)


router = APIRouter(prefix="/api/v2/admin/app-config", tags=["admin-app-config"])


# ---------------------------------------------------------------------------
# Helpers locales — guard + serialización
# ---------------------------------------------------------------------------
def _user_from_headers(request: Request) -> Dict[str, str]:
    user_id = (
        request.headers.get("x-ami-userid")
        or request.headers.get("x-user-id")
        or ""
    )
    role = request.headers.get("x-ami-role") or ""
    return {"id": user_id, "role": role}


def _require_admin_like(request: Request) -> Dict[str, str]:
    """GET: ADMIN o SUPERADMIN. 403 al resto."""
    user = _user_from_headers(request)
    if user["role"] not in {"ADMIN", "SUPERADMIN"}:
        raise HTTPException(
            status_code=403,
            detail="Se requiere rol ADMIN o SUPERADMIN",
        )
    return user


def _require_superadmin(request: Request) -> Dict[str, str]:
    """PUT: solo SUPERADMIN."""
    user = _user_from_headers(request)
    if user["role"] != "SUPERADMIN":
        raise HTTPException(
            status_code=403,
            detail="Se requiere rol SUPERADMIN",
        )
    return user


# ---------------------------------------------------------------------------
# GET /api/v2/admin/app-config/extraction-default-provider
# ---------------------------------------------------------------------------
@router.get("/extraction-default-provider")
async def get_extraction_default(request: Request) -> Dict[str, Any]:
    """
    Lee el proveedor de extracción predeterminado persistido en AppConfig.
    Si no hay row / valor inválido / BD caída → fallback "gemini" con source="default".
    """
    _require_admin_like(request)
    provider, source = await get_extraction_default_provider()

    # Para devolver updatedAt, leer la fila directamente.
    updated_at: Optional[str] = None
    try:
        prisma = _pc.get_prisma_client()
        row = await prisma.appconfig.find_unique(
            where={"key": EXTRACTION_DEFAULT_PROVIDER_KEY}
        )
        if row is not None and row.updatedAt is not None:
            dt = row.updatedAt
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            updated_at = dt.isoformat()
    except Exception:
        # BD caída / tabla ausente → no es error; retornamos source="default".
        pass

    return {
        "provider": provider,
        "source": source,
        "updatedAt": updated_at,
    }


# ---------------------------------------------------------------------------
# PUT /api/v2/admin/app-config/extraction-default-provider
# ---------------------------------------------------------------------------
@router.put("/extraction-default-provider")
async def put_extraction_default(
    payload: Dict[str, Any], request: Request
) -> Dict[str, Any]:
    """
    Upsert del proveedor de extracción predeterminado.
    Body: { provider: "gemini" | "m3", expectedUpdatedAt: str | None }

    - dr7 rechazado (es clínico-only).
    - Optimistic locking: si expectedUpdatedAt presente y difiere → 409.
    - AuditLog: action="extraction_default_provider_updated".
    - Invalida caché del store tras commit.
    """
    user = _require_superadmin(request)

    provider = payload.get("provider")
    if not isinstance(provider, str):
        raise HTTPException(status_code=400, detail="provider es obligatorio")
    if provider not in EXTRACTION_DEFAULT_PROVIDER_VALID:
        if provider == "dr7":
            raise HTTPException(
                status_code=400,
                detail="dr7 is clinical-only",
            )
        raise HTTPException(
            status_code=400,
            detail=f"provider inválido: '{provider}'. Usa uno de {sorted(EXTRACTION_DEFAULT_PROVIDER_VALID)}",
        )

    expected_updated_at_raw = payload.get("expectedUpdatedAt")

    prisma = _pc.get_prisma_client()

    # 1. Leer fila actual (para previous + optimistic locking).
    existing = None
    try:
        existing = await prisma.appconfig.find_unique(
            where={"key": EXTRACTION_DEFAULT_PROVIDER_KEY}
        )
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail=f"app_config no accesible: {type(e).__name__}",
        )

    previous_provider: Optional[str] = None
    if existing is not None:
        raw_value = existing.value
        if isinstance(raw_value, dict):
            prev = raw_value.get("provider")
            if isinstance(prev, str) and prev in EXTRACTION_DEFAULT_PROVIDER_VALID:
                previous_provider = prev

        # Optimistic locking
        if expected_updated_at_raw:
            try:
                expected_dt = datetime.fromisoformat(expected_updated_at_raw)
                if expected_dt.tzinfo is None:
                    expected_dt = expected_dt.replace(tzinfo=timezone.utc)
                current_dt = existing.updatedAt
                if current_dt.tzinfo is None:
                    current_dt = current_dt.replace(tzinfo=timezone.utc)
                if abs((current_dt - expected_dt).total_seconds()) > 1:
                    raise HTTPException(
                        status_code=409,
                        detail={
                            "code": "conflict",
                            "message": "Config modificada por otro usuario (optimistic locking).",
                            "currentUpdatedAt": current_dt.isoformat(),
                        },
                    )
            except HTTPException:
                raise
            except Exception as e:
                raise HTTPException(
                    status_code=400,
                    detail=f"expectedUpdatedAt inválido: {e}",
                )

    # 2. Upsert.
    # FIX-20260810-04: prisma-client-py 0.15 requiere `Json` wrapper para
    # columnas `Json`/`JSONB`. Pasar dict crudo genera DataError
    # "Invalid argument type. `value` should be of any of the following types:
    # `JsonNullValueInput`, `Json`".
    from prisma._fields import Json as PrismaJson
    data = {
        "value": PrismaJson({"provider": provider}),
        "updatedBy": user["id"] or None,
    }
    if existing is None:
        await prisma.appconfig.create({
            "key": EXTRACTION_DEFAULT_PROVIDER_KEY,
            **data,
        })
    else:
        await prisma.appconfig.update(
            where={"key": EXTRACTION_DEFAULT_PROVIDER_KEY},
            data=data,
        )

    # 3. AuditLog (sin secretos — este endpoint no toca keys).
    try:
        # FIX-20260810-04: `details` es columna Json/JSONB → requiere wrapper.
        from prisma._fields import Json as PrismaJson
        await prisma.auditlog.create({
            "userId": user["id"] or None,
            "action": "extraction_default_provider_updated",
            "entity": "AppConfig",
            "entityId": EXTRACTION_DEFAULT_PROVIDER_KEY,
            "details": PrismaJson({
                "previous": previous_provider,
                "current": provider,
                "updatedBy": user["id"],
                "source": "ui",
            }),
            "ipAddress": (
                request.client.host if request.client else None
            ),
        })
    except Exception as audit_err:
        import logging
        logging.getLogger(__name__).warning(
            "AuditLog falló en put_extraction_default: %s",
            type(audit_err).__name__,
        )

    # 4. Mantener la caché caliente por construcción (ARCH-20260809-06 §7.4 — fix B†).
    # IMPL-20260810-01: tras commit, primamos la caché con el valor nuevo para que
    # la siguiente lectura síncrona (status público + extractor) retorne inmediatamente
    # sin depender del GET async que recalienta la caché. Mantenemos también `invalidate`
    # para convergencia multi-réplica vía TTL 60 s (la otra réplica no recibe el priming).
    store = get_app_config_store()
    store.invalidate(EXTRACTION_DEFAULT_PROVIDER_KEY)
    store.prime(EXTRACTION_DEFAULT_PROVIDER_KEY, {"provider": provider})

    # 5. Releer para devolver updatedAt fresco.
    row = await prisma.appconfig.find_unique(
        where={"key": EXTRACTION_DEFAULT_PROVIDER_KEY}
    )
    updated_at_str: Optional[str] = None
    if row is not None and row.updatedAt is not None:
        dt = row.updatedAt
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        updated_at_str = dt.isoformat()

    return {
        "provider": provider,
        "source": "db",
        "updatedAt": updated_at_str,
    }
