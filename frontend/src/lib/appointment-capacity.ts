import type { PrismaClient } from '@prisma/client'
import {
  appointmentAgendaHour,
  appointmentAgendaHourMinute,
  agendaDayUtcRange,
  formatAppointmentAgendaDateString,
  isAppointmentScheduleInPast,
} from '@/lib/appointment-scheduling'
import {
  branchOperatingHoursForDate,
  DEFAULT_HOURLY_MINUTES_CAPACITY,
  parseBranchWeeklySchedule,
  resolveBranchDayMeta,
} from '@/lib/branch-weekly-schedule'
import { isPrismaMissingColumnError } from '@/lib/prisma/missing-column-error'
import { resolveEffectiveProfileDuration } from '@/lib/profile-duration'

/** Citas que ocupan cupo (canceladas y reagendadas no cuentan). */
export const ACTIVE_APPOINTMENT_STATUSES = [
  'SCHEDULED',
  'CONFIRMED',
  'COMPLETED',
  'NO_SHOW',
] as const

/** Duración fallback en minutos cuando una cita o perfil no tiene duración calculada/definida (>0). */
export const DEFAULT_APPOINTMENT_DURATION_MINUTES = 30

export type BranchCapacityMode = 'HOURLY_COUNT' | 'DURATION_MINUTES'

export type BranchDayAvailabilityStatus = 'past' | 'full' | 'partial' | 'open'

export type BranchDayAvailability = {
  date: string
  booked: number
  capacityTotal: number
  openHourSlots: number
  status: BranchDayAvailabilityStatus
  capacityMode?: BranchCapacityMode
}

export type BranchHourSlotAvailability = {
  hour: number
  count: number
  capacity: number
  full: boolean
  capacityMode: BranchCapacityMode
  usedMinutes: number
  minutesCapacity: number
  remainingMinutes: number
  availableForProfile: number
  requiredMinutes: number
  exceedsClosing: boolean
}

export function parseBranchMinutesOfDay(time: string, fallback = 17 * 60): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time.trim())
  if (!m) return fallback
  const hh = Math.min(23, Math.max(0, Number(m[1])))
  const mm = Math.min(59, Math.max(0, Number(m[2])))
  return hh * 60 + mm
}

export function normalizePositiveAppointmentDuration(minutes: number | null | undefined): number {
  if (typeof minutes === 'number' && Number.isFinite(minutes) && minutes > 0) {
    return Math.round(minutes)
  }
  return DEFAULT_APPOINTMENT_DURATION_MINUTES
}

/**
 * Distribuye la duración de una cita en bloques horarios de 60 minutos
 * a partir de `startHour:startMinute`.
 * Ej.: 10:00 con 75 min → { 10: 60, 11: 15 }.
 */
export function distributeDurationAcrossHours(
  startHour: number,
  startMinute: number,
  durationMinutes: number,
): Map<number, number> {
  const allocation = new Map<number, number>()
  let remaining = normalizePositiveAppointmentDuration(durationMinutes)
  let hour = Math.max(0, Math.min(23, Math.floor(startHour)))
  let offsetInHour = Math.max(0, Math.min(59, Math.floor(startMinute)))

  while (remaining > 0 && hour < 24) {
    const availableInHour = 60 - offsetInHour
    const slice = Math.min(availableInHour, remaining)
    allocation.set(hour, (allocation.get(hour) ?? 0) + slice)
    remaining -= slice
    hour += 1
    offsetInHour = 0
  }
  return allocation
}

/** Valida si `horaInicio + duración` rebasa la hora de cierre de la clínica. */
export function exceedsBranchClosingTime(
  startHour: number,
  startMinute: number,
  durationMinutes: number,
  closingTime: string,
): boolean {
  const closingTotal = parseBranchMinutesOfDay(closingTime, 17 * 60)
  const startTotal = startHour * 60 + startMinute
  const dur = normalizePositiveAppointmentDuration(durationMinutes)
  return startTotal + dur > closingTotal
}

/**
 * Evalúa cuántas citas de duración `durationMinutes` caben iniciando a `startHour:00`
 * dado el consumo actual por hora (`usedMinutesByHour`), la capacidad en minutos por hora,
 * la ventana operativa y la hora de cierre.
 */
