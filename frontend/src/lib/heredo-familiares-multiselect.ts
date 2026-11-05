import { HEREDOFAMILIARES_VALUES } from '@/schemas/clinical/exam.schema'

/** Opciones de parentesco seleccionables en conjunto (F-23). */
export const HEREDOFAMILIARES_MULTI_OPTIONS = HEREDOFAMILIARES_VALUES.filter(
  (v) => v !== 'NEGADOS',
)

const CANONICAL = new Set<string>(HEREDOFAMILIARES_VALUES)

/** Interpreta valor persistido (legacy una opción o varias separadas por coma). */
export function parseHeredoFamiliaresSelection(stored: string | null | undefined): string[] {
  const raw = (stored ?? '').trim()
  if (!raw) return []
  if (raw === 'NEGADOS') return ['NEGADOS']
  if (CANONICAL.has(raw)) return [raw]
  const parts = raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => CANONICAL.has(s))
  return [...new Set(parts)]
}

/** Serializa selección múltiple al string del schema (orden ZIN). */
export function serializeHeredoFamiliaresSelection(selected: string[]): string {
  const set = new Set(selected.map((s) => s.trim()).filter(Boolean))
  if (set.size === 0) return ''
  if (set.has('NEGADOS')) return 'NEGADOS'
  const ordered = HEREDOFAMILIARES_MULTI_OPTIONS.filter((v) => set.has(v))
  return ordered.join(', ')
}

export function toggleHeredoFamiliaresOption(current: string[], option: string): string[] {
  if (option === 'NEGADOS') {
    return ['NEGADOS']
  }
  const withoutNegados = current.filter((v) => v !== 'NEGADOS')
  if (withoutNegados.includes(option)) {
    return withoutNegados.filter((v) => v !== option)
  }
  return [...withoutNegados, option]
}
