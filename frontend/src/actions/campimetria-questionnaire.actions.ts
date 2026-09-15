/**
 * @fileoverview Server Action — captura de Campimetría en clinicalContext.
 * @id IMPL-FEATURE-20260914-01
 * @backup context/SPECs/SPEC-FEATURE-20260914-01-CAMPIMETRIA-CUESTIONARIO.md
 */
'use server'

import { revalidatePath } from 'next/cache'
import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import {
  CAMPIMETRIA_QUESTIONNAIRE_SCHEMA_VERSION,
  type CampimetriaQuestionnairePayload,
} from '@/schemas/clinical/campimetria-questionnaire.schema'
import { inheritAcuityFromExam } from '@/lib/clinical/campimetria-inherited'
import { buildCampimetriaExtractedData } from '@/lib/clinical/campimetria-report'
import { triggerStructuredStudyAIPrediagnosis } from '@/actions/ai-prediagnosis.actions'

async function runCampimetriaPrediagnosis(input: {
  eventTestId: string
  eventId: string
  payload: CampimetriaQuestionnairePayload
}): Promise<{ aiWarning?: string }> {
  const exam = await prisma.medicalExam.findUnique({
    where: { eventId: input.eventId },
    select: { eyeAcuityData: true },
  })
  const { aptitud: _legacyAptitud, ...payload } = input.payload
  const extractedData = buildCampimetriaExtractedData({
    payload,
    acuity: inheritAcuityFromExam(
      (exam?.eyeAcuityData as Record<string, unknown> | null) ?? null,
    ),
  })
  const aiResult = await triggerStructuredStudyAIPrediagnosis({
    eventTestId: input.eventTestId,
    eventId: input.eventId,
    studyType: 'Campimetria',
    extractedData,
  })
  await prisma.eventTest.update({
    where: { id: input.eventTestId },
    data: {
      resultNotes: aiResult.success
        ? `Campimetría: IA generada (${aiResult.clinicalState ?? 'AI_PENDING_REVIEW'}): ${aiResult.summary ?? ''}`.trim()
        : `Campimetría: captura guardada, pero la IA no generó prediagnóstico: ${aiResult.error ?? 'sin detalle'}`,
    },
  })
  return aiResult.success ? {} : { aiWarning: aiResult.error }
}

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

    let aiWarning: string | undefined
    if (options?.triggerPrediagnosis) {
      const predx = await runCampimetriaPrediagnosis({
        eventTestId,
        eventId,
        payload: validation.payload,
      })
      aiWarning = predx.aiWarning
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

/** Reintenta prediagnóstico IA con la captura ya guardada en clinicalContext. */
export async function retryCampimetriaPrediagnosis(
  eventTestId: string,
  eventId: string,
): Promise<{ success: true } | { success: false; error: string }> {
  if (!eventTestId || !eventId) {
    return { success: false, error: 'Faltan parámetros obligatorios' }
  }

  const eventTest = await prisma.eventTest.findUnique({
    where: { id: eventTestId },
    select: {
      eventId: true,
      testNameSnapshot: true,
      clinicalContext: true,
    },
  })
  if (!eventTest) {
    return { success: false, error: 'El estudio no existe.' }
  }
  if (eventTest.eventId !== eventId) {
    return { success: false, error: 'El estudio no pertenece al evento indicado.' }
  }
  if (!eventTest.testNameSnapshot.toLowerCase().includes('campimetr')) {
    return { success: false, error: 'Este reintento sólo aplica a campimetría.' }
  }

  const ctx = eventTest.clinicalContext
  if (
    !ctx ||
    typeof ctx !== 'object' ||
    (ctx as { schemaVersion?: string }).schemaVersion !==
      CAMPIMETRIA_QUESTIONNAIRE_SCHEMA_VERSION
  ) {
    return {
      success: false,
      error: 'No hay captura de campimetría guardada para generar prediagnóstico.',
    }
  }

  const { validateCampimetriaQuestionnairePayload } = await import(
    '@/lib/clinical/campimetria-questionnaire-validate'
  )
  const validation = validateCampimetriaQuestionnairePayload(ctx)
  if (!validation.valid) {
    return {
      success: false,
      error: 'La captura guardada está incompleta. Completa el formulario y vuelve a intentar.',
    }
  }

  try {
    const predx = await runCampimetriaPrediagnosis({
      eventTestId,
      eventId,
      payload: validation.payload,
    })
    revalidatePath(`/events/${eventId}`)
    if (predx.aiWarning) {
      return { success: false, error: predx.aiWarning }
    }
    return { success: true }
  } catch (err) {
    console.error('[IMPL-FEATURE-20260914-01] retryCampimetriaPrediagnosis failed:', err)
    return {
      success: false,
      error: 'No se pudo generar el prediagnóstico. Intente nuevamente.',
    }
  }
}
