/**
 * Heredo-familiares ZIN: selección múltiple de parentesco (O9-31).
 * Persistencia en el mismo string del campo (`PADRE|MADRE`, legacy `PADRE` u `OTROS`).
 */

import { HEREDOFAMILIARES_VALUES } from '@/schemas/clinical/exam.schema'

/** Opciones seleccionables (sin NEGADOS ni OTROS). */
export const HEREDOFAMILIARES_MULTI_OPTIONS = HEREDOFAMILIARES_VALUES.filter(
  (v) => v !== 'NEGADOS' && v !== 'OTROS',
)

const MULTI_DELIM = '|'

export function parseHeredoFamiliaresMulti(value: string | null | undefined): string[] {
  const raw = (value ?? '').trim()
  if (!raw || raw === 'NEGADOS' || raw === 'NO APLICA') return []
  if (raw === 'OTROS') return []
  if (raw.includes(MULTI_DELIM)) {
    return raw.split(MULTI_DELIM).map((s) => s.trim()).filter(Boolean)
  }
  if ((HEREDOFAMILIARES_MULTI_OPTIONS as readonly string[]).includes(raw)) {
    return [raw]
  }
  return []
}

export function serializeHeredoFamiliaresMulti(selected: readonly string[]): string {
  const uniq = [...new Set(selected.map((s) => s.trim()).filter(Boolean))]
  if (uniq.length === 0) return ''
  return uniq.join(MULTI_DELIM)
}

export function toggleHeredoFamiliaresMulti(
  currentStored: string,
  option: string,
  checked: boolean,
): string {
  if (option === 'NEGADOS') {
    return checked ? 'NEGADOS' : ''
  }
  const selected = parseHeredoFamiliaresMulti(currentStored)
  const next = checked
    ? [...selected.filter((s) => s !== option), option]
    : selected.filter((s) => s !== option)
  if (next.length === 0) return ''
  return serializeHeredoFamiliaresMulti(next)
}

export function heredoFamiliaresMultiIsNegados(stored: string): boolean {
  return (stored ?? '').trim() === 'NEGADOS'
}