export function evaluateMinuteSlotForStartHour(input: {
  startHour: number
  startMinute?: number
  hours: readonly number[]
  usedMinutesByHour: ReadonlyMap<number, number>
  hourlyMinutesCapacity: number
  closingTime: string
  durationMinutes: number
}): {
  ok: boolean
  fitCount: number
  exceedsClosing: boolean
  outsideHours: boolean
  bottleneckRemainingMinutes: number
  requiredSliceMinutes: number
} {
  const startMinute = input.startMinute ?? 0
  const dur = normalizePositiveAppointmentDuration(input.durationMinutes)
  const hoursSet = new Set(input.hours)

  if (!hoursSet.has(input.startHour)) {
    return {
      ok: false,
      fitCount: 0,
      exceedsClosing: false,
      outsideHours: true,
      bottleneckRemainingMinutes: 0,
      requiredSliceMinutes: dur,
    }
  }

  if (exceedsBranchClosingTime(input.startHour, startMinute, dur, input.closingTime)) {
    return {
      ok: false,
      fitCount: 0,
      exceedsClosing: true,
      outsideHours: false,
      bottleneckRemainingMinutes: 0,
      requiredSliceMinutes: dur,
    }
  }

  const slices = distributeDurationAcrossHours(input.startHour, startMinute, dur)
  let minFit = Number.POSITIVE_INFINITY
  let bottleneckRemaining = Number.POSITIVE_INFINITY
  let bottleneckRequired = dur

  for (const [hour, slice] of slices.entries()) {
    if (!hoursSet.has(hour)) {
      return {
        ok: false,
        fitCount: 0,
        exceedsClosing: true,
        outsideHours: false,
        bottleneckRemainingMinutes: 0,
        requiredSliceMinutes: slice,
      }
    }
    const used = input.usedMinutesByHour.get(hour) ?? 0
    const remaining = Math.max(0, input.hourlyMinutesCapacity - used)
    const fit = Math.floor(remaining / slice)
    if (fit < minFit) {
      minFit = fit
      bottleneckRemaining = remaining
      bottleneckRequired = slice
    }
  }

  const fitCount = Number.isFinite(minFit) ? minFit : 0
  return {
    ok: fitCount >= 1,
    fitCount,
    exceedsClosing: false,
    outsideHours: false,
    bottleneckRemainingMinutes: Number.isFinite(bottleneckRemaining) ? bottleneckRemaining : 0,
    requiredSliceMinutes: bottleneckRequired,
  }
}

type AppointmentCapacityRow = {
  id: string
  scheduledAt: Date
  estimatedDurationMinutes: number | null
  serviceProfile: {
    calculatedDurationMinutes: number | null
    durationOverrideMinutes: number | null
  } | null
}

async function fetchActiveAppointmentsForRange(
  db: PrismaClient,
  branchId: string,
  gte: Date,
  lte: Date,
  excludeAppointmentId?: string | null,
): Promise<AppointmentCapacityRow[]> {
  const where = {
    branchId,
    scheduledAt: { gte, lte },
    status: { in: [...ACTIVE_APPOINTMENT_STATUSES] },
    ...(excludeAppointmentId ? { id: { not: excludeAppointmentId } } : {}),
  }

  try {
    return await db.appointment.findMany({
      where,
      select: {
        id: true,
        scheduledAt: true,
        estimatedDurationMinutes: true,
        serviceProfile: {
          select: {
            calculatedDurationMinutes: true,
            durationOverrideMinutes: true,
          },
        },
      },
    })
  } catch (error) {
    if (!isPrismaMissingColumnError(error)) throw error
    const rows = await db.appointment.findMany({
      where,
      select: {
        id: true,
        scheduledAt: true,
      },
    })
    return rows.map((row) => ({
      ...row,
      estimatedDurationMinutes: null,
      serviceProfile: null,
    }))
  }
}

function resolveRowDurationMinutes(row: AppointmentCapacityRow): number {
  if (
    typeof row.estimatedDurationMinutes === 'number' &&
    Number.isFinite(row.estimatedDurationMinutes) &&
    row.estimatedDurationMinutes > 0
  ) {
    return Math.round(row.estimatedDurationMinutes)
  }
  const fromProfile = resolveEffectiveProfileDuration(row.serviceProfile)
  return normalizePositiveAppointmentDuration(fromProfile)
}

