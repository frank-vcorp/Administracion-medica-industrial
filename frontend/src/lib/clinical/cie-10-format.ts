/** Tipos y formato de presentación CIE-10 (sin catálogo embebido). */

export type Cie10Entry = {
  code: string
  description: string
}

export function normalizeCie10Code(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
}

/** Presentación con punto decimal (p. ej. G130 → G13.0). */
export function formatCie10Code(raw: string): string {
  const n = normalizeCie10Code(raw)
  const m = n.match(/^([A-Z])(\d{2})(\d+)$/)
  if (m) return `${m[1]}${m[2]}.${m[3]}`
  return raw.trim().toUpperCase()
}

export function formatCie10Unified(entry: Cie10Entry): string {
  return `${formatCie10Code(entry.code)} — ${entry.description}`
}

/** Restaura selección desde texto guardado sin cargar el catálogo (solo UI). */
export function parseDiagnosticoUnificadoDisplay(
  value: string | undefined | null,
): Cie10Entry | null {
  const trimmed = (value ?? '').trim()
  if (!trimmed) return null

  const dash = trimmed.indexOf(' — ')
  if (dash > 0) {
    const code = normalizeCie10Code(trimmed.slice(0, dash))
    const description = trimmed.slice(dash + 3).trim()
    if (!code) return null
    return { code, description }
  }

  const code = normalizeCie10Code(trimmed)
  if (!code) return null
  return { code, description: '' }
}
