"""
IMPL-20260630-06: Slice A NOVA absorción (ARCH-20260630-02).
Pydantic schemas para los 8 mods del módulo de catálogos LIS.

Diseño:
  - Un schema base `LabCatalogMod` para el discriminador del parámetro ?mod=
  - Schemas de Create / Update / Out por cada mod (8 mods del Slice A).
  - DataTablesResponse para la respuesta paginada server-side.
  - Todos los campos opcionales tienen defaults; las validaciones siguen el SPEC §3.
"""
from __future__ import annotations

from enum import Enum
from typing import List, Literal, Optional

from pydantic import BaseModel, Field, field_validator


# ---------------------------------------------------------------------------
# Discriminador de mods (sincronizado con frontend/src/lib/validations/lab-catalog.ts)
# ---------------------------------------------------------------------------
class LabCatalogMod(str, Enum):
    UNIDADES = "unidades"
    MUESTRAS = "muestras"
    RECIPIENTES = "recipientes"
    METODOLOGIAS = "metodologias"
    LUGARES_PROCESO = "lugares_proceso"
    CLASIFICACIONES = "clasificaciones"
    INDICACIONES = "indicaciones"
    DEPARTAMENTOS = "departamentos"

    @classmethod
    def parse(cls, raw: str | None) -> "LabCatalogMod":
        """Acepta alias comunes (singular, sin acentos) y devuelve el mod canónico.
        Si el valor es desconocido devuelve UNIDADES como fallback (alineado con
        la regla del SPEC §6.2: "mod inválido → redirect a ?mod=unidades")."""
        if not raw:
            return cls.UNIDADES
        normalized = raw.strip().lower().replace(" ", "_")
        aliases = {
            "unidad": cls.UNIDADES.value,
            "muestra": cls.MUESTRAS.value,
            "recipiente": cls.RECIPIENTES.value,
            "metodologia": cls.METODOLOGIAS.value,
            "lugar_proceso": cls.LUGARES_PROCESO.value,
            "lugares": cls.LUGARES_PROCESO.value,
            "clasificacion": cls.CLASIFICACIONES.value,
            "indicacion": cls.INDICACIONES.value,
            "departamento": cls.DEPARTAMENTOS.value,
        }
        if normalized in aliases:
            return cls(aliases[normalized])
        for member in cls:
            if member.value == normalized:
                return member
        return cls.UNIDADES


# ---------------------------------------------------------------------------
# Unidad (LabUnit)
# ---------------------------------------------------------------------------
class LabUnitBase(BaseModel):
    symbol: str = Field(..., min_length=1, max_length=32)
    name: str = Field(..., min_length=1, max_length=120)
    system: Literal["SI", "CONVENTIONAL"]


class LabUnitCreate(LabUnitBase):
    active: bool = True


class LabUnitUpdate(BaseModel):
    symbol: Optional[str] = Field(None, min_length=1, max_length=32)
    name: Optional[str] = Field(None, min_length=1, max_length=120)
    system: Optional[Literal["SI", "CONVENTIONAL"]] = None
    active: Optional[bool] = None


class LabUnitOut(LabUnitBase):
    id: str
    active: bool
    createdAt: str
    updatedAt: str


# ---------------------------------------------------------------------------
# Muestra (LabSample)
# ---------------------------------------------------------------------------
class LabSampleBase(BaseModel):
    code: str = Field(..., min_length=1, max_length=32)
    name: str = Field(..., min_length=1, max_length=120)
    defaultContainerId: Optional[str] = None
    preservation: Optional[str] = Field(None, max_length=120)
    minVolume: Optional[str] = Field(None, max_length=32)


class LabSampleCreate(LabSampleBase):
    active: bool = True


class LabSampleUpdate(BaseModel):
    code: Optional[str] = Field(None, min_length=1, max_length=32)
    name: Optional[str] = Field(None, min_length=1, max_length=120)
    defaultContainerId: Optional[str] = None
    preservation: Optional[str] = Field(None, max_length=120)
    minVolume: Optional[str] = Field(None, max_length=32)
    active: Optional[bool] = None


class LabSampleOut(LabSampleBase):
    id: str
    active: bool
    createdAt: str
    updatedAt: str


# ---------------------------------------------------------------------------
# Recipiente (LabContainer)
# ---------------------------------------------------------------------------
class LabContainerBase(BaseModel):
    code: str = Field(..., min_length=1, max_length=32)
    name: str = Field(..., min_length=1, max_length=120)
    color: Optional[str] = Field(None, max_length=32)
    cap: Optional[str] = Field(None, max_length=64)


class LabContainerCreate(LabContainerBase):
    active: bool = True


