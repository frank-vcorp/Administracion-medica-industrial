"""
Esquemas Pydantic para extracción estructurada de documentos médicos.
IMPL-20260225-01: Pipeline IA modular - Clasificación y extracción especializada.
IMPL-20260326-16: Separación capa extractiva / capa interpretativa IA (ARCH-20260326-16).
               La extracción NO puede contener diagnóstico_ia, interpretación clínica
               ni recomendaciones de aptitud. Esas capas viven en AIPrediagnosisSnapshot.
"""

from pydantic import BaseModel, Field
from typing import Literal, Union, Dict, List, Optional
from datetime import datetime


# ---------------------------------------------------------------------------
# Capa 1: Clasificación documental
# ---------------------------------------------------------------------------

class DocumentClassification(BaseModel):
    """Clasificación de tipo de documento médico."""
    tipo: Literal["Audiometria", "Espirometria", "Laboratorio", "Rayos_X", "Otro"]
    confianza: float = Field(..., ge=0.0, le=1.0)
    razon: str = Field(description="Breve explicación de por qué se clasificó así")


# ---------------------------------------------------------------------------
# Capa 2: Extracción estructurada — SIN interpretación clínica
#
# REGLA CRÍTICA (ARCH-20260326-16):
#  - NO incluir diagnostico_ia, interpretacion_clinica_final, aptitud ni equivalentes.
#  - Solo parámetros canónicos, calidad documental y fragmentos fuente.
# ---------------------------------------------------------------------------

class AudiometriaData(BaseModel):
    """
    Datos EXTRAÍDOS de estudio audiométrico.
    NOTA: no incluye diagnóstico ni interpretación — esas capas van en AIPrediagnosisSnapshot.
    """
    paciente: str
    fecha_estudio: str
    oido_derecho: Dict[str, int] = Field(
        description="Frecuencias Hz (string) -> Decibeles. Ej: {'500': 10, '1000': 15}"
    )
    oido_izquierdo: Dict[str, int]
    notas_calidad: Optional[str] = Field(
        default=None,
        description="Observaciones sobre calidad del documento (ilegible, falta información, etc.)"
    )


class LaboratorioData(BaseModel):
    """
    Datos EXTRAÍDOS de análisis de laboratorio clínico.
    NOTA: no incluye interpretación clínica — esa capa va en AIPrediagnosisSnapshot.
    """
    paciente: str
    fecha: str
    estudio_tipo: str = Field(description="Ej: Biometría Hemática, Química Sanguínea")
    parametros: List[Dict[str, str]] = Field(
        description="Lista de {parametro, valor, unidad, referencia, estado: normal|high|low|unknown}"
    )
    profesional: Optional[str] = None
    notas_calidad: Optional[str] = None


class EspirometriaData(BaseModel):
    """
    Datos EXTRAÍDOS de prueba de función pulmonar.
    NOTA: no incluye diagnóstico — esa capa va en AIPrediagnosisSnapshot.
    """
    paciente: str
    fecha_estudio: str
    fev1: Optional[float] = Field(default=None, description="FEV1 en litros")
    fvc: Optional[float] = Field(default=None, description="FVC en litros")
    fev1_fvc_ratio: Optional[float] = None
    fev1_percent_predicho: Optional[float] = None
    notas_calidad: Optional[str] = None


class RayosXData(BaseModel):
    """
    Datos EXTRAÍDOS de estudio radiológico.
    NOTA: hallazgos son observaciones descriptivas, no diagnóstico final.
    """
    paciente: str
    fecha_estudio: str
    localizacion: str = Field(description="Ej: Tórax, Columna, Extremidades")
    hallazgos: List[str] = Field(
        description="Lista de hallazgos descriptivos sin interpretación clínica final"
    )
    radiologista: Optional[str] = None
    notas_calidad: Optional[str] = None


class ExtractedDataUnion(BaseModel):
    """Unión discriminada de tipos de datos extraídos (capa extractiva)."""
    classification: DocumentClassification
    data: Union[AudiometriaData, LaboratorioData, EspirometriaData, RayosXData, Dict]
    processing_time_seconds: float
    gemini_model: str = "gemini-2.5-flash"


# ---------------------------------------------------------------------------
# Capa 3: Prediagnóstico IA — separada e inmutable
# Ref: ARCH-20260326-16 §"Separación de capas"
# ---------------------------------------------------------------------------

class ClinicalBasisItem(BaseModel):
    """Fundamento clínico aplicado en el prediagnóstico."""
    principle: str
    applied_parameters: List[str] = Field(default_factory=list)


class ClinicalCitation(BaseModel):
    """Cita de evidencia clínica controlada y versionada."""
    source_id: str
    title: str
    section: Optional[str] = None
    excerpt: Optional[str] = None
    version_or_date: Optional[str] = None


class AIPrediagnosisResult(BaseModel):
    """
    Resultado de prediagnóstico IA por estudio.
    GUARDRAIL: NO puede contener aptitud laboral, dictamen final ni firma.
    Lenguaje obligatorio: 'compatible con', 'sugiere', 'requiere correlación clínica'.
    """
    summary: str = Field(
        description="Resumen prudente IA. Debe usar lenguaje no diagnóstico definitivo."
    )
    confidence: float = Field(..., ge=0.0, le=1.0)
    clinical_state: Literal[
        "DRAFT_EXTRACTED",
        "AI_PENDING_REVIEW",
        "AI_NON_CONCLUSIVE",
        "REVIEWED_ACCEPTED",
        "REVIEWED_EDITED",
        "REVIEWED_REJECTED",
        "SUPERSEDED",
    ] = "AI_PENDING_REVIEW"
    justification: List[str] = Field(
        default_factory=list,
        description="Lista de razones clínicas basadas en parámetros extraídos"
    )
    clinical_basis: List[ClinicalBasisItem] = Field(default_factory=list)
    citations: List[ClinicalCitation] = Field(default_factory=list)
    limitations: List[str] = Field(
        default_factory=list,
        description="Limitaciones de esta interpretación: calidad doc, parámetros faltantes, etc."
    )
    red_flags: List[str] = Field(
        default_factory=list,
        description="Alertas clínicas que requieren atención médica prioritaria"
    )
    non_conclusive_reason: Optional[str] = Field(
        default=None,
        description="Si clinical_state=AI_NON_CONCLUSIVE, razón explícita"
    )


class AIAuditMetadata(BaseModel):
    """Metadatos de auditoría transaccional de una corrida IA."""
    model_name: str
    prompt_version: str
    pipeline_version: str = "ai-pipeline-2026-03"
    corpus_version: Optional[str] = None
    source_file_hash: Optional[str] = None
    triggered_by_user_id: Optional[str] = None
    trigger_reason: Literal["initial_upload", "manual_regeneration"] = "initial_upload"
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())


class ExtractionSnapshotPayload(BaseModel):
    """
    Payload completo de un snapshot de extracción (inmutable tras creación).
    Ref: ARCH-20260326-16 §"Persistencia pragmática inicial"
    """
    study_type: str
    source_file_name: Optional[str] = None
    extracted_data: Union[AudiometriaData, LaboratorioData, EspirometriaData, RayosXData, Dict]
    missing_fields: List[str] = Field(default_factory=list)
    quality_notes: List[str] = Field(default_factory=list)
    audit: Optional[AIAuditMetadata] = None
