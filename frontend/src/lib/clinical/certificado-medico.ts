import {
  CERTIFICADO_MEDICO_SCHEMA_VERSION,
  CertificadoMedicoPayloadSchema,
  type CertificadoMedicoPayload,
} from '@/schemas/clinical/certificado-medico.schema'

export function isCertificadoMedicoTestName(name: string): boolean {
  const n = name.trim().toLowerCase()
  if (n.includes('digital')) return false
  return /certificado\s+m[eé]dico/.test(n) || n === 'certificado medico'
}

export function parseCertificadoMedicoClinicalContext(
  raw: unknown,
): CertificadoMedicoPayload | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const v = (raw as { schemaVersion?: string }).schemaVersion
  if (v !== CERTIFICADO_MEDICO_SCHEMA_VERSION) return null
  const parsed = CertificadoMedicoPayloadSchema.safeParse(raw)
  return parsed.success ? parsed.data : null
}
