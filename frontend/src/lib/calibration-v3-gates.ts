/**
 * Gates V3 publicados en `MedicalTest.options` (ARCH-20260820-01).
 * Lectura pura para decidir si el resolver en backend bloquearía prediagnóstico.
 */
import type { AICalibrationV3, AICalibrationVersionV3 } from '@/types/calibration'

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseOptions(rawOptions: unknown): Record<string, unknown> {
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

function readV3Root(options: Record<string, unknown>): AICalibrationV3 | null {
  const raw = options.aiCalibration
  if (!isPlainObject(raw)) return null
  if (raw.schemaVersion !== 'V3') return null
  return raw as unknown as AICalibrationV3
}

function resolveVigentPublishedVersion(root: AICalibrationV3): AICalibrationVersionV3 | null {
  const publishedVersions = root.publishedVersions ?? []
  if (publishedVersions.length === 0) return null

  let vigent: AICalibrationVersionV3 | undefined
  if (root.currentPublishedVersionId) {
    vigent = publishedVersions.find((v) => v.versionId === root.currentPublishedVersionId)
  }
  if (!vigent) {
    vigent = publishedVersions.find(
      (v) => v.status === 'published' || v.status === 'disabled',
    )
  }
  return vigent ?? null
}

export type PublishedV3Gates = {
  enabled: boolean
  prediagnosisEnabled: boolean
  /** true si el resolver V3 devolvería calibration_disabled en prediagnóstico */
  blocksPrediagnosisResolver: boolean
}

export function readPublishedV3GatesFromTestOptions(
  rawOptions: unknown,
): PublishedV3Gates | null {
  const options = parseOptions(rawOptions)
  const root = readV3Root(options)
  if (!root) return null

  const vigent = resolveVigentPublishedVersion(root)
  if (!vigent) return null

  const enabled = vigent.status === 'disabled' ? false : Boolean(vigent.enabled)
  const clinical = vigent.clinicalCriteria
  const prediagnosisEnabled =
    clinical?.prediagnosisEnabled !== undefined
      ? Boolean(clinical.prediagnosisEnabled)
      : true

  const blocksPrediagnosisResolver = !enabled || !prediagnosisEnabled

  return {
    enabled,
    prediagnosisEnabled,
    blocksPrediagnosisResolver,
  }
}

/** Legacy V1/V2 `aiCalibration.diagnosis` con prompt usable. */
export function hasLegacyDiagnosisPrompt(rawOptions: unknown): boolean {
  const options = parseOptions(rawOptions)
  const ac = options.aiCalibration
  if (!isPlainObject(ac)) return false
  const diagnosis = ac.diagnosis
  if (!isPlainObject(diagnosis)) return false
  if (diagnosis.enabled === false) return false
  const prompt = diagnosis.prompt
  return typeof prompt === 'string' && prompt.trim().length > 0
}

/**
 * Si el published V3 bloquearía prediagnóstico pero hay prompt legacy,
 * omitir `medical_test_id` para que el backend use `legacy_hardcoded`.
 */
export function shouldOmitMedicalTestIdForLegacyPrediagnosis(
  rawOptions: unknown,
): boolean {
  const gates = readPublishedV3GatesFromTestOptions(rawOptions)
  if (!gates?.blocksPrediagnosisResolver) return false
  return hasLegacyDiagnosisPrompt(rawOptions)
}
