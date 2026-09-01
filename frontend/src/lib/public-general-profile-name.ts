/** Prefijo de perfiles creados en mostrador / público general. */
export const PB_PROFILE_PREFIX = 'PB'

export type TestAbbrevInput = {
  id: string
  code: string
  name: string
}

function normalizeToken(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
}

/** Tres letras por prueba: código del catálogo o primera palabra del nombre. */
export function testAbbreviation(test: TestAbbrevInput): string {
  const fromCode = normalizeToken(test.code)
  if (fromCode.length >= 3) return fromCode.slice(0, 3)

  const firstWord = normalizeToken((test.name.split(/\s+/)[0] || test.name).trim())
  if (firstWord.length >= 3) return firstWord.slice(0, 3)

  const padded = (firstWord || 'TST').padEnd(3, 'X')
  return padded.slice(0, 3)
}

/**
 * Nombre corto reutilizable: PB AUD-ESP-SOM (+N si hay más de maxParts pruebas).
 * Mismo conjunto de pruebas → mismo nombre (orden alfabético por abreviatura).
 */
export function buildPbProfileNameFromTests(
  tests: TestAbbrevInput[],
  maxParts = 4
): string {
  if (tests.length === 0) {
    return `${PB_PROFILE_PREFIX} Rápido`
  }

  const sorted = [...tests].sort((a, b) =>
    testAbbreviation(a).localeCompare(testAbbreviation(b))
  )

  const abbrevs: string[] = []
  const used = new Set<string>()

  for (const test of sorted) {
    let ab = testAbbreviation(test)
    const fullCode = normalizeToken(test.code)
    if (used.has(ab) && fullCode.length > ab.length) {
      ab = fullCode.slice(0, 4)
    }
    if (used.has(ab)) {
      ab = `${ab}${test.id.replace(/-/g, '').slice(0, 1).toUpperCase()}`
    }
    used.add(ab)
    abbrevs.push(ab)
  }

  const overflow = abbrevs.length > maxParts ? abbrevs.length - maxParts : 0
  const visible = overflow > 0 ? abbrevs.slice(0, maxParts) : abbrevs
  const suffix = overflow > 0 ? ` +${overflow}` : ''

  return `${PB_PROFILE_PREFIX} ${visible.join('-')}${suffix}`
}

/** Aplica prefijo PB si el usuario escribió un nombre custom. */
export function ensurePbProfileName(
  userName: string | null | undefined,
  autoName: string
): string {
  const trimmed = (userName ?? '').trim()
  if (!trimmed) return autoName

  if (/^PB(\s|$|-)/i.test(trimmed)) {
    const rest = trimmed.replace(/^PB[\s-]*/i, '').trim()
    return rest ? `${PB_PROFILE_PREFIX} ${rest}` : autoName
  }

  return `${PB_PROFILE_PREFIX} ${trimmed}`
}
