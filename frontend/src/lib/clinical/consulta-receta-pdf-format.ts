import { SME_PDF_FOOTER } from '@/lib/brand-constants'
import type { ConsultaMedicaPayload } from '@/schemas/clinical/consulta-medica.schema'

const DEFAULT_LUGAR = 'Santiago de Querétaro, Qro.'

/** Fecha legal para receta: «a 9 de noviembre de 2026». */
export function formatFechaRecetaLegal(date: Date): string {
  if (Number.isNaN(date.getTime())) return '—'
  const dayMonthYear = new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Mexico_City',
  }).format(date)
  return dayMonthYear
}

export function buildLugarReceta(branch: {
  name?: string | null
  address?: string | null
} | null | undefined): string {
  const name = branch?.name?.trim()
  const address = branch?.address?.trim()
  if (name && address) return `${name} · ${address}`
  if (address) return address
  if (name) return `${name}, Qro.`
  return DEFAULT_LUGAR
}

export function buildFechaLugarReceta(lugar: string, date: Date): string {
  const lugarNorm = lugar.trim() || DEFAULT_LUGAR
  return `${lugarNorm}, a ${formatFechaRecetaLegal(date)}`
}

export function formatFechaRecetaCorta(date: Date): string {
  return new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'America/Mexico_City',
  }).format(date)
}

export function buildDiagnosticoRecetaDisplay(consulta: ConsultaMedicaPayload): string {
  const cie = consulta.diagnostico_unificado?.trim()
  const espec = consulta.diagnostico_especifico?.trim()
  if (cie && espec) return `${cie} — ${espec}`
  return cie || espec || '—'
}

export { SME_PDF_FOOTER }
