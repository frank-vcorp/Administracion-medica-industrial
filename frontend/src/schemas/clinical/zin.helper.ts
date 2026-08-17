/**
 * @file Helpers compartidos para campos con catálogo ZIN (DA-1, Opción A).
 *
 * Helper neutral sin dependencias entre esquemas para evitar ciclos de
 * import entre `exam.schema.ts` ↔ `history.schema.ts`.
 *
 * Ver ADR-20260817-01 y SPEC_ARCH-20260817-01 §2.1.
 *
 * @id IMPL-20260817-03
 */
import { z } from 'zod'

/**
 * Schema Zod tolerante para campo ZIN (DA-1, Opción A).
 *
 * Acepta:
 *   - Valores del catálogo `enumValues` (captura nueva via UI `<select>`).
 *   - Cualquier string no-vacío (registros legacy en BD — sin migración).
 *   - String vacío (compatibilidad con campos opcionales: `campimetria`,
 *     `test_ishihara` que permitían blank en captura legacy).
 *
 * Rechaza únicamente `undefined`/`null` puros (lo cubre el wrapper).
 *
 * @id IMPL-20260817-01-C1 (extracted IMPL-20260817-03 para evitar ciclo)
 */
export function tolerantZinEnum(enumValues: readonly string[]) {
  return z.string().refine(
    (v) => v === '' || enumValues.includes(v) || v.length > 0,
    { message: 'Valor fuera del catálogo ZIN; aceptado como legacy.' }
  )
}
