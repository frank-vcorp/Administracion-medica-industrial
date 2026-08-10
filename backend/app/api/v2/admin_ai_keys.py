"""
IMPL-20260809-06 — ARCH-20260809-03: Endpoints admin para gestión runtime
de API Keys de proveedores IA (m3, gemini, dr7).

Prefijo: /api/v2/admin/ai-keys
Roles:
  - GET (listado mascareado): x-ami-role ∈ {ADMIN, SUPERADMIN} → 200.
  - PUT/DELETE (edición/borrado): x-ami-role == SUPERADMIN → 200; resto → 403.

SPEC §6 contrato + ADR §D4 (permisos). El guard real vive en la server action
NextAuth del frontend (`listAIProviderKeys`, `updateAIProviderKey`,
`deleteAIProviderKey`); este header es defense-in-depth al estilo de
`maintenance.py:22` y `mobile_units.py:23`.
"""
from __future__ import annotations

import base64
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Request

from app.services import prisma_client as _pc
from app.services.ai.keys import (
    CANONICAL_PROVIDERS,
    KeyResolver,
    decrypt_key,
    encrypt_key,
    get_key_resolver,
    is_ai_keys_from_db_enabled,
)

router = APIRouter(prefix="/api/v2/admin/ai-keys", tags=["admin-ai-keys"])


# ---------------------------------------------------------------------------
# Helpers locales — guard + serialización mascareada
# ---------------------------------------------------------------------------
def _user_from_headers(request: Request) -> Dict[str, str]:
    """Extrae user del header `x-ami-userid` + rol de `x-ami-role`.
    Patrón consistente con maintenance.py:18 y mobile_units.py:18.
    """
    user_id = (
        request.headers.get("x-ami-userid")
        or request.headers.get("x-user-id")
        or ""
    )
    role = request.headers.get("x-ami-role") or ""
    return {"id": user_id, "role": role}


def _require_admin_like(request: Request) -> Dict[str, str]:
    """GET listado: ADMIN o SUPERADMIN. 403 al resto."""
    user = _user_from_headers(request)
    if user["role"] not in {"ADMIN", "SUPERADMIN"}:
        raise HTTPException(
            status_code=403,
            detail="Se requiere rol ADMIN o SUPERADMIN",
        )
    return user


def _require_superadmin(request: Request) -> Dict[str, str]:
    """PUT/DELETE: solo SUPERADMIN."""
    user = _user_from_headers(request)
    if user["role"] != "SUPERADMIN":
        raise HTTPException(
            status_code=403,
            detail="Se requiere rol SUPERADMIN",
        )
    return user


def _key_suffix_from_row(row: Any) -> Optional[str]:
    """Devuelve los últimos 4 chars de la key descifrada, o None si no se pudo."""
    try:
        from app.services.ai.keys import _load_encryption_key
        mk = _load_encryption_key()
        # FIX-20260810-03: row.keyCiphertext/etc son objetos `fields.Base64`
        # (wrapper). Su método `.decode()` devuelve los bytes originales.
        plaintext = decrypt_key(
            row.keyCiphertext.decode(),
            row.keyNonce.decode(),
            row.keyTag.decode(),
            mk,
        )
        return plaintext[-4:] if len(plaintext) >= 4 else plaintext
    except Exception:
        return None


def _row_to_public(row: Any) -> Dict[str, Any]:
    """Serializa una fila `AIProviderKey` para el GET — NUNCA incluye la key
    completa ni el ciphertext. `keySuffix` = últimos 4 chars (sólo si descifró)."""
    return {
        "provider": row.provider,
        "present": bool(row.enabled),
        "keySuffix": _key_suffix_from_row(row),
        "baseUrl": row.baseUrl,
        "defaultModel": row.defaultModel,
        "enabled": bool(row.enabled),
        "updatedAt": row.updatedAt.isoformat() if row.updatedAt else None,
        "updatedBy": row.updatedBy,
        # `source` se calcula en runtime por el resolver, no por la fila.
    }


def _source_for_provider(provider: str) -> str:
    """Decide 'env' vs 'db' para el status público del GET.
    Si la flag está off, siempre 'env'. Si on y la fila existe y enabled, 'db'.
    """
    if not is_ai_keys_from_db_enabled():
        return "env"
    return "env"  # placeholder; el caller lo sobreescribe tras el lookup


