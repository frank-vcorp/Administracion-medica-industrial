import {
  type EventTestPipelineStatus,
  toBusinessStudyStatus,
} from '@/lib/clinical/study-status-display'

export type EventCompleteness = 'complete' | 'incomplete'

export const EVENT_COMPLETENESS_LABELS: Record<EventCompleteness, string> = {
  complete: 'Expediente completo',
  incomplete: 'Expediente incompleto',
}

export const EVENT_COMPLETENESS_BADGE: Record<EventCompleteness, string> = {
  complete: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  incomplete: 'bg-red-50 text-red-700 border-red-100',
}

/** Prueba resuelta: resultado registrado, cerrada, omitida o cancelada. */
export function isEventTestResolved(status: EventTestPipelineStatus): boolean {
  return toBusinessStudyStatus(status) !== 'PENDIENTE'
}

export function getEventCompleteness(
  tests: ReadonlyArray<{ status: EventTestPipelineStatus }>,
): EventCompleteness {
  if (tests.length === 0) return 'incomplete'
  return tests.every((test) => isEventTestResolved(test.status))
    ? 'complete'
    : 'incomplete'
}

export function getEventCompletenessLabel(
  tests: ReadonlyArray<{ status: EventTestPipelineStatus }>,
): string {
  return EVENT_COMPLETENESS_LABELS[getEventCompleteness(tests)]
}

export function getEventCompletenessBadgeClass(
  tests: ReadonlyArray<{ status: EventTestPipelineStatus }>,
): string {
  return EVENT_COMPLETENESS_BADGE[getEventCompleteness(tests)]
}
