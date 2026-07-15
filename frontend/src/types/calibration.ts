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
