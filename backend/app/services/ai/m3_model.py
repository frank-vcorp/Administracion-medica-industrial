"""
Modelo MiniMax de extracción y prediagnóstico.

El modelo que ya lee los estudios (audiometría incluida) es el que está
guardado en /admin/ai-keys. Hoy esa fila dice MiniMax-M3. No se sustituye
por otro id: cambiarlo a MiniMax-M3.1-Flash con poco razonamiento dejó la
extracción incompleta.

Si no hay modelo configurado, el default vuelve a ser MiniMax-M3.
MiniMax-M3.1-Flash solo se usa cuando alguien lo elige de forma explícita.
"""

from __future__ import annotations

import os
from typing import Any, Dict, Optional

M3_MODEL_FLASH = "MiniMax-M3.1-Flash"
M3_MODEL_LEGACY = "MiniMax-M3"
M3_FLASH_REASONING_EFFORT = "low"


def resolve_m3_model(configured: Optional[str] = None) -> str:
    """Respeta el id configurado. Vacío → env → MiniMax-M3."""
    raw = (configured or "").strip()
    if raw:
        return raw
    env_model = (os.environ.get("M3_DEFAULT_MODEL") or "").strip()
    return env_model or M3_MODEL_LEGACY


def m3_performance_body(model: Optional[str]) -> Dict[str, Any]:
    """Flash, si se eligió a mano, no razona en nivel max."""
    if (model or "").strip() == M3_MODEL_FLASH:
        return {"reasoning_effort": M3_FLASH_REASONING_EFFORT}
    return {}
