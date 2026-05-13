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
    # IMPL-20260326-17: Añadidos Campimetria, Electrocardiograma, RiesgoCardiovascular (GEN-O1WV7, GEN-C85PD, GEN-U5BQX)
    tipo: Literal[
        "Audiometria",
        "Espirometria",
        "Laboratorio",
        "Rayos_X",
        "Campimetria",
        "Electrocardiograma",
        "RiesgoCardiovascular",
        "Otro",
    ]
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
    IMPL-20260513-01: Frecuencias canónicas 250-8000 Hz, señal de completitud documental.
    NOTA: no incluye diagnóstico ni interpretación — esas capas van en AIPrediagnosisSnapshot.
    """
    paciente: str
    fecha_estudio: str
    oido_derecho: Dict[str, int] = Field(
        description="Frecuencias Hz (string) -> Decibeles. Canónicas: 250,500,1000,2000,3000,4000,6000,8000"
    )
    oido_izquierdo: Dict[str, int]
    frecuencias_detectadas: Optional[List[str]] = Field(
        default=None,
        description="Lista de frecuencias realmente encontradas en el documento (trazabilidad de cobertura)"
    )
    completitud_documental: Optional[Literal["suficiente", "parcial", "no_concluyente"]] = Field(
        default=None,
        description="Calidad general del documento: suficiente=>=6 frecuencias por oído, parcial=3-5, no_concluyente=<3"
    )
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
    IMPL-20260513-01: Añadidos campos de broncodilatador, interpretabilidad y completitud.
    NOTA: no incluye diagnóstico — esa capa va en AIPrediagnosisSnapshot.
    """
    paciente: str
    fecha_estudio: str
    fev1: Optional[float] = Field(default=None, description="FEV1 en litros")
    fvc: Optional[float] = Field(default=None, description="FVC en litros")
    fev1_fvc_ratio: Optional[float] = Field(default=None, description="Relación FEV1/FVC")
    fev1_percent_predicho: Optional[float] = Field(default=None, description="FEV1 como % del predicho")
    fvc_percent_predicho: Optional[float] = Field(default=None, description="FVC como % del predicho (si disponible)")
    broncodilatador_post_fev1: Optional[float] = Field(
        default=None, description="FEV1 post-broncodilatador en litros (si se realizó prueba BD)"
    )
    broncodilatador_post_fvc: Optional[float] = Field(
        default=None, description="FVC post-broncodilatador en litros (si disponible)"
    )
    es_interpretable: Optional[bool] = Field(
        default=None,
        description="True si tiene fev1+fvc mínimos; False si el documento es no concluyente"
    )
    completitud_documental: Optional[Literal["suficiente", "parcial", "no_concluyente"]] = Field(
        default=None,
        description="suficiente=fev1+fvc+ratio+%predicho, parcial=solo fev1+fvc, no_concluyente=faltan mínimos"
    )
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


# ---------------------------------------------------------------------------
# IMPL-20260326-17: Schemas para estudios GEN-O1WV7, GEN-C85PD, GEN-U5BQX
# ---------------------------------------------------------------------------

class CampimetriaData(BaseModel):
    """
    Datos EXTRAÍDOS de estudio de campo visual (campimetría).
    Parámetros canónicos: puntos de déficit por ojo, índices de pérdida.
    NOTA: prediagnóstico IA no soportado en V1 — requiere revisión médica manual.
    """
    paciente: str
    fecha_estudio: str
    ojo_derecho_defectos: Optional[List[str]] = Field(
        default=None,
        description="Lista de déficits/escotomas detectados en ojo derecho"
    )
    ojo_izquierdo_defectos: Optional[List[str]] = Field(
        default=None,
        description="Lista de déficits/escotomas detectados en ojo izquierdo"
    )
    indices_ojo_derecho: Optional[Dict[str, str]] = Field(
        default=None,
        description="Índices numéricos OD: MD, PSD, VFI si están disponibles"
    )
    indices_ojo_izquierdo: Optional[Dict[str, str]] = Field(
        default=None,
        description="Índices numéricos OI: MD, PSD, VFI si están disponibles"
    )
    profesional: Optional[str] = None
    notas_calidad: Optional[str] = None


