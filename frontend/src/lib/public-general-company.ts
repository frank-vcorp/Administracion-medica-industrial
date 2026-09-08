/** Empresa interna para pacientes particulares / mostrador. */
export const PUBLIC_GENERAL_COMPANY_RFC = 'PG010101XXX'
/** Etiqueta visual y nombre canónico en BD (DEC-20260907-02). */
export const PUBLIC_GENERAL_COMPANY_NAME = 'Público General'

/** Nombres legacy a reconocer al buscar/fusionar duplicados. */
export const PUBLIC_GENERAL_LEGACY_NAMES = [
  'PÚBLICO EN GENERAL',
  'PUBLICO EN GENERAL',
  'Público en general',
] as const

export function normalizePublicGeneralName(value: string): string {
  return value
    .toUpperCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function isPublicGeneralCompany(company: {
  name?: string | null
  rfc?: string | null
}): boolean {
  if (!company) return false
  if (company.rfc === PUBLIC_GENERAL_COMPANY_RFC) return true
  const normalized = normalizePublicGeneralName(company.name ?? '')
  return (
    normalized === normalizePublicGeneralName(PUBLIC_GENERAL_COMPANY_NAME) ||
    normalized.includes('PUBLICO EN GENERAL') ||
    normalized === 'PUBLICO GENERAL'
  )
}
