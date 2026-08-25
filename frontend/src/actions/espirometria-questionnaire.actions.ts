/**
 * @fileoverview Server Action para guardar el cuestionario emergente de
 *   Espirometría en `EventTest.clinicalContext` (FEATURE-20260824-02).
 *
 * Contrato:
 *   - Valida el payload con Zod server-side (rechaza inválidos → AC-4).
 *   - Guarda atómicamente por `eventTestId`; editar reemplaza el snapshot
 *     actual y conserva `updatedAt`.
 *   - No duplica PII; el encabezado lo aporta la papeleta (no se reescribe).
 *   - No emite diagnóstico ni aptitud (FEATURE-20260824-02 §Prohibido).
 *
 * FIX-Vercel-Build (2026-08-25): Next.js 16 / Turbopack rechaza exports
 *   síncronos en archivos con `'use server'`. El helper puro de validación
 *   (`validateEspirometriaQuestionnairePayload`) se movió a
 *   `frontend/src/lib/clinical/espirometria-questionnaire-validate.ts`
 *   y se reimporta aquí. Este archivo sólo expone `async` exports, que
 *   es lo que el runtime de Next.js requiere.
 *
 * @id IMPL-FEATURE-20260824-02
 * @backup context/SPECs/SPEC-FEATURE-20260824-02-CUESTIONARIO-ESPIROMETRIA.md
 */
'use server'

import { revalidatePath } from 'next/cache'
import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import {
  EspirometriaQuestionnairePayloadSchema,
  type EspirometriaQuestionnairePayload,
} from '@/schemas/clinical/espirometria-questionnaire.schema'
// Helper puro (síncrono) vive en `@/lib/clinical/espirometria-questionnaire-validate`.
// No se re-exporta desde este archivo (los módulos `'use server'` sólo pueden
// exportar funciones `async` en Next.js 16). Los consumidores que necesiten
// el helper deben importarlo directamente desde su nueva ubicación.

export type SaveEspirometriaQuestionnaireResult =
  | {
      success: true
      eventTestId: string
      payload: EspirometriaQuestionnairePayload
      updatedAt: string
    }
  | {
      success: false
      error: string
      // Issues estructurados para que la UI muestre errores campo a campo.
      fieldErrors?: Record<string, string[]>
    }

/**
 * Guarda (o reemplaza) el cuestionario de Espirometría asociado a un
 * EventTest. La operación es atómica y reemplaza el snapshot actual.
 */
export async function saveEspirometriaQuestionnaire(
  eventTestId: string,
  rawPayload: unknown,
  eventId: string,
): Promise<SaveEspirometriaQuestionnaireResult> {
  if (!eventTestId || !eventId) {
    return { success: false, error: 'Faltan parámetros obligatorios' }
  }

  // 1. Validación Zod server-side (AC-4). Rechaza payloads inválidos con
  //    detalle campo a campo para que la UI muestre el error (AC-4).
  const parsed = EspirometriaQuestionnairePayloadSchema.safeParse(rawPayload)
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path.join('.') || '_root'
      if (!fieldErrors[key]) fieldErrors[key] = []
      fieldErrors[key].push(issue.message)
    }
    return {
      success: false,
      error: 'Datos del cuestionario inválidos. Revise los campos marcados.',
      fieldErrors,
    }
  }

  const payload = parsed.data

  // 2. Verificar que el EventTest existe y pertenece al evento indicado.
  //    No permitimos escribir un cuestionario contra un EventTest que
  //    corresponda a otro MedicalEvent (defensa contra IDs cruzados).
  const eventTest = await prisma.eventTest.findUnique({
    where: { id: eventTestId },
    select: { id: true, eventId: true },
  })
  if (!eventTest) {
    return { success: false, error: 'El estudio no existe.' }
  }
  if (eventTest.eventId !== eventId) {
    return {
      success: false,
      error: 'El estudio no pertenece al evento indicado.',
    }
  }

  // 3. Persistencia atómica: reemplazo total del snapshot.
  //    No mezclamos con merge parcial para preservar el contrato
  //    "editar reemplaza el snapshot actual" del SPEC.
  try {
    const updated = await prisma.eventTest.update({
      where: { id: eventTestId },
      data: {
        clinicalContext: payload as unknown as Prisma.InputJsonValue,
      },
      select: { id: true, updatedAt: true },
    })
    revalidatePath(`/events/${eventId}`)
    return {
      success: true,
      eventTestId: updated.id,
      payload,
      updatedAt: updated.updatedAt.toISOString(),
    }
  } catch (err) {
    console.error(
      '[IMPL-FEATURE-20260824-02] saveEspirometriaQuestionnaire failed:',
      err,
    )
    return {
      success: false,
      error: 'No se pudo guardar el cuestionario. Intente nuevamente.',
    }
  }
}
