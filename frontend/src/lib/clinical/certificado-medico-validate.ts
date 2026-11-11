import {
  CertificadoMedicoDraftSchema,
  CertificadoMedicoPayloadSchema,
  CERTIFICADO_MEDICO_SCHEMA_VERSION,
  type CertificadoMedicoPayload,
} from '@/schemas/clinical/certificado-medico.schema'
import { zodErrorToFieldErrors } from '@/lib/save-action-errors'
import {
  formatZodFieldErrorLine,
  formatZodRequiredFieldBanner,
  formatZodIssueMessage,
} from '@/lib/zod-user-messages'

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
    const fieldErrors = zodErrorToFieldErrors(parsed.error)
    const firstKey = Object.keys(fieldErrors)[0]
    const firstIssue = parsed.error.issues[0]
    const firstMsg = firstKey ? fieldErrors[firstKey]?.[0] : undefined
    const error =
      mode === 'final' && firstKey && firstKey === 'integracion_diagnostica'
        ? formatZodRequiredFieldBanner(firstKey, 3)
        : firstKey && firstMsg
          ? formatZodFieldErrorLine(firstKey, firstMsg)
          : firstIssue
            ? formatZodIssueMessage(firstIssue)
            : 'Datos de certificado inválidos'
    return {
      valid: false,
      error,
      fieldErrors,
    }
  }

  const payload = parsed.data as CertificadoMedicoPayload
  if (mode === 'final' && payload.medico_cedula.trim() === '—') {
    return { valid: false, error: 'Indica la cédula profesional del médico.' }
  }

  return { valid: true, payload }
}
