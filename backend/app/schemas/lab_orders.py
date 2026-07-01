"""
IMPL-20260701-03: Slice B NOVA absorción (ARCH-20260701-03) — admisión LabOrder.
Pydantic schemas para el flujo end-to-end de admisión de laboratorio.

Diseño:
  - Replica 1:1 el SPEC §4.1 y §4.3.
  - Incluye Create/Update/Out para LabOrder y LabOrderItem.
  - Schemas auxiliares para autocomplete (workers/doctors/companies/tests).
  - Variantes "FromDB" para reflejar campos computed (age, companyName, folio, etc.)
    en respuestas de búsqueda.
"""
from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import List, Literal, Optional

from pydantic import BaseModel, Field, field_validator


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------
class LabOrderStatus(str, Enum):
    DRAFT = "DRAFT"
    SAVED = "SAVED"
    SAMPLE_TAKEN = "SAMPLE_TAKEN"
    IN_PROCESS = "IN_PROCESS"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class LabOrderUrgency(str, Enum):
    NORMAL = "NORMAL"
    URGENT = "URGENT"


class LabOrderConfidentiality(str, Enum):
    NORMAL = "NORMAL"
    CONFIDENTIAL = "CONFIDENTIAL"


# ---------------------------------------------------------------------------
# LabOrderItem
# ---------------------------------------------------------------------------
class LabOrderItemBase(BaseModel):
    medicalTestId: str
    price: float = Field(..., ge=0)
    discountAmount: float = Field(0, ge=0)
    discountPct: float = Field(0, ge=0, le=100)


class LabOrderItemCreate(LabOrderItemBase):
    pass


class LabOrderItemUpdate(BaseModel):
    price: Optional[float] = Field(None, ge=0)
    discountAmount: Optional[float] = Field(None, ge=0)
    discountPct: Optional[float] = Field(None, ge=0, le=100)


class LabOrderItemResponse(LabOrderItemBase):
    id: str
    labOrderId: str
    amount: float
    resultStatus: str = "P"
    createdAt: datetime
    updatedAt: datetime
    # opcional: snapshot del nombre/código del estudio para no requerir join
    medicalTestName: Optional[str] = None
    medicalTestCode: Optional[str] = None


# ---------------------------------------------------------------------------
# LabOrder
# ---------------------------------------------------------------------------
class LabOrderBase(BaseModel):
    workerId: str
    medicalEventId: Optional[str] = None
    companyId: Optional[str] = None
    classificationId: Optional[str] = None
    doctorName: str = Field(..., min_length=2, max_length=120)
    doctorClave: Optional[str] = Field(None, max_length=40)
    patientDiscountPct: float = Field(0, ge=0, le=100)
    doctorDiscountPct: float = Field(0, ge=0, le=100)
    doctorCommissionPct: float = Field(0, ge=0, le=100)
    companyDiscountPct: float = Field(0, ge=0, le=100)
    urgency: LabOrderUrgency = LabOrderUrgency.NORMAL
    confidentiality: LabOrderConfidentiality = LabOrderConfidentiality.NORMAL
    homeSample: bool = False
    sendResultsByEmail: bool = False
    generateInvoice: bool = False
    language: Literal["es", "en"] = "es"
    deliveryDate: Optional[datetime] = None
    deliveryTime: Optional[str] = Field(None, pattern=r"^\d{2}:\d{2}$")
    observations: Optional[str] = Field(None, max_length=2000)
    isCourtesy: bool = False
    courtesyType: Optional[str] = Field(None, max_length=120)


class LabOrderCreate(LabOrderBase):
    items: List[LabOrderItemCreate] = Field(..., min_length=1)


class LabOrderUpdate(BaseModel):
    companyId: Optional[str] = None
    classificationId: Optional[str] = None
    doctorName: Optional[str] = Field(None, min_length=2, max_length=120)
    doctorClave: Optional[str] = Field(None, max_length=40)
    patientDiscountPct: Optional[float] = Field(None, ge=0, le=100)
    doctorDiscountPct: Optional[float] = Field(None, ge=0, le=100)
    doctorCommissionPct: Optional[float] = Field(None, ge=0, le=100)
    companyDiscountPct: Optional[float] = Field(None, ge=0, le=100)
    urgency: Optional[LabOrderUrgency] = None
    confidentiality: Optional[LabOrderConfidentiality] = None
    homeSample: Optional[bool] = None
    sendResultsByEmail: Optional[bool] = None
    generateInvoice: Optional[bool] = None
    language: Optional[Literal["es", "en"]] = None
    deliveryDate: Optional[datetime] = None
    deliveryTime: Optional[str] = Field(None, pattern=r"^\d{2}:\d{2}$")
    observations: Optional[str] = Field(None, max_length=2000)
    isCourtesy: Optional[bool] = None
    courtesyType: Optional[str] = Field(None, max_length=120)


class LabOrderConfirm(BaseModel):
    """Trigger vacío para confirmar una orden (DRAFT → SAVED)."""
    pass


class LabOrderResponse(LabOrderBase):
    id: str
    folio: Optional[int] = None
    novaFolio: Optional[str] = None
    branch: str = "MATRIZ"
    status: LabOrderStatus = LabOrderStatus.DRAFT
    subtotal: float = 0
    ivaPct: float = 16
    iva: float = 0
    total: float = 0
    createdAt: datetime
    updatedAt: datetime
    createdById: str
    cancelledAt: Optional[datetime] = None
    cancelledById: Optional[str] = None
    confirmedAt: Optional[datetime] = None
    items: List[LabOrderItemResponse] = []


class LabOrderListRow(BaseModel):
    """Fila reducida para DataTables (no incluye items para mantener payload ligero)."""
    id: str
    folio: Optional[int] = None
    fecha: Optional[str] = None  # ISO
    paciente: Optional[str] = None
    medico: Optional[str] = None
    empresa: Optional[str] = None
    total: float = 0
    status: LabOrderStatus = LabOrderStatus.DRAFT
    itemCount: int = 0


# ---------------------------------------------------------------------------
# Autocomplete — request/response
# ---------------------------------------------------------------------------
class WorkerSearchResult(BaseModel):
    id: str
    fullName: str
    code: str  # universalId
    age: Optional[int] = None
    companyName: Optional[str] = None


class DoctorSearchResult(BaseModel):
    name: str
    clave: Optional[str] = None


class CompanySearchResult(BaseModel):
    id: str
    name: str
    rfc: Optional[str] = None


class LabTestSearchResult(BaseModel):
    id: str
    code: str
    alternateCode: Optional[str] = None
    name: str
    price: float = 0


# ---------------------------------------------------------------------------
# Variantes "FromDB" — alias de los schemas Out con campos computed listos
# (la service rellena estos campos en _serialize_*)
# ---------------------------------------------------------------------------
class LabOrderItemCreateFromDB(LabOrderItemResponse):
    """Alias semántico para items que ya vienen con amount calculado desde DB."""
    pass


class LabOrderCreateFromDB(LabOrderResponse):
    """Alias semántico para órdenes que ya vienen con totales calculados desde DB."""
    pass


# ---------------------------------------------------------------------------
# DataTables (reuso del patrón de lab_catalogs)
# ---------------------------------------------------------------------------
class DataTablesResponse(BaseModel):
    draw: int
    recordsTotal: int
    recordsFiltered: int
    data: List[dict]


# ---------------------------------------------------------------------------
# Soft delete payload
# ---------------------------------------------------------------------------
class LabOrderCancelRequest(BaseModel):
    motivo: str = Field(..., min_length=3, max_length=500)
