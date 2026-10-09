import {
  CertificadoMedicoDraftSchema,
  CertificadoMedicoPayloadSchema,
  CERTIFICADO_MEDICO_SCHEMA_VERSION,
  type CertificadoMedicoPayload,
} from '@/schemas/clinical/certificado-medico.schema'

export function validateCertificadoMedicoPayload(
  raw: unknown,
  mode: 'draft' | 'final',
):
  | { valid: true; payload: CertificadoMedicoPayload }
  | { valid: false; error: string; fieldErrors?: Record<string, string[]> } {
  const withVersion =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? { ...(raw as object), schemaVersion: CERTIFICADO_MEDICO_SCHEMA_VERSION }
      : { schemaVersion: CERTIFICADO_MEDICO_SCHEMA_VERSION }

  const schema = mode === 'final' ? CertificadoMedicoPayloadSchema : CertificadoMedicoDraftSchema
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
      error: parsed.error.issues[0]?.message ?? 'Datos de certificado inválidos',
      fieldErrors,
    }
  }

  const payload = parsed.data as CertificadoMedicoPayload
  if (mode === 'final' && payload.medico_cedula.trim() === '—') {
    return { valid: false, error: 'Indica la cédula profesional del médico.' }
  }

  return { valid: true, payload }
}
