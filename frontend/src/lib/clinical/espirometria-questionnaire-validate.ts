/**
 * @fileoverview Helper puro síncrono para validar payloads del cuestionario
 *   de Espirometría (FEATURE-20260824-02).
 *
 * FIX-Vercel-Build (2026-08-25): este helper se extrajo del archivo
 *   `frontend/src/actions/espirometria-questionnaire.actions.ts` porque
 *   Next.js 16 / Turbopack rechaza exports síncronos en archivos con
 *   `'use server'` (los archivos de server actions sólo pueden exportar
 *   funciones `async`). Mantenerlo aquí, como utility sincronizable y
 *   libremente testeable, preserva la semántica original y desbloquea
 *   el build Vercel.
 *
 * Patrón equivalente al de `study-type-mismatch-note.ts` (mismo
 * microkernel, mismo `lib/clinical/`).
 *
 * La validación Zod es la única fuente de verdad: `saveEspirometriaQuestionnaire`
 * (en `actions/`) usa este mismo helper internamente; cualquier cambio
 * aquí debe replicarse en el server action.
 *
 * @id IMPL-FEATURE-20260824-02
 * @backup context/SPECs/SPEC-FEATURE-20260824-02-CUESTIONARIO-ESPIROMETRIA.md
 */

import {
  EspirometriaQuestionnairePayloadSchema,
  type EspirometriaQuestionnairePayload,
} from '@/schemas/clinical/espirometria-questionnaire.schema'

export type ValidatedClinicalContextPayload =
  | { valid: true; payload: EspirometriaQuestionnairePayload }
  | { valid: false; error: string; fieldErrors: Record<string, string[]> }

/**
 * Helper puro síncrono que valida un payload candidato del cuestionario
 * contra `EspirometriaQuestionnairePayloadSchema` (Zod). Devuelve un
 * resultado discriminado por `valid` para que callers (server action y
 * tests) puedan manejar el éxito y el rechazo con detalle de campo.
 *
 * No es un server action: se mantiene en `lib/` para que pueda ser
 * importado desde tests, desde server actions y desde cualquier otro
 * consumer sin restricciones del runtime `'use server'` de Next.js 16.
 */
export function validateEspirometriaQuestionnairePayload(
  rawPayload: unknown,
): ValidatedClinicalContextPayload {
  const parsed = EspirometriaQuestionnairePayloadSchema.safeParse(rawPayload)
  if (parsed.success) {
    return { valid: true, payload: parsed.data }
  }
  const fieldErrors: Record<string, string[]> = {}
  for (const issue of parsed.error.issues) {
    const key = issue.path.join('.') || '_root'
    if (!fieldErrors[key]) fieldErrors[key] = []
    fieldErrors[key].push(issue.message)
  }
  return {
    valid: false,
    error: 'Datos del cuestionario inválidos. Revise los campos marcados.',
    fieldErrors,
  }
}
