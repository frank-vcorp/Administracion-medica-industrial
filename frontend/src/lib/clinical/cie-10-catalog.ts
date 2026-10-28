import catalogJson from '../../../resources/clinical/cie-10-es.json'

/** Entrada del catálogo CIE-10 (español). Fuente: verasativa/CIE-10 (códigos oficiales CIE-10). */
export type Cie10Entry = {
  code: string
  description: string
}

const ENTRIES: Cie10Entry[] = catalogJson as Cie10Entry[]

const byNormalizedCode = new Map<string, Cie10Entry>()

function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
}

/** Presentación con punto decimal (p. ej. G130 → G13.0). */
export function formatCie10Code(raw: string): string {
  const n = normalizeCode(raw)
  const m = n.match(/^([A-Z])(\d{2})(\d+)$/)
  if (m) return `${m[1]}${m[2]}.${m[3]}`
  return raw.trim().toUpperCase()
}

export function formatCie10Unified(entry: Cie10Entry): string {
  return `${formatCie10Code(entry.code)} — ${entry.description}`
}

function buildIndex(): void {
  if (byNormalizedCode.size > 0) return
  for (const entry of ENTRIES) {
    byNormalizedCode.set(normalizeCode(entry.code), entry)
  }
}

export function getCie10CatalogSize(): number {
  buildIndex()
  return byNormalizedCode.size
}

export function findCie10ByCode(raw: string): Cie10Entry | null {
  buildIndex()
  const key = normalizeCode(raw)
  return byNormalizedCode.get(key) ?? null
}

export function isKnownCie10Code(raw: string): boolean {
  return findCie10ByCode(raw) != null
}

/** Parsea valor persistido (`CODE — descripción` o solo código). */
export function parseDiagnosticoUnificadoStored(
  value: string | undefined | null,
): { code: string; description: string; display: string } | null {
  const trimmed = (value ?? '').trim()
  if (!trimmed) return null

  const dash = trimmed.indexOf(' — ')
  if (dash > 0) {
    const codePart = trimmed.slice(0, dash).trim()
    const descPart = trimmed.slice(dash + 3).trim()
    const found = findCie10ByCode(codePart)
    if (found) {
      return {
        code: found.code,
        description: descPart || found.description,
        display: formatCie10Unified({ code: found.code, description: descPart || found.description }),
      }
    }
  }

  const found = findCie10ByCode(trimmed)
  if (found) {
    return {
      code: found.code,
      description: found.description,
      display: formatCie10Unified(found),
    }
  }

  return null
}

function normalizeSearchText(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

export function searchCie10Catalog(query: string, limit = 25): Cie10Entry[] {
  buildIndex()
  const q = normalizeSearchText(query)
  if (q.length < 2) return []

  const qCode = normalizeCode(query)
  const out: Cie10Entry[] = []
  const seen = new Set<string>()

  const push = (entry: Cie10Entry) => {
    const key = normalizeCode(entry.code)
    if (seen.has(key)) return
    seen.add(key)
    out.push(entry)
  }

  if (qCode.length >= 2) {
    for (const entry of ENTRIES) {
      const key = normalizeCode(entry.code)
      if (key.startsWith(qCode)) push(entry)
      if (out.length >= limit) return out.slice(0, limit)
    }
  }

  for (const entry of ENTRIES) {
    if (normalizeSearchText(entry.description).includes(q)) push(entry)
    if (out.length >= limit) break
  }

  return out.slice(0, limit)
}
