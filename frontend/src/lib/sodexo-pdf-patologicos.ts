/**
 * Sección 5 — Personal patológico (REG-SO-01).
 */
import type { PDFDocument } from 'pdf-lib'
import { sodexoDefaultNiegaPair } from '@/lib/sodexo-pdf-acroform'
import { SODEXO_PATOLOGICOS_ALL_PAIRS } from '@/lib/sodexo-pdf-patologicos-pairs'
import {
  SODEXO_PATOLOGICOS_CATALOG,
  type SodexoPatologicoCatalogEntry,
} from '@/lib/sodexo-patologicos-catalog'
import type { SodexoPatologicoExtensionRow } from '@/lib/sodexo-patologicos-prefill'

type PdfForm = ReturnType<PDFDocument['getForm']>

/** @deprecated Usar `SODEXO_PATOLOGICOS_CATALOG`. */
export type SodexoPatologiaRow = SodexoPatologicoCatalogEntry & {
  amiKey: string
  descField: string
}

/** Compatibilidad tests / imports antiguos. */
export const SODEXO_PATOLOGICOS_LEFT = SODEXO_PATOLOGICOS_CATALOG.filter((r) => r.column === 'left')
export const SODEXO_PATOLOGICOS_RIGHT = SODEXO_PATOLOGICOS_CATALOG.filter((r) => r.column === 'right')

export const SODEXO_PATOLOGICOS_EXTRA_KEYS = [
  'exantematicas',
  'desmayos',
  'ginecologicos',
  'hernias',
  'otras',
] as const

export type PatologiaParsed = {
  negado: boolean
  si: boolean
  descripcion: string
}

export function parsePatologiaEntry(raw: unknown): PatologiaParsed {
  if (raw == null) return { negado: true, si: false, descripcion: '' }
  if (typeof raw === 'string') {
    const u = raw.trim().toUpperCase()
    if (!u || u === 'NEGADO' || u === 'NO APLICA') {
      return { negado: true, si: false, descripcion: '' }
    }
    return { negado: false, si: true, descripcion: raw.trim() }
  }
  if (typeof raw === 'object' && raw !== null && 'estado' in raw) {
    const estado = String((raw as { estado?: string }).estado ?? 'NEGADO').toUpperCase()
    const det = (raw as { detalle?: Record<string, string> }).detalle
    const descripcion = [det?.desde_cuando, det?.tratamiento, det?.observaciones]
      .map((x) => (x ?? '').trim())
      .filter(Boolean)
      .join('; ')
    if (estado === 'SI') return { negado: false, si: true, descripcion }
    if (estado === 'NEGADO' || estado === 'NO APLICA') {
      return { negado: true, si: false, descripcion: '' }
    }
    return { negado: false, si: true, descripcion: estado }
  }
  return { negado: true, si: false, descripcion: '' }
}

function extensionToParsed(row: SodexoPatologicoExtensionRow | undefined): PatologiaParsed | null {
  if (!row?.estado) return null
  if (row.estado === 'NEGADO') return { negado: true, si: false, descripcion: '' }
  if (row.estado === 'SI') {
    return { negado: false, si: true, descripcion: (row.descripcion ?? '').trim() }
  }
  return null
}

function setText(form: PdfForm, fieldName: string, value: string) {
  if (!value.trim()) return
  try {
    form.getTextField(fieldName).setText(value)
  } catch {
    // ignore
  }
}

function setCheck(form: PdfForm, fieldName: string, checked: boolean) {
  if (!checked) return
  try {
    form.getCheckBox(fieldName).check()
  } catch {
    // ignore
  }
}

function applyRow(form: PdfForm, entry: SodexoPatologicoCatalogEntry, parsed: PatologiaParsed) {
  if (parsed.negado) {
    setCheck(form, entry.pdf.checkNo, true)
    return
  }
  if (parsed.si) {
    setCheck(form, entry.pdf.checkSi, true)
    if (entry.pdf.descField) setText(form, entry.pdf.descField, parsed.descripcion)
  }
}

function resolveParsed(
  entry: SodexoPatologicoCatalogEntry,
  patologicosAmi: Record<string, unknown>,
  extMap: Record<string, SodexoPatologicoExtensionRow> | null | undefined,
): PatologiaParsed | null {
  const fromExt = extensionToParsed(extMap?.[entry.key])
  if (fromExt) return fromExt
  if (entry.amiKey) return parsePatologiaEntry(patologicosAmi[entry.amiKey])
  return null
}

export function fillSodexoPatologicos(
  form: PdfForm,
  patologicos: Record<string, unknown> | null | undefined,
  extPatologicos?: Record<string, SodexoPatologicoExtensionRow> | null,
): string {
  const record = patologicos ?? {}
  const ext = extPatologicos ?? null
  const usedAmiKeys = new Set(
    SODEXO_PATOLOGICOS_CATALOG.map((r) => r.amiKey).filter(Boolean) as string[],
  )

  for (const entry of SODEXO_PATOLOGICOS_CATALOG) {
    const parsed = resolveParsed(entry, record, ext)
    if (parsed) applyRow(form, entry, parsed)
  }

  const extras: string[] = []
  for (const key of SODEXO_PATOLOGICOS_EXTRA_KEYS) {
    const p = parsePatologiaEntry(record[key])
    if (p.si) {
      const label = key.replace(/_/g, ' ')
      extras.push(`${label}: ${p.descripcion || 'Sí'}`)
    }
  }
  for (const [key, raw] of Object.entries(record)) {
    if (usedAmiKeys.has(key)) continue
    if ((SODEXO_PATOLOGICOS_EXTRA_KEYS as readonly string[]).includes(key)) continue
    const p = parsePatologiaEntry(raw)
    if (p.si) extras.push(`${key.replace(/_/g, ' ')}: ${p.descripcion || 'Sí'}`)
  }
  return extras.join('\n')
}

/** Marca «Niega» en filas §5 sin dato (paridad con ejemplo impreso). */
export function applySodexoPatologicosDefaultNiega(form: PdfForm) {
  for (const pair of SODEXO_PATOLOGICOS_ALL_PAIRS) {
    sodexoDefaultNiegaPair(form, pair)
  }
}
