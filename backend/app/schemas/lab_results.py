"""
IMPL-20260707-16: Slice C NOVA absorción (ARCH-20260707-16) — LabResult.

Schemas Pydantic para captura de resultados + ciclo de vida P/R/A/V +
bitácora de auditoría + integración con papeleta vía EventTest.

Diseño:
  - Réplica 1:1 de SPEC §4.1 y §4.3.
  - Variantes "FromDB" para respuestas con campos computados
    (rangeValidation, auditCount, etc.).
  - Schemas auxiliares para worklist (analitos esperados por orden).
"""
from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------
class LabResultStatus(str, Enum):
    PENDING = "PENDING"
    REPORTED = "REPORTED"
    AUTHORIZED = "AUTHORIZED"
    VALIDATED = "VALIDATED"
    INVALIDATED = "INVALIDATED"


class LabResultTransitionAction(str, Enum):
    """Acciones de transición sobre el ciclo de vida."""
    REPORT = "report"
    AUTHORIZE = "authorize"
    VALIDATE = "validate"
    INVALIDATE = "invalidate"


class LabAnalyteDataType(str, Enum):
    NUMERIC = "NUMERIC"
    TEXT = "TEXT"
    ENUM = "ENUM"


class LabSex(str, Enum):
    M = "M"
    F = "F"
    A = "A"


# ---------------------------------------------------------------------------
# LabAnalyte (catálogo)
# ---------------------------------------------------------------------------
class LabAnalyteBase(BaseModel):
    medicalTestId: str
    code: str = Field(..., min_length=1, max_length=64)
    name: str = Field(..., min_length=1, max_length=120)
    orderIndex: int = Field(0, ge=0)
    dataType: LabAnalyteDataType = LabAnalyteDataType.NUMERIC
    defaultUnitId: Optional[str] = None
    active: bool = True


class LabAnalyteCreate(LabAnalyteBase):
    pass


class LabAnalyteResponse(LabAnalyteBase):
    id: str
    createdAt: datetime
    updatedAt: datetime


# ---------------------------------------------------------------------------
# LabReferenceRange
# ---------------------------------------------------------------------------
class LabReferenceRangeBase(BaseModel):
    analyteId: str
    sex: LabSex = LabSex.A
    ageMinMonths: Optional[int] = Field(None, ge=0)
    ageMaxMonths: Optional[int] = Field(None, ge=0)
    valueMin: Optional[float] = None
    valueMax: Optional[float] = None
    textValue: Optional[str] = Field(None, max_length=255)
    unitId: Optional[str] = None
    criticalLow: Optional[float] = None
    criticalHigh: Optional[float] = None
    isCritical: bool = False


class LabReferenceRangeCreate(LabReferenceRangeBase):
    pass


class LabReferenceRangeResponse(LabReferenceRangeBase):
    id: str
    createdAt: datetime
    updatedAt: datetime


# ---------------------------------------------------------------------------
# LabResult
# ---------------------------------------------------------------------------
class LabResultCreate(BaseModel):
    """Entrada para crear un resultado (POST /results)."""
    labOrderItemId: str
    analyteId: str
    eventTestId: Optional[str] = None
    valueText: Optional[str] = Field(None, max_length=500)
    valueNumber: Optional[float] = None
    unitId: Optional[str] = None
    observations: Optional[str] = Field(None, max_length=2000)
    # Flag manual del analista (no calculado)
    isAbnormal: bool = False

    def model_post_init(self, __context: Any) -> None:
        # Validación suave: debe traer al menos uno de valueText/valueNumber.
        if self.valueText is None and self.valueNumber is None:
            raise ValueError("Debe proporcionar valueText o valueNumber")


class LabResultBulkCreate(BaseModel):
    """Bulk create — usado por la página /lab/results/[orderId]."""
    items: List[LabResultCreate] = Field(..., min_length=1, max_length=200)


