"""
IMPL-20260708-FINAL — Fase 4 NOVA absorción (I Cutover y deprecación).

Endpoint REST para reportar el estado del cutover.

  GET /api/v1/lab/cutover-status → estado de las 9 fases del roadmap NOVA→AMI

Devuelve:
  {
    "ready": bool,
    "slices": {
      "A": "closed",
      "B-v2": "closed",
      "C": "closed",
      "D": "closed",
      "E": "closed",
      "F": "closed",
      "G": "closed",
      "H": "partial",
      "I": "in_progress"
    },
    "completed": ["A", "B-v2", "C", "D", "E", "F", "G"],
    "pending": ["H", "I"],
    "nova_deprecated": false,
    "next_actions": [...]
  }

NOTA: El estado se calcula en base a constantes conocidas. En una versión
futura podría leerse de un `CutoverStatus` Prisma model para tracking
dinámico desde el dashboard admin. Hoy es declarativo y validado en cada
release mergeada (Fases 1, 2 y 3 cerradas; Fase 4 en curso).
"""
from __future__ import annotations

from typing import Any, Dict, List

from fastapi import APIRouter

router = APIRouter(prefix="/api/v1/lab", tags=["lab-cutover"])


# ---------------------------------------------------------------------------
# Estado declarativo de las 9 fases del roadmap NOVA→AMI
# ---------------------------------------------------------------------------
# Refleja el SPEC_IMPL-20260707-SLICES-D-G-FINAL.md y los merges previos.
# - Slice A: catalogos base → Fases 1 Slice A mergeada
# - Slice B-v2: bandeja papeletas → Fase 1 B-v2 mergeada
# - Slice C: resultados → Fase 1 C mergeada
# - Slice D: trazabilidad → Fase 2 mergeada
# - Slice E: catalogos avanzados + seed → Fase 1 E mergeada
# - Slice F: PDF imprimibles → Fase 3 mergeada
# - Slice G: caja y cortesías → Fase 3 mergeada
# - Slice H: migración NOVA → Fase 4 H (este slice) — partial
# - Slice I: cutover + deprecación → Fase 4 I (este slice) — in_progress
SLICES_STATUS: Dict[str, str] = {
    "A": "closed",
    "B-v2": "closed",
    "C": "closed",
    "D": "closed",
    "E": "closed",
    "F": "closed",
    "G": "closed",
    "H": "partial",
    "I": "in_progress",
}


def _build_response() -> Dict[str, Any]:
    completed = [k for k, v in SLICES_STATUS.items() if v == "closed"]
    pending = [k for k, v in SLICES_STATUS.items() if v != "closed"]
    all_done = all(v == "closed" for v in SLICES_STATUS.values())

    next_actions: List[str] = []
    if "H" in pending:
        next_actions.append(
            "Slice H: Frank debe compartir dump NOVA (.sql o .csv) para "
            "migrar órdenes operativas del último mes."
        )
    if "I" in pending:
        next_actions.append(
            "Slice I: Comunicar a Lolis/Leticia/Dra. Erika la fecha de "
            "cutover y archivar snapshot final de NOVA."
        )

    return {
        "ready": all_done,
        "slices": dict(SLICES_STATUS),
        "completed": completed,
        "pending": pending,
        "nova_deprecated": all_done,
        "next_actions": next_actions,
    }


# ---------------------------------------------------------------------------
# GET /api/v1/lab/cutover-status
# ---------------------------------------------------------------------------
@router.get("/cutover-status")
async def get_cutover_status() -> Dict[str, Any]:
    """
    Devuelve el estado actual del cutover NOVA → AMI.

    Sin auth (read-only, no expone datos sensibles). Útil para:
      - UI /admin/lab/cutover (render checklist)
      - Banner "NOVA deprecado" (ocultar cuando ready=true)
      - Monitoring externo (curl, dashboard)
    """
    return _build_response()