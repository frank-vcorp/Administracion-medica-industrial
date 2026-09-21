/**
 * Etapas V1 / V2 / V3 del módulo de validación (SPEC ARCH-20260921-01 §5.2).
 */
import {
  getStudyVisibleStep,
  type StudyStepInput,
} from '@/lib/clinical/study-step'
import type { EventTestPipelineStatus } from '@/lib/clinical/study-status-display'

export type ValidationStage = 'V1' | 'V2' | 'V3'

export const VALIDATION_STAGE_LABELS: Record<ValidationStage, string> = {
  V1: 'En espera de resultados',
  V2: 'En espera de diagnóstico por estudio',
  V3: 'En espera de dictamen final',
}

export const VALIDATION_STAGE_BADGE: Record<ValidationStage, string> = {
  V1: 'bg-amber-50 text-amber-700 border-amber-100',
  V2: 'bg-sky-50 text-sky-700 border-sky-100',
  V3: 'bg-violet-50 text-violet-700 border-violet-100',
}

export type ValidationStageTest = {
  id: string
  status: EventTestPipelineStatus
  interpretation?: StudyStepInput['interpretation']
}

export function getValidationStage(
  tests: ReadonlyArray<ValidationStageTest>,
  notPerformedTestIds: ReadonlySet<string> = new Set(),
): ValidationStage {
  const active = tests.filter((t) => t.status !== 'CANCELLED')
  if (active.length === 0) return 'V1'

  const steps = active.map((test) =>
    getStudyVisibleStep({
      status: test.status,
      hasNotPerformedIncidence: notPerformedTestIds.has(test.id),
      interpretation: test.interpretation ?? null,
    }),
  )

  if (steps.some((s) => s === '1' || s === 'INVALID')) return 'V1'
  if (active.some((t) => ['PENDING', 'IN_PROGRESS', 'SAMPLE_TAKEN'].includes(t.status))) {
    return 'V1'
  }
  if (steps.every((s) => s === '3' || s === 'E')) return 'V3'
  return 'V2'
}
