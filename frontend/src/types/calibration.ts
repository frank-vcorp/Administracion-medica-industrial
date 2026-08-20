/**
 * @fileoverview Tipos compartidos para el módulo de Calibración IA Asistida
 *   con Versionado Automático (ARCH-20260327-19).
 * @id IMPL-20260327-19
 * @backup context/SPECs/SPEC_ARCH-20260327-19-CALIBRACION-IA-ASISTIDA-VERSIONADO-AUTOMATICO.md
 * @intervention IMPL-20260604-01
 * @backup context/SPECs/SPEC_ARCH-20260604-01-CALIBRACION-PRESENTACION-ESTUDIOS-IA.md
 */

// ─────────────────────────────────────────────────────────────────────────────
// Candidato de campo — salida del análisis heurístico de snapshots
// ─────────────────────────────────────────────────────────────────────────────

export type CandidateFieldType = "text" | "number" | "boolean" | "date" | "unknown"
export type CandidateRecommendation = "accept" | "review" | "discard"

export interface CandidateField {
  key: string
  label: string
  type: CandidateFieldType
  /** Número de snapshots en los que aparece este campo */
  frequency: number
  /** Total de snapshots analizados */
  totalSnapshots: number
  /** Hasta 3 valores de ejemplo observados */
  exampleValues: string[]
  /** Porcentaje de aparición (0-100) */
  confidence: number
  /** Aliases detectados (por ahora vacío, reservado para futuras iteraciones) */
  aliases: string[]
  recommendation: CandidateRecommendation
}

// ─────────────────────────────────────────────────────────────────────────────
// Entrada de historial de versiones
// ─────────────────────────────────────────────────────────────────────────────

