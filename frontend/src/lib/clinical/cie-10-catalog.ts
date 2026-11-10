import catalogJson from '../../../resources/clinical/cie-10-es.json'
import {
  formatCie10Code,
  formatCie10Unified,
  normalizeCie10Code,
  type Cie10Entry,
} from '@/lib/clinical/cie-10-format'

export type { Cie10Entry }
export { formatCie10Code, formatCie10Unified }

/** Catálogo CIE-10 (español). Fuente: verasativa/CIE-10 — `frontend/resources/clinical/cie-10-es.json`. */
const ENTRIES: Cie10Entry[] = catalogJson as Cie10Entry[]

const byNormalizedCode = new Map<string, Cie10Entry>()
let sortedByCode: Cie10Entry[] | null = null

function getSortedByCode(): Cie10Entry[] {
  if (sortedByCode) return sortedByCode
  sortedByCode = [...ENTRIES].sort((a, b) =>
    normalizeCie10Code(a.code).localeCompare(normalizeCie10Code(b.code), 'en', { sensitivity: 'base' }),
  )
  return sortedByCode
}

function normalizeCode(raw: string): string {
  return normalizeCie10Code(raw)
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

/** Lista inicial al enfocar el campo (sin escribir). */
export function listCie10CatalogPreview(limit = 20): Cie10Entry[] {
  buildIndex()
  return getSortedByCode().slice(0, Math.max(1, limit))
}

export function findCie10ByCode(raw: string): Cie10Entry | null {
  buildIndex()
  const key = normalizeCode(raw)
  return byNormalizedCode.get(key) ?? null
}

export function isKnownCie10Code(raw: string): boolean {
  return findCie10ByCode(raw) != null
}

/** Parsea valor persistido (`CODE — descripción` o solo código) validando contra catálogo. */
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
  const trimmed = query.trim()
  if (!trimmed) return listCie10CatalogPreview(limit)

  const q = normalizeSearchText(trimmed)
  const qCode = normalizeCode(trimmed)
  const out: Cie10Entry[] = []
  const seen = new Set<string>()

  const push = (entry: Cie10Entry) => {
    const key = normalizeCode(entry.code)
    if (seen.has(key)) return
    seen.add(key)
    out.push(entry)
  }

  if (qCode.length >= 1) {
    for (const entry of ENTRIES) {
      const key = normalizeCode(entry.code)
      if (key.startsWith(qCode)) push(entry)
      if (out.length >= limit) return out.slice(0, limit)
    }
  }

  if (q.length < 2) return out.slice(0, limit)

  for (const entry of ENTRIES) {
    if (normalizeSearchText(entry.description).includes(q)) push(entry)
    if (out.length >= limit) break
  }

  return out.slice(0, limit)
}
