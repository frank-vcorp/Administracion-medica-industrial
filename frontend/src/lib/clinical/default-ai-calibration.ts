/**
 * Lectura única de calibración IA desde `MedicalTest.options.aiCalibration` (BD).
 * Sin prompts hardcodeados ni bootstrap en código: toda calibración debe
 * existir explícitamente en base de datos (administrada desde /admin/services).
 */

import type { AICalibrationV3 } from '@/types/calibration'
import { resolveCurrentPublishedVersion } from '@/lib/calibration-v3-ui'

type JsonRecord = Record<string, unknown>

function isPlainObject(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseOptionsObject(options: unknown): JsonRecord | null {
  if (isPlainObject(options)) return options
  if (typeof options === 'string' && options.trim()) {
    try {
      const parsed: unknown = JSON.parse(options)
      return isPlainObject(parsed) ? parsed : null
    } catch {
      return null
    }
  }
  return null
}

/**
 * Lee exclusivamente la calibración almacenada en `MedicalTest.options.aiCalibration`.
 * Para contratos V3 lee la versión publicada/deshabilitada vigente (sin fallback a
 * draft ni a prompts hardcodeados). Para V1/V2 devuelve el objeto persistido tal cual.
 */
export function readStoredAiCalibrationFromTestOptions(
  options: unknown,
): JsonRecord | null {
  const opts = parseOptionsObject(options)
  if (!opts) return null

  const rawCal = opts.aiCalibration
  if (!isPlainObject(rawCal)) {
    return null
  }

  if (rawCal.schemaVersion === 'V3') {
    const root = rawCal as unknown as AICalibrationV3
    const vigent = resolveCurrentPublishedVersion(root)
    if (!vigent) return null

    const slice: JsonRecord = {
      enabled: vigent.status === 'disabled' ? false : Boolean(vigent.enabled),
      canonicalStudyType: vigent.canonicalStudyType ?? null,
      extraction: vigent.extraction ?? null,
    }
    if (vigent.clinicalCriteria) {
      slice.clinicalCriteria = vigent.clinicalCriteria
    }
    return slice
  }

  return rawCal
}

/**
 * Devuelve únicamente la calibración leída de BD sin inyectar prompts ni
 * bootstrap hardcodeado.
 */
export function resolveAiCalibrationForUpload(
  stored: JsonRecord | null | undefined,
  _studyType?: string | null,
): JsonRecord | null {
  void _studyType
  if (!isPlainObject(stored)) return null
  return Object.keys(stored).length > 0 ? { ...stored } : null
}