export interface CalibrationVersion {
  version: number
  label: string
  createdAt: string
  source: "manual-review" | "ai-assisted-review" | "candidate-promotion"
  summary: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Contrato aiCalibration V2 completo (en MedicalTest.options.aiCalibration)
// ─────────────────────────────────────────────────────────────────────────────

export interface FieldDefinition {
  key: string
  label: string
  type: CandidateFieldType
  aliases: string[]
  required: boolean
  unit?: string
}

export type PresentationSectionKind =
  | "keyValue"
  | "table"
  | "note"
  | "badges"
  | "bilateralFrequency"

export interface PresentationColumn {
  key: string
  label: string
}

export type PresentationSection =
  | {
      kind: "keyValue"
      title: string
      sourceKey?: string
      fields: string[]
    }
  | {
      kind: "table"
      title: string
      source: string
      columns: PresentationColumn[]
    }
  | {
      kind: "note"
      title: string
      source: string
    }
  | {
      kind: "badges"
      title: string
      sourceKey?: string
      fields: string[]
    }
  | {
      kind: "bilateralFrequency"
      title: string
      rightKey: string
      leftKey: string
      preferredOrder?: number[]
    }

export interface StudyPresentationSchema {
  studyType: string
  sections: PresentationSection[]
}

export interface PresentationCalibration {
  enabled: boolean
  schema: StudyPresentationSchema | null
  lastSuggestedAt?: string
  lastSuggestionModel?: string
  lastSuggestionSummary?: string
}

export interface AICalibrationV2 {
  /** Versión actual del contrato efectivo */
  currentVersion: number
  currentVersionLabel: string
  updatedAt: string
  versions: CalibrationVersion[]
  /** Borrador de definición de campos (pendiente de promoción) */
  draft?: {
    fieldDefinitions: FieldDefinition[]
  }
  /** Definición efectiva de campos (vigente) */
  fieldDefinitions?: FieldDefinition[]
  /** Espejo de los campos de la V1 para compatibilidad */
  enabled?: boolean
  canonicalStudyType?: string
  extraction?: {
    enabled: boolean
    prompt?: string
    version?: string
    schemaVersion?: string
    targetFields?: string[]
    // ARCH-20260809-02: selector runtime de proveedor extractivo.
    // `provider` ausente se trata como "gemini" (migración legacy implícita).
    provider?: "gemini" | "m3"
    /** Modelo explícito del proveedor; si ausente se usa default de proceso. */
    model?: string
  }
  diagnosis?: {
    enabled: boolean
    prompt?: string
    version?: string
    promptVersion?: string
    requiresDoctorCalibration?: boolean
  }
  presentation?: PresentationCalibration
  aiAssistance?: {
    lastSuggestedAt: string
    lastSuggestionSummary: string
    snapshotCount: number
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Contrato aiCalibration V3 (ARCH-20260820-01 Fase 2)
// @spec context/SPECs/SPEC_ARCH-20260820-01-CALIBRACION-FUENTE-UNICA.md §5
// @decision DEC-20260820-02 (operationMode) + FND-20260820-04 (familyTemplate)
//
// El contrato V3 unifica activación, tipo canónico, extracción, interpretación
// clínica y presentación bajo un mismo versionado con estados explícitos de
// publicación. V1/V2 siguen siendo legibles vía el adaptador del resolver
// (backend) y permanecen operativos hasta Fase 7.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Clasificación operativa de cada entrada del catálogo `MedicalTest`
 * (DEC-20260820-02). Vive en `MedicalTest.options.operationMode`, NO dentro
 * de una versión de calibración. Determina capacidades de IA y existencia
 * del editor de calibración.
 *
 * - `manual_service`: sin IA. No existe bloque `aiCalibration`. Sin editor.
 * - `document_extraction`: extracción configurable + presentación. Sin
 *   `clinicalCriteria` (no hay prediagnóstico).
 * - `clinical_interpretation`: extracción + criterios clínicos + prediagnóstico
 *   + presentación. Editor completo.
 */
export type OperationMode = "manual_service" | "document_extraction" | "clinical_interpretation"

/**
 * Estados de una versión V3 (SPEC §6.1). Los estados `published`,
 * `superseded` y `disabled` son inmutables post-publicación. `draft` y
 * `tested` son mutables (edición en curso).
 */
export type CalibrationVersionStatus = "draft" | "tested" | "published" | "superseded" | "disabled"

/**
 * Criterios clínicos configurables (SPEC §5.2). SOLO aplica a
 * `operationMode = clinical_interpretation`. Para `document_extraction`,
 * `clinicalCriteria` es `null`/ausente (no hay prediagnóstico).
 * Reemplaza a `REQUIRED_PARAMS`, `CONFIDENCE_THRESHOLDS`,
 * `PREDIAGNOSIS_SUPPORTED_TYPES` y `PREDIAGNOSTIC_PROMPTS` hardcodeados.
 */
export interface ClinicalCriteria {
  /** Reemplaza PREDIAGNOSIS_SUPPORTED_TYPES. */
  prediagnosisEnabled: boolean
  /** Reemplaza REQUIRED_PARAMS[study_type]. */
  requiredParams: string[]
  /** Reemplaza CONFIDENCE_THRESHOLDS[study_type]. */
  confidenceThreshold: number | null
  /** Reemplaza PREDIAGNOSTIC_PROMPTS[study_type]. */
  prompt: string | null
  /** Hash sha256 del prompt para auditoría sin duplicar texto. */
  promptHash?: string | null
  promptVersion?: string | null
  /** Referencias normativas que respaldan el criterio. */
  supportingReferences?: Array<{
    source_id: string
    title: string
    section?: string
    excerpt?: string
    version_or_date?: string
  }>
}

/**
 * Capa de extracción V3 (SPEC §5.2). Hereda provider/model de
 * ARCH-20260809-02.
 */
export interface AICalibrationExtractionV3 {
  enabled: boolean
  prompt: string | null
  promptHash?: string | null
  version?: string | null
  schemaVersion?: string | null
  targetFields?: string[]
  provider?: "gemini" | "m3"
  model?: string | null
}

/**
 * Capa de presentación V3 (SPEC §5.2). Reutiliza `StudyPresentationSchema`
 * de ARCH-20260604-01.
 */
export interface AICalibrationPresentationV3 {
  enabled: boolean
  schema: StudyPresentationSchema | null
  schemaHash?: string | null
}

/**
 * Referencia normativa dentro de una versión publicada.
 */
export interface SupportingReference {
  source_id: string
  title: string
  section?: string
  excerpt?: string
  version_or_date?: string
}

/**
 * Versión publicada V3 (inmutable post-publish) — SPEC §5.2.
 *
 * Condicionalidad por modo (DEC-20260820-02):
 * - `extraction`, `fieldDefinitions`, `presentation` aplican a
 *   `document_extraction` y `clinical_interpretation`.
 * - `clinicalCriteria` aplica **solo** a `clinical_interpretation`. Para
 *   `document_extraction` es `null`/ausente.
 * - `operationMode` no se duplica en la versión (vive en `MedicalTest.options`).
 */
export interface AICalibrationVersionV3 {
  /** UUID único, inmutable. */
  versionId: string
  /** Entero monótono por MedicalTest. */
  versionNumber: number
  label: string
  status: "published" | "superseded" | "disabled"
  publishedAt: string
  publishedBy: string | null
  supersededAt?: string | null
  supersededByVersionId?: string | null
  /** Gate global por prueba (H1). */
  enabled: boolean
  /** Gate routing (H2, H3, H10). */
  canonicalStudyType: string | null
  extraction: AICalibrationExtractionV3
  fieldDefinitions: FieldDefinition[]
  /** Solo clinical_interpretation; null/ausente en document_extraction. */
  clinicalCriteria: ClinicalCriteria | null
  presentation: AICalibrationPresentationV3
}

/**
 * Draft V3 (mutable) — SPEC §5.3. Misma estructura que la versión publicada
 * pero con `status: draft | tested`, sin `versionId` asignado (se asigna al
 * publicar), y `publishedAt`/`publishedBy` nulos. Cada save del editor
 * actualiza el draft.
 */
export interface AICalibrationDraftV3 {
  status: "draft" | "tested"
  label: string
  enabled: boolean
  canonicalStudyType: string | null
  extraction: AICalibrationExtractionV3
  fieldDefinitions: FieldDefinition[]
  /** Solo clinical_interpretation; null en document_extraction. */
  clinicalCriteria: ClinicalCriteria | null
  presentation: AICalibrationPresentationV3
  /** Timestamp del último save del draft (auditoría de edición). */
  updatedAt?: string
}

/**
 * Overrides por prueba miembro de una familia (SPEC §5.6, FND-20260820-04).
 * Solo los campos que difieren de la plantilla de familia; ausente = hereda.
 * Un override puede añadir/reemplazar `fieldDefinitions` por analito, pero
 * **no** eliminar los `required` de la plantilla (gate G9).
 */
export interface AICalibrationOverridesV3 {
  fieldDefinitions?: FieldDefinition[]
  extraction?: Partial<AICalibrationExtractionV3>
  presentation?: Partial<AICalibrationPresentationV3>
  clinicalCriteria?: ClinicalCriteria | null
}

/**
 * Snapshot del último estado V1/V2 al migrar (SPEC §5.1, §11.2). Se congela
 * al primer publish material desde V1/V2 (CA-G15). Publicaciones posteriores
 * no lo sobrescriben. Solo auditoría.
 */
export interface LegacyV1V2Snapshot {
  /** Copia fiel del JSON V1/V2 al momento de la primera publicación V3. */
  snapshot: Record<string, unknown>
  migratedAt: string
  migratedBy: string | null
  /** Schema version origen ("V1" | "V2" | "V1V2"). */
  sourceSchemaVersion: string
}

/**
 * Raíz del contrato `aiCalibration` V3 (SPEC §5.1). Solo existe si
 * `MedicalTest.options.operationMode != manual_service`.
 *
 * Pendiente (P-04/P-05, SPEC §21): `familyTemplateId` es `null` para todas
 * las pruebas hasta que ATLAS/Frank confirmen el catálogo de plantillas. No
 * inventar contenido del catálogo.
 */
export interface AICalibrationV3 {
  schemaVersion: "V3"
  /** ID de la versión `published` vigente; null si nunca publicada. */
  currentPublishedVersionId: string | null
  /** null para pruebas sin familia (Audiometría, ECG, etc.) hasta P-04. */
  familyTemplateId: string | null
  overrides?: AICalibrationOverridesV3
  /** Borrador en curso (mutable). null si no hay edición. */
  draft: AICalibrationDraftV3 | null
  /** Solo versiones published/superseded/disabled, inmutables. */
  publishedVersions: AICalibrationVersionV3[]
  /** Congelado al primer publish desde V1/V2; null si no aplica. */
  legacyV1V2Snapshot: LegacyV1V2Snapshot | null
}

// ─────────────────────────────────────────────────────────────────────────────
// IMPL-20260715-04 — Resultado de upload de PDF de prueba en calibración.
// SPEC: context/SPECs/SPEC_ARCH-20260715-04-UPLOAD-PDFS-CALIBRACION.md
// Contrato entre el backend (POST /api/v1/calibration/upload) y el frontend.
// NO se persiste en DB; vive solo en memoria del backend durante la sesión.
// ─────────────────────────────────────────────────────────────────────────────

export interface CalibrationTestExtractionResult {
  structured_data: Record<string, unknown>
  raw_payload: Record<string, unknown>
  model_used: string
  prompt_version: string
  duration_seconds: number
  // ARCH-20260809-02: trazabilidad del selector multi-proveedor (Gemini + MiniMax M3).
  extraction_provider_used?: "gemini" | "m3" | "xml_parser"
  extraction_provider_requested?: "gemini" | "m3" | "xml_parser"
  extraction_fallback_reason?: string | null
}

export interface CalibrationTestPrediagnosisResult {
  result: Record<string, unknown>
  model_used: string
  prompt_version: string
  duration_seconds: number
}

export interface CalibrationTestResults {
  success: boolean
  test_id: string
  canonical_study_type?: string
  extraction: CalibrationTestExtractionResult
  prediagnosis: CalibrationTestPrediagnosisResult
  created_at?: string
}
