/**
 * Normalización de talla (m) y cálculo de IMC para somatometría.
 * Acepta metros (1.75), dígitos sin punto (175 → 1.75 m) o centímetros enteros (198 → 1.98 m).
 */

const CM_AS_METERS_MIN = 100
const CM_AS_METERS_MAX = 272
export const TALLA_METERS_MAX = 3.5

/** Inserta punto decimal al capturar solo dígitos (ej. 198 → 1.98). */
export function formatTallaMetersWhileTyping(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  if (trimmed.includes('.') || trimmed.includes(',')) {
    return trimmed.replace(',', '.')
  }
  const digits = trimmed.replace(/\D/g, '')
  if (!digits) return trimmed
  if (digits.length === 1) return digits
  const dec = digits.slice(1, 3)
  return dec.length > 0 ? `${digits[0]}.${dec}` : digits[0]
}

/** Valor final en metros para persistencia / validación. */
export function normalizeTallaMetersToNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined
  const raw = String(value).trim().replace(',', '.')
  if (!raw) return undefined

  let parsed: number
  if (raw.includes('.')) {
    parsed = Number.parseFloat(raw)
  } else if (/^\d+$/.test(raw)) {
    parsed = Number.parseFloat(formatTallaMetersWhileTyping(raw))
  } else {
    parsed = Number.parseFloat(raw)
  }

  if (!Number.isFinite(parsed) || parsed <= 0) return undefined

  if (Number.isInteger(parsed) && parsed >= CM_AS_METERS_MIN && parsed <= CM_AS_METERS_MAX) {
    parsed = parsed / 100
  }

  if (parsed > TALLA_METERS_MAX) return undefined

  return Math.round(parsed * 1000) / 1000
}

/** Presentación estable con dos decimales cuando aplica (1.75, 1.98). */
export function formatTallaMetersForDisplay(raw: string): string {
  const m = normalizeTallaMetersToNumber(raw)
  if (m === undefined) return raw.trim()
  return m.toFixed(2)
}

export function computeBmi(pesoKg: unknown, tallaRaw: unknown): {
  imc: string
  imcValue: number
  tallaM: number
} {
  const peso =
    typeof pesoKg === 'number'
      ? pesoKg
      : Number.parseFloat(String(pesoKg ?? '').trim()) || 0
  const tallaM = normalizeTallaMetersToNumber(tallaRaw) ?? 0
  if (peso <= 0 || tallaM <= 0) {
    return { imc: '0.00', imcValue: 0, tallaM: 0 }
  }
  const imcValue = peso / (tallaM * tallaM)
  return { imc: imcValue.toFixed(2), imcValue, tallaM }
}

export function complexionFromImc(imcValue: number): string {
  if (imcValue <= 0) return 'NORMAL'
  if (imcValue > 29.9) return 'OBESIDAD'
  if (imcValue > 24.9) return 'SOBREPESO'
  if (imcValue < 18.5) return 'BAJO PESO'
  return 'NORMAL'
}
