/**
 * @file Helpers para el acordeón Sí/Negado/No Aplica del PatologicosSchema.
 *
 * @id IMPL-20260817-06
 * @spec ATLAS → SOFIA handoff (acordeón colapsable con resumen)
 *
 * **Por qué existe:** el comportamiento del acordeón Patologicos
 * (IMPL-20260817-04) ahora distingue entre "estado SÍ + 3 campos vacíos"
 * (mostrar inputs desplegados) y "estado SÍ + 3 campos con contenido"
 * (mostrar resumen colapsado, click para expandir). Esta distinción es
 * idéntica en `AntecedentesCaptura` (snapshot por cita) y
 * `AntecedentesForm` (editor maestro longitudinal) — extraer el helper
 * evita duplicación y permite testearlo en aislamiento desde
 * `medical-exam.actions.test.ts`.
 *
 * **Contrato:** `hasDetalleContent(undefined)` → `false` (caso seguro
 * para cuando la entry está en estado `NEGADO`/`NO APLICA` y `detalle`
 * es `undefined`).
 */

import type { DetalleTriple } from '@/schemas/clinical/history.schema'

/**
 * Determina si un `DetalleTriple` tiene al menos un campo con contenido
 * significativo (no-vacío y no-whitespace-only). Es la condición para
 * colapsar el acordeón Patologicos en vista resumen.
 *
 * @param d - `DetalleTriple` o `undefined` (este último devuelve `false`).
 * @returns `true` si al menos uno de `desde_cuando`, `tratamiento`,
 *          `observaciones` tiene texto no-whitespace.
 *
 * @example
 *   hasDetalleContent({ desde_cuando: '', tratamiento: '', observaciones: '' })  // false
 *   hasDetalleContent({ desde_cuando: '15 años', tratamiento: '', observaciones: '' })  // true
 *   hasDetalleContent({ desde_cuando: '   ', tratamiento: '', observaciones: '' })  // false
 *   hasDetalleContent(undefined)  // false
 */
export function hasDetalleContent(d: DetalleTriple | undefined): boolean {
  if (!d) return false
  return Boolean(
    (d.desde_cuando && d.desde_cuando.trim()) ||
    (d.tratamiento && d.tratamiento.trim()) ||
    (d.observaciones && d.observaciones.trim()),
  )
}
