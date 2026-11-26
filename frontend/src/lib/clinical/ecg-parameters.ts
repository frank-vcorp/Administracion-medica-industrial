/**
 * Esquema Zod y helpers puros para parámetros editables de Electrocardiograma.
 * Módulo sin `'use server'` — reutilizable en UI, server actions, reporte y PDF.
 */
import { z } from 'zod'

export const ECG_PARAMETERS_SCHEMA_VERSION = 'ecg-parameters-v1' as const

export const ecgParametersPayloadSchema = z.object({
  schemaVersion: z.literal(ECG_PARAMETERS_SCHEMA_VERSION),
  ritmicidad: z.string().trim().max(60).nullable().optional(),
  ritmo: z.string().trim().max(120).nullable().optional(),
  frecuencia_bpm: z.number().int().min(20).max(300).nullable().optional(),
  duracion_p_ms: z.number().int().min(20).max(400).nullable().optional(),
  morfologia_p: z.string().trim().max(240).nullable().optional(),
  intervalo_pr_ms: z.number().int().min(40).max(600).nullable().optional(),
  duracion_qrs_ms: z.number().int().min(20).max(400).nullable().optional(),
  eje_electrico: z.string().trim().max(100).nullable().optional(),
  eje_grados: z.number().int().min(-180).max(180).nullable().optional(),
  qtc_ms: z.number().int().min(200).max(800).nullable().optional(),
  segmento_st: z.string().trim().max(240).nullable().optional(),
  onda_t: z.string().trim().max(240).nullable().optional(),
  onda_q_patologica: z.string().trim().max(240).nullable().optional(),
  updatedAt: z.string().optional(),
})

export type EcgParametersPayload = z.infer<typeof ecgParametersPayloadSchema>

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function asInt(value: unknown, allowNegative = false): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const n = Math.round(value)
    return allowNegative || n > 0 ? n : null
  }
  if (typeof value === 'string' && value.trim()) {
    const match = value.trim().match(/-?\d+(?:[.,]\d+)?/)
    if (!match) return null
    const parsed = Number.parseFloat(match[0].replace(',', '.'))
    if (!Number.isFinite(parsed)) return null
    const n = Math.round(parsed)
    return allowNegative || n > 0 ? n : null
  }
  return null
}

function asString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const t = value.trim()
  return t.length > 0 ? t : null
}

export function isEcgParametersContext(
  value: unknown,
): value is EcgParametersPayload {
  return ecgParametersPayloadSchema.safeParse(value).success
}

export function parseEcgParametersContext(
  value: unknown,
): EcgParametersPayload | null {
  const parsed = ecgParametersPayloadSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

export type EcgEditableFields = Omit<
  EcgParametersPayload,
  'schemaVersion' | 'updatedAt'
>

/** Extrae valores iniciales para el formulario desde `extractedData` y/o `clinicalContext`. */
export function buildInitialEcgParametersFromExtraction(
  extractionOrData: unknown,
  savedContext?: unknown,
): EcgParametersPayload {
  const root = asRecord(extractionOrData)
  const data = (root ? asRecord(root.extracted_data) ?? root : null) ?? {}
  const saved = parseEcgParametersContext(savedContext)

  const eixoText = asString(data.eje_electrico)
  const extractedGrados =
    asInt(data.eje_grados, true) ?? (eixoText ? asInt(eixoText, true) : null)

  const pickStr = (
    key: keyof EcgEditableFields,
    fallback: string | null,
  ): string | null => {
    if (saved && Object.prototype.hasOwnProperty.call(saved, key)) {
      const val = saved[key]
      return typeof val === 'string' ? (val.trim() || null) : null
    }
    return fallback
  }

  const pickNum = (
    key: keyof EcgEditableFields,
    fallback: number | null,
  ): number | null => {
    if (saved && Object.prototype.hasOwnProperty.call(saved, key)) {
      const val = saved[key]
      return typeof val === 'number' && Number.isFinite(val) ? val : null
    }
    return fallback
  }

  return {
    schemaVersion: ECG_PARAMETERS_SCHEMA_VERSION,
    ritmicidad: pickStr('ritmicidad', asString(data.ritmicidad)),
    ritmo: pickStr('ritmo', asString(data.ritmo)),
    frecuencia_bpm: pickNum('frecuencia_bpm', asInt(data.frecuencia_bpm)),
    duracion_p_ms: pickNum('duracion_p_ms', asInt(data.duracion_p_ms)),
    morfologia_p: pickStr('morfologia_p', asString(data.morfologia_p)),
    intervalo_pr_ms: pickNum('intervalo_pr_ms', asInt(data.intervalo_pr_ms)),
    duracion_qrs_ms: pickNum('duracion_qrs_ms', asInt(data.duracion_qrs_ms)),
    eje_electrico: pickStr('eje_electrico', eixoText),
    eje_grados: pickNum('eje_grados', extractedGrados),
    qtc_ms: pickNum('qtc_ms', asInt(data.qtc_ms)),
    segmento_st: pickStr('segmento_st', asString(data.segmento_st)),
    onda_t: pickStr('onda_t', asString(data.onda_t)),
    onda_q_patologica: pickStr(
      'onda_q_patologica',
      asString(data.onda_q_patologica),
    ),
    ...(saved?.updatedAt ? { updatedAt: saved.updatedAt } : {}),
  }
}

/** Fusiona parámetros confirmados por el médico sobre los datos extraídos para el reporte PDF. */
export function mergeEcgExtractionWithSavedParameters<
  T extends Record<string, unknown>,
>(extracted: T | null, savedContext: unknown): T | null {
  const saved = parseEcgParametersContext(savedContext)
  if (!saved && !extracted) return null
  const base: Record<string, unknown> = extracted ? { ...extracted } : {}
  if (!saved) return base as T

  const keys: ReadonlyArray<keyof EcgEditableFields> = [
    'ritmicidad',
    'ritmo',
    'frecuencia_bpm',
    'duracion_p_ms',
    'morfologia_p',
    'intervalo_pr_ms',
    'duracion_qrs_ms',
    'eje_electrico',
    'eje_grados',
    'qtc_ms',
    'segmento_st',
    'onda_t',
    'onda_q_patologica',
  ]
  for (const k of keys) {
    if (Object.prototype.hasOwnProperty.call(saved, k)) {
      base[k] = saved[k] ?? null
    }
  }
  return base as T
}
