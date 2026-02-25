"""
Esquemas Pydantic para extracción estructurada de documentos médicos.
IMPL-20260225-01: Pipeline IA modular - Clasificación y extracción especializada.
"""

from pydantic import BaseModel, Field
from typing import Literal, Union, Dict, List, Optional


class DocumentClassification(BaseModel):
    """Clasificación de tipo de documento médico."""
    tipo: Literal["Audiometria", "Espirometria", "Laboratorio", "Rayos_X", "Otro"]
    confianza: float = Field(..., ge=0.0, le=1.0)
    razon: str = Field(description="Breve explicación de por qué se clasificó así")


class AudiometriaData(BaseModel):
    """Datos estructurados de estudio audiométrico."""
    paciente: str
    fecha_estudio: str
    oido_derecho: Dict[int, int] = Field(
        description="Frecuencias Hz -> Decibeles. Ej: {500: 10, 1000: 15}"
    )
    oido_izquierdo: Dict[int, int]
    diagnostico_ia: str = Field(description="Pronóstico/diagnóstico breve")
    recomendaciones: List[str] = Field(default_factory=list)
    interpretacion: Optional[str] = None


class LaboratorioData(BaseModel):
    """Datos estructurados de análisis de laboratorio clínico."""
    paciente: str
    fecha: str
    estudio_tipo: str = Field(description="Ej: Biometría Hemática, Química Sanguínea")
    valores_anormales: List[Dict[str, str]] = Field(
        description="Lista de {parametro, valor, referencia}"
    )
    interpretacion: str
    profesional: Optional[str] = None


class EspirometriaData(BaseModel):
    """Datos estructurados de prueba de función pulmonar."""
    paciente: str
    fecha_estudio: str
    fev1: float = Field(description="FEV1 en litros")
    fvc: float = Field(description="FVC en litros")
    fev1_fvc_ratio: Optional[float] = None
    fev1_percent_predicho: Optional[float] = None
    diagnostico_ia: str
    recomendaciones: List[str] = Field(default_factory=list)


class RayosXData(BaseModel):
    """Datos estructurados de estudio radiológico."""
    paciente: str
    fecha_estudio: str
    localizacion: str = Field(description="Ej: Tórax, Columna, Extremidades")
    hallazgos: List[str]
    interpretacion: str
    radiologista: Optional[str] = None


class ExtractedDataUnion(BaseModel):
    """Unión discriminada de tipos de datos extraídos."""
    classification: DocumentClassification
    data: Union[AudiometriaData, LaboratorioData, EspirometriaData, RayosXData, Dict]
    processing_time_seconds: float
    gemini_model: str = "gemini-2.5-flash"
