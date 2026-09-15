/**
 * Validación pura del cuestionario de Campimetría.
 * Fuera de `'use server'` por Next.js 16 / Turbopack.
 *
 * @id IMPL-FEATURE-20260914-01
 */
import {
  CampimetriaQuestionnairePayloadSchema,
  type CampimetriaQuestionnairePayload,
} from '@/schemas/clinical/campimetria-questionnaire.schema'

export type ValidatedCampimetriaClinicalContextPayload =
  | { valid: true; payload: CampimetriaQuestionnairePayload }
  | { valid: false; error: string; fieldErrors: Record<string, string[]> }

export function validateCampimetriaQuestionnairePayload(
  rawPayload: unknown,
): ValidatedCampimetriaClinicalContextPayload {
  const parsed = CampimetriaQuestionnairePayloadSchema.safeParse(rawPayload)
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
    error: 'Datos de campimetría inválidos. Revise los campos marcados.',
    fieldErrors,
  }
}
