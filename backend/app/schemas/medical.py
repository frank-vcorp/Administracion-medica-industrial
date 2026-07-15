"""
Esquemas Pydantic para extracción estructurada de documentos médicos.
IMPL-20260225-01: Pipeline IA modular - Clasificación y extracción especializada.
IMPL-20260326-16: Separación capa extractiva / capa interpretativa IA (ARCH-20260326-16).
               La extracción NO puede contener diagnóstico_ia, interpretación clínica
               ni recomendaciones de aptitud. Esas capas viven en AIPrediagnosisSnapshot.
"""

from pydantic import BaseModel, Field
from typing import Any, Literal, Union, Dict, List, Optional
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
    IMPL-20260516-07: Campos fuente del formato diagnóstico (faringe, CAD, CAI, MTD, MTI). ARCH-20260516-07.
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
    # IMPL-20260516-07: Campos fuente del formato diagnóstico — opcionales, solo cuando visibles en el documento.
    # La sección de descripción audiométrica narrativa NO debe extraerse (criterio clínico ARCH-20260516-07).
    faringe: Optional[str] = Field(
        default=None,
        description="Estado de la faringe si visible en el formato clínico (campo fuente)"
    )
    cad: Optional[str] = Field(
        default=None,
        description="Conducto auditivo externo derecho (CAD) — hallazgo del formato fuente"
    )
    cai: Optional[str] = Field(
        default=None,
        description="Conducto auditivo externo izquierdo (CAI) — hallazgo del formato fuente"
    )
    mtd: Optional[str] = Field(
        default=None,
        description="Membrana timpánica derecha (MTD) — hallazgo del formato fuente"
    )
    mti: Optional[str] = Field(
        default=None,
        description="Membrana timpánica izquierda (MTI) — hallazgo del formato fuente"
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


# ---------------------------------------------------------------------------
# IMPL-20260516-12: Espirometría — Sub-modelos de extracción exhaustiva (ARCH-20260516-12)
# Bloques del layout real AMI: paciente_detalle, estudio, condiciones, parametros, calidad, graficas.
# ---------------------------------------------------------------------------

class EspirometriaParamRow(BaseModel):
    """
    Fila tabular del cuadro de parámetros espirométricos.
    IMPL-20260516-12: Mapeo canónico label→key con valores M1/M2/M3, REF y LLN.
    """
    label: str = Field(description="Etiqueta literal de la fila como aparece en el documento")
    key: Optional[str] = Field(
        default=None,
        description="Clave canónica normalizada (ej: fev1_l, fvc_l, fef25_75_l_s). None si no se puede mapear."
    )
    unidad: Optional[str] = Field(default=None, description="Unidad de medida (ej: L, L/s, %)")
    m1: Optional[float] = Field(default=None, description="Valor maniobra 1")
    m1_pct_ref: Optional[float] = Field(default=None, description="% del referencial para M1")
    m2: Optional[float] = Field(default=None, description="Valor maniobra 2")
    m2_pct_ref: Optional[float] = Field(default=None, description="% del referencial para M2")
    m3: Optional[float] = Field(default=None, description="Valor maniobra 3")
    m3_pct_ref: Optional[float] = Field(default=None, description="% del referencial para M3")
    ref: Optional[float] = Field(default=None, description="Valor referencial del predicho")
    lln: Optional[float] = Field(default=None, description="Límite inferior de la normalidad (LLN)")


class EspirometriaPacienteDetalle(BaseModel):
    """Metadatos demográficos del paciente extraídos del layout espirométrico. IMPL-20260516-12."""
    nombre_completo: Optional[str] = None
    sexo: Optional[str] = None
    edad_anios: Optional[float] = None
    talla_cm: Optional[float] = None
    peso_kg: Optional[float] = None
    imc: Optional[float] = None
    fuma: Optional[str] = None
    motivo: Optional[str] = None
    procedencia: Optional[str] = None


class EspirometriaEstudio(BaseModel):
    """Metadatos del estudio espirométrico (referencia, equipo, versión). IMPL-20260516-12."""
    referencia: Optional[str] = None
    fecha_estudio: Optional[str] = None
    hora_estudio: Optional[str] = None
    tipo_reporte: Optional[str] = None
    equipo_modelo: Optional[str] = None
    version_software: Optional[str] = None


class EspirometriaCondiciones(BaseModel):
    """Condiciones ambientales y técnicas de adquisición. IMPL-20260516-12."""
    temperatura_c: Optional[float] = None
    presion_mmhg: Optional[float] = None
    humedad_pct: Optional[float] = None
    tecnico: Optional[str] = None
    transductor: Optional[str] = None
    referencia_ecuacion: Optional[str] = None
    factor_etnico: Optional[str] = None
    factor_btps: Optional[str] = Field(default=None, description="Factor de corrección BTPS")


class EspirometriaCalidad(BaseModel):
    """Calidad técnica y repetibilidad ATS/ERS del estudio. IMPL-20260516-12."""
    repetibilidad_ats_ers_fvc: Optional[str] = Field(
        default=None,
        description="Resultado de repetibilidad ATS/ERS para FVC (ej: Aceptable, No aceptable)"
    )
    repetibilidad_ats_ers_fev1: Optional[str] = Field(
        default=None,
        description="Resultado de repetibilidad ATS/ERS para FEV1"
    )
    es_interpretable: Optional[bool] = Field(
        default=None,
        description="True si el estudio tiene mínimos para interpretación clínica"
    )
    completitud_documental: Optional[Literal["suficiente", "parcial", "no_concluyente"]] = None
    notas_calidad: Optional[str] = None


class EspirometriaGraficas(BaseModel):
    """Presencia y observaciones de curvas gráficas del estudio. IMPL-20260516-12."""
    curva_flujo_volumen_presente: Optional[bool] = None
    curva_volumen_tiempo_presente: Optional[bool] = None
    maniobras_graficadas: Optional[int] = None
    observaciones_grafica: Optional[str] = None


class EspirometriaData(BaseModel):
    """
    Datos EXTRAÍDOS de prueba de función pulmonar.
    IMPL-20260513-01: Añadidos campos de broncodilatador, interpretabilidad y completitud.
    IMPL-20260516-12: Extracción exhaustiva con bloques paciente_detalle/estudio/condiciones/
                     parametros/calidad/graficas (ARCH-20260516-12).
                     Los campos legacy (fev1, fvc, etc.) se conservan para compatibilidad hacia atrás;
                     la extracción nueva los sigue populando desde la tabla fuente.
    NOTA: no incluye diagnóstico — esa capa va en AIPrediagnosisSnapshot.
    """
    # --- Campos raíz (backward compat y acceso rápido al pipeline) ---
    paciente: str
    fecha_estudio: str
    # --- Legacy flat fields: siguen populándose en la extracción nueva para no romper pipeline ---
    fev1: Optional[float] = Field(default=None, description="FEV1 en litros (mejor valor disponible)")
    fvc: Optional[float] = Field(default=None, description="FVC en litros (mejor valor disponible)")
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
        description="True si tiene fev1+fvc mínimos (legacy; usar calidad.es_interpretable si disponible)"
    )
    completitud_documental: Optional[Literal["suficiente", "parcial", "no_concluyente"]] = Field(
        default=None,
        description="Completitud documental (legacy; usar calidad.completitud_documental si disponible)"
    )
    notas_calidad: Optional[str] = Field(
        default=None,
        description="Notas de calidad (legacy; usar calidad.notas_calidad si disponible)"
    )
    # --- Bloques exhaustivos nuevos (ARCH-20260516-12) ---
    paciente_detalle: Optional[EspirometriaPacienteDetalle] = Field(
        default=None,
        description="Metadatos demográficos del paciente extraídos del layout"
    )
    estudio: Optional[EspirometriaEstudio] = Field(
        default=None,
        description="Metadatos del estudio (referencia, equipo, versión)"
    )
    condiciones: Optional[EspirometriaCondiciones] = Field(
        default=None,
        description="Condiciones de adquisición (temperatura, presión, humedad)"
    )
    parametros: Optional[List[EspirometriaParamRow]] = Field(
        default=None,
        description="Tabla exhaustiva de parámetros espirométricos con M1/M2/M3, REF y LLN"
    )
    calidad: Optional[EspirometriaCalidad] = Field(
        default=None,
        description="Calidad técnica y repetibilidad ATS/ERS del estudio"
    )
    graficas: Optional[EspirometriaGraficas] = Field(
        default=None,
        description="Presencia y observaciones de curvas gráficas"
    )


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