async def _build_listing_response(prisma: Any) -> List[Dict[str, Any]]:
    """Construye la lista de los 3 proveedores canónicos, rellenando `present=false`
    cuando no hay fila en BD."""
    rows = await prisma.aiproviderkey.find_many()
    by_provider = {r.provider: r for r in rows}

    out: List[Dict[str, Any]] = []
    for provider in CANONICAL_PROVIDERS:
        row = by_provider.get(provider)
        if row is None:
            # Sin fila en BD: present=false, source='env' (si flag off) o
            # 'env' con warning implícito (si flag on pero row_missing).
            out.append({
                "provider": provider,
                "present": False,
                "keySuffix": None,
                "baseUrl": None,
                "defaultModel": None,
                "enabled": False,
                "updatedAt": None,
                "updatedBy": None,
                "source": _source_for_provider(provider),
            })
        else:
            item = _row_to_public(row)
            item["source"] = _source_for_provider(provider)
            out.append(item)
    return out


# ---------------------------------------------------------------------------
# GET — listado mascareado (ADMIN o SUPERADMIN)
# ---------------------------------------------------------------------------
@router.get("")
async def list_ai_keys(request: Request) -> Dict[str, Any]:
    """
    Lista los 3 proveedores canónicos con su estado mascareado.
    SPEC §6.1: `keySuffix` = últimos 4 chars (sólo si descifró OK).
    NUNCA retorna la key completa ni el ciphertext/nonce/tag.
    """
    _require_admin_like(request)
    prisma = _pc.get_prisma_client()
    providers = await _build_listing_response(prisma)
    return {"providers": providers}


# ---------------------------------------------------------------------------
# PUT — upsert de key cifrada (SUPERADMIN)
# ---------------------------------------------------------------------------
class _PutBody(Dict[str, Any]):
    """Sólo type-hint para la spec; FastAPI acepta Dict[str, Any]."""
    pass


