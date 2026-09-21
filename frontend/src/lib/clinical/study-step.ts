/**
 * Pasos visibles 1 · 2 · 3 · E por estudio (SPEC ARCH-20260921-01 §3).
 * Deriva desde EventTestStatus sin cambiar BD.
 */
import {
  type EventTestPipelineStatus,
  type StudyInterpretationInput,
  isStudyInterpreted,
} from '@/lib/clinical/study-status-display'

export type StudyVisibleStep = '1' | '2' | '3' | 'E' | 'INVALID'

export type StudyStepInput = {
  status: EventTestPipelineStatus
  /** Incidencia ligada (STUDY_NOT_PERFORMED o ADMIN_INCIDENCE con eventTestId). */
  hasNotPerformedIncidence?: boolean
  interpretation?: StudyInterpretationInput | null
}

export function getStudyVisibleStep(input: StudyStepInput): StudyVisibleStep {
  const { status, hasNotPerformedIncidence, interpretation } = input

  if (status === 'SKIPPED' || status === 'CANCELLED') {
    return hasNotPerformedIncidence ? 'E' : 'INVALID'
  }

  if (status === 'PENDING' || status === 'IN_PROGRESS') return '1'
  if (status === 'SAMPLE_TAKEN') return '2'
  if (status === 'RESULT_REGISTERED') {
    return isStudyInterpreted(interpretation) ? '3' : '2'
  }
  if (status === 'COMPLETED') return '3'

  return '1'
}

/**
 * Paso 1 completado para checkout (SPEC §4.4).
 * Distinto del paso visible: IN_PROGRESS sigue en chip «1» pero ya permite salida.
 */
export function isStep1DoneForCheckout(input: StudyStepInput): boolean {
  const step = getStudyVisibleStep(input)
  if (step === 'E' || step === '2' || step === '3') return true
  if (step === 'INVALID') return false
  return input.status === 'IN_PROGRESS'
}

export function isStudyInStep1Pending(input: StudyStepInput): boolean {
  return getStudyVisibleStep(input) === '1'
}