class PrediagnosisInputDebug(BaseModel):
    """
    IMPL-20260516-08: Payload de entrada clínica enviado al modelo de prediagnóstico.
    Persiste lo que llegó a la capa MedGemma/Gemini para trazabilidad y calibración.
    GUARDRAIL: NO contiene API keys, tokens ni secretos del proveedor. ARCH-20260516-08.
    """
    study_type: str
    extracted_data: Dict[str, Any] = Field(default_factory=dict)
    medical_calibration: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Calibración médica aplicada (dict clínico sin credenciales)"
    )
    clinical_provider: Optional[str] = None
    clinical_model_used: Optional[str] = None
    rendered_prompt: Optional[str] = Field(
        default=None,
        description="Prompt textual renderizado y enviado al modelo clínico"
    )


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
    # IMPL-20260516-06: Recomendación clínica prudente (ARCH-20260516-06)
    # Solo seguimiento, correlación o vigilancia preventiva.
    # PROHIBIDO: aptitud laboral, dictamen final, incapacidad, alta/baja, tratamiento prescriptivo.
    recommendation: Optional[str] = Field(
        default=None,
        description=(
            "Recomendación clínica breve (1-2 oraciones) de seguimiento, correlación o vigilancia. "
            "Nunca expresa aptitud laboral, dictamen final ni tratamiento prescriptivo. "
            "None si el estudio es no concluyente o el campo no aplica."
        )
    )
    non_conclusive_reason: Optional[str] = Field(
        default=None,
        description="Si clinical_state=AI_NON_CONCLUSIVE, razón explícita"
    )
    # ARCH-20260715-03: Campos derivados de Audiometría (predx-audiometria-v2-derivado).
    # Opcionales porque solo aplican a Audiometría; otros estudios no los generan.
    # Se usa Dict[str, Any] y no modelos anidados para no sobre-especificar en V1
    # y mantener compatibilidad con estudios donde estos bloques no existen.
    resumen_por_oido: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Audiometría: PTA, status, severity, pattern y basis por oído (OD/OI)."
    )
    resumen_bilateral: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Audiometría: status global, lateralidad, simetría y nota clínica bilateral."
    )
    clasificacion_hipoacusia: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Audiometría: clasificación de hipoacusia por oído y bilateral con confianza."
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
    # IMPL-20260518-03: Fuente real del prompt clínico (ARCH-20260518-03)
    prompt_source: Optional[Literal["ai_calibration", "backend_fallback"]] = Field(
        default=None,
        description=(
            "Fuente real del prompt clínico usado: "
            "'ai_calibration' si vino de aiCalibration.diagnosis.prompt, "
            "'backend_fallback' si se usó el prompt backend hardcodeado"
        )
    )
    # IMPL-20260518-03: Versión real del prompt clínico usado (ARCH-20260518-03)
    prompt_version: Optional[str] = Field(
        default=None,
        description=(
            "Versión real del prompt clínico usado: versión de calibración si viene de aiCalibration, "
            "'backend_v2' si se usó fallback general backend."
        )
    )
    # IMPL-20260516-08: RAW de entrada clínica — payload enviado al modelo (ARCH-20260516-08)
    input_debug: Optional["PrediagnosisInputDebug"] = Field(
        default=None,
        description="Payload estructurado de entrada enviado a la capa clínica (para trazabilidad sin secretos)"
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
