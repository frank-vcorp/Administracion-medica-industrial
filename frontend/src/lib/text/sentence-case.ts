/**
 * Normalización de texto libre (modo oración en español) y nombres propios / ciudades.
 */

const LETTER_WITH_CASE = /[^\p{Lu}\p{Ll}]*[\p{Lu}\p{Ll}]/u
const HAS_LOWER_THEN_UPPER = /\p{Ll}.*\p{Lu}/u
const CIE10_TOKEN_RE = /^[A-Z]\d{2}(?:\.\d{1,4})?$/i
const DOTTED_ACRONYM_RE = /^(?:[\p{L}]\.){2,}$/u
const WORD_WITH_CASE_RE = /[\p{L}\p{N}]+(?:[-'’][\p{L}\p{N}]+)*/gu

const PROPER_NAME_LOWERCASE_PARTICLES = new Set([
  'a',
  'al',
  'con',
  'de',
  'del',
  'e',
  'en',
  'la',
  'las',
  'los',
  'o',
  'para',
  'por',
  'sin',
  'u',
  'y',
])

const PRESERVED_UPPERCASE_CODES = new Set([
  'CDMX',
  'CURP',
  'IMSS',
  'INE',
  'ISSSTE',
  'NSS',
  'RFC',
  'SME',
])

/** Acrónimos médicos frecuentes que no deben aplastarse en texto mixto. */
const CLINICAL_ACRONYMS = new Set([
  'AHF',
  'AMI',
  'AO',
  'APNP',
  'APP',
  'BH',
  'CDMX',
  'CURP',
  'DM',
  'ECG',
  'EGO',
  'EKG',
  'EMG',
  'EPOC',
  'EPP',
  'ERC',
  'FC',
  'FR',
  'HAS',
  'IMC',
  'IMSS',
  'INE',
  'IRC',
  'ISSSTE',
  'IVU',
  'LCR',
  'NOM',
  'NSS',
  'OD',
  'OI',
  'OMS',
  'PAD',
  'PAS',
  'PSA',
  'PVC',
  'QS',
  'RFC',
  'RMN',
  'SME',
  'SNC',
  'SPO2',
  'STPS',
  'TA',
  'TAC',
  'TSH',
  'VDRL',
  'VIH',
  'VL',
  'VLC',
  'VC',
  'VCC',
])

/**
 * Frases multipalabra y localidades/estados de México (sin acentos para matching;
 * se capitalizan con reglas de nombre propio manteniendo el texto original).
 */
const PLACE_PHRASES_ASCII = [
  'san cristobal de las casas',
  'santiago de queretaro',
  'san miguel de allende',
  'ciudad del carmen',
  'san juan del rio',
  'baja california sur',
  'playa del carmen',
  'estado de mexico',
  'ciudad de mexico',
  'san luis potosi',
  'tuxtla gutierrez',
  'puerto vallarta',
  'lazaro cardenas',
  'ciudad victoria',
  'ciudad obregon',
  'valle de bravo',
  'gomez palacio',
  'piedras negras',
  'baja california',
  'ciudad juarez',
  'nuevo laredo',
  'quintana roo',
  'nuevo leon',
  'el marques',
  'los mochis',
  'los cabos',
  'poza rica',
  'santa fe',
  'la paz',
]

const PLACE_WORDS_ASCII = new Set([
  'acapulco',
  'aguascalientes',
  'apaseo',
  'apodaca',
  'atizapan',
  'campeche',
  'cancun',
  'cdmx',
  'celaya',
  'chalco',
  'chetumal',
  'chiapas',
  'chihuahua',
  'coahuila',
  'coatzacoalcos',
  'colima',
  'cordoba',
  'corregidora',
  'cuautla',
  'cuernavaca',
  'culiacan',
  'durango',
  'ecatepec',
  'ensenada',
  'fresnillo',
  'guadalajara',
  'guadalupe',
  'guanajuato',
  'guerrero',
  'hermosillo',
  'hidalgo',
  'irapuato',
  'ixtapa',
  'jalisco',
  'jiutepec',
  'juarez',
  'leon',
  'manzanillo',
  'matamoros',
  'mazatlan',
  'merida',
  'metepec',
  'mexicali',
  'mexico',
  'michoacan',
  'monclova',
  'monterrey',
  'morelia',
  'naucalpan',
  'nayarit',
  'nezahualcoyotl',
  'oaxaca',
  'orizaba',
  'pachuca',
  'puebla',
  'queretaro',
  'reynosa',
  'salamanca',
  'saltillo',
  'silao',
  'sinaloa',
  'sonora',
  'tabasco',
  'tamaulipas',
  'tampico',
  'tapachula',
  'tehuacan',
  'tepeji',
  'tepic',
  'tequisquiapan',
  'texcoco',
  'tijuana',
  'tlalnepantla',
  'tlaxcala',
  'toluca',
  'torreon',
  'tula',
  'tulancingo',
  'uruapan',
  'veracruz',
  'villahermosa',
  'xalapa',
  'yucatan',
  'zacatecas',
  'zamora',
  'zapopan',
  'zihuatanejo',
])

function stripDiacriticsLower(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es')
}

function hasCasedLetter(s: string): boolean {
  for (const ch of s) {
    if (ch.toLocaleLowerCase('es') !== ch.toLocaleUpperCase('es')) {
      return true
    }
  }
  return false
}

function isUpperLetter(ch: string): boolean {
  return ch.toLocaleLowerCase('es') !== ch.toLocaleUpperCase('es') && ch === ch.toLocaleUpperCase('es')
}

function isLowerLetter(ch: string): boolean {
  return ch.toLocaleLowerCase('es') !== ch.toLocaleUpperCase('es') && ch === ch.toLocaleLowerCase('es')
}

function isTitleCaseWord(word: string): boolean {
  const letters = [...word].filter((c) => c.toLocaleLowerCase('es') !== c.toLocaleUpperCase('es'))
  if (letters.length === 0) return false
  if (!isUpperLetter(letters[0])) return false
  return letters.slice(1).every((c) => isLowerLetter(c))
}

function capitalizeFirstSpanishSentence(text: string): string {
  const match = text.match(LETTER_WITH_CASE)
  if (!match || match.index === undefined) {
    return text
  }
  const letterIndex = match.index + match[0].length - 1
  return (
    text.slice(0, letterIndex) +
    text.charAt(letterIndex).toLocaleUpperCase('es') +
    text.slice(letterIndex + 1)
  )
}

function capitalizeProperSegment(segment: string, forceCapitalizeFirst: boolean): string {
  if (!segment) return segment
  const dotParts = segment.split('.')
  if (segment.includes('.') && DOTTED_ACRONYM_RE.test(segment)) {
    return segment.toLocaleUpperCase('es')
  }
  if (dotParts.length > 1 && dotParts.every((p) => !p || /^[\p{L}\p{N}]+$/u.test(p))) {
    // Ej: "Dr." / "Av." / "Col." / "S.A."
    return dotParts
      .map((part, idx) => {
        if (!part) return ''
        return capitalizeProperWord(part, forceCapitalizeFirst && idx === 0)
      })
      .join('.')
  }
  return capitalizeProperWord(segment, forceCapitalizeFirst)
}

function capitalizeProperWord(word: string, forceCapitalize: boolean): string {
  if (!word || !hasCasedLetter(word)) return word
  if (CIE10_TOKEN_RE.test(word)) {
    return word.toLocaleUpperCase('es')
  }
  const upper = word.toLocaleUpperCase('es')
  if (PRESERVED_UPPERCASE_CODES.has(upper)) {
    return upper
  }
  if (word.includes('-')) {
    return word
      .split('-')
      .map((sub, i) => capitalizeProperWord(sub, forceCapitalize && i === 0))
      .join('-')
  }
  const lower = word.toLocaleLowerCase('es')
  if (!forceCapitalize && PROPER_NAME_LOWERCASE_PARTICLES.has(lower)) {
    return lower
  }
  return capitalizeFirstSpanishSentence(lower)
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
 * Formato nombre propio / domicilio / ciudad (es):
 * Capitaliza nombres, apellidos, ciudades y direcciones conservando partículas
 * españolas (`de`, `del`, `la`, `las`, `los`, `y`, etc.) en minúscula intermedia.
 */
export function applyProperNameCase(value: string): string {
  if (!value) return value
  const trimmed = value.trim()
  if (!trimmed || !hasCasedLetter(trimmed)) return value

  const tokenRe = /[\p{L}\p{N}.'-]+/gu
  let isFirstTokenInClause = true
  let lastIndex = 0
  let out = ''

  for (const match of trimmed.matchAll(tokenRe)) {
    const idx = match.index ?? 0
    const gap = trimmed.slice(lastIndex, idx)
    out += gap
    if (/[,;:\n\r]/.test(gap)) {
      isFirstTokenInClause = true
    }
    const token = match[0]
    out += capitalizeProperSegment(token, isFirstTokenInClause)
    isFirstTokenInClause = false
    lastIndex = idx + token.length
  }
  out += trimmed.slice(lastIndex)

  if (out === trimmed) return value
  const start = value.indexOf(trimmed)
  const lead = value.slice(0, start)
  const trail = value.slice(start + trimmed.length)
  return lead + out + trail
}

function restorePlaceCapitalization(text: string): string {
  let result = text.normalize('NFC')
  const ascii = stripDiacriticsLower(result)

  // 1. Frases multipalabra de ciudades/estados (de mayor a menor longitud)
  if (ascii.length === result.length) {
    for (const phrase of PLACE_PHRASES_ASCII) {
      let searchFrom = 0
      while (searchFrom < ascii.length) {
        const idx = ascii.indexOf(phrase, searchFrom)
        if (idx === -1) break
        const before = idx > 0 ? ascii[idx - 1] : ''
        const after = idx + phrase.length < ascii.length ? ascii[idx + phrase.length] : ''
        const boundaryBefore = !before || !/[\p{L}\p{N}]/u.test(before)
        const boundaryAfter = !after || !/[\p{L}\p{N}]/u.test(after)
        if (boundaryBefore && boundaryAfter) {
          const slice = result.slice(idx, idx + phrase.length)
          const casedSlice = applyProperNameCase(slice)
          result = result.slice(0, idx) + casedSlice + result.slice(idx + phrase.length)
        }
        searchFrom = idx + phrase.length
      }
    }
  }

  // 2. Ciudades y estados de una sola palabra
  result = result.replace(WORD_WITH_CASE_RE, (token) => {
    if (CIE10_TOKEN_RE.test(token)) {
      return token.toLocaleUpperCase('es')
    }
    const asciiToken = stripDiacriticsLower(token)
    if (PLACE_WORDS_ASCII.has(asciiToken)) {
      return capitalizeProperWord(token, true)
    }
    return token
  })

  return result
}

function restoreCieAndCodes(text: string): string {
  return text.replace(/[\p{L}\p{N}.]+/gu, (token) => {
    if (CIE10_TOKEN_RE.test(token)) {
      return token.toLocaleUpperCase('es')
    }
    return token
  })
}

function hasErraticCapsInMixedText(trimmed: string): boolean {
  const words = trimmed.match(/[\p{L}\p{N}.-]+/gu) ?? []
  for (const w of words) {
    if (CIE10_TOKEN_RE.test(w)) continue
    if (HAS_LOWER_THEN_UPPER.test(w)) return true
    const letters = [...w].filter((c) => c.toLocaleLowerCase('es') !== c.toLocaleUpperCase('es'))
    if (letters.length >= 2 && letters.every(isUpperLetter)) {
      const upper = w.toLocaleUpperCase('es')
      if (!CLINICAL_ACRONYMS.has(upper)) {
        return true
      }
    }
  }
  return false
}

/**
 * Modo oración para texto libre clínico (locale `es`):
 * - Convierte MAYÚSCULAS sostenidas y errores de bloqueo de mayúsculas (`hOLA COMO ESTAS`)
 *   a formato oración.
 * - Respeta códigos CIE-10 (`J45.0`), ciudades/estados mexicanos conocidos (`Querétaro`,
 *   `San Luis Potosí`, `Ciudad de México`) y nombres propios escritos en Title Case
 *   dentro de texto mixto normal.
 */
export function applySentenceCase(value: string): string {
  if (!value) return value
  const trimmed = value.trim()
  if (!trimmed || !hasCasedLetter(trimmed)) return value

  let cased: string
  if (isAllCapsUserText(trimmed) || hasErraticCapsInMixedText(trimmed)) {
    const lower = trimmed.toLocaleLowerCase('es')
    cased = capitalizeFirstSpanishSentence(lower)
    cased = restorePlaceCapitalization(cased)
    cased = restoreCieAndCodes(cased)
    // Restaurar acrónimos clínicos conocidos en texto mixto no-all-caps si aplica
    if (!isAllCapsUserText(trimmed)) {
      cased = cased.replace(/\b[\p{L}\p{N}]+\b/gu, (tok) => {
        const up = tok.toLocaleUpperCase('es')
        if (CLINICAL_ACRONYMS.has(up)) {
          // Solo si aparecía en mayúsculas en el texto original
          const re = new RegExp(`\\b${up}\\b`)
          if (re.test(trimmed)) return up
        }
        return tok
      })
    }
  } else {
    // Texto mixto o minúsculas normales: respeta nombres propios en Title Case,
    // capitaliza la primera letra si faltaba, y normaliza ciudades y códigos CIE.
    cased = trimmed.replace(WORD_WITH_CASE_RE, (token) => {
      if (CIE10_TOKEN_RE.test(token)) return token.toLocaleUpperCase('es')
      if (isTitleCaseWord(token)) return token
      return token
    })
    cased = capitalizeFirstSpanishSentence(cased)
    cased = restorePlaceCapitalization(cased)
  }

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
