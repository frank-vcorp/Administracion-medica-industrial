import type { EventStatus } from '@prisma/client'

export const EVENT_STATUS_LABELS: Record<EventStatus, string> = {
  SCHEDULED: 'Agendado',
  CHECKED_IN: 'En sala',
  IN_PROGRESS: 'En curso',
  VALIDATING: 'Validando',
  COMPLETED: 'Completado',
  CANCELED: 'Cancelado',
}

export const EVENT_STATUS_BADGE: Record<EventStatus, string> = {
  SCHEDULED: 'bg-slate-100 text-slate-600',
  CHECKED_IN: 'bg-amber-100 text-amber-700',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  VALIDATING: 'bg-purple-100 text-purple-700',
  COMPLETED: 'bg-emerald-100 text-emerald-700',
  CANCELED: 'bg-slate-100 text-slate-500',
}

export function getEventStatusLabel(status: EventStatus): string {
  return EVENT_STATUS_LABELS[status] ?? status
}

export function getEventStatusBadgeClass(status: EventStatus): string {
  return EVENT_STATUS_BADGE[status] ?? 'bg-gray-100 text-gray-700'
}