class ElectrocardiogramaData(BaseModel):
    """
    Datos EXTRAÍDOS de trazado electrocardiográfico (ECG).
    NOTA: no incluye diagnóstico — esa capa va en AIPrediagnosisSnapshot.
    """
    paciente: str
    fecha_estudio: str
    ritmo: Optional[str] = Field(default=None, description="Ej: Sinusal, Fibrilación Auricular")
    frecuencia_bpm: Optional[int] = Field(default=None, description="Frecuencia cardíaca en lpm")
    intervalo_pr_ms: Optional[int] = Field(default=None, description="Intervalo PR en milisegundos")
    duracion_qrs_ms: Optional[int] = Field(default=None, description="Duración del QRS en ms")
    qtc_ms: Optional[int] = Field(default=None, description="QTc corregido en ms")
    eje_electrico: Optional[str] = Field(
        default=None, description="Eje eléctrico: Normal, Desviación izquierda/derecha"
    )
    hallazgos: List[str] = Field(
        default_factory=list,
        description="Hallazgos descriptivos (no diagnóstico): ondas, bloqueos, alteraciones de segmento"
    )
    profesional: Optional[str] = None
    notas_calidad: Optional[str] = None


class RiesgoCardiovascularData(BaseModel):
    """
    Datos EXTRAÍDOS de evaluación de riesgo cardiovascular.
    El documento ya contiene el riesgo calculado — la extracción lo recupera.
    NOTA: prediagnóstico IA no soportado en V1 (el cálculo ya está en el documento).
    """
    paciente: str
    fecha_estudio: str
    nivel_riesgo: Optional[str] = Field(
        default=None, description="Ej: Bajo, Moderado, Alto, Muy Alto"
    )
    porcentaje_riesgo: Optional[float] = Field(
        default=None, description="Porcentaje de riesgo a 10 años si está disponible"
    )
    escala_utilizada: Optional[str] = Field(
        default=None, description="Ej: Framingham, OMS/ISH, ACC/AHA ASCVD"
    )
    factores_riesgo: List[str] = Field(
        default_factory=list,
        description="Factores de riesgo identificados en el documento"
    )
    profesional: Optional[str] = None
    notas_calidad: Optional[str] = None


# ---------------------------------------------------------------------------
# IMPL-20260326-02: Formularios internos estructurados — prediagnóstico directo
# Somatometria, AgudezaVisual, ExamenMedico NO requieren OCR; los parámetros
# son capturados directamente por el operador en la interfaz web.
# ---------------------------------------------------------------------------

class SomatometriaData(BaseModel):
    """
    Datos de somatometría y signos vitales capturados directamente en sistema.
    NOTA: sin archivo fuente — los parámetros vienen del formulario interno.
    """
    peso_kg: Optional[float] = Field(default=None, description="Peso corporal en kilogramos")
    talla_m: Optional[float] = Field(default=None, description="Talla en metros")
    imc: Optional[float] = Field(default=None, description="Índice de Masa Corporal kg/m²")
    complexion: Optional[str] = Field(
        default=None,
        description="Ej: NORMAL, SOBREPESO, OBESIDAD, OBESIDAD SEVERA, BAJO PESO"
    )
    ta_sistolica: Optional[float] = Field(default=None, description="TA sistólica mmHg")
    ta_diastolica: Optional[float] = Field(default=None, description="TA diastólica mmHg")
    fc_min: Optional[float] = Field(default=None, description="Frecuencia cardíaca (lpm)")
    fr_min: Optional[float] = Field(default=None, description="Frecuencia respiratoria (rpm)")
    temperatura: Optional[float] = Field(default=None, description="Temperatura corporal °C")
    perimetro_cintura: Optional[float] = Field(default=None, description="Perímetro de cintura cm")
    perimetro_cadera: Optional[float] = Field(default=None, description="Perímetro de cadera cm")
    notas_calidad: Optional[str] = Field(
        default=None,
        description="Observaciones sobre la captura (datos parciales, dudosos, etc.)"
    )


