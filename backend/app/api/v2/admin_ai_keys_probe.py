"""
IMPL-20260809-09 — ARCH-20260809-05: Endpoint de "Probar conexión" para
proveedores IA. Solo SUPERADMIN.

Prefijo: /api/v2/admin/ai-keys/{provider}/probe
"""
from __future__ import annotations

from typing import Any, Dict

from fastapi import APIRouter, HTTPException, Request

from app.services.ai.probe import (
    ERROR_KIND_RATE_LIMITED,
    probe_provider,
)


router = APIRouter(prefix="/api/v2/admin/ai-keys", tags=["admin-ai-keys-probe"])


def _require_superadmin(request: Request) -> Dict[str, str]:
    """Solo SUPERADMIN puede probar conexión."""
    user_id = (
        request.headers.get("x-ami-userid")
        or request.headers.get("x-user-id")
        or ""
    )
    role = request.headers.get("x-ami-role") or ""
    if role != "SUPERADMIN":
        raise HTTPException(
            status_code=403,
            detail="Se requiere rol SUPERADMIN",
        )
    return {"id": user_id, "role": role}


@router.post("/{provider}/probe")
async def probe_ai_key(provider: str, request: Request) -> Dict[str, Any]:
    """
    Ejecuta un probe real al endpoint del proveedor con prompt trivial.
    Rate limit interno: 1/30s por proveedor (429 con retryAfterSec).
    """
    _require_superadmin(request)

    if provider not in ("gemini", "m3", "dr7"):
        raise HTTPException(
            status_code=400,
            detail=f"provider '{provider}' no soportado",
        )

    result = await probe_provider(provider)

    # Mapear rate limit interno a HTTP 429 (no es un ProbeResponse normal).
    if result.get("rateLimited"):
        raise HTTPException(
            status_code=429,
            detail={
                "code": ERROR_KIND_RATE_LIMITED,
                "message": result.get("message", "rate_limited"),
                "retryAfterSec": result.get("retryAfterSec", 30),
            },
        )

    # Mapear not_configured a HTTP 503 (mismatches con admin_ai_keys semántica).
    if result.get("errorKind") == "not_configured":
        raise HTTPException(
            status_code=503,
            detail={
                "code": "not_configured",
                "message": result.get("message", "not_configured"),
            },
        )

    # Cualquier otro caso (ok=True, ok=False con HTTP del proveedor) → 200.
    return result