class LabResultUpdate(BaseModel):
    valueText: Optional[str] = Field(None, max_length=500)
    valueNumber: Optional[float] = None
    unitId: Optional[str] = None
    observations: Optional[str] = Field(None, max_length=2000)
    isAbnormal: Optional[bool] = None
    eventTestId: Optional[str] = None


class LabResultTransitionRequest(BaseModel):
    """POST /results/{id}/{action} — body opcional para invalidate/authorize."""
    reason: Optional[str] = Field(None, max_length=500)


class LabResultAuditResponse(BaseModel):
    id: str
    action: str
    fromStatus: Optional[LabResultStatus] = None
    toStatus: Optional[LabResultStatus] = None
    before: Optional[Dict[str, Any]] = None
    after: Optional[Dict[str, Any]] = None
    reason: Optional[str] = None
    userId: str
    createdAt: datetime


class LabResultResponse(BaseModel):
    id: str
    labOrderItemId: str
    analyteId: str
    eventTestId: Optional[str] = None
    valueText: Optional[str] = None
    valueNumber: Optional[float] = None
    unitId: Optional[str] = None
    status: LabResultStatus = LabResultStatus.PENDING
    capturedById: Optional[str] = None
    capturedAt: Optional[datetime] = None
    reportedById: Optional[str] = None
    reportedAt: Optional[datetime] = None
    authorizedById: Optional[str] = None
    authorizedAt: Optional[datetime] = None
    validatedById: Optional[str] = None
    validatedAt: Optional[datetime] = None
    invalidatedById: Optional[str] = None
    invalidatedAt: Optional[datetime] = None
    invalidateReason: Optional[str] = None
    isOutOfRange: bool = False
    isCritical: bool = False
    isAbnormal: bool = False
    observations: Optional[str] = None
    createdAt: datetime
    updatedAt: datetime
    # Enriquecido opcional (lo rellena el service)
    analyteCode: Optional[str] = None
    analyteName: Optional[str] = None
    analyteDataType: Optional[LabAnalyteDataType] = None
    unitSymbol: Optional[str] = None


class LabResultWithAudit(LabResultResponse):
    auditEvents: List[LabResultAuditResponse] = []


# ---------------------------------------------------------------------------
# Worklist (analitos esperados para una orden)
# ---------------------------------------------------------------------------
class WorklistExpectedAnalyte(BaseModel):
    analyteId: str
    code: str
    name: str
    dataType: LabAnalyteDataType
    orderIndex: int
    defaultUnitId: Optional[str] = None
    defaultUnitSymbol: Optional[str] = None
    # Rango aplicable (resuelto por edad/sexo)
    rangeMin: Optional[float] = None
    rangeMax: Optional[float] = None
    rangeText: Optional[str] = None
    criticalLow: Optional[float] = None
    criticalHigh: Optional[float] = None
    # Resultado existente (si ya hay LabResult)
    existingResultId: Optional[str] = None
    existingValueText: Optional[str] = None
    existingValueNumber: Optional[float] = None
    existingStatus: Optional[LabResultStatus] = None


class WorklistItem(BaseModel):
    labOrderItemId: str
    medicalTestId: str
    medicalTestCode: str
    medicalTestName: str
    analytes: List[WorklistExpectedAnalyte]


class WorklistResponse(BaseModel):
    orderId: str
    folio: Optional[int] = None
    orderStatus: str
    items: List[WorklistItem]


# ---------------------------------------------------------------------------
# DataTables
# ---------------------------------------------------------------------------
class DataTablesResponse(BaseModel):
    draw: int
    recordsTotal: int
    recordsFiltered: int
    data: List[Dict[str, Any]]


# ---------------------------------------------------------------------------
# Vinculación LabOrderItem ↔ EventTest
# ---------------------------------------------------------------------------
class LinkLabOrderItemEventTestRequest(BaseModel):
    eventTestId: Optional[str] = None