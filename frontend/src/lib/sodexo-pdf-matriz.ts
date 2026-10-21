/**
 * §3 Matriz de riesgos — columnas 1–5 (empleos HO) y A (actual); varias por factor.
 */
import type { SodexoExtensionData } from '@/schemas/clinical/examen-medico-variant.schema'
import type { PdfForm } from '@/lib/sodexo-pdf-acroform'
import { sodexoSetCheck, sodexoSetText } from '@/lib/sodexo-pdf-acroform'
import {
  normalizeMatrizFactorValue,
  type SodexoMatrizColumn,
} from '@/lib/sodexo-ho-table'
import {
  SODEXO_MATRIZ_FACTOR_LEVELS,
  SODEXO_MATRIZ_KEYWORD_ALIASES,
} from '@/lib/sodexo-pdf-matriz-map'

export type MatrizNivel = SodexoMatrizColumn

function columnIndex(col: SodexoMatrizColumn): number {
  if (col === 'A') return 5
  return Math.min(4, Math.max(0, Number(col) - 1))
}

function resolveFactorId(token: string): string | null {
  const t = token.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  if (SODEXO_MATRIZ_FACTOR_LEVELS[t]) return t
  for (const [kw, id] of Object.entries(SODEXO_MATRIZ_KEYWORD_ALIASES)) {
    const k = kw.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    if (t.includes(k)) return id
  }
  return null
}

/** Legacy: `ruido:3; calor:2` en observaciones. */
export function parseMatrizFromText(text: string | null | undefined): Record<string, SodexoMatrizColumn[]> {
  const out: Record<string, SodexoMatrizColumn[]> = {}
  const raw = (text ?? '').trim()
  if (!raw) return out

  const chunks = raw.split(/[\n;,]+/).map((x) => x.trim()).filter(Boolean)
  for (const chunk of chunks) {
    const m = chunk.match(/^(.+?)\s*[:=]\s*([1-5aA])$/i) ?? chunk.match(/^(.+?)\s+([1-5aA])$/i)
    if (!m) continue
    const id = resolveFactorId(m[1])
    const lvl = m[2].toUpperCase() as SodexoMatrizColumn
    if (id && /^[1-5A]$/.test(lvl)) out[id] = [lvl]
  }
  return out
}

export function fillSodexoMatrizRiesgos(
  form: PdfForm,
  ext: SodexoExtensionData | null,
  riesgosTrabajoText: string | null | undefined,
) {
  const merged: Record<string, SodexoMatrizColumn[]> = {
    ...parseMatrizFromText(riesgosTrabajoText),
    ...parseMatrizFromText(ext?.matriz_riesgos_observaciones),
  }

  const structured = ext?.matriz_factores ?? {}
  for (const [k, v] of Object.entries(structured)) {
    const cols = normalizeMatrizFactorValue(v)
    if (cols.length) merged[k] = cols
  }

  for (const [factorId, columnas] of Object.entries(merged)) {
    const boxes = SODEXO_MATRIZ_FACTOR_LEVELS[factorId]
    if (!boxes || boxes.length < 6) continue
    for (const col of columnas) {
      const idx = columnIndex(col)
      sodexoSetCheck(form, boxes[idx], true)
    }
  }

  if (ext?.matriz_riesgos_observaciones) {
    sodexoSetText(form, 'Texto129', ext.matriz_riesgos_observaciones)
  }
}
