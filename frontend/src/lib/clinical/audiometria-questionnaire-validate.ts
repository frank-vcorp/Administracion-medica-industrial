/**
 * @fileoverview Helper puro síncrono para validar payloads del cuestionario
 *   de Audiometría (FEATURE-20260825-02).
 *
 * Mismo patrón que `espirometria-questionnaire-validate.ts`:
 *   - Extraído del archivo `'use server'` porque Next.js 16 / Turbopack
 *     rechaza exports síncronos en server actions.
 *   - Mantenido en `lib/` para que pueda ser importado desde tests, server
 *     actions y cualquier otro consumer sin restricciones del runtime.
 *   - La validación Zod es la única fuente de verdad.
 *
 * @id IMPL-FEATURE-20260825-02
 * @backup context/SPECs/SPEC-FEATURE-20260825-02-AUDIOMETRIA-ENTREGABLE.md
 */

import {
  AudiometriaQuestionnairePayloadSchema,
  type AudiometriaQuestionnairePayload,
} from '@/schemas/clinical/audiometria-questionnaire.schema'

export type ValidatedAudiometriaClinicalContextPayload =
  | { valid: true; payload: AudiometriaQuestionnairePayload }
  | { valid: false; error: string; fieldErrors: Record<string, string[]> }

/**
 * Helper puro síncrono que valida un payload candidato del cuestionario
 * contra `AudiometriaQuestionnairePayloadSchema` (Zod). Devuelve un
 * resultado discriminado por `valid` para que callers (server action y
 * tests) puedan manejar el éxito y el rechazo con detalle de campo.
 */
export function validateAudiometriaQuestionnairePayload(
  rawPayload: unknown,
): ValidatedAudiometriaClinicalContextPayload {
  const parsed = AudiometriaQuestionnairePayloadSchema.safeParse(rawPayload)
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