import type { PrismaClient } from '@prisma/client'
import {
  appointmentAgendaHour,
  agendaDayUtcRange,
  formatAppointmentAgendaDateString,
} from '@/lib/appointment-scheduling'

/** Citas que ocupan cupo (canceladas y reagendadas no cuentan). */
export const ACTIVE_APPOINTMENT_STATUSES = [
  'SCHEDULED',
  'CONFIRMED',
  'COMPLETED',
  'NO_SHOW',
] as const

export type BranchDayAvailabilityStatus = 'past' | 'full' | 'partial' | 'open'

export type BranchDayAvailability = {
  date: string
  booked: number
  capacityTotal: number
  openHourSlots: number
  status: BranchDayAvailabilityStatus
}

/** Conteo por hora de agenda para un día (una sola consulta a BD). */
export async function countAppointmentsByHourForDay(
  db: PrismaClient,
  branchId: string,
  dateStr: string,
): Promise<Map<number, number>> {
  const { gte, lte } = agendaDayUtcRange(dateStr)
  const rows = await db.appointment.findMany({
    where: {
      branchId,
      scheduledAt: { gte, lte },
      status: { in: [...ACTIVE_APPOINTMENT_STATUSES] },
    },
    select: { scheduledAt: true },
  })
  const byHour = new Map<number, number>()
  for (const row of rows) {
    const hour = appointmentAgendaHour(row.scheduledAt)
    byHour.set(hour, (byHour.get(hour) ?? 0) + 1)
  }
  return byHour
}

export async function countAppointmentsInBranchHour(
  db: PrismaClient,
  branchId: string,
  scheduledAt: Date,
): Promise<number> {
  const dateStr = formatAppointmentAgendaDateString(scheduledAt)
  const targetHour = appointmentAgendaHour(scheduledAt)
  const byHour = await countAppointmentsByHourForDay(db, branchId, dateStr)
  return byHour.get(targetHour) ?? 0
}

function summarizeDayFromHourCounts(
  dateStr: string,
  byHour: Map<number, number>,
  hours: number[],
  hourlyCapacity: number,
  todayStr: string,
): BranchDayAvailability {
  let booked = 0
  let openHourSlots = 0
  const capacityTotal = hours.length * hourlyCapacity

  for (const hour of hours) {
    const count = byHour.get(hour) ?? 0
    booked += count
    if (count < hourlyCapacity) openHourSlots += 1
  }

  let status: BranchDayAvailabilityStatus = 'open'
  if (dateStr < todayStr) {
    status = 'past'
  } else if (openHourSlots === 0) {
    status = 'full'
  } else if (openHourSlots < hours.length) {
    status = 'partial'
  }

  return { date: dateStr, booked, capacityTotal, openHourSlots, status }
}

/** Disponibilidad por día para un rango de fechas (YYYY-MM-DD), en una consulta. */
export async function computeBranchDayAvailabilityForDates(
  db: PrismaClient,
  branchId: string,
  dateStrings: string[],
  branchMeta: { hourlyCapacity: number; openingTime: string; closingTime: string },
  todayStr: string,
): Promise<BranchDayAvailability[]> {
  const uniqueDates = [...new Set(dateStrings)].sort()
  if (uniqueDates.length === 0) return []

  const hours = branchOperatingHours(branchMeta.openingTime, branchMeta.closingTime)
  const hourlyCapacity = branchMeta.hourlyCapacity
  const gte = agendaDayUtcRange(uniqueDates[0]).gte
  const lte = agendaDayUtcRange(uniqueDates[uniqueDates.length - 1]).lte

  const rows = await db.appointment.findMany({
    where: {
      branchId,
      scheduledAt: { gte, lte },
      status: { in: [...ACTIVE_APPOINTMENT_STATUSES] },
    },
    select: { scheduledAt: true },
  })

  const byDateHour = new Map<string, Map<number, number>>()
  for (const row of rows) {
    const dateStr = formatAppointmentAgendaDateString(row.scheduledAt)
    const hour = appointmentAgendaHour(row.scheduledAt)
    if (!byDateHour.has(dateStr)) byDateHour.set(dateStr, new Map())
    const hourMap = byDateHour.get(dateStr)!
    hourMap.set(hour, (hourMap.get(hour) ?? 0) + 1)
  }

  return uniqueDates.map((dateStr) =>
    summarizeDayFromHourCounts(
      dateStr,
      byDateHour.get(dateStr) ?? new Map(),
      hours,
      hourlyCapacity,
      todayStr,
    ),
  )
}

export async function checkBranchHourCapacity(
  db: PrismaClient,
  branchId: string,
  scheduledAt: Date,
): Promise<{ ok: boolean; count: number; capacity: number }> {
  const branch = await db.branch.findUnique({
    where: { id: branchId },
    select: { hourlyCapacity: true, isActive: true },
  })
  if (!branch?.isActive) {
    return { ok: false, count: 0, capacity: 0 }
  }
  const capacity = branch.hourlyCapacity ?? 15
  const count = await countAppointmentsInBranchHour(db, branchId, scheduledAt)
  return { ok: count < capacity, count, capacity }
}

export function parseBranchHour(time: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time.trim())
  if (!m) return 7
  return Math.min(23, Math.max(0, Number(m[1])))
}

export function branchOperatingHours(openingTime: string, closingTime: string): number[] {
  const start = parseBranchHour(openingTime)
  const end = parseBranchHour(closingTime)
  const hours: number[] = []
  for (let h = start; h < end; h++) hours.push(h)
  return hours.length > 0 ? hours : [8, 9, 10, 11, 12, 13, 14, 15, 16]
}
