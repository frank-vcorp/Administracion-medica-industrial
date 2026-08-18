/**
 * @file Helpers para clasificación de aptitud laboral (IMPL-20260817-08-C3).
 *
 * Convierte el campo estructurado `aptitud` (5 valores del PDF canónico +
 * legacy `'NO APTO'`) en estados booleanos para el portal B2B.
 *
 * **Motivación DA-1 (ARCH-20260817-02):** el literal canónico del PDF de
 * referencia para "no apto" es
 * `"NO CUMPLE CON LOS CRITERIOS DE SALUD PARA EL PUESTO PROPUESTO"`, que NO
 * contiene la subcadena `"no apto"`. La heurística histórica del portal
 * (`finalDiagnosis.toLowerCase().includes('no apto')`) lo clasificaría
 * erróneamente como APTO. Estos helpers leen el campo estructurado
 * `aptitud` y preservan el fallback legacy solo si la `aptitud` es nula.
 *
 * **Reversibilidad:** cada callsite decide cómo extraer `aptitud` (del
 * `physicalExamData` estructurado, del `finalDiagnosis` legacy, o de ambos).
 * Si en una SPEC futura se migra `aptitud` a columna Prisma, solo cambia el
 * extractor — los helpers siguen igual.
 *
 * @id IMPL-20260817-08-C3
 * @spec SPEC_ARCH-20260817-02 §2.1 (DA-1), §6
 */
import { APTITUD_VALUES } from '@/schemas/clinical/exam.schema'

/**
 * Determina si una `aptitud` representa un dictamen "apto" (cualquier variante
 * apta: simple, condicionado, con restricciones).
 *
 * Acepta:
 * - `'APTO'`
 * - `'APTO CONDICIONADO'`
 * - `'APTO CON RESTRICCIONES'`
 * - Cualquier variante en mayúsculas/minúsculas (`'apto'`, `'Apto Condicionado'`, etc.)
 *
 * Rechaza:
 * - `null` / `undefined` / string vacío → `false`
 * - `'NO CUMPLE CON LOS CRITERIOS DE SALUD PARA EL PUESTO PROPUESTO'` → `false`
 * - `'NO APTO'` (legacy) → `false`
 * - `'PENDIENTE DE RESULTADOS'` → `false`
 *
 * @param aptitud - Valor del campo estructurado `aptitud` (puede ser null/undefined).
 * @returns `true` si el dictamen es apto en cualquiera de sus variantes.
 */
export function isAptoFromVerdict(
  aptitud: string | null | undefined
): boolean {
  if (!aptitud) return false
  const v = aptitud.toUpperCase().trim()
  return (
    v === 'APTO' ||
    v === 'APTO CONDICIONADO' ||
    v === 'APTO CON RESTRICCIONES'
  )
}

/**
 * Determina si una `aptitud` representa un dictamen "no cumple" / "no apto".
 *
 * Acepta:
 * - `'NO CUMPLE CON LOS CRITERIOS DE SALUD PARA EL PUESTO PROPUESTO'` (literal canónico PDF)
 * - `'NO APTO'` (legacy — DA-1)
 *
 * Rechaza:
 * - `null` / `undefined` / string vacío → `false`
 * - Cualquier variante de "apto" → `false`
 * - `'PENDIENTE DE RESULTADOS'` → `false`
 *
 * @param aptitud - Valor del campo estructurado `aptitud`.
 * @returns `true` si el dictamen es no-cumple o legacy no-apto.
 */
export function isNoCumple(
  aptitud: string | null | undefined
): boolean {
  if (!aptitud) return false
  const v = aptitud.toUpperCase().trim()
  return (
    v === 'NO CUMPLE CON LOS CRITERIOS DE SALUD PARA EL PUESTO PROPUESTO' ||
    v === 'NO APTO'
  )
}

/**
 * Determina si una `aptitud` representa un dictamen pendiente de resultados.
 *
 * @param aptitud - Valor del campo estructurado `aptitud`.
 * @returns `true` si el dictamen es `'PENDIENTE DE RESULTADOS'`.
 */
export function isPendienteResultados(
  aptitud: string | null | undefined
): boolean {
  if (!aptitud) return false
  return aptitud.toUpperCase().trim() === 'PENDIENTE DE RESULTADOS'
}

/**
 * Etiqueta corta de aptitud para badges del portal (sin prefijos ni sufijos).
 * Mapea los 5 valores canónicos + legacy a labels cortos consistentes con la UI.
 *
 * @param aptitud - Valor del campo estructurado `aptitud`.
 * @returns Etiqueta corta (`'APTO'`, `'APTO CONDICIONADO'`, etc.) o el valor
 *          original si no está en el enum nuevo (para registros legacy no
 *          esperados: se muestra literal).
 */
export function aptitudLabel(aptitud: string | null | undefined): string {
  if (!aptitud) return ''
  // APTITUD_VALUES ya contiene los 5 literales canónicos (en MAYÚSCULAS).
  if ((APTITUD_VALUES as readonly string[]).includes(aptitud)) {
    return aptitud
  }
  // Legacy: si es 'NO APTO' (legacy DA-1), mostrar 'NO APTO'.
  if (aptitud.toUpperCase().trim() === 'NO APTO') {
    return 'NO APTO'
  }
  // Fallback: mostrar literal original (registros con strings inesperados).
  return aptitud
}
