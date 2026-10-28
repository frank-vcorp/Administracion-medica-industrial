import {
  CONSULTA_MEDICA_SCHEMA_VERSION,
  type ConsultaMedicaPayload,
} from '@/schemas/clinical/consulta-medica.constants'

export function isConsultaMedicaTestName(name: string): boolean {
  const n = name.trim().toLowerCase()
  if (/consulta de nutrici|consulta de psicolog|consulta fisioterap/i.test(n)) {
    return false
  }
  return /consulta\s+m[eé]dica/.test(n) || n === 'atencion medica'
}

/** Restaura borrador en UI sin ejecutar Zod (el catálogo CIE-10 es solo servidor). */
export function parseConsultaMedicaClinicalContext(
  raw: unknown,
): Partial<ConsultaMedicaPayload> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const v = (raw as { schemaVersion?: string }).schemaVersion
  if (v !== CONSULTA_MEDICA_SCHEMA_VERSION) return null
  return raw as Partial<ConsultaMedicaPayload>
}

export { CONSULTA_MEDICA_SCHEMA_VERSION, type ConsultaMedicaPayload }
