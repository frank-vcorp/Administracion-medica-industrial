"""
IMPL-20260708-19: Fase 3 NOVA absorción (ARCH-20260707-17) — F Reportes PDF.

Schemas Pydantic auxiliares para los endpoints de PDF imprimibles:
  - GET /api/v1/lab/reports/etiquetas/{orderId}
  - GET /api/v1/lab/reports/resultados/{orderId}
  - GET /api/v1/lab/reports/recibos/{orderId}

Estos endpoints retornan `application/pdf` (no JSON), por lo que estos
schemas son solo para validación interna / errores tipados. La salida
principal es Response(media_type="application/pdf").
"""
from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


class ReportErrorResponse(BaseModel):
    """Respuesta de error para los endpoints de PDF."""
    error: str = Field(..., description="Mensaje de error legible")
    orderId: Optional[str] = Field(None, description="ID de la LabOrder solicitada")