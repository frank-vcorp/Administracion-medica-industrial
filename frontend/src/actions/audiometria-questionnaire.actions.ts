/**
 * @fileoverview Server Action para guardar el cuestionario auditivo de
 *   Audiometría en `EventTest.clinicalContext` (FEATURE-20260825-02).
 *
 * Contrato (paralelo a `espirometria-questionnaire.actions.ts`):
 *   - Valida el payload con Zod server-side (rechaza inválidos → AC-4).
 *   - Guarda atómicamente por `eventTestId`; editar reemplaza el snapshot.
 *   - No duplica PII; el encabezado lo aporta la papeleta.
 *   - No emite diagnóstico ni aptitud.
 *   - El helper puro de validación vive en
 *     `frontend/src/lib/clinical/audiometria-questionnaire-validate.ts` para
 *     mantener el archivo como `'use server'` puro en Next.js 16.
 *
 * @id IMPL-FEATURE-20260825-02
 * @backup context/SPECs/SPEC-FEATURE-20260825-02-AUDIOMETRIA-ENTREGABLE.md
 */
'use server'

import { revalidatePath } from 'next/cache'
import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import type { AudiometriaQuestionnairePayload } from '@/schemas/clinical/audiometria-questionnaire.schema'
// Helper puro (síncrono) vive en `@/lib/clinical/audiometria-questionnaire-validate`.

export type SaveAudiometriaQuestionnaireResult =
  | {
      success: true
      eventTestId: string
      payload: AudiometriaQuestionnairePayload
      updatedAt: string
    }
  | {
      success: false
      error: string
      fieldErrors?: Record<string, string[]>
    }

/**
 * Guarda (o reemplaza) el cuestionario auditivo de Audiometría asociado a
 * un EventTest. La operación es atómica y reemplaza el snapshot actual.
 *
 * Defensa contra IDs cruzados: rechaza si el `eventTestId` no pertenece
 * al `eventId` indicado (mismo patrón que el cuestionario de Espirometría).
 */
export async function saveAudiometriaQuestionnaire(
  eventTestId: string,
  rawPayload: unknown,
  eventId: string,
): Promise<SaveAudiometriaQuestionnaireResult> {
  if (!eventTestId || !eventId) {
    return { success: false, error: 'Faltan parámetros obligatorios' }
  }

  // Importación local (lazy) para evitar que el archivo 'use server' tenga
  // un import síncrono de un módulo pesado. Además coincide con el patrón
  // del cuestionario de Espirometría tras el FIX-Vercel-Build.
  const { validateAudiometriaQuestionnairePayload } = await import(
    '@/lib/clinical/audiometria-questionnaire-validate'
  )

  // 1. Validación Zod server-side (AC-4). Rechaza payloads inválidos con
  //    detalle campo a campo para que la UI muestre el error.
  const validation = validateAudiometriaQuestionnairePayload(rawPayload)
  if (!validation.valid) {
    return {
      success: false,
      error: validation.error,
      fieldErrors: validation.fieldErrors,
    }
  }
  const payload = validation.payload

  // 2. Verificar que el EventTest existe y pertenece al evento indicado.
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
      '[IMPL-FEATURE-20260825-02] saveAudiometriaQuestionnaire failed:',
      err,
    )
    return {
      success: false,
      error: 'No se pudo guardar el cuestionario. Intente nuevamente.',
    }
  }
}