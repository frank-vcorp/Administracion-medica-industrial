import {
  CONSULTA_MEDICA_SCHEMA_VERSION,
  ConsultaMedicaPayloadSchema,
  type ConsultaMedicaPayload,
} from '@/schemas/clinical/consulta-medica.schema'

export function isConsultaMedicaTestName(name: string): boolean {
  const n = name.trim().toLowerCase()
  if (/consulta de nutrici|consulta de psicolog|consulta fisioterap/i.test(n)) {
    return false
  }
  return /consulta\s+m[eé]dica/.test(n) || n === 'atencion medica'
}

export function parseConsultaMedicaClinicalContext(
  raw: unknown,
): ConsultaMedicaPayload | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const v = (raw as { schemaVersion?: string }).schemaVersion
  if (v !== CONSULTA_MEDICA_SCHEMA_VERSION) return null
  const parsed = ConsultaMedicaPayloadSchema.safeParse(raw)
  return parsed.success ? parsed.data : null
}