export async function resolveBranchCapacityConfig(
  db: PrismaClient,
  branchId: string,
): Promise<{
  id: string
  hourlyCapacity: number
  openingTime: string
  closingTime: string
  isActive: boolean
  weeklySchedule: unknown
  capacityMode: BranchCapacityMode
  hourlyMinutesCapacity: number | null
} | null> {
  try {
    const branch = await db.branch.findUnique({
      where: { id: branchId },
      select: {
        id: true,
        hourlyCapacity: true,
        openingTime: true,
        closingTime: true,
        isActive: true,
        weeklySchedule: true,
        capacityMode: true,
        hourlyMinutesCapacity: true,
      },
    })
    if (!branch) return null
    return {
      ...branch,
      capacityMode:
        branch.capacityMode === 'DURATION_MINUTES' ? 'DURATION_MINUTES' : 'HOURLY_COUNT',
    }
  } catch (error) {
    if (!isPrismaMissingColumnError(error)) throw error
    const fallback = await db.branch.findUnique({
      where: { id: branchId },
      select: {
        id: true,
        hourlyCapacity: true,
        openingTime: true,
        closingTime: true,
        isActive: true,
      },
    })
    if (!fallback) return null
    return {
      ...fallback,
      weeklySchedule: null,
      capacityMode: 'HOURLY_COUNT',
      hourlyMinutesCapacity: null,
    }
  }
}

