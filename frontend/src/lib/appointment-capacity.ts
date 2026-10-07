import type { PrismaClient } from '@prisma/client'
import {
  appointmentAgendaHour,
  agendaDayUtcRange,
  formatAppointmentAgendaDateString,
} from '@/lib/appointment-scheduling'

const ACTIVE_APPOINTMENT_STATUSES = ['SCHEDULED', 'CONFIRMED', 'COMPLETED', 'NO_SHOW'] as const

export async function countAppointmentsInBranchHour(
  db: PrismaClient,
  branchId: string,
  scheduledAt: Date,
): Promise<number> {
  const dateStr = formatAppointmentAgendaDateString(scheduledAt)
  const targetHour = appointmentAgendaHour(scheduledAt)
  const { gte, lte } = agendaDayUtcRange(dateStr)

  const rows = await db.appointment.findMany({
    where: {
      branchId,
      scheduledAt: { gte, lte },
      status: { in: [...ACTIVE_APPOINTMENT_STATUSES] },
    },
    select: { scheduledAt: true },
  })

  return rows.filter((r) => appointmentAgendaHour(r.scheduledAt) === targetHour).length
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
