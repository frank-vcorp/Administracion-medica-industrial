/**
 * Fusión optimista de EventTests en la papeleta (evita `router.refresh()` que
 * remonta PapeletaWorkspace y desincroniza `activeTestId` con la URL del cliente).
 */

export type PapeletaEventTestSeed = {
  id: string
  testNameSnapshot: string
  status?: string
  fileUrl?: string | null
  resultNotes?: string | null
  test?: {
    code?: string | null
    category?: { name: string } | null
    options?: unknown
  } | null
}

export type PapeletaEventTestRow = {
  id: string
  testNameSnapshot: string
  status: string
  fileUrl: string | null
  resultNotes: string | null
  test?: PapeletaEventTestSeed['test']
  clinicalContext: null
  aiSnapshot: null
  extractionSnapshot: null
}

export function buildPapeletaEventTestRow(seed: PapeletaEventTestSeed): PapeletaEventTestRow {
  return {
    id: seed.id,
    testNameSnapshot: seed.testNameSnapshot,
    status: seed.status ?? 'PENDING',
    fileUrl: seed.fileUrl ?? null,
    resultNotes: seed.resultNotes ?? null,
    test: seed.test ?? null,
    clinicalContext: null,
    aiSnapshot: null,
    extractionSnapshot: null,
  }
}

/** Añade estudios nuevos sin duplicar ids ya presentes en la lista lateral. */
export function appendPapeletaEventTests<T extends { id: string }>(
  prev: readonly T[],
  seeds: readonly PapeletaEventTestSeed[],
): T[] {
  if (seeds.length === 0) return [...prev]
  const existing = new Set(prev.map((t) => t.id))
  const built = seeds
    .filter((s) => s.id && !existing.has(s.id))
    .map((s) => buildPapeletaEventTestRow(s) as unknown as T)
  if (built.length === 0) return [...prev]
  return [...prev, ...built]
}

export function removePapeletaEventTestById<T extends { id: string }>(
  prev: readonly T[],
  eventTestId: string,
): T[] {
  return prev.filter((t) => t.id !== eventTestId)
}
