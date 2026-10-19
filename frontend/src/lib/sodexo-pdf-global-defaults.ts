/**
 * Defaults globales AcroForm para paridad con ejemplo impreso (Niega / Normal).
 * Se ejecuta al final del pipeline, sin pisar casillas ya marcadas.
 */
import type { PdfForm } from '@/lib/sodexo-pdf-acroform'
import {
  sodexoDefaultNiegaPair,
  sodexoDefaultNormalPair,
  sodexoIsChecked,
  sodexoSetCheck,
  type SodexoNoSiPair,
  type SodexoNormalPair,
} from '@/lib/sodexo-pdf-acroform'
import { loadSodexoFieldGeometry, type SodexoFieldGeo } from '@/lib/sodexo-pdf-geometry'

export type SodexoPairKind = 'niega' | 'normal'

export type DetectedPair = {
  kind: SodexoPairKind
  left: string
  right: string
  page: number
  y: number
  x: number
}

function skipCheckbox(page: number, x: number, y: number): boolean {
  if (page === 0 && y >= 165 && y <= 225 && x >= 215) return true
  if (page === 0 && y >= 108 && y <= 148) return true
  if (page === 0 && y >= 580) return true
  if (page === 1 && y >= 235 && y <= 265) return true
  return false
}

function classifyPairKind(page: number, x: number, y: number): SodexoPairKind {
  if (page === 2 && y >= 470) {
    if (x < 280) return 'normal'
    if (y >= 540 && y <= 720 && x < 220) return 'normal'
  }
  if (page === 1 && y >= 270 && y <= 295) return 'niega'
  return 'niega'
}

/** Detecta pares adyacentes No/Sí o Normal/Anormal por fila (geometría). */
export function detectSodexoCheckboxPairs(): DetectedPair[] {
  const geo = loadSodexoFieldGeometry()
  const cbs = geo.filter((f) => f.type === 'CheckBox')
  const byPageY = new Map<string, SodexoFieldGeo[]>()

  for (const f of cbs) {
    if (skipCheckbox(f.page, f.x, f.y)) continue
    const yKey = Math.round(f.y / 3) * 3
    const key = `${f.page}:${yKey}`
    if (!byPageY.has(key)) byPageY.set(key, [])
    byPageY.get(key)!.push(f)
  }

  const out: DetectedPair[] = []
  const seen = new Set<string>()

  for (const [key, row] of byPageY) {
    const page = Number(key.split(':')[0])
    const y = Number(key.split(':')[1])
    const sorted = [...row].sort((a, b) => a.x - b.x)
    for (let i = 0; i < sorted.length - 1; i++) {
      const left = sorted[i]
      const right = sorted[i + 1]
      const dx = right.x - left.x
      if (dx < 12 || dx > 55) continue
      const sig = `${left.name}|${right.name}`
      if (seen.has(sig)) continue
      seen.add(sig)
      const kind = classifyPairKind(page, left.x, y)
      out.push({
        kind,
        left: left.name,
        right: right.name,
        page,
        y,
        x: left.x,
      })
      i++
    }
  }
  return out
}

export function applySodexoGlobalCheckboxDefaults(form: PdfForm) {
  const pairs = detectSodexoCheckboxPairs()
  for (const p of pairs) {
    if (p.kind === 'normal') {
      sodexoDefaultNormalPair(form, { normal: p.left, abnormal: p.right } as SodexoNormalPair)
    } else {
      sodexoDefaultNiegaPair(form, { no: p.left, si: p.right } as SodexoNoSiPair)
    }
  }
}

/** Casillas sueltas (grids 1–5+A) sin marcar: no se tocan. */
/** Filas con 3+ casillas: si ninguna marcada, marca la más a la izquierda (rejillas APP / examen). */
export function applySodexoRowLeftmostCheckboxDefaults(form: PdfForm) {
  const geo = loadSodexoFieldGeometry().filter((f) => f.type === 'CheckBox')
  const byKey = new Map<string, SodexoFieldGeo[]>()

  for (const f of geo) {
    if (skipCheckbox(f.page, f.x, f.y)) continue
    if (f.page === 0 && f.y >= 165 && f.y <= 225 && f.x >= 215) continue
    const yKey = Math.round(f.y / 4) * 4
    const key = `${f.page}:${yKey}`
    if (!byKey.has(key)) byKey.set(key, [])
    byKey.get(key)!.push(f)
  }

  for (const row of byKey.values()) {
    const sorted = [...row].sort((a, b) => a.x - b.x)
    if (sorted.length < 3) continue
    const any = sorted.some((f) => sodexoIsChecked(form, f.name))
    if (any) continue
    sodexoSetCheck(form, sorted[0].name, true)
  }
}

export function applySodexoMatrizNoExposureDefaults(form: PdfForm) {
  const geo = loadSodexoFieldGeometry()
  const matriz = geo.filter(
    (f) =>
      f.type === 'CheckBox' &&
      f.page === 0 &&
      f.y >= 165 &&
      f.y <= 225 &&
      f.x >= 215,
  )
  for (const f of matriz) {
    if (!sodexoIsChecked(form, f.name)) {
      // sin exposición declarada → ningún nivel
    }
  }
}
