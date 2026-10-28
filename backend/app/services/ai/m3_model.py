"""
Prueba MiniMax-M3.1-Flash en extracción y prediagnóstico.

El id guardado MiniMax-M3 se trata como Flash para esta medición.
El razonamiento va en `low`, el nivel más rápido de la API.
Otro id explícito, distinto de M3, se respeta.
"""

from __future__ import annotations

import os
from typing import Any, Dict, Optional

M3_MODEL_FLASH = "MiniMax-M3.1-Flash"
M3_MODEL_LEGACY = "MiniMax-M3"
M3_FLASH_REASONING_EFFORT = "low"


def resolve_m3_model(configured: Optional[str] = None) -> str:
    """MiniMax-M3 y vacío pasan a Flash. Cualquier otro id se queda."""
    raw = (configured or "").strip()
    if not raw:
        raw = (os.environ.get("M3_DEFAULT_MODEL") or "").strip()
    if not raw or raw == M3_MODEL_LEGACY:
        return M3_MODEL_FLASH
    return raw


def m3_performance_body(model: Optional[str]) -> Dict[str, Any]:
    if (model or "").strip() == M3_MODEL_FLASH:
        return {"reasoning_effort": M3_FLASH_REASONING_EFFORT}
    return {}
