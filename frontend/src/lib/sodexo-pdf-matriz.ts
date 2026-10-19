/**
 * §3 Matriz de riesgos — casillas 1–5 + A desde extensión o texto libre.
 */
import type { SodexoExtensionData } from '@/schemas/clinical/examen-medico-variant.schema'
import type { PdfForm } from '@/lib/sodexo-pdf-acroform'
import { sodexoSetCheck, sodexoSetText } from '@/lib/sodexo-pdf-acroform'
import {
  SODEXO_MATRIZ_FACTOR_LEVELS,
  SODEXO_MATRIZ_KEYWORD_ALIASES,
} from '@/lib/sodexo-pdf-matriz-map'

export type MatrizNivel = '1' | '2' | '3' | '4' | '5' | 'A'

function nivelIndex(n: MatrizNivel): number {
  if (n === 'A') return 5
  return Math.min(4, Math.max(0, Number(n) - 1))
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

/** `ruido:3; calor:2` o líneas `ruido 3` en textarea de extensión. */
export function parseMatrizFromText(text: string | null | undefined): Record<string, MatrizNivel> {
  const out: Record<string, MatrizNivel> = {}
  const raw = (text ?? '').trim()
  if (!raw) return out

  const chunks = raw.split(/[\n;,]+/).map((x) => x.trim()).filter(Boolean)
  for (const chunk of chunks) {
    const m = chunk.match(/^(.+?)\s*[:=]\s*([1-5aA])$/i) ?? chunk.match(/^(.+?)\s+([1-5aA])$/i)
    if (!m) {
      const id = resolveFactorId(chunk)
      if (id) out[id] = '2'
      continue
    }
    const id = resolveFactorId(m[1])
    const lvl = m[2].toUpperCase() as MatrizNivel
    if (id && /^[1-5A]$/.test(lvl)) out[id] = lvl
  }
  return out
}

export function fillSodexoMatrizRiesgos(
  form: PdfForm,
  ext: SodexoExtensionData | null,
  riesgosTrabajoText: string | null | undefined,
) {
  const structured = (ext?.matriz_factores ?? {}) as Record<string, MatrizNivel | string>
  const fromText = parseMatrizFromText(ext?.matriz_riesgos_observaciones)
  const fromRiesgos = parseMatrizFromText(riesgosTrabajoText)

  const merged: Record<string, MatrizNivel> = { ...fromRiesgos, ...fromText }
  for (const [k, v] of Object.entries(structured)) {
    const lvl = String(v).toUpperCase() as MatrizNivel
    if (/^[1-5A]$/.test(lvl)) merged[k] = lvl
  }

  for (const [factorId, nivel] of Object.entries(merged)) {
    const boxes = SODEXO_MATRIZ_FACTOR_LEVELS[factorId]
    if (!boxes || boxes.length < 6) continue
    const idx = nivelIndex(nivel)
    sodexoSetCheck(form, boxes[idx], true)
  }

  if (ext?.matriz_riesgos_observaciones) {
    sodexoSetText(form, 'Texto129', ext.matriz_riesgos_observaciones)
  }
}