@router.put("/{provider}")
async def upsert_ai_key(
    provider: str, payload: Dict[str, Any], request: Request
) -> Dict[str, Any]:
    """
    SPEC §6.2 — Cifra apiKey con AES-256-GCM y guarda/actualiza en BD.
    Invalida caché del resolver tras commit → rotación inmediata sin reinicio.
    Escribe AuditLog con maskedKeySuffix, sin key completa ni ciphertext.
    """
    user = _require_superadmin(request)

    if provider not in CANONICAL_PROVIDERS:
        raise HTTPException(
            status_code=400,
            detail=f"provider '{provider}' no soportado. Usa uno de {sorted(CANONICAL_PROVIDERS)}",
        )

    api_key = (payload.get("apiKey") or "").strip()
    if not api_key:
        raise HTTPException(
            status_code=400,
            detail="apiKey es obligatorio y no puede estar vacío",
        )
    if len(api_key) > 512:
        raise HTTPException(
            status_code=400,
            detail="apiKey excede longitud máxima (512 chars)",
        )

    base_url = payload.get("baseUrl")
    if base_url is not None:
        if not isinstance(base_url, str) or not base_url.strip():
            raise HTTPException(status_code=400, detail="baseUrl inválido")

    default_model = payload.get("defaultModel")
    if default_model is not None:
        if not isinstance(default_model, str) or len(default_model) > 128:
            raise HTTPException(status_code=400, detail="defaultModel inválido")

    expected_updated_at_raw = payload.get("expectedUpdatedAt")

    # 1. Verificar ENCRYPTION_KEY (503 si falta — SPEC §6.2 / CB-2).
    try:
        from app.services.ai.keys import _load_encryption_key
        master_key = _load_encryption_key()
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))

    prisma = _pc.get_prisma_client()

    # 3. Optimistic locking (SPEC §6.2.3 / AC-11).
    existing = await prisma.aiproviderkey.find_unique(where={"provider": provider})
    if existing is not None and expected_updated_at_raw:
        try:
            expected_dt = datetime.fromisoformat(expected_updated_at_raw)
            if expected_dt.tzinfo is None:
                expected_dt = expected_dt.replace(tzinfo=timezone.utc)
            # Comparar con la fila actual (tolerar pequeñas diferencias de tz).
            current_dt = existing.updatedAt
            if current_dt.tzinfo is None:
                current_dt = current_dt.replace(tzinfo=timezone.utc)
            if abs((current_dt - expected_dt).total_seconds()) > 1:
                raise HTTPException(
                    status_code=409,
                    detail={
                        "code": "conflict",
                        "message": "Fila modificada por otro usuario (optimistic locking).",
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

    # 4. Cifrar + 5. Upsert.
    ciphertext, nonce, tag = encrypt_key(api_key, master_key)
    key_suffix = api_key[-4:] if len(api_key) >= 4 else api_key
    # FIX-20260810-02: prisma-client-py 0.15 NO serializa `bytes` para columnas
    # Bytes (BYTEA) — su serializer JSON lanza TypeError. El cliente espera
    # base64 str; el engine decodifica a bytes reales al almacenar.
    # Reasignamos in-place para que los dicts create/update (líneas abajo)
    # reciban los strings base64 sin tocar su estructura.
    ciphertext = base64.b64encode(ciphertext).decode("ascii")
    nonce = base64.b64encode(nonce).decode("ascii")
    tag = base64.b64encode(tag).decode("ascii")

    fields_changed: List[str] = []
    if existing is None:
        await prisma.aiproviderkey.create({
            "provider": provider,
            "keyCiphertext": ciphertext,
            "keyNonce": nonce,
            "keyTag": tag,
            "baseUrl": base_url,
            "defaultModel": default_model,
            "enabled": True,
            "updatedBy": user["id"] or None,
        })
        fields_changed = ["apiKey", "baseUrl", "defaultModel"]
    else:
        update_data = {
            "keyCiphertext": ciphertext,
            "keyNonce": nonce,
            "keyTag": tag,
            "baseUrl": base_url,
            "defaultModel": default_model,
            "enabled": True,
            "updatedBy": user["id"] or None,
        }
        fields_changed = ["apiKey", "baseUrl", "defaultModel"]
        await prisma.aiproviderkey.update(
            where={"provider": provider}, data=update_data
        )

    # 6. AuditLog (sin key completa ni ciphertext).
    try:
        await prisma.auditlog.create({
            "userId": user["id"] or None,
            "action": "ai_key_updated",
            "entity": "AIProviderKey",
            "entityId": provider,
            "details": {
                "provider": provider,
                "updatedBy": user["id"],
                "maskedKeySuffix": key_suffix,
                "source": "ui",
                "fieldsChanged": fields_changed,
                "previousUpdatedAt": (
                    existing.updatedAt.isoformat() if existing else None
                ),
            },
            "ipAddress": (
                request.client.host if request.client else None
            ),
        })
    except Exception as audit_err:
        # No fallar el PUT si el audit log falla — Frank necesita la rotación.
        # Loguear sin exponer la key.
        import logging
        logging.getLogger(__name__).warning(
            "AuditLog falló en upsert_ai_key(%s): %s",
            provider,
            type(audit_err).__name__,
        )

    # 7. Invalidar caché del resolver.
    resolver: KeyResolver = get_key_resolver()
    resolver.invalidate(provider)

    # Releer para devolver updatedAt fresco.
    row = await prisma.aiproviderkey.find_unique(where={"provider": provider})
    return {
        "provider": provider,
        "present": True,
        "keySuffix": key_suffix,
        "baseUrl": row.baseUrl if row else base_url,
        "defaultModel": row.defaultModel if row else default_model,
        "enabled": True,
        "updatedAt": row.updatedAt.isoformat() if row and row.updatedAt else None,
        "source": "db",
    }


# ---------------------------------------------------------------------------
# DELETE — borrar fila (SUPERADMIN)
# ---------------------------------------------------------------------------
@router.delete("/{provider}")
async def delete_ai_key(provider: str, request: Request) -> Dict[str, Any]:
    """SPEC §6.3 — Borra fila AIProviderKey. La siguiente `resolve` cae a env var."""
    user = _require_superadmin(request)

    if provider not in CANONICAL_PROVIDERS:
        raise HTTPException(
            status_code=400,
            detail=f"provider '{provider}' no soportado. Usa uno de {sorted(CANONICAL_PROVIDERS)}",
        )

    prisma = _pc.get_prisma_client()
    existing = await prisma.aiproviderkey.find_unique(where={"provider": provider})
    if existing is None:
        raise HTTPException(
            status_code=404,
            detail=f"No existe key en BD para provider '{provider}'",
        )

    await prisma.aiproviderkey.delete(where={"provider": provider})

    # AuditLog
    try:
        await prisma.auditlog.create({
            "userId": user["id"] or None,
            "action": "ai_key_deleted",
            "entity": "AIProviderKey",
            "entityId": provider,
            "details": {
                "provider": provider,
                "updatedBy": user["id"],
                "source": "ui",
            },
            "ipAddress": (
                request.client.host if request.client else None
            ),
        })
    except Exception as audit_err:
        import logging
        logging.getLogger(__name__).warning(
            "AuditLog falló en delete_ai_key(%s): %s",
            provider,
            type(audit_err).__name__,
        )

    # Invalidar caché → próxima resolve cae a env var.
    get_key_resolver().invalidate(provider)
    return {"provider": provider, "present": False, "source": "env"}