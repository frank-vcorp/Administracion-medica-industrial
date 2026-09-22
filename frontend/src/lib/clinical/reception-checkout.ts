/**
 * Reglas de checkout en recepción (SPEC ARCH-20260921-01 §4.4).
 */
import {
  type EventTestPipelineStatus,
  type StudyInterpretationInput,
} from '@/lib/clinical/study-status-display'
import {
  filterEventTestsForCheckout,
  isExamenMedicoCaptureClosed,
} from '@/lib/clinical/examen-medico-capture'
import { isExamenMedicoTestName } from '@/lib/clinical/examen-medico-variant'
import {
  getStudyVisibleStep,
  isStep1DoneForCheckout,
  type StudyStepInput,
} from '@/lib/clinical/study-step'

export type ReceptionCheckoutTest = {
  id: string
  status: EventTestPipelineStatus
  testNameSnapshot?: string | null
  interpretation?: StudyInterpretationInput | null
  /** Solo Examen Médico: true tras «Cerrar captura» con todas las fases. */
  examenCaptureClosed?: boolean
}

export type ReceptionCheckoutEvent = {
  dischargedAt?: Date | string | null
  eventTests: ReadonlyArray<ReceptionCheckoutTest>
}

export type CheckoutEligibility =
  | { eligible: true }
  | { eligible: false; reason: 'already_discharged' | 'no_tests' | 'pending_studies' | 'invalid_skipped' }

function toStepInput(
  test: ReceptionCheckoutTest,
  notPerformedTestIds: ReadonlySet<string>,
): StudyStepInput {
  return {
    status: test.status,
    hasNotPerformedIncidence: notPerformedTestIds.has(test.id),
    interpretation: test.interpretation ?? null,
  }
}

export function getCheckoutEligibility(
  event: ReceptionCheckoutEvent,
  notPerformedTestIds: ReadonlySet<string> = new Set(),
): CheckoutEligibility {
  if (event.dischargedAt) {
    return { eligible: false, reason: 'already_discharged' }
  }

  const tests = filterEventTestsForCheckout(
    event.eventTests.filter((t) => t.status !== 'CANCELLED'),
  )
  if (tests.length === 0) {
    return { eligible: false, reason: 'no_tests' }
  }

  for (const test of tests) {
    const name = test.testNameSnapshot ?? ''
    if (isExamenMedicoTestName(name)) {
      if (!test.examenCaptureClosed) {
        return { eligible: false, reason: 'pending_studies' }
      }
      continue
    }

    const input = toStepInput(test, notPerformedTestIds)

    if (getStudyVisibleStep(input) === 'INVALID') {
      return { eligible: false, reason: 'invalid_skipped' }
    }

    if (!isStep1DoneForCheckout(input)) {
      return { eligible: false, reason: 'pending_studies' }
    }
  }

  return { eligible: true }
}

export function isCheckoutEnabled(
  event: ReceptionCheckoutEvent,
  notPerformedTestIds: ReadonlySet<string> = new Set(),
): boolean {
  return getCheckoutEligibility(event, notPerformedTestIds).eligible
}

/** Incidencias de cronograma ligadas a eventTestId (STUDY_NOT_PERFORMED o ADMIN_INCIDENCE). */
export function buildNotPerformedTestIdSet(
  entries: ReadonlyArray<{ eventTestId: string | null; entryType: string }>,
): Set<string> {
  const ids = new Set<string>()
  for (const entry of entries) {
    if (!entry.eventTestId) continue
    if (
      entry.entryType === 'ADMIN_INCIDENCE' ||
      entry.entryType === 'STUDY_NOT_PERFORMED'
    ) {
      ids.add(entry.eventTestId)
    }
  }
  return ids
}
