/**
 * @file FIX-20260821-01 §4.5: Helper que produce el label del stage "extracting"
 * a partir del provider extractivo real expuesto por
 * `extraction_snapshot.audit.extraction_provider_used`.
 *
 * Reglas (ver SPEC_FIX-20260821-01-GATE-TABLEAWARE-ESPIROMETRIA.md §4.5):
 * - 'm3' → "Extrayendo datos con Minimax" (provider vigente tras FIX-20260812-12).
 * - 'gemini' → "Extrayendo datos con Gemini".
 * - cualquier otro / ausente → texto neutro "Extrayendo datos" sin afirmar proveedor.
 *
 * Se exporta separado de `PapeletaWorkspace.tsx` para poder testearse con
 * vitest sin necesidad de DOM environment (test puro sobre strings).
 *
 * @id IMPL-20260821-01-UI-LABEL
 */

export type ExtractionProvider = 'm3' | 'gemini' | 'xml_parser' | (string & {})

/**
 * Devuelve el label del stage "extracting" según el provider extractivo.
 *
 * @param provider - Valor de `extraction_snapshot.audit.extraction_provider_used`.
 *                   Si es null/undefined/'' se devuelve texto neutro.
 * @returns string - Label a renderizar en el panel de progreso.
 */
export function extractingStageLabel(provider: ExtractionProvider | null | undefined): string {
  const p = (provider || '').toLowerCase()
  if (p === 'm3') return 'Extrayendo datos con Minimax'
  if (p === 'gemini') return 'Extrayendo datos con Gemini'
  return 'Extrayendo datos'
}