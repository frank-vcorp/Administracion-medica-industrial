/**
 * Calibración mínima embebida cuando el MedicalTest en BD no tiene
 * `options.aiCalibration.extraction.prompt` (bootstrap operativo AMI).
 * No sustituye calibración publicada en admin; solo evita EXTRACTION_PROMPT_NOT_CONFIGURED.
 */

import type { AICalibrationV3 } from '@/types/calibration'
import { getV3PublishedAiCalibrationSlice } from '@/lib/calibration-v3-ui'

export const ECG_EXTRACTION_VERSION = 'ecg-ami-bootstrap-v1'

export const ECG_EXTRACTION_PROMPT = `EXTRACCIÓN DE ELECTROCARDIOGRAMA (ECG / Electrocardiograma)

Devuelve SOLO un objeto JSON válido. Sin markdown, sin comentarios, sin bloques <think>. JSON único que empieza con { y termina con }.

Campos esperados:
{
  "paciente": "nombre del paciente en el reporte",
  "fecha_estudio": "fecha del estudio tal como aparece",
  "ritmo": "ej. Sinusal, Fibrilación auricular, o null",
  "frecuencia_bpm": número entero o null,
  "intervalo_pr_ms": número entero o null,
  "duracion_qrs_ms": número entero o null,
  "qtc_ms": número entero o null,
  "eje_electrico": "Normal, Desviación izquierda/derecha, o null",
  "hallazgos": ["descripción objetiva del trazado, sin diagnóstico definitivo"],
  "profesional": "médico o firmante si aparece, o null",
  "notas_calidad": "calidad del documento o null"
}

REGLAS:
- NO inventes valores; usa null si no son legibles.
- NO incluyas diagnóstico final, aptitud laboral ni tratamiento.
- "hallazgos" = descripciones del trazado (ondas, bloqueos, ST-T, etc.).
- frecuencia_bpm, intervalos y qtc deben ser números (no strings) cuando sean legibles.
`

type JsonRecord = Record<string, unknown>

function hasExtractionPrompt(aiCalibration: JsonRecord | null | undefined): boolean {
  if (!aiCalibration || typeof aiCalibration !== 'object') return false
  const extraction = aiCalibration.extraction
  if (!extraction || typeof extraction !== 'object' || Array.isArray(extraction)) return false
  const prompt = (extraction as JsonRecord).prompt
  return typeof prompt === 'string' && prompt.trim().length > 0
}

function isEcgStudyType(studyType: string | null | undefined): boolean {
  const type = (studyType ?? '').trim()
  return (
    type === 'Electrocardiograma' ||
    type === 'ECG' ||
    type.toLowerCase() === 'ekg'
  )
}

function bootstrapForStudyType(studyType: string | null | undefined): JsonRecord | null {
  if (isEcgStudyType(studyType)) {
    return {
      enabled: true,
      canonicalStudyType: 'ECG',
      extraction: {
        prompt: ECG_EXTRACTION_PROMPT,
        version: ECG_EXTRACTION_VERSION,
      },
      bootstrap: true,
    }
  }
  return null
}

/** Lee calibración legacy o el slice de la versión V3 publicada (prompt en publishedVersions). */
export function readStoredAiCalibrationFromTestOptions(
  options: unknown,
): JsonRecord | null {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    return null
  }
  const rawCal = (options as JsonRecord).aiCalibration
  if (!rawCal || typeof rawCal !== 'object' || Array.isArray(rawCal)) {
    return null
  }
  const cal = rawCal as JsonRecord
  if (cal.schemaVersion === 'V3') {
    const slice = getV3PublishedAiCalibrationSlice(cal as unknown as AICalibrationV3)
    return slice ?? null
  }
  return cal
}

/** Fusiona calibración de BD con bootstrap AMI si falta prompt de extracción. */
export function resolveAiCalibrationForUpload(
  stored: JsonRecord | null | undefined,
  studyType: string | null | undefined,
): JsonRecord | null {
  const base: JsonRecord =
    stored && typeof stored === 'object' && !Array.isArray(stored) ? { ...stored } : {}

  if (hasExtractionPrompt(base)) {
    return Object.keys(base).length > 0 ? base : null
  }

  const bootstrap = bootstrapForStudyType(studyType)
  if (!bootstrap) {
    return Object.keys(base).length > 0 ? base : null
  }

  const baseExtraction =
    base.extraction && typeof base.extraction === 'object' && !Array.isArray(base.extraction)
      ? (base.extraction as JsonRecord)
      : {}

  const bootExtraction =
    bootstrap.extraction && typeof bootstrap.extraction === 'object'
      ? (bootstrap.extraction as JsonRecord)
      : {}

  return {
    ...base,
    enabled: base.enabled ?? bootstrap.enabled,
    canonicalStudyType: base.canonicalStudyType ?? bootstrap.canonicalStudyType,
    extraction: { ...baseExtraction, ...bootExtraction },
    bootstrap: true,
  }
}
