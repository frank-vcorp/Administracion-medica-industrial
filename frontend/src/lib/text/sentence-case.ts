/**
 * Normaliza texto libre escrito en MAYÚSCULAS a formato oración
 * (primera letra en mayúscula, resto en minúsculas), preservando acentos del español.
 * No modifica cadenas con mezcla de mayúsculas/minúsculas (p. ej. acrónimos).
 */

const LETTER_WITH_CASE = /[^\p{Lu}\p{Ll}]*[\p{Lu}\p{Ll}]/u

function hasCasedLetter(s: string): boolean {
  for (const ch of s) {
    if (ch.toLocaleLowerCase('es') !== ch.toLocaleUpperCase('es')) {
      return true
    }
  }
  return false
}

/** True si todas las letras con casing están en mayúsculas (ignora dígitos y símbolos). */
export function isAllCapsUserText(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed || !hasCasedLetter(trimmed)) return false

  for (const ch of trimmed) {
    if (ch.toLocaleLowerCase('es') === ch.toLocaleUpperCase('es')) continue
    if (ch !== ch.toLocaleUpperCase('es')) return false
  }
  return true
}

/**
 * Si el valor completo está en MAYÚSCULAS, lo convierte a oración; si no, lo devuelve igual.
 */
export function applySentenceCaseIfAllCaps(value: string): string {
  const trimmed = value.trim()
  if (!trimmed || !isAllCapsUserText(trimmed)) {
    return value
  }

  const lower = trimmed.toLocaleLowerCase('es')
  const match = lower.match(LETTER_WITH_CASE)
  if (!match || match.index === undefined) {
    return lower
  }

  const letterIndex = match.index + match[0].length - 1
  return (
    lower.slice(0, letterIndex) +
    lower.charAt(letterIndex).toLocaleUpperCase('es') +
    lower.slice(letterIndex + 1)
  )
}
