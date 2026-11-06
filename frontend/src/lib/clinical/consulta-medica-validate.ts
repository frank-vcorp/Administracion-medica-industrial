import {
  ConsultaMedicaDraftSchema,
  ConsultaMedicaPayloadSchema,
  CONSULTA_MEDICA_SCHEMA_VERSION,
  type ConsultaMedicaPayload,
} from '@/schemas/clinical/consulta-medica.schema'
import {
  CONSULTA_MEDICA_SCHEMA_VERSION_V1,
  type TipoIncapacidadConsultaValue,
} from '@/schemas/clinical/consulta-medica.constants'
import { sanitizeClinicalHistoryInput } from '@/lib/clinical/sanitize-clinical-history'

function coerceTipoIncapacidadFromV1(
  base: Record<string, unknown>,
): TipoIncapacidadConsultaValue | undefined {
  const otorga = base.otorga_incapacidad
  if (otorga !== 'SI') {
    return 'NINGUNA'
  }
  if (base.tipo_incapacidad && typeof base.tipo_incapacidad === 'string') {
    return base.tipo_incapacidad as TipoIncapacidadConsultaValue
  }
  const pase = base.pase_salida
  if (pase === 'SI') return 'PASE_SALIDA'
  const dias = base.dias_incapacidad
  if (typeof dias === 'number' && dias > 0) return 'INTERNA_SME'
  return 'IMSS'
}

/** Normaliza v1→v2 (incapacidad) antes de validar o armar PDF. */
export function normalizeConsultaClinicalContext(raw: unknown): Record<string, unknown> {
  return prepareConsultaRaw(raw)
}

function prepareConsultaRaw(raw: unknown): Record<string, unknown> {
  const base =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? { ...(raw as Record<string, unknown>) }
      : {}
  const fromVersion = base.schemaVersion
  base.schemaVersion = CONSULTA_MEDICA_SCHEMA_VERSION
  if (fromVersion === CONSULTA_MEDICA_SCHEMA_VERSION_V1) {
    base.tipo_incapacidad = coerceTipoIncapacidadFromV1(base)
    delete base.pase_salida
  }
  if ('antecedentes' in base) {
    const sanitized = sanitizeClinicalHistoryInput(base.antecedentes)
    if (sanitized === undefined) delete base.antecedentes
    else base.antecedentes = sanitized
  }
  return base
}

export function validateConsultaMedicaPayload(
  raw: unknown,
  mode: 'draft' | 'final',
):
  | { valid: true; payload: ConsultaMedicaPayload }
  | { valid: false; error: string; fieldErrors?: Record<string, string[]> } {
  const withVersion = prepareConsultaRaw(raw)
  const schema = mode === 'final' ? ConsultaMedicaPayloadSchema : ConsultaMedicaDraftSchema
  const parsed = schema.safeParse(withVersion)
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path.join('.') || '_root'
      fieldErrors[key] = fieldErrors[key] ?? []
      fieldErrors[key].push(issue.message)
    }
    const firstKey = Object.keys(fieldErrors)[0]
    const firstMessage = firstKey ? fieldErrors[firstKey]?.[0] : undefined
    return {
      valid: false,
      error: firstKey && firstKey !== '_root' && firstMessage
        ? `${firstKey}: ${firstMessage}`
        : firstMessage ?? 'Datos de consulta inválidos',
      fieldErrors,
    }
  }
  return { valid: true, payload: parsed.data as ConsultaMedicaPayload }
}
