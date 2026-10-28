"""
Modelo MiniMax usado por extracción y prediagnóstico.

MiniMax-M3.1-Flash (19 oct 2026) es el modelo vigente del plan: en la
comparación pública es más capaz que MiniMax-M3, igual o más rápido, y
más barato. Acepta imagen, igual que M3.

Si no se pide `reasoning_effort`, Flash piensa en nivel `max` y la
respuesta se alarga hasta el corte de 300 s de Vercel. Para este flujo
(JSON clínico y extracción de un estudio) el esfuerzo queda en `low`.
No se envía `thinking.type=disabled`: Flash responde 400.
"""

from __future__ import annotations

import os
from typing import Any, Dict, Optional

M3_MODEL_FLASH = "MiniMax-M3.1-Flash"
M3_MODEL_LEGACY = "MiniMax-M3"
M3_FLASH_REASONING_EFFORT = "low"


def resolve_m3_model(configured: Optional[str] = None) -> str:
    """
    Modelo efectivo.

    Vacío o el id viejo `MiniMax-M3` (la única opción que había en admin)
    pasan a Flash. Cualquier otro id explícito se respeta.
    `M3_DEFAULT_MODEL` solo gana si trae un id distinto del legado.
    """
    env_model = (os.environ.get("M3_DEFAULT_MODEL") or "").strip()
    raw = (configured or "").strip() or env_model
    if not raw or raw == M3_MODEL_LEGACY:
        return M3_MODEL_FLASH
    return raw


def m3_performance_body(model: Optional[str]) -> Dict[str, Any]:
    """Campos extra del chat. Solo Flash: esfuerzo de razonamiento bajo."""
    if (model or "").strip() == M3_MODEL_FLASH:
        return {"reasoning_effort": M3_FLASH_REASONING_EFFORT}
    return {}
