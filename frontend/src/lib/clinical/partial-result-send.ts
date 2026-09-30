/**
 * Envío parcial de resultados (DEC-20260930-01).
 * Gates: (1) laboratorio en batería, (2) resto de estudios cerrados para entrega.
 */
import { LAB_CATEGORY_ID } from '@/lib/validations/study'
import { isExamenMedicoTestName } from '@/lib/clinical/examen-medico-variant'
import { isExamenMedicoCaptureClosed } from '@/lib/clinical/examen-medico-capture'
import {
  buildStudyInterpretationFromSnapshot,
  type EventTestPipelineStatus,
  type StudyInterpretationInput,
} from '@/lib/clinical/study-status-display'
import {
  getStudyVisibleStep,
  type StudyStepInput,
} from '@/lib/clinical/study-step'

export type PartialSendEventTest = {
  id: string
  status: EventTestPipelineStatus
  testNameSnapshot: string | null
  fileUrl?: string | null
  test?: {
    categoryId?: string | null
    category?: { name: string } | null
  } | null
  interpretation?: StudyInterpretationInput | null
  hasValidatedPdf?: boolean
}

export type PartialSendEventInput = {
  eventTests: ReadonlyArray<PartialSendEventTest>
  examPhysicalExamData?: Record<string, unknown> | null
  hasLabOrder?: boolean
  notPerformedTestIds?: ReadonlySet<string>
}

export function isLaboratoryEventTest(test: PartialSendEventTest): boolean {
  if (test.test?.categoryId === LAB_CATEGORY_ID) return true
  const cat = (test.test?.category?.name ?? '').toLowerCase()
  if (cat.includes('laboratorio')) return true
  const name = (test.testNameSnapshot ?? '').toLowerCase()
  return (
    name.includes('laboratorio') ||
    name.includes('biometr') ||
    name.includes('química') ||
    name.includes('quimica') ||
    name.includes('cultivo') ||
    name.includes('ego') ||
    name.includes('orina')
  )
}

function toStepInput(
  test: PartialSendEventTest,
  notPerformedTestIds: ReadonlySet<string>,
): StudyStepInput {
  return {
    status: test.status,
    hasNotPerformedIncidence: notPerformedTestIds.has(test.id),
    interpretation: test.interpretation ?? null,
  }
}

/** Estudio no-lab cerrado para entrega (dictamen por estudio / no realizada / examen médico cerrado). */
export function isNonLabStudyClosedForPartialSend(
  test: PartialSendEventTest,
  examCaptureClosed: boolean,
  notPerformedTestIds: ReadonlySet<string>,
): boolean {
  if (isLaboratoryEventTest(test)) return true

  const name = test.testNameSnapshot ?? ''
  if (isExamenMedicoTestName(name)) {
    return examCaptureClosed
  }

  const step = getStudyVisibleStep(toStepInput(test, notPerformedTestIds))
  return step === '3' || step === 'E'
}

export function eventHasLaboratoryInBattery(input: PartialSendEventInput): boolean {
  if (input.hasLabOrder) return true
  return input.eventTests.some(
    (t) => t.status !== 'CANCELLED' && isLaboratoryEventTest(t),
  )
}

export function evaluatePartialSendEligibility(
  input: PartialSendEventInput,
): { eligible: false; reason: string } | { eligible: true } {
  if (!eventHasLaboratoryInBattery(input)) {
    return {
      eligible: false,
      reason: 'El envío parcial solo aplica cuando la batería incluye laboratorio.',
    }
  }

  const notPerformed = input.notPerformedTestIds ?? new Set<string>()
  const examClosed = isExamenMedicoCaptureClosed(input.examPhysicalExamData)

  const active = input.eventTests.filter((t) => t.status !== 'CANCELLED')
  const nonLab = active.filter((t) => !isLaboratoryEventTest(t))

  for (const test of nonLab) {
    if (!isNonLabStudyClosedForPartialSend(test, examClosed, notPerformed)) {
      return {
        eligible: false,
        reason:
          'Primero deben cerrarse los estudios que no son laboratorio (interpretación, no realizada o examen médico con captura cerrada).',
      }
    }
  }

  const sendableLab = listSendableLabTestsForPartial(input)
  if (sendableLab.length === 0) {
    return {
      eligible: false,
      reason: 'No hay resultados de laboratorio listos para adjuntar (PDF validado o archivo de estudio).',
    }
  }

  return { eligible: true }
}

/** Laboratorios con al menos un archivo entregable. */
export function listSendableLabTestsForPartial(
  input: PartialSendEventInput,
): PartialSendEventTest[] {
  const notPerformed = input.notPerformedTestIds ?? new Set<string>()
  return input.eventTests.filter((t) => {
    if (t.status === 'CANCELLED' || !isLaboratoryEventTest(t)) return false
    if (notPerformed.has(t.id)) return false
    return Boolean(t.hasValidatedPdf || t.fileUrl)
  })
}

export function interpretationFromPredxSnapshot(
  clinicalState: string | null | undefined,
  doctorStatus: string | null | undefined,
): StudyInterpretationInput | null {
  if (!clinicalState) return null
  return buildStudyInterpretationFromSnapshot({
    snapshot: { clinicalState },
    existingReview: doctorStatus ? { doctorStatus } : null,
  })
}
