/**
 * Normaliza texto libre a formato oración (es): primera letra con mayúscula, resto en minúsculas.
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

function capitalizeFirstSpanishSentence(lower: string): string {
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
 * Modo oración: siempre normaliza letras a minúsculas salvo la primera del texto (locale `es`).
 * Si el valor ya está normalizado, se devuelve intacto (incluye espacios).
 */
export function applySentenceCase(value: string): string {
  if (!value) return value
  const trimmed = value.trim()
  if (!trimmed || !hasCasedLetter(trimmed)) return value

  const lower = trimmed.toLocaleLowerCase('es')
  const cased = capitalizeFirstSpanishSentence(lower)
  if (cased === trimmed) return value

  const start = value.indexOf(trimmed)
  const lead = value.slice(0, start)
  const trail = value.slice(start + trimmed.length)
  return lead + cased + trail
}

/**
 * Legado: solo transforma si todo el texto estaba en MAYÚSCULAS.
 * Preferir {@link applySentenceCase} en validación y UI.
 */
export function applySentenceCaseIfAllCaps(value: string): string {
  if (!isAllCapsUserText(value)) return value
  return applySentenceCase(value)
}