export async function resolveProfileRequiredDurationMinutes(
  db: PrismaClient,
  serviceProfileId?: string | null,
): Promise<number | null> {
  if (!serviceProfileId) return null
  try {
    const profile = await db.medicalProfile.findUnique({
      where: { id: serviceProfileId },
      select: {
        calculatedDurationMinutes: true,
        durationOverrideMinutes: true,
      },
    })
    return resolveEffectiveProfileDuration(profile)
  } catch (error) {
    if (!isPrismaMissingColumnError(error)) throw error
    return null
  }
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

function aggregateMinutesByHour(rows: readonly AppointmentCapacityRow[]): Map<number, number> {
  const byHour = new Map<number, number>()
  for (const row of rows) {
    const { hour, minute } = appointmentAgendaHourMinute(row.scheduledAt)
    const dur = resolveRowDurationMinutes(row)
    const slices = distributeDurationAcrossHours(hour, minute, dur)
    for (const [h, mins] of slices.entries()) {
      byHour.set(h, (byHour.get(h) ?? 0) + mins)
    }
  }
  return byHour
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

  return {
    date: dateStr,
    booked,
    capacityTotal,
    openHourSlots,
    status,
    capacityMode: 'HOURLY_COUNT',
  }
}

function summarizeDayFromHourMinutes(
  dateStr: string,
  usedMinutesByHour: Map<number, number>,
  hours: number[],
  hourlyMinutesCapacity: number,
  closingTime: string,
  requiredDurationMinutes: number,
  todayStr: string,
): BranchDayAvailability {
  let booked = 0
  let openHourSlots = 0
  let validHoursCount = 0
  const capacityTotal = hours.length * hourlyMinutesCapacity

  for (const hour of hours) {
    booked += usedMinutesByHour.get(hour) ?? 0
    if (!exceedsBranchClosingTime(hour, 0, requiredDurationMinutes, closingTime)) {
      validHoursCount += 1
      const evalSlot = evaluateMinuteSlotForStartHour({
        startHour: hour,
        hours,
        usedMinutesByHour,
        hourlyMinutesCapacity,
        closingTime,
        durationMinutes: requiredDurationMinutes,
      })
      if (evalSlot.ok) openHourSlots += 1
    }
  }

  let status: BranchDayAvailabilityStatus = 'open'
  if (dateStr < todayStr) {
    status = 'past'
  } else if (openHourSlots === 0) {
    status = 'full'
  } else if (booked > 0 || openHourSlots < validHoursCount) {
    status = 'partial'
  }

  return {
    date: dateStr,
    booked,
    capacityTotal,
    openHourSlots,
    status,
    capacityMode: 'DURATION_MINUTES',
  }
}

/** Disponibilidad por día para un rango de fechas (YYYY-MM-DD), en una consulta. */
export async function computeBranchDayAvailabilityForDates(
  db: PrismaClient,
  branchId: string,
  dateStrings: string[],
  branchMeta: {
    hourlyCapacity: number
    openingTime: string
    closingTime: string
    weeklySchedule?: unknown
    capacityMode?: string | null
    hourlyMinutesCapacity?: number | null
  },
  todayStr: string,
  options?: {
    requiredDurationMinutes?: number | null
  },
): Promise<BranchDayAvailability[]> {
  const uniqueDates = [...new Set(dateStrings)].sort()
  if (uniqueDates.length === 0) return []

  const weekly = parseBranchWeeklySchedule(branchMeta.weeklySchedule)
  const fallback = {
    openingTime: branchMeta.openingTime,
    closingTime: branchMeta.closingTime,
    hourlyCapacity: branchMeta.hourlyCapacity,
    capacityMode: branchMeta.capacityMode ?? 'HOURLY_COUNT',
    hourlyMinutesCapacity: branchMeta.hourlyMinutesCapacity ?? DEFAULT_HOURLY_MINUTES_CAPACITY,
  }
  const gte = agendaDayUtcRange(uniqueDates[0]).gte
  const lte = agendaDayUtcRange(uniqueDates[uniqueDates.length - 1]).lte

  const rows = await fetchActiveAppointmentsForRange(db, branchId, gte, lte)

  const byDateRows = new Map<string, AppointmentCapacityRow[]>()
  for (const row of rows) {
    const dateStr = formatAppointmentAgendaDateString(row.scheduledAt)
    if (!byDateRows.has(dateStr)) byDateRows.set(dateStr, [])
    byDateRows.get(dateStr)!.push(row)
  }

  const requiredDuration = normalizePositiveAppointmentDuration(
    options?.requiredDurationMinutes,
  )

  return uniqueDates.map((dateStr) => {
    const dayMeta = resolveBranchDayMeta(dateStr, fallback, weekly)
    if (!dayMeta.open) {
      return {
        date: dateStr,
        booked: 0,
        capacityTotal: 0,
        openHourSlots: 0,
        status: dateStr < todayStr ? ('past' as const) : ('full' as const),
        capacityMode: dayMeta.capacityMode,
      }
    }
    const hours = branchOperatingHours(dayMeta.openingTime, dayMeta.closingTime)
    const dayRows = byDateRows.get(dateStr) ?? []

    if (dayMeta.capacityMode === 'DURATION_MINUTES') {
      const usedByHour = aggregateMinutesByHour(dayRows)
      return summarizeDayFromHourMinutes(
        dateStr,
        usedByHour,
        hours,
        dayMeta.hourlyMinutesCapacity,
        dayMeta.closingTime,
        requiredDuration,
        todayStr,
      )
    }

    const byHour = new Map<number, number>()
    for (const row of dayRows) {
      const hour = appointmentAgendaHour(row.scheduledAt)
      byHour.set(hour, (byHour.get(hour) ?? 0) + 1)
    }
    return summarizeDayFromHourCounts(
      dateStr,
      byHour,
      hours,
      dayMeta.hourlyCapacity,
      todayStr,
    )
  })
}

/** Slots detallados por hora para un día (usado en Recepción, Portal B2B y Consulta). */
export async function computeBranchHourSlotsForDay(
  db: PrismaClient,
  branchId: string,
  dateStr: string,
  options?: {
    requiredDurationMinutes?: number | null
    serviceProfileId?: string | null
    excludeAppointmentId?: string | null
  },
): Promise<
  | { ok: false; reason: 'BRANCH_INACTIVE' | 'BRANCH_CLOSED'; slots: BranchHourSlotAvailability[] }
  | {
      ok: true
      capacityMode: BranchCapacityMode
      hourlyCapacity: number
      hourlyMinutesCapacity: number
      requiredDurationMinutes: number
      closingTime: string
      slots: BranchHourSlotAvailability[]
    }
> {
  const branch = await resolveBranchCapacityConfig(db, branchId)
  if (!branch?.isActive) {
    return { ok: false, reason: 'BRANCH_INACTIVE', slots: [] }
  }

  const fallback = {
    openingTime: branch.openingTime,
    closingTime: branch.closingTime,
    hourlyCapacity: branch.hourlyCapacity ?? 15,
    capacityMode: branch.capacityMode,
    hourlyMinutesCapacity: branch.hourlyMinutesCapacity ?? DEFAULT_HOURLY_MINUTES_CAPACITY,
  }
  const weekly = parseBranchWeeklySchedule(branch.weeklySchedule)
  const dayMeta = resolveBranchDayMeta(dateStr, fallback, weekly)
  if (!dayMeta.open) {
    return { ok: false, reason: 'BRANCH_CLOSED', slots: [] }
  }

  const hours = branchOperatingHoursForDate(dateStr, fallback, weekly)
  const { gte, lte } = agendaDayUtcRange(dateStr)
  const dayRows = await fetchActiveAppointmentsForRange(
    db,
    branchId,
    gte,
    lte,
    options?.excludeAppointmentId,
  )

  const profileDur =
    options?.requiredDurationMinutes ??
    (await resolveProfileRequiredDurationMinutes(db, options?.serviceProfileId))
  const requiredDuration = normalizePositiveAppointmentDuration(profileDur)

  const countByHour = new Map<number, number>()
  for (const row of dayRows) {
    const h = appointmentAgendaHour(row.scheduledAt)
    countByHour.set(h, (countByHour.get(h) ?? 0) + 1)
  }
  const usedMinutesByHour = aggregateMinutesByHour(dayRows)

  const slots: BranchHourSlotAvailability[] = hours.map((hour) => {
    const count = countByHour.get(hour) ?? 0
    const usedMinutes = usedMinutesByHour.get(hour) ?? 0

    if (dayMeta.capacityMode === 'DURATION_MINUTES') {
      const evalSlot = evaluateMinuteSlotForStartHour({
        startHour: hour,
        hours,
        usedMinutesByHour,
        hourlyMinutesCapacity: dayMeta.hourlyMinutesCapacity,
        closingTime: dayMeta.closingTime,
        durationMinutes: requiredDuration,
      })
      const remainingMinutes = Math.max(0, dayMeta.hourlyMinutesCapacity - usedMinutes)
      return {
        hour,
        count,
        capacity: dayMeta.hourlyMinutesCapacity,
        full: !evalSlot.ok,
        capacityMode: 'DURATION_MINUTES',
        usedMinutes,
        minutesCapacity: dayMeta.hourlyMinutesCapacity,
        remainingMinutes,
        availableForProfile: evalSlot.fitCount,
        requiredMinutes: requiredDuration,
        exceedsClosing: evalSlot.exceedsClosing,
      }
    }

    const remainingCount = Math.max(0, dayMeta.hourlyCapacity - count)
    return {
      hour,
      count,
      capacity: dayMeta.hourlyCapacity,
      full: count >= dayMeta.hourlyCapacity,
      capacityMode: 'HOURLY_COUNT',
      usedMinutes,
      minutesCapacity: dayMeta.hourlyMinutesCapacity,
      remainingMinutes: Math.max(0, dayMeta.hourlyMinutesCapacity - usedMinutes),
      availableForProfile: remainingCount,
      requiredMinutes: requiredDuration,
      exceedsClosing: false,
    }
  })

  return {
    ok: true,
    capacityMode: dayMeta.capacityMode,
    hourlyCapacity: dayMeta.hourlyCapacity,
    hourlyMinutesCapacity: dayMeta.hourlyMinutesCapacity,
    requiredDurationMinutes: requiredDuration,
    closingTime: dayMeta.closingTime,
    slots,
  }
}

export type BranchHourCapacityCheck = {
  ok: boolean
  count: number
  capacity: number
  reason?: string
  capacityMode?: BranchCapacityMode
  requiredMinutes?: number
  remainingMinutes?: number
}

/** Mensaje en español para rechazos de cupo / horario al agendar. */
export function appointmentCapacityUserMessage(check: BranchHourCapacityCheck): string {
  if (check.ok) return ''
  switch (check.reason) {
    case 'OUTSIDE_HOURS':
      return 'La hora elegida está fuera del horario operativo de la sucursal ese día. Ajuste la fecha o la hora.'
    case 'BRANCH_CLOSED':
      return 'La sucursal no atiende ese día. Elija otra fecha.'
    case 'BRANCH_INACTIVE':
      return 'La sucursal seleccionada no está activa.'
    case 'APPOINTMENT_IN_PAST':
      return 'No puede agendar en una fecha u hora pasada.'
    case 'EXCEEDS_CLOSING_TIME':
      return 'La duración de este perfil rebasa la hora de cierre de la sucursal. Elija un horario más temprano.'
    case 'INSUFFICIENT_MINUTES':
      return `No hay minutos suficientes en el horario seleccionado (${check.remainingMinutes ?? 0} min disponibles; se requieren ${check.requiredMinutes ?? 0} min). Elija otra hora.`
    default:
      if (check.capacity > 0 && check.count >= check.capacity) {
        return `Este horario ya alcanzó el cupo (${check.count}/${check.capacity}). Elija otra hora.`
      }
      return 'No hay cupo en el horario seleccionado. Elija otra fecha u hora.'
  }
}

export async function checkBranchHourCapacity(
  db: PrismaClient,
  branchId: string,
  scheduledAt: Date,
  options?: {
    requiredDurationMinutes?: number | null
    serviceProfileId?: string | null
    excludeAppointmentId?: string | null
    partySize?: number
  },
): Promise<BranchHourCapacityCheck> {
  const branch = await resolveBranchCapacityConfig(db, branchId)
  if (!branch?.isActive) {
    return { ok: false, count: 0, capacity: 0, reason: 'BRANCH_INACTIVE' }
  }
  if (isAppointmentScheduleInPast(scheduledAt)) {
    return {
      ok: false,
      count: 0,
      capacity: branch.hourlyCapacity ?? 15,
      reason: 'APPOINTMENT_IN_PAST',
    }
  }
  const dateStr = formatAppointmentAgendaDateString(scheduledAt)
  const fallback = {
    openingTime: branch.openingTime,
    closingTime: branch.closingTime,
    hourlyCapacity: branch.hourlyCapacity ?? 15,
    capacityMode: branch.capacityMode,
    hourlyMinutesCapacity: branch.hourlyMinutesCapacity ?? DEFAULT_HOURLY_MINUTES_CAPACITY,
  }
  const weekly = parseBranchWeeklySchedule(branch.weeklySchedule)
  const dayMeta = resolveBranchDayMeta(dateStr, fallback, weekly)
  if (!dayMeta.open) {
    return {
      ok: false,
      count: 0,
      capacity: dayMeta.hourlyCapacity,
      reason: 'BRANCH_CLOSED',
      capacityMode: dayMeta.capacityMode,
    }
  }
  const hours = branchOperatingHoursForDate(dateStr, fallback, weekly)
  const { hour: targetHour, minute: targetMinute } = appointmentAgendaHourMinute(scheduledAt)
  if (!hours.includes(targetHour)) {
    return {
      ok: false,
      count: 0,
      capacity: dayMeta.hourlyCapacity,
      reason: 'OUTSIDE_HOURS',
      capacityMode: dayMeta.capacityMode,
    }
  }

  const partySize = Math.max(1, Math.floor(options?.partySize ?? 1))
  const { gte, lte } = agendaDayUtcRange(dateStr)
  const dayRows = await fetchActiveAppointmentsForRange(
    db,
    branchId,
    gte,
    lte,
    options?.excludeAppointmentId,
  )

  if (dayMeta.capacityMode === 'DURATION_MINUTES') {
    const profileDur =
      options?.requiredDurationMinutes ??
      (await resolveProfileRequiredDurationMinutes(db, options?.serviceProfileId))
    const requiredDuration = normalizePositiveAppointmentDuration(profileDur)
    const usedMinutesByHour = aggregateMinutesByHour(dayRows)

    const evalSlot = evaluateMinuteSlotForStartHour({
      startHour: targetHour,
      startMinute: targetMinute,
      hours,
      usedMinutesByHour,
      hourlyMinutesCapacity: dayMeta.hourlyMinutesCapacity,
      closingTime: dayMeta.closingTime,
      durationMinutes: requiredDuration,
    })

    if (evalSlot.exceedsClosing) {
      return {
        ok: false,
        count: usedMinutesByHour.get(targetHour) ?? 0,
        capacity: dayMeta.hourlyMinutesCapacity,
        reason: 'EXCEEDS_CLOSING_TIME',
        capacityMode: 'DURATION_MINUTES',
        requiredMinutes: requiredDuration,
        remainingMinutes: Math.max(
          0,
          dayMeta.hourlyMinutesCapacity - (usedMinutesByHour.get(targetHour) ?? 0),
        ),
      }
    }

    if (evalSlot.fitCount < partySize) {
      return {
        ok: false,
        count: usedMinutesByHour.get(targetHour) ?? 0,
        capacity: dayMeta.hourlyMinutesCapacity,
        reason: 'INSUFFICIENT_MINUTES',
        capacityMode: 'DURATION_MINUTES',
        requiredMinutes: evalSlot.requiredSliceMinutes * partySize,
        remainingMinutes: evalSlot.bottleneckRemainingMinutes,
      }
    }

    const usedInHour = usedMinutesByHour.get(targetHour) ?? 0
    return {
      ok: true,
      count: usedInHour,
      capacity: dayMeta.hourlyMinutesCapacity,
      capacityMode: 'DURATION_MINUTES',
      requiredMinutes: requiredDuration,
      remainingMinutes: Math.max(0, dayMeta.hourlyMinutesCapacity - usedInHour),
    }
  }

  const capacity = dayMeta.hourlyCapacity
  let count = 0
  for (const row of dayRows) {
    if (appointmentAgendaHour(row.scheduledAt) === targetHour) {
      count += 1
    }
  }
  return {
    ok: count + partySize <= capacity,
    count,
    capacity,
    capacityMode: 'HOURLY_COUNT',
  }
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
