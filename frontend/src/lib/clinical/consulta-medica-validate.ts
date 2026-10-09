import {
  ConsultaMedicaDraftSchema,
  ConsultaMedicaPayloadSchema,
  CONSULTA_MEDICA_SCHEMA_VERSION,
  type ConsultaMedicaPayload,
} from '@/schemas/clinical/consulta-medica.schema'

export function validateConsultaMedicaPayload(
  raw: unknown,
  mode: 'draft' | 'final',
):
  | { valid: true; payload: ConsultaMedicaPayload }
  | { valid: false; error: string; fieldErrors?: Record<string, string[]> } {
  const withVersion =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? { ...(raw as object), schemaVersion: CONSULTA_MEDICA_SCHEMA_VERSION }
      : { schemaVersion: CONSULTA_MEDICA_SCHEMA_VERSION }

  const schema = mode === 'final' ? ConsultaMedicaPayloadSchema : ConsultaMedicaDraftSchema
  const parsed = schema.safeParse(withVersion)
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path.join('.') || '_root'
      fieldErrors[key] = fieldErrors[key] ?? []
      fieldErrors[key].push(issue.message)
    }
    return {
      valid: false,
      error: parsed.error.issues[0]?.message ?? 'Datos de consulta inválidos',
      fieldErrors,
    }
  }
  return { valid: true, payload: parsed.data as ConsultaMedicaPayload }
}
