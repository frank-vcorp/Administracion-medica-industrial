/**
 * Carga datos persistidos y valida cierre de prueba (COMPLETED).
 * Solo para server actions — sin `'use client'`.
 */
import prisma from '@/lib/prisma'
import { CAMPIMETRIA_QUESTIONNAIRE_SCHEMA_VERSION } from '@/schemas/clinical/campimetria-questionnaire.schema'
import {
  formatStudyMissingFieldsSpanish,
  resolveStudyCaptureKind,
  validateStudyCaptureForComplete,
} from '@/lib/clinical/study-required-fields'
import { getCanonicalAIStudyType } from '@/lib/study-ai'

export type EventTestCompleteGateResult =
  | { ok: true }
  | { ok: false; error: string; missingLabels: string[] }

export async function assertEventTestCaptureForComplete(
  eventTestId: string,
  eventId: string,
): Promise<EventTestCompleteGateResult> {
  const eventTest = await prisma.eventTest.findFirst({
    where: { id: eventTestId, eventId },
    select: {
      testNameSnapshot: true,
      clinicalContext: true,
    },
  })
  if (!eventTest) {
    return { ok: false, error: 'El estudio no existe.', missingLabels: [] }
  }

  const kind = resolveStudyCaptureKind({
    testNameSnapshot: eventTest.testNameSnapshot,
    canonicalStudyType: getCanonicalAIStudyType({
      testNameSnapshot: eventTest.testNameSnapshot,
    }),
  })
  if (!kind) {
    return { ok: true }
  }

  let capturePayload: unknown = null
  if (kind === 'Campimetria') {
    const ctx = eventTest.clinicalContext
    if (
      ctx &&
      typeof ctx === 'object' &&
      (ctx as { schemaVersion?: string }).schemaVersion ===
        CAMPIMETRIA_QUESTIONNAIRE_SCHEMA_VERSION
    ) {
      capturePayload = ctx
    } else {
      return {
        ok: false,
        error: 'Completa la captura de campimetría antes de cerrar el estudio.',
        missingLabels: ['captura de campimetría'],
      }
    }
  } else {
    const exam = await prisma.medicalExam.findUnique({
      where: { eventId },
      select: { somatometryData: true, eyeAcuityData: true },
    })
    capturePayload =
      kind === 'Somatometria'
        ? (exam?.somatometryData ?? null)
        : (exam?.eyeAcuityData ?? null)
  }

  const validation = validateStudyCaptureForComplete(kind, capturePayload ?? {})
  if (validation.ok) return { ok: true }

  const missingLabels = validation.missing.map((m) => m.label)
  return {
    ok: false,
    error: formatStudyMissingFieldsSpanish(validation.missing),
    missingLabels,
  }
}
