/**
 * @fileoverview Server Action — captura de Campimetría en clinicalContext.
 * @id IMPL-FEATURE-20260914-01
 * @backup context/SPECs/SPEC-FEATURE-20260914-01-CAMPIMETRIA-CUESTIONARIO.md
 */
'use server'

import { revalidatePath } from 'next/cache'
import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import type { CampimetriaQuestionnairePayload } from '@/schemas/clinical/campimetria-questionnaire.schema'
import { inheritAcuityFromExam } from '@/lib/clinical/campimetria-inherited'
import { buildCampimetriaExtractedData } from '@/lib/clinical/campimetria-report'
import { triggerStructuredStudyAIPrediagnosis } from '@/actions/ai-prediagnosis.actions'

export type SaveCampimetriaQuestionnaireResult =
  | {
      success: true
      eventTestId: string
      payload: CampimetriaQuestionnairePayload
      updatedAt: string
      aiWarning?: string
    }
  | {
      success: false
      error: string
      fieldErrors?: Record<string, string[]>
    }

export async function saveCampimetriaQuestionnaire(
  eventTestId: string,
  rawPayload: unknown,
  eventId: string,
  options?: { triggerPrediagnosis?: boolean },
): Promise<SaveCampimetriaQuestionnaireResult> {
  if (!eventTestId || !eventId) {
    return { success: false, error: 'Faltan parámetros obligatorios' }
  }

  const { validateCampimetriaQuestionnairePayload } = await import(
    '@/lib/clinical/campimetria-questionnaire-validate'
  )

  const validation = validateCampimetriaQuestionnairePayload(rawPayload)
  if (!validation.valid) {
    return {
      success: false,
      error: validation.error,
      fieldErrors: validation.fieldErrors,
    }
  }
  const { aptitud: _legacyAptitud, ...payload } = validation.payload

  const eventTest = await prisma.eventTest.findUnique({
    where: { id: eventTestId },
    select: { id: true, eventId: true, testNameSnapshot: true },
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

  const name = eventTest.testNameSnapshot.toLowerCase()
  if (!name.includes('campimetr')) {
    return {
      success: false,
      error: 'Este cuestionario sólo aplica a campimetría.',
    }
  }

  try {
    const updated = await prisma.eventTest.update({
      where: { id: eventTestId },
      data: {
        clinicalContext: payload as unknown as Prisma.InputJsonValue,
      },
      select: { id: true, updatedAt: true },
    })

    const exam = await prisma.medicalExam.findUnique({
      where: { eventId },
      select: { eyeAcuityData: true },
    })
    let aiWarning: string | undefined
    if (options?.triggerPrediagnosis) {
      const extractedData = buildCampimetriaExtractedData({
        payload,
        acuity: inheritAcuityFromExam(
          (exam?.eyeAcuityData as Record<string, unknown> | null) ?? null,
        ),
      })
      const aiResult = await triggerStructuredStudyAIPrediagnosis({
        eventTestId,
        eventId,
        studyType: 'Campimetria',
        extractedData,
      })
      if (!aiResult.success) aiWarning = aiResult.error
      await prisma.eventTest.update({
        where: { id: eventTestId },
        data: {
          resultNotes: aiResult.success
            ? `Campimetría: IA generada (${aiResult.clinicalState ?? 'AI_PENDING_REVIEW'}): ${aiResult.summary ?? ''}`.trim()
            : `Campimetría: captura guardada, pero la IA no generó prediagnóstico: ${aiResult.error ?? 'sin detalle'}`,
        },
      })
    }

    revalidatePath(`/events/${eventId}`)
    return {
      success: true,
      eventTestId: updated.id,
      payload,
      updatedAt: updated.updatedAt.toISOString(),
      aiWarning,
    }
  } catch (err) {
    console.error('[IMPL-FEATURE-20260914-01] saveCampimetriaQuestionnaire failed:', err)
    return {
      success: false,
      error: 'No se pudo guardar la campimetría. Intente nuevamente.',
    }
  }
}
