/**
 * Horario operativo por día (lunes–sábado) por sucursal — O9-32.
 */

import { z } from 'zod'
import { branchOperatingHours, parseBranchHour } from '@/lib/appointment-capacity'

export const BRANCH_WEEKDAY_KEYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const

export type BranchWeekdayKey = (typeof BRANCH_WEEKDAY_KEYS)[number]

export const BRANCH_WEEKDAY_LABELS: Record<BranchWeekdayKey, string> = {
  monday: 'Lunes',
  tuesday: 'Martes',
  wednesday: 'Miércoles',
  thursday: 'Jueves',
  friday: 'Viernes',
  saturday: 'Sábado',
}

export type BranchDaySchedule = {
  enabled?: boolean
  openingTime?: string
  closingTime?: string
  hourlyCapacity?: number
}

export type BranchWeeklySchedule = Partial<Record<BranchWeekdayKey, BranchDaySchedule>>

const WEEKDAY_TO_KEY: Record<number, BranchWeekdayKey | undefined> = {
  1: 'monday',
  2: 'tuesday',
  3: 'wednesday',
  4: 'thursday',
  5: 'friday',
  6: 'saturday',
}

export function weekdayKeyForAgendaDate(dateStr: string, timeZone = 'America/Mexico_City'): BranchWeekdayKey | null {
  const anchor = new Date(`${dateStr}T12:00:00`)
  const wd = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(anchor)
  const map: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 0 }
  const n = map[wd] ?? 0
  return WEEKDAY_TO_KEY[n] ?? null
}

export function resolveBranchDayMeta(
  dateStr: string,
  fallback: { openingTime: string; closingTime: string; hourlyCapacity: number },
  weeklySchedule: BranchWeeklySchedule | null | undefined,
): { openingTime: string; closingTime: string; hourlyCapacity: number; open: boolean } {
  const key = weekdayKeyForAgendaDate(dateStr)
  const day = key ? weeklySchedule?.[key] : undefined
  if (day?.enabled === false) {
    return { ...fallback, open: false }
  }
  return {
    openingTime: day?.openingTime?.trim() || fallback.openingTime,
    closingTime: day?.closingTime?.trim() || fallback.closingTime,
    hourlyCapacity:
      typeof day?.hourlyCapacity === 'number' && day.hourlyCapacity > 0
        ? day.hourlyCapacity
        : fallback.hourlyCapacity,
    open: true,
  }
}

export function branchOperatingHoursForDate(
  dateStr: string,
  fallback: { openingTime: string; closingTime: string; hourlyCapacity: number },
  weeklySchedule: BranchWeeklySchedule | null | undefined,
): number[] {
  const meta = resolveBranchDayMeta(dateStr, fallback, weeklySchedule)
  if (!meta.open) return []
  return branchOperatingHours(meta.openingTime, meta.closingTime)
}

export function defaultBranchWeeklySchedule(
  openingTime: string,
  closingTime: string,
  hourlyCapacity: number,
): BranchWeeklySchedule {
  const day: BranchDaySchedule = {
    enabled: true,
    openingTime,
    closingTime,
    hourlyCapacity,
  }
  return Object.fromEntries(BRANCH_WEEKDAY_KEYS.map((k) => [k, { ...day }])) as BranchWeeklySchedule
}

export function parseBranchWeeklySchedule(raw: unknown): BranchWeeklySchedule | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  return raw as BranchWeeklySchedule
}

const hhmm = /^([01]\d|2[0-3]):([0-5]\d)$/

export const branchDayScheduleSchema = z.object({
  enabled: z.boolean().optional(),
  openingTime: z.string().regex(hhmm, 'HH:MM').optional(),
  closingTime: z.string().regex(hhmm, 'HH:MM').optional(),
  hourlyCapacity: z.coerce.number().int().min(1).max(100).optional(),
})

export const branchWeeklyScheduleSchema = z
  .record(z.string(), branchDayScheduleSchema)
  .optional()

export { parseBranchHour }
