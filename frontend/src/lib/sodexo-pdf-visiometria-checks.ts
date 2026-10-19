/**
 * Casillas de agudeza visual (§9) — por defecto “sin corrección / normal”.
 */
import type { PdfForm } from '@/lib/sodexo-pdf-acroform'
import { sodexoSetCheck } from '@/lib/sodexo-pdf-acroform'

/** Columna izquierda rejilla visión (sin corrección / normal). */
const VISION_DEFAULT_LEFT = [
  'Check Box818',
  'Check Box816',
  'Check Box814',
  'Check Box812',
  'Check Box810',
  'Check Box808',
] as const

export function fillSodexoVisiometriaChecks(form: PdfForm) {
  for (const name of VISION_DEFAULT_LEFT) {
    sodexoSetCheck(form, name, true)
  }
}
