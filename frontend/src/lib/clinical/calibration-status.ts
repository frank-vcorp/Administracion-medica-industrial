/**
 * Derivación pura del estado de calibración IA por prueba (`MedicalTest.options`)
 * en modo oración para la tabla y editor de `/admin/services`.
 */

import type { AICalibrationV3, OperationMode } from '@/types/calibration'
import { isOperationModeValue, resolveCurrentPublishedVersion } from '@/lib/calibration-v3-ui'

export type CalibrationStatusKind =
  | 'calibrated'
  | 'partial'
  | 'draft_only'
  | 'disabled'
  | 'manual_service'
  | 'missing'

export interface MedicalTestCalibrationStatus {
  kind: CalibrationStatusKind
  /** Etiqueta principal en modo oración. */
  label: string
  /** Descripción breve en modo oración. */
  detail: string
  operationMode: OperationMode | null
  hasExtractionPrompt: boolean
  hasClinicalPrompt: boolean
  /** True si falta calibrar o está pendiente de publicar/completar. */
  needsCalibration: boolean
  schemaMode: 'v3_published' | 'v3_draft' | 'v1_v2' | 'none'
}

type JsonRecord = Record<string, unknown>

function isPlainObject(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseOptions(rawOptions: unknown): JsonRecord {
  if (isPlainObject(rawOptions)) return rawOptions
  if (typeof rawOptions === 'string' && rawOptions.trim()) {
    try {
      const parsed: unknown = JSON.parse(rawOptions)
      return isPlainObject(parsed) ? parsed : {}
    } catch {
      return {}
    }
  }
  return {}
}

function nonEmptyPrompt(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0
}

export function getMedicalTestCalibrationStatus(
  rawOptions: unknown,
): MedicalTestCalibrationStatus {
  const options = parseOptions(rawOptions)
  const operationMode = isOperationModeValue(options.operationMode)
    ? options.operationMode
    : null

  if (operationMode === 'manual_service') {
    return {
      kind: 'manual_service',
      label: 'Servicio manual sin IA',
      detail: 'No requiere calibración de prompts.',
      operationMode,
      hasExtractionPrompt: false,
      hasClinicalPrompt: false,
      needsCalibration: false,
      schemaMode: 'none',
    }
  }

  const rawCal = options.aiCalibration
  if (!isPlainObject(rawCal)) {
    return {
      kind: 'missing',
      label: 'Falta calibrar',
      detail: 'Sin configuración de prompts en base de datos.',
      operationMode,
      hasExtractionPrompt: false,
      hasClinicalPrompt: false,
      needsCalibration: true,
      schemaMode: 'none',
    }
  }

  // Contrato V3
  if (rawCal.schemaVersion === 'V3') {
    const root = rawCal as unknown as AICalibrationV3
    const vigent = resolveCurrentPublishedVersion(root)

    if (!vigent) {
      const draft = root.draft
      const draftExt = nonEmptyPrompt(draft?.extraction?.prompt)
      const draftClin = nonEmptyPrompt(draft?.clinicalCriteria?.prompt)
      if (draft && (draftExt || draftClin)) {
        return {
          kind: 'draft_only',
          label: 'Borrador pendiente de publicar',
          detail: 'Hay un borrador guardado que aún debe publicarse.',
          operationMode,
          hasExtractionPrompt: draftExt,
          hasClinicalPrompt: draftClin,
          needsCalibration: true,
          schemaMode: 'v3_draft',
        }
      }
      return {
        kind: 'missing',
        label: 'Falta calibrar',
        detail: 'Sin versión publicada ni prompts configurados.',
        operationMode,
        hasExtractionPrompt: false,
        hasClinicalPrompt: false,
        needsCalibration: true,
        schemaMode: 'none',
      }
    }

    const isDisabled = vigent.status === 'disabled' || vigent.enabled === false
    const hasExt = nonEmptyPrompt(vigent.extraction?.prompt)
    const hasClin = nonEmptyPrompt(vigent.clinicalCriteria?.prompt)

    if (isDisabled) {
      return {
        kind: 'disabled',
        label: 'Calibración deshabilitada',
        detail: 'La versión publicada tiene la IA desactivada.',
        operationMode,
        hasExtractionPrompt: hasExt,
        hasClinicalPrompt: hasClin,
        needsCalibration: false,
        schemaMode: 'v3_published',
      }
    }

    if (operationMode === 'document_extraction') {
      return hasExt
        ? {
            kind: 'calibrated',
            label: 'Calibrada (solo extracción)',
            detail: 'Prompt de extracción publicado.',
            operationMode,
            hasExtractionPrompt: true,
            hasClinicalPrompt: false,
            needsCalibration: false,
            schemaMode: 'v3_published',
          }
        : {
            kind: 'missing',
            label: 'Falta calibrar',
            detail: 'Falta prompt de extracción en versión publicada.',
            operationMode,
            hasExtractionPrompt: false,
            hasClinicalPrompt: false,
            needsCalibration: true,
            schemaMode: 'v3_published',
          }
    }

    if (hasExt && hasClin) {
      return {
        kind: 'calibrated',
        label: 'Calibrada (extracción y prediagnóstico)',
        detail: 'Ambos prompts publicados y activos.',
        operationMode,
        hasExtractionPrompt: true,
        hasClinicalPrompt: true,
        needsCalibration: false,
        schemaMode: 'v3_published',
      }
    }

    if (hasExt || hasClin) {
      return {
        kind: 'partial',
        label: hasExt ? 'Solo extracción configurada' : 'Solo prediagnóstico configurado',
        detail: hasExt
          ? 'Falta configurar el prompt de prediagnóstico.'
          : 'Falta configurar el prompt de extracción.',
        operationMode,
        hasExtractionPrompt: hasExt,
        hasClinicalPrompt: hasClin,
        needsCalibration: true,
        schemaMode: 'v3_published',
      }
    }

    return {
      kind: 'missing',
      label: 'Falta calibrar',
      detail: 'Sin prompts configurados en versión publicada.',
      operationMode,
      hasExtractionPrompt: false,
      hasClinicalPrompt: false,
      needsCalibration: true,
      schemaMode: 'v3_published',
    }
  }

  // Contrato V1 / V2
  const ext = isPlainObject(rawCal.extraction) ? rawCal.extraction : null
  const diag = isPlainObject(rawCal.diagnosis) ? rawCal.diagnosis : null
  const cc = isPlainObject(rawCal.clinicalCriteria) ? rawCal.clinicalCriteria : null

  const hasExt = nonEmptyPrompt(ext?.prompt)
  const hasClin = nonEmptyPrompt(diag?.prompt) || nonEmptyPrompt(cc?.prompt)

  if (rawCal.enabled === false) {
    return {
      kind: 'disabled',
      label: 'Calibración deshabilitada',
      detail: 'Calibración desactivada manualmente en pruebas.',
      operationMode,
      hasExtractionPrompt: hasExt,
      hasClinicalPrompt: hasClin,
      needsCalibration: false,
      schemaMode: 'v1_v2',
    }
  }

  if (hasExt && hasClin) {
    return {
      kind: 'calibrated',
      label: 'Calibrada (extracción y prediagnóstico)',
      detail: 'Prompts de extracción y prediagnóstico activos en base de datos.',
      operationMode,
      hasExtractionPrompt: true,
      hasClinicalPrompt: true,
      needsCalibration: false,
      schemaMode: 'v1_v2',
    }
  }

  if (hasExt || hasClin) {
    return {
      kind: 'partial',
      label: hasExt ? 'Solo extracción configurada' : 'Solo prediagnóstico configurado',
      detail: hasExt
        ? 'Falta configurar el prompt de prediagnóstico.'
        : 'Falta configurar el prompt de extracción.',
      operationMode,
      hasExtractionPrompt: hasExt,
      hasClinicalPrompt: hasClin,
      needsCalibration: true,
      schemaMode: 'v1_v2',
    }
  }

  return {
    kind: 'missing',
    label: 'Falta calibrar',
    detail: 'Sin prompts de extracción ni prediagnóstico configurados.',
    operationMode,
    hasExtractionPrompt: false,
    hasClinicalPrompt: false,
    needsCalibration: true,
    schemaMode: 'v1_v2',
  }
}
