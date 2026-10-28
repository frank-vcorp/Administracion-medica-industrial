"""
Resolución canónica del modelo MiniMax para extracción y prediagnóstico.

`MiniMax-M3.1-Flash` es el modelo activo. En BD existen calibraciones con
grafías como `"Minimax-M3"` (m minúscula) o `"MiniMax-M3"`: todas esas
variantes se promueven de forma case-insensitive a `MiniMax-M3.1-Flash`
con `reasoning_effort="low"` (el nivel más rápido de la API).
"""

from __future__ import annotations

import os
from typing import Any, Dict, Optional

M3_MODEL_FLASH = "MiniMax-M3.1-Flash"
M3_MODEL_LEGACY = "MiniMax-M3"
M3_FLASH_REASONING_EFFORT = "low"

_FLASH_PROMOTED_LOWER = frozenset({
    "",
    "m3",
    "minimax",
    "minimax-m3",
    "minimax-m3.1-flash",
    "minimax-m3-flash",
})


def resolve_m3_model(configured: Optional[str] = None) -> str:
    """Normaliza variantes de MiniMax-M3 / Flash (case-insensitive) a `MiniMax-M3.1-Flash`."""
    raw = (configured or "").strip()
    if not raw:
        raw = (os.environ.get("M3_DEFAULT_MODEL") or "").strip()
    if raw.lower() in _FLASH_PROMOTED_LOWER:
        return M3_MODEL_FLASH
    return raw


def m3_performance_body(model: Optional[str]) -> Dict[str, Any]:
    if resolve_m3_model(model) == M3_MODEL_FLASH and (model or "").strip().lower() in _FLASH_PROMOTED_LOWER:
        return {"reasoning_effort": M3_FLASH_REASONING_EFFORT}
    return {}
