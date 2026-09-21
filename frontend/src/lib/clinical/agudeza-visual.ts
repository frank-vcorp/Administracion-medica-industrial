/**
 * Parámetros y clasificación de agudeza visual (R-08 / CAMPIMETRÍA.xlsx + ZIN).
 * Fuente única para examen médico, estudio Agudeza Visual y herencia campimetría.
 */

import { VISION_SNELLEN_VALUES } from '@/schemas/clinical/exam.schema'

export const VISION_SNELLEN_NO_APLICA = 'NO APLICA' as const

/** Opciones de captura UI: incluye NO APLICA + escala Snellen. */
export const VISION_SNELLEN_SELECT_OPTIONS = [
  VISION_SNELLEN_NO_APLICA,
  ...VISION_SNELLEN_VALUES,
] as const

export function parseSnellenDenominator(
  value: string | null | undefined,
): number | null {
  const trimmed = String(value ?? '').trim()
  if (!trimmed || trimmed === VISION_SNELLEN_NO_APLICA) return null
  const match = trimmed.match(/^20\/(\d+)$/)
  if (!match) return null
  return parseInt(match[1], 10)
}

/**
 * Visión lejana OD/OI → resumen canónico (peor ojo).
 * >20/30 → DISMINUIDA; ≤20/25 → NORMAL; intermedio → BAJA AL MOMENTO DE LA TOMA.
 */
export function deriveAgudezaVisualResumen(
  od: string | null | undefined,
  oi: string | null | undefined,
): string {
  const a = parseSnellenDenominator(od)
  const b = parseSnellenDenominator(oi)
  if (a === null && b === null) return ''
  const worst = Math.max(a ?? 30, b ?? 30)
  if (worst > 30) return 'DISMINUIDA'
  if (worst <= 25) return 'NORMAL'
  return 'BAJA AL MOMENTO DE LA TOMA'
}
