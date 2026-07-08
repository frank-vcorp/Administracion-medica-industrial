"""
IMPL-20260707-18: Fase 2 NOVA absorción (ARCH-20260707-17) — D Trazabilidad.

Schemas Pydantic para el timeline de LabTraceEvent.

  - GET  /api/v1/lab/orders/{id}/trace  → LabTraceTimelineResponse
  - POST /api/v1/lab/orders/{id}/trace  → body: RecordTraceEventRequest → LabTraceEventRow
"""
from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Eventos válidos del ciclo de vida
# ---------------------------------------------------------------------------
class LabTraceEventType(str, Enum):
    SAMPLE_RECEIVED = "SAMPLE_RECEIVED"   # muestra físicamente recibida en el lab
    PROCESS_STARTED = "PROCESS_STARTED"   # inicia procesamiento analítico
    ANALYSIS_DONE = "ANALYSIS_DONE"       # terminó el análisis (equipo/procedimiento)
    VALIDATED = "VALIDATED"               # resultados validados por responsable
    DELIVERED = "DELIVERED"               # resultado entregado al médico/paciente


# ---------------------------------------------------------------------------
# Requests
# ---------------------------------------------------------------------------
class RecordTraceEventRequest(BaseModel):
    """Body para POST /lab/orders/{id}/trace."""
    event: LabTraceEventType = Field(..., description="Tipo de evento del ciclo de vida")
    notes: Optional[str] = Field(None, max_length=1000)
    location: Optional[str] = Field(None, max_length=200, description="Lugar físico del proceso (ej. 'Hematología', 'Mostrador 2')")


# ---------------------------------------------------------------------------
# Responses
# ---------------------------------------------------------------------------
class LabTraceEventRow(BaseModel):
    """Fila del timeline de trazabilidad."""
    id: str
    labOrderId: str
    event: str
    timestamp: datetime
    userId: Optional[str] = None
    userFullName: Optional[str] = None
    notes: Optional[str] = None
    location: Optional[str] = None


class LabTraceTimelineResponse(BaseModel):
    labOrderId: str
    total: int
    rows: List[LabTraceEventRow]
