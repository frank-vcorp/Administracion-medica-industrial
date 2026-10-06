/**
 * Pruebas de laboratorio con resultado sensible: el médico decide si el
 * hallazgo va al dictamen general (empresa) o queda solo en expediente.
 */

export const DICTAMEN_LAB_CLINICAL_CONTEXT_VERSION = 'dictamen-lab-v1' as const

/** Nombres canónicos en catálogo (seed Excel AMI). */
export const DICTAMEN_OPTIONAL_LAB_TEST_NAMES = [
  'PIE ORINA',
  'PIE SANGRE',
  'PRUEBA ESPECIAL',
] as const

export type DictamenLabClinicalContext = {
  schemaVersion: typeof DICTAMEN_LAB_CLINICAL_CONTEXT_VERSION
  includeInDictamenGeneral: boolean
}

export function normalizeLabTestLabel(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ')
}

export function isDictamenOptionalLabTest(testNameSnapshot: string | null | undefined): boolean {
  const n = normalizeLabTestLabel(testNameSnapshot ?? '')
  if (!n) return false
  return DICTAMEN_OPTIONAL_LAB_TEST_NAMES.some(
    (canonical) => n === normalizeLabTestLabel(canonical),
  )
}

export function serviceNameMatchesEventTest(
  serviceName: string,
  testNameSnapshot: string,
): boolean {
  return normalizeLabTestLabel(serviceName) === normalizeLabTestLabel(testNameSnapshot)
}

/** Default: incluir (comportamiento previo) hasta que el médico marque lo contrario. */
export function readIncludeInDictamenGeneral(
  testNameSnapshot: string,
  clinicalContext: unknown,
): boolean {
  if (!isDictamenOptionalLabTest(testNameSnapshot)) return true
  if (!clinicalContext || typeof clinicalContext !== 'object') return true
  const ctx = clinicalContext as Record<string, unknown>
  if (ctx.schemaVersion !== DICTAMEN_LAB_CLINICAL_CONTEXT_VERSION) return true
  return ctx.includeInDictamenGeneral !== false
}

export function buildDictamenLabClinicalContext(
  includeInDictamenGeneral: boolean,
): DictamenLabClinicalContext {
  return {
    schemaVersion: DICTAMEN_LAB_CLINICAL_CONTEXT_VERSION,
    includeInDictamenGeneral,
  }
}

export type EventTestDictamenFlagRef = {
  testNameSnapshot: string
  clinicalContext: unknown
}

export function filterServiceEntriesForDictamenGeneral<T extends { serviceName: string }>(
  entries: readonly T[],
  eventTests: readonly EventTestDictamenFlagRef[],
): T[] {
  return entries.filter((entry) => {
    const match = eventTests.find((et) =>
      serviceNameMatchesEventTest(entry.serviceName, et.testNameSnapshot),
    )
    if (!match) return true
    return readIncludeInDictamenGeneral(match.testNameSnapshot, match.clinicalContext)
  })
}

export type DictamenServiceBlock = {
  labs: readonly { serviceName: string }[]
  studies: readonly { serviceName: string }[]
}

export function applyEventDictamenLabFilters<T extends DictamenServiceBlock>(
  block: T,
  eventTests: readonly EventTestDictamenFlagRef[],
): T {
  return {
    ...block,
    labs: filterServiceEntriesForDictamenGeneral(block.labs, eventTests),
    studies: filterServiceEntriesForDictamenGeneral(block.studies, eventTests),
  }
}

export function groupEventTestsByEventId(
  rows: readonly ({ eventId: string } & EventTestDictamenFlagRef)[],
): Map<string, EventTestDictamenFlagRef[]> {
  const map = new Map<string, EventTestDictamenFlagRef[]>()
  for (const row of rows) {
    const list = map.get(row.eventId) ?? []
    list.push({
      testNameSnapshot: row.testNameSnapshot,
      clinicalContext: row.clinicalContext,
    })
    map.set(row.eventId, list)
  }
  return map
}
