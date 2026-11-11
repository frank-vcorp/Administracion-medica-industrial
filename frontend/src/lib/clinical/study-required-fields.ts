/**
 * Reglas de campos obligatorios por prueba clínica (captura manual).
 * Alineado con `assertExamenMedicoReadyToClose` donde aplica.
 */
import {
  isAgudezaVisualTestName,
  isSomatometriaTestName,
} from '@/lib/clinical/examen-medico-capture'
import { getCanonicalAIStudyType } from '@/lib/study-ai'
export type StudyCaptureKind =
  | 'Somatometria'
  | 'AgudezaVisual'
  | 'Campimetria'

export type StudyRequiredFieldRule = {
  field: string
  label: string
}

export type StudyCaptureValidationResult =
  | { ok: true }
  | { ok: false; missing: StudyRequiredFieldRule[] }

export const SOMATOMETRIA_REQUIRED_FOR_COMPLETE: StudyRequiredFieldRule[] = [
  { field: 'peso_kg', label: 'peso (kg)' },
  { field: 'talla_m', label: 'talla (m)' },
]

/** Al menos uno de estos signos vitales para cerrar la prueba. */
export const SOMATOMETRIA_VITALS_ANY_OF: StudyRequiredFieldRule[] = [
  { field: 'ta_sistolica', label: 'tensión arterial sistólica' },
  { field: 'fc_min', label: 'frecuencia cardiaca' },
]

export const AGUDEZA_VISUAL_REQUIRED_FOR_COMPLETE: StudyRequiredFieldRule[] = [
  { field: 'vision_lejana_od', label: 'resultado OD (visión lejana)' },
  { field: 'vision_lejana_oi', label: 'resultado OI (visión lejana)' },
]

export const CAMPI_CONFRONTACION_REQUIRED: StudyRequiredFieldRule[] = [
  { field: 'confrontacion.ojo_derecho', label: 'confrontación ojo derecho' },
  { field: 'confrontacion.ojo_izquierdo', label: 'confrontación ojo izquierdo' },
]

function asRecord(data: unknown): Record<string, unknown> {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return {}
  return data as Record<string, unknown>
}

function hasNonEmptyString(data: Record<string, unknown>, key: string): boolean {
  return String(data[key] ?? '').trim().length > 0
}

function hasPositiveNumber(data: Record<string, unknown>, key: string): boolean {
  const raw = String(data[key] ?? '').trim()
  if (!raw) return false
  const n = Number(raw)
  return Number.isFinite(n) && n > 0
}

function getNestedValue(data: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.')
  let cur: unknown = data
  for (const p of parts) {
    if (!cur || typeof cur !== 'object' || Array.isArray(cur)) return undefined
    cur = (cur as Record<string, unknown>)[p]
  }
  return cur
}

export function resolveStudyCaptureKind(input: {
  testNameSnapshot?: string | null
  canonicalStudyType?: string | null
}): StudyCaptureKind | null {
  const name = String(input.testNameSnapshot ?? '')
  const canon =
    input.canonicalStudyType ??
    (input.testNameSnapshot
      ? getCanonicalAIStudyType({ testNameSnapshot: name })
      : null)
  if (canon === 'Campimetria') return 'Campimetria'
  if (isSomatometriaTestName(name)) return 'Somatometria'
  if (isAgudezaVisualTestName(name)) return 'AgudezaVisual'
  return null
}

export function validateStudyCaptureForComplete(
  kind: StudyCaptureKind,
  rawData: unknown,
): StudyCaptureValidationResult {
  const data = asRecord(rawData)
  const missing: StudyRequiredFieldRule[] = []

  if (kind === 'Somatometria') {
    for (const rule of SOMATOMETRIA_REQUIRED_FOR_COMPLETE) {
      if (!hasPositiveNumber(data, rule.field)) missing.push(rule)
    }
    const hasVital = SOMATOMETRIA_VITALS_ANY_OF.some((rule) =>
      hasNonEmptyString(data, rule.field),
    )
    if (!hasVital) {
      missing.push({
        field: '_vitals',
        label: 'al menos un signo vital (tensión arterial o frecuencia cardiaca)',
      })
    }
    return missing.length === 0 ? { ok: true } : { ok: false, missing }
  }

  if (kind === 'AgudezaVisual') {
    for (const rule of AGUDEZA_VISUAL_REQUIRED_FOR_COMPLETE) {
      if (!hasNonEmptyString(data, rule.field)) missing.push(rule)
    }
    return missing.length === 0 ? { ok: true } : { ok: false, missing }
  }

  if (kind === 'Campimetria') {
    const confrontacion = asRecord(data.confrontacion)
    for (const rule of CAMPI_CONFRONTACION_REQUIRED) {
      const leaf = rule.field.split('.').pop() ?? rule.field
      if (!hasNonEmptyString(confrontacion, leaf)) missing.push(rule)
    }
    return missing.length === 0 ? { ok: true } : { ok: false, missing }
  }

  return { ok: true }
}

export function formatStudyMissingFieldsSpanish(
  missing: ReadonlyArray<Pick<StudyRequiredFieldRule, 'label'>>,
): string {
  if (missing.length === 0) return ''
  const labels = missing.map((m) => m.label)
  return `Falta: ${labels.join(', ')}.`
}

export function studyValidationToFieldErrors(
  result: Extract<StudyCaptureValidationResult, { ok: false }>,
): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {}
  for (const m of result.missing) {
    const msg = `Campo obligatorio: ${m.label}`
    if (!fieldErrors[m.field]) fieldErrors[m.field] = []
    fieldErrors[m.field].push(msg)
  }
  return fieldErrors
}

export function isStudyRequiredField(
  kind: StudyCaptureKind,
  fieldKey: string,
): boolean {
  if (kind === 'Somatometria') {
    return SOMATOMETRIA_REQUIRED_FOR_COMPLETE.some((r) => r.field === fieldKey)
  }
  if (kind === 'AgudezaVisual') {
    return AGUDEZA_VISUAL_REQUIRED_FOR_COMPLETE.some((r) => r.field === fieldKey)
  }
  if (kind === 'Campimetria') {
    return CAMPI_CONFRONTACION_REQUIRED.some((r) => r.field === fieldKey)
  }
  return false
}

/** Lista plana de paths requeridos (para asteriscos en UI de campimetría anidada). */
export function isCampimetriaRequiredPath(path: string): boolean {
  return CAMPI_CONFRONTACION_REQUIRED.some((r) => r.field === path)
}

export function touchStudyFieldValue(data: Record<string, unknown>, path: string): boolean {
  const value = getNestedValue(data, path)
  if (value === null || value === undefined) return false
  return String(value).trim().length > 0
}
