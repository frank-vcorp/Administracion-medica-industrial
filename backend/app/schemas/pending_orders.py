"""
IMPL-20260707-17: Fase 1 NOVA absorción (ARCH-20260707-17) — B-v2 + E.

Schemas Pydantic para los nuevos endpoints de Fase 1:
  - B-v2: bandeja de papeletas + trigger SAMPLE_TAKEN → LabOrder DRAFT
  - E:    catálogo avanzado de estudios (MedicalTest + LabAnalyte + LabReferenceRange)

Diseño:
  - Lightweight: solo se definen los contratos de I/O que el frontend necesita.
  - Reutiliza enums existentes (LabSex, LabAnalyteDataType) ya persistidos en Prisma.
"""
from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# ID de categoría "Laboratorio" — confirmado contra DB
# (ver context/SPECs/CONF-20260707-01-FLUJO-NOVA.md §2.1)
# ---------------------------------------------------------------------------
LAB_CATEGORY_ID = "64d3f863"


# ---------------------------------------------------------------------------
# B-v2 — Bandeja de papeletas
# ---------------------------------------------------------------------------
class PendingOrderRow(BaseModel):
    """Fila de la bandeja: un MedicalEvent con EventTests SAMPLE_TAKEN de cat=Laboratorio."""
    medicalEventId: str
    folio: Optional[str] = None  # human-readable (id corto)
    workerId: str
    workerName: str
    workerCode: str
    companyName: Optional[str] = None
    doctorName: str  # nombre del médico que atendió (intakeCreatedByUser.fullName o "Por asignar")
    intakeCreatedByUserId: Optional[str] = None
    branchId: Optional[str] = None
    branchName: Optional[str] = None
    eventStatus: str
    eventCreatedAt: datetime
    eventTests: List["PendingOrderEventTestRow"] = []
    # ID de la LabOrder DRAFT ya creada por el trigger, si existe
    existingDraftLabOrderId: Optional[str] = None
    existingDraftLabOrderFolio: Optional[int] = None


class PendingOrderEventTestRow(BaseModel):
    id: str
    testNameSnapshot: str
    medicalTestId: Optional[str] = None
    medicalTestCode: Optional[str] = None
    status: str
    selectedOption: Optional[str] = None
    createdAt: datetime


class PendingOrdersResponse(BaseModel):
    branchId: Optional[str] = None
    categoryId: str = LAB_CATEGORY_ID
    total: int
    rows: List[PendingOrderRow]


class TriggerAutoGenerateRequest(BaseModel):
    medicalEventId: str = Field(..., min_length=1)
    # currentUser se extrae del header X-AMI-UserId (no body)


class MarkSampleTakenRequest(BaseModel):
    """Body opcional — la acción principal es el cambio de status."""
    notes: Optional[str] = Field(None, max_length=500)


class TriggerAutoGenerateResponse(BaseModel):
    medicalEventId: str
    labOrderId: str
    folio: Optional[int] = None
    status: str = "DRAFT"
    itemsCount: int
    alreadyExisted: bool = False  # si ya existía un LabOrder DRAFT con esos eventTestIds


# ---------------------------------------------------------------------------
# E — Catálogo avanzado (MedicalTest + analitos + rangos)
# ---------------------------------------------------------------------------
class LabAnalyteDataType(str, Enum):
    NUMERIC = "NUMERIC"
    TEXT = "TEXT"
    ENUM = "ENUM"


class LabSexEnum(str, Enum):
    M = "M"
    F = "F"
    A = "A"


class LabCatalogAnalyte(BaseModel):
    id: str
    code: str
    name: str
    orderIndex: int = 0
    dataType: LabAnalyteDataType = LabAnalyteDataType.NUMERIC
    defaultUnitCode: Optional[str] = None
    active: bool = True
    referenceRanges: List["LabCatalogReferenceRange"] = []


class LabCatalogReferenceRange(BaseModel):
    id: str
    sex: LabSexEnum = LabSexEnum.A
    ageMinMonths: Optional[int] = None
    ageMaxMonths: Optional[int] = None
    valueMin: Optional[float] = None
    valueMax: Optional[float] = None
    textValue: Optional[str] = None
    unitCode: Optional[str] = None
    criticalLow: Optional[float] = None
    criticalHigh: Optional[float] = None
    isCritical: bool = False


class LabCatalogTest(BaseModel):
    id: str
    code: str
    name: str
    categoryId: str
    novaClave: Optional[str] = None
    daysToResult: Optional[int] = None
    isProfile: bool = False
    isPackage: bool = False
    analytes: List[LabCatalogAnalyte] = []


class LabCatalogResponse(BaseModel):
    categoryId: str = LAB_CATEGORY_ID
    total: int
    rows: List[LabCatalogTest]


# CRUD inputs ----------------------------------------------------------------
class LabAnalyteCreate(BaseModel):
    medicalTestId: str = Field(..., min_length=1)
    code: str = Field(..., min_length=1, max_length=40)
    name: str = Field(..., min_length=1, max_length=200)
    orderIndex: int = 0
    dataType: LabAnalyteDataType = LabAnalyteDataType.NUMERIC
    defaultUnitCode: Optional[str] = None
    active: bool = True


class LabAnalyteUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    orderIndex: Optional[int] = None
    dataType: Optional[LabAnalyteDataType] = None
    defaultUnitCode: Optional[str] = None
    active: Optional[bool] = None


class LabReferenceRangeCreate(BaseModel):
    analyteId: str = Field(..., min_length=1)
    sex: LabSexEnum = LabSexEnum.A
    ageMinMonths: Optional[int] = Field(None, ge=0)
    ageMaxMonths: Optional[int] = Field(None, ge=0)
    valueMin: Optional[float] = None
    valueMax: Optional[float] = None
    textValue: Optional[str] = Field(None, max_length=200)
    unitCode: Optional[str] = None
    criticalLow: Optional[float] = None
    criticalHigh: Optional[float] = None
    isCritical: bool = False


class LabReferenceRangeUpdate(BaseModel):
    sex: Optional[LabSexEnum] = None
    ageMinMonths: Optional[int] = Field(None, ge=0)
    ageMaxMonths: Optional[int] = Field(None, ge=0)
    valueMin: Optional[float] = None
    valueMax: Optional[float] = None
    textValue: Optional[str] = Field(None, max_length=200)
    unitCode: Optional[str] = None
    criticalLow: Optional[float] = None
    criticalHigh: Optional[float] = None
    isCritical: Optional[bool] = None


# Seed ------------------------------------------------------------------------
class SeedResult(BaseModel):
    status: str
    seeded: int  # número de estudios creados
    analytes: int
    referenceRanges: int
    note: str = ""


# Resolver referencias forward de Pydantic v2
PendingOrderRow.model_rebuild()
LabCatalogAnalyte.model_rebuild()