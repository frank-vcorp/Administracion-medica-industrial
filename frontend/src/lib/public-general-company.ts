/** Empresa interna para pacientes particulares / mostrador. */
export const PUBLIC_GENERAL_COMPANY_RFC = 'PG010101XXX'
export const PUBLIC_GENERAL_COMPANY_NAME = 'PÚBLICO EN GENERAL'

export function isPublicGeneralCompany(company: {
  name?: string | null
  rfc?: string | null
}): boolean {
  if (!company) return false
  if (company.rfc === PUBLIC_GENERAL_COMPANY_RFC) return true
  const normalized = (company.name ?? '').toUpperCase().normalize('NFD').replace(/\p{M}/gu, '')
  return normalized.includes('PUBLICO EN GENERAL')
}