class AgudezaVisualData(BaseModel):
    """
    Datos de agudeza visual capturados directamente en sistema.
    NOTA: sin archivo fuente — los parámetros vienen del formulario interno.
    """
    vision_lejana_od: Optional[str] = Field(default=None, description="Visión lejana ojo derecho (ej: 20/20)")
    vision_lejana_oi: Optional[str] = Field(default=None, description="Visión lejana ojo izquierdo")
    vision_cercana_od: Optional[str] = Field(default=None, description="Visión cercana ojo derecho")
    vision_cercana_oi: Optional[str] = Field(default=None, description="Visión cercana ojo izquierdo")
    lejana_corregida_od: Optional[str] = Field(default=None, description="Visión lejana corregida OD")
    lejana_corregida_oi: Optional[str] = Field(default=None, description="Visión lejana corregida OI")
    cercana_corregida_od: Optional[str] = Field(default=None, description="Visión cercana corregida OD")
    cercana_corregida_oi: Optional[str] = Field(default=None, description="Visión cercana corregida OI")
    reflejos: Optional[str] = Field(default=None, description="Exploración de reflejos pupilares")
    test_ishihara: Optional[str] = Field(default=None, description="Resultado test de Ishihara (visión cromática)")
    campimetria: Optional[str] = Field(default=None, description="Nota de campimetría si se realizó ")
    notas_calidad: Optional[str] = None


class ExamenMedicoData(BaseModel):
    """
    Hallazgos relevantes de exploración física capturados directamente en sistema.
    NOTA: sin archivo fuente — los datos vienen del formulario médico interno.
    Solo se incluyen sistemas con hallazgos documentados (no vacíos).
    """
    neurologico: Optional[str] = None
    cabeza: Optional[str] = None
    ojos: Optional[str] = None
    oidos_cad: Optional[str] = Field(default=None, description="Oído AD")
    oidos_cai: Optional[str] = Field(default=None, description="Oído AI")
    corazon: Optional[str] = None
    campos_pulmonares: Optional[str] = None
    abdomen: Optional[str] = None
    columna_vertebral: Optional[str] = None
    ms_superiores: Optional[str] = Field(default=None, description="Miembros superiores")
    ms_inferiores: Optional[str] = Field(default=None, description="Miembros inferiores")
    impresion_diagnostica: Optional[str] = None
    antecedentes_patologicos: Optional[str] = Field(
        default=None,
        description="Resumen de antecedentes medicoquirúrgicos relevantes"
    )
    hallazgos_relevantes: List[str] = Field(
        default_factory=list,
        description="Lista condensada de hallazgos positivos/negativos relevantes"
    )
    notas_calidad: Optional[str] = None


class ExtractedDataUnion(BaseModel):
    """Unión discriminada de tipos de datos extraídos (capa extractiva)."""
    classification: DocumentClassification
    # IMPL-20260326-17: Añadidos CampimetriaData, ElectrocardiogramaData, RiesgoCardiovascularData
    # IMPL-20260326-02: Añadidos SomatometriaData, AgudezaVisualData, ExamenMedicoData (formularios internos)
    data: Union[AudiometriaData, LaboratorioData, EspirometriaData, RayosXData, CampimetriaData, ElectrocardiogramaData, RiesgoCardiovascularData, SomatometriaData, AgudezaVisualData, ExamenMedicoData, Dict]
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
    # IMPL-20260513-01: Trazabilidad de proveedor clínico y política de calibración
    calibration_source: Optional[Literal["medical_calibration", "general_fallback"]] = Field(
        default=None,
        description="Indica si se usó calibración médica del panel o fallback general en modo sombra"
    )
    clinical_model_used: Optional[str] = Field(
        default=None,
        description="Modelo real utilizado para la capa clínica (ej: gemini-2.5-flash, google/medgemma-27b-text-it)"
    )
    # IMPL-20260513-03: Proveedor clínico real (gemini | featherless)
    clinical_provider: Optional[Literal["gemini", "featherless"]] = Field(
        default=None,
        description="Proveedor backend de la capa clínica: 'gemini' (Gemini text-only) o 'featherless' (MedGemma vía OpenAI SDK)"
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
    # IMPL-20260326-17: Añadidos CampimetriaData, ElectrocardiogramaData, RiesgoCardiovascularData
    # IMPL-20260326-02: Añadidos SomatometriaData, AgudezaVisualData, ExamenMedicoData (formularios internos)
    extracted_data: Union[AudiometriaData, LaboratorioData, EspirometriaData, RayosXData, CampimetriaData, ElectrocardiogramaData, RiesgoCardiovascularData, SomatometriaData, AgudezaVisualData, ExamenMedicoData, Dict]
    missing_fields: List[str] = Field(default_factory=list)
    quality_notes: List[str] = Field(default_factory=list)
    audit: Optional[AIAuditMetadata] = None
