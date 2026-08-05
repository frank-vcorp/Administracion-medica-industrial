/**
 * Helpers compartidos entre calendarios (ProjectsCalendar / MaintenanceCalendar).
 * @id ARCH-20260804-03 — extraídos de ProjectsCalendar para reutilización en MaintenanceCalendar.
 */
import type { ProjectStatus } from '@prisma/client'
// ARCH-20260804-04 §4.3: `import type` (se borra en compilación) para evitar
// cycle con `project.actions.ts` (que es `'use server'`).
import type { AvailabilityConflict } from '@/actions/project.actions'

export function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value)
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

export function addMonths(date: Date, amount: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1)
}

export function addDays(date: Date, amount: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + amount)
  return next
}

/** Inicio de grilla mensual: lunes de la semana que contiene el 1° del mes. */
export function startOfGrid(month: Date): Date {
  const firstDay = startOfMonth(month)
  const weekday = (firstDay.getDay() + 6) % 7
  return addDays(firstDay, -weekday)
}

export function isSameDay(left: Date, right: Date): boolean {
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate()
}

export function isSameMonth(left: Date, right: Date): boolean {
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth()
}

export function formatMonthLabel(month: Date): string {
  return month.toLocaleDateString('es-MX', {
    month: 'long',
    year: 'numeric',
  })
}

export function formatRange(startDate: Date | string, endDate: Date | string): string {
  const start = toDate(startDate)
  const end = toDate(endDate)
  return `${start.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })} - ${end.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}`
}

/**
 * Determina si un proyecto está activo en un día concreto.
 * Activo = [startDate, endDate] contiene al día (cualquier hora de ese día).
 */
export function isProjectActiveOnDay(
  project: { startDate: Date | string; endDate: Date | string },
  day: Date
): boolean {
  const projectStart = toDate(project.startDate)
  const projectEnd = toDate(project.endDate)
  const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, 0, 0, 0)
  const dayEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59, 999)
  return projectStart <= dayEnd && projectEnd >= dayStart
}

/**
 * Determina si un mantenimiento cae dentro del rango de fechas del proyecto.
 * Usado por ProjectsCalendar para vincular badge 🔧 Mant.
 */
export function isMaintenanceInProjectRange(
  maintenance: { scheduledDate: Date | string },
  projectStartDate: Date | string,
  projectEndDate: Date | string
): boolean {
  const mDate = toDate(maintenance.scheduledDate)
  const projectStart = toDate(projectStartDate)
  const projectEnd = toDate(projectEndDate)
  const rangeStart = new Date(projectStart.getFullYear(), projectStart.getMonth(), projectStart.getDate(), 0, 0, 0, 0)
  const rangeEnd = new Date(projectEnd.getFullYear(), projectEnd.getMonth(), projectEnd.getDate(), 23, 59, 59, 999)
  return mDate >= rangeStart && mDate <= rangeEnd
}

/**
 * Constantes de badges para proyectos — paridad exacta con ProjectsCalendar.
 * Reutilizadas por MaintenanceCalendar para renderizar pills de proyecto superpuestas.
 */

export const STATUS_LABELS: Record<ProjectStatus, string> = {
  DRAFT: 'Borrador',
  CONFIRMED: 'Confirmado',
  IN_PROGRESS: 'En curso',
  COMPLETED: 'Completado',
  CANCELLED: 'Cancelado',
}

export const STATUS_BADGES: Record<ProjectStatus, string> = {
  DRAFT: 'border-slate-200 bg-slate-100 text-slate-700',
  CONFIRMED: 'border-blue-200 bg-blue-50 text-blue-700',
  IN_PROGRESS: 'border-amber-200 bg-amber-50 text-amber-700',
  COMPLETED: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  CANCELLED: 'border-red-200 bg-red-50 text-red-700',
}

// ─── ARCH-20260804-04 §4.3: helper para mensajes legibles de bloqueo ─────────

/**
 * Resumen legible en español de los conflictos de disponibilidad de unidad.
 * Mezcla mantenimientos y proyectos en el orden en que vienen, trunca a
 * un máximo de 3 elementos y añade "+N más" si excede.
 *
 * Formatos:
 *  - Mantenimiento: "Mantenimiento {maintenanceType} el {dateISO}"
 *  - Proyecto:      "Proyecto «{name}»"
 *
 * Devuelve "" si `conflicts` está vacío.
 */
export function summarizeConflicts(conflicts: AvailabilityConflict[]): string {
  if (!conflicts || conflicts.length === 0) return ''
  const MAX = 3
  const parts = conflicts.slice(0, MAX).map((c) => {
    if (c.type === 'maintenance') {
      const type = c.maintenanceType ?? c.name ?? 'programado'
      const date = c.dateISO ?? ''
      return date ? `Mantenimiento ${type} el ${date}` : `Mantenimiento ${type}`
    }
    // type === 'project'
    const name = c.name ?? 'sin nombre'
    return `Proyecto «${name}»`
  })
  const overflow = conflicts.length - MAX
  const suffix = overflow > 0 ? ` (+${overflow} más)` : ''
  return parts.join('; ') + suffix
}