/**
 * @file Helper para generar fechas relativas en tests e2e (no envejece).
 * @id IMPL-20260804-06 — R6 (deuda residual post-O1)
 *
 * Por qué existe: TC-3, TC-4 y TC-7 usaban fechas hardcodeadas (2026-08-01,
 * 2026-08-05, 2026-08-15) que envejecieron el 2026-08-16 (R6 dictamen GEMINI
 * INFRA-20260805-02). Este helper devuelve fechas dinámicas basadas en
 * `Date.now()` con un offset en días para evitar la time-bomb.
 *
 * Uso:
 *   - Fechas devueltas en formato `YYYY-MM-DD` (lo que esperan los inputs
 *     HTML `<input type="date">` consumidos por getByLabel('Inicio *') etc.).
 *   - Offset positivo = futuro; 0 = hoy.
 *   - Función pura, sin side effects: testeable con vitest si se quisiera.
 */

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

/**
 * Devuelve la fecha actual más `offsetDays` días en formato `YYYY-MM-DD`.
 *
 * @param offsetDays Días a sumar (puede ser negativo).
 * @returns string con formato `YYYY-MM-DD`.
 *
 * @example
 *   dynamicTestDate(7)     // "2026-08-12" si hoy es 2026-08-05
 *   dynamicTestDate(0)      // hoy
 */
export function dynamicTestDate(offsetDays = 0): string {
  const now = new Date()
  // Usar UTC para evitar derivas por zona horaria del runner.
  const target = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  )
  target.setUTCDate(target.getUTCDate() + offsetDays)
  const iso = target.toISOString().slice(0, 10) // YYYY-MM-DD
  if (!ISO_DATE_REGEX.test(iso)) {
    throw new Error(`dynamicTestDate produjo formato inválido: ${iso}`)
  }
  return iso
}

/**
 * Igual a dynamicTestDate pero devuelve objeto Date (para asserts o cálculos).
 */
export function dynamicTestDateAsDate(offsetDays = 0): Date {
  const [y, m, d] = dynamicTestDate(offsetDays).split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}