class LabContainerUpdate(BaseModel):
    code: Optional[str] = Field(None, min_length=1, max_length=32)
    name: Optional[str] = Field(None, min_length=1, max_length=120)
    color: Optional[str] = Field(None, max_length=32)
    cap: Optional[str] = Field(None, max_length=64)
    active: Optional[bool] = None


class LabContainerOut(LabContainerBase):
    id: str
    active: bool
    createdAt: str
    updatedAt: str


# ---------------------------------------------------------------------------
# Metodología (LabMethod)
# ---------------------------------------------------------------------------
class LabMethodBase(BaseModel):
    code: str = Field(..., min_length=1, max_length=32)
    name: str = Field(..., min_length=1, max_length=120)
    principle: Optional[str] = Field(None, max_length=255)


class LabMethodCreate(LabMethodBase):
    active: bool = True


class LabMethodUpdate(BaseModel):
    code: Optional[str] = Field(None, min_length=1, max_length=32)
    name: Optional[str] = Field(None, min_length=1, max_length=120)
    principle: Optional[str] = Field(None, max_length=255)
    active: Optional[bool] = None


class LabMethodOut(LabMethodBase):
    id: str
    active: bool
    createdAt: str
    updatedAt: str


# ---------------------------------------------------------------------------
# Lugar de proceso (LabProcessArea)
# ---------------------------------------------------------------------------
class LabProcessAreaBase(BaseModel):
    code: str = Field(..., min_length=1, max_length=32)
    name: str = Field(..., min_length=1, max_length=120)
    departmentId: Optional[str] = None


class LabProcessAreaCreate(LabProcessAreaBase):
    active: bool = True


class LabProcessAreaUpdate(BaseModel):
    code: Optional[str] = Field(None, min_length=1, max_length=32)
    name: Optional[str] = Field(None, min_length=1, max_length=120)
    departmentId: Optional[str] = None
    active: Optional[bool] = None


class LabProcessAreaOut(LabProcessAreaBase):
    id: str
    active: bool
    createdAt: str
    updatedAt: str


# ---------------------------------------------------------------------------
# Clasificación (LabClassification)
# ---------------------------------------------------------------------------
class LabClassificationBase(BaseModel):
    code: str = Field(..., min_length=1, max_length=32)
    name: str = Field(..., min_length=1, max_length=120)
    color: Optional[str] = Field(None, max_length=16)
    sortOrder: int = 0

    @field_validator("color")
    @classmethod
    def _validate_hex(cls, v: Optional[str]) -> Optional[str]:
        if v is None or v == "":
            return v
        if not v.startswith("#") or len(v) not in (4, 7, 9):
            raise ValueError("color debe ser hex (#RGB, #RRGGBB o #RRGGBBAA)")
        return v.upper()


class LabClassificationCreate(LabClassificationBase):
    active: bool = True


class LabClassificationUpdate(BaseModel):
    code: Optional[str] = Field(None, min_length=1, max_length=32)
    name: Optional[str] = Field(None, min_length=1, max_length=120)
    color: Optional[str] = Field(None, max_length=16)
    sortOrder: Optional[int] = None
    active: Optional[bool] = None


class LabClassificationOut(LabClassificationBase):
    id: str
    active: bool
    createdAt: str
    updatedAt: str


# ---------------------------------------------------------------------------
# Indicación (LabIndication)
# ---------------------------------------------------------------------------
class LabIndicationBase(BaseModel):
    code: str = Field(..., min_length=1, max_length=32)
    text: str = Field(..., min_length=1, max_length=500)


class LabIndicationCreate(LabIndicationBase):
    active: bool = True


class LabIndicationUpdate(BaseModel):
    code: Optional[str] = Field(None, min_length=1, max_length=32)
    text: Optional[str] = Field(None, min_length=1, max_length=500)
    active: Optional[bool] = None


class LabIndicationOut(LabIndicationBase):
    id: str
    active: bool
    createdAt: str
    updatedAt: str


# ---------------------------------------------------------------------------
# Departamento (LabDepartment)
# ---------------------------------------------------------------------------
class LabDepartmentBase(BaseModel):
    code: str = Field(..., min_length=1, max_length=32)
    name: str = Field(..., min_length=1, max_length=120)


class LabDepartmentCreate(LabDepartmentBase):
    active: bool = True


class LabDepartmentUpdate(BaseModel):
    code: Optional[str] = Field(None, min_length=1, max_length=32)
    name: Optional[str] = Field(None, min_length=1, max_length=120)
    active: Optional[bool] = None


class LabDepartmentOut(LabDepartmentBase):
    id: str
    active: bool
    createdAt: str
    updatedAt: str


# ---------------------------------------------------------------------------
# DataTables — respuesta paginada server-side
# ---------------------------------------------------------------------------
class DataTablesResponse(BaseModel):
    draw: int
    recordsTotal: int
    recordsFiltered: int
    data: List[dict]