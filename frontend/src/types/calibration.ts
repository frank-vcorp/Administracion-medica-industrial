/**
 * @fileoverview Tipos compartidos para el módulo de Calibración IA Asistida
 *   con Versionado Automático (ARCH-20260327-19).
 * @id IMPL-20260327-19
 * @backup context/SPECs/SPEC_ARCH-20260327-19-CALIBRACION-IA-ASISTIDA-VERSIONADO-AUTOMATICO.md
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
    schemaVersion?: string
    targetFields?: string[]
  }
  diagnosis?: {
    enabled: boolean
    promptVersion?: string
    requiresDoctorCalibration?: boolean
  }
  aiAssistance?: {
    lastSuggestedAt: string
    lastSuggestionSummary: string
    snapshotCount: number
  }
}
