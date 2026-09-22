/** Zona operativa de citas AMI (sucursales en México). */
export const AMI_APPOINTMENT_TIMEZONE = 'America/Mexico_City'

type ZonedParts = {
  year: number
  month: number
  day: number
  hour: number
  minute: number
}

function zonedPartsFromUtcMs(utcMs: number, timeZone: string): ZonedParts {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
  const parts = fmt.formatToParts(new Date(utcMs))
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? '0')
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
  }
}

/**
 * Convierte fecha/hora de pared (calendario de cita) en instante UTC para persistir.
 * Evita que el servidor (UTC) guarde 08:00 como 08:00 UTC en lugar de hora México.
 */
export function parseAppointmentLocalDateTime(date: string, time: string): Date {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim())
  const timeMatch = /^(\d{1,2}):(\d{2})$/.exec(time.trim())
  if (!dateMatch || !timeMatch) {
    return new Date(`${date}T${time}:00`)
  }

  const target = {
    year: Number(dateMatch[1]),
    month: Number(dateMatch[2]),
    day: Number(dateMatch[3]),
    hour: Number(timeMatch[1]),
    minute: Number(timeMatch[2]),
  }

  let guess = Date.UTC(target.year, target.month - 1, target.day, target.hour, target.minute)
  for (let i = 0; i < 6; i++) {
    const zoned = zonedPartsFromUtcMs(guess, AMI_APPOINTMENT_TIMEZONE)
    const deltaMinutes =
      (target.year - zoned.year) * 525_600 +
      (target.month - zoned.month) * 43_200 +
      (target.day - zoned.day) * 1_440 +
      (target.hour - zoned.hour) * 60 +
      (target.minute - zoned.minute)
    if (deltaMinutes === 0) {
      return new Date(guess)
    }
    guess += deltaMinutes * 60 * 1000
  }

  return new Date(guess)
}

export function formatAppointmentAgendaDateString(
  scheduledAt: Date | string,
  timeZone = AMI_APPOINTMENT_TIMEZONE,
): string {
  const d = new Date(scheduledAt)
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const parts = fmt.formatToParts(d)
  const y = parts.find((p) => p.type === 'year')?.value ?? '0000'
  const m = parts.find((p) => p.type === 'month')?.value ?? '01'
  const day = parts.find((p) => p.type === 'day')?.value ?? '01'
  return `${y}-${m}-${day}`
}

export function appointmentAgendaHour(
  scheduledAt: Date | string,
  timeZone = AMI_APPOINTMENT_TIMEZONE,
): number {
  const d = new Date(scheduledAt)
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    hour12: false,
  })
  return Number(fmt.format(d))
}

export function formatAppointmentAgendaTime(
  scheduledAt: Date | string,
  timeZone = AMI_APPOINTMENT_TIMEZONE,
): string {
  const d = new Date(scheduledAt)
  return new Intl.DateTimeFormat('es-MX', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    hourCycle: 'h23',
  }).format(d)
}

/** Rango UTC que cubre un día de agenda (00:00–23:59:59.999) en zona AMI. */
export function agendaDayUtcRange(dateStr: string): { gte: Date; lte: Date } {
  const gte = parseAppointmentLocalDateTime(dateStr, '00:00')
  const lte = new Date(parseAppointmentLocalDateTime(dateStr, '23:59').getTime() + 59_999)
  return { gte, lte }
}

/** Fecha de calendario operativo (YYYY-MM-DD) en zona AMI — para recepción y agenda. */
export function todayAgendaDateString(timeZone = AMI_APPOINTMENT_TIMEZONE): string {
  return formatAppointmentAgendaDateString(new Date(), timeZone)
}

const AGENDA_WEEKDAY: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
}

/** Suma días de calendario en zona AMI (dateStr YYYY-MM-DD). */
export function addAgendaDays(
  dateStr: string,
  days: number,
  timeZone = AMI_APPOINTMENT_TIMEZONE,
): string {
  const anchor = parseAppointmentLocalDateTime(dateStr, '12:00')
  const shifted = new Date(anchor.getTime() + days * 86_400_000)
  return formatAppointmentAgendaDateString(shifted, timeZone)
}

/** Lunes de la semana de agenda que contiene `dateStr`. */
export function getAgendaWeekStartMonday(dateStr: string, timeZone = AMI_APPOINTMENT_TIMEZONE): string {
  const anchor = parseAppointmentLocalDateTime(dateStr, '12:00')
  const wdLabel = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
  }).format(anchor)
  const weekday = AGENDA_WEEKDAY[wdLabel] ?? 0
  const diff = weekday === 0 ? -6 : 1 - weekday
  return addAgendaDays(dateStr, diff, timeZone)
}

/** Rango UTC lunes–domingo (inicio en `weekStartMonday` YYYY-MM-DD). */
export function agendaWeekUtcRange(weekStartMonday: string): { gte: Date; lte: Date } {
  const weekEnd = addAgendaDays(weekStartMonday, 6)
  const { gte } = agendaDayUtcRange(weekStartMonday)
  const { lte } = agendaDayUtcRange(weekEnd)
  return { gte, lte }
}

export function currentAgendaYearMonth(offsetMonths = 0): { year: number; month: number } {
  const [year, month, day] = todayAgendaDateString().split('-').map(Number)
  let y = year
  let m = month + offsetMonths
  while (m < 1) {
    m += 12
    y -= 1
  }
  while (m > 12) {
    m -= 12
    y += 1
  }
  void day
  return { year: y, month: m }
}

/** Rango UTC del mes de calendario AMI (month 1–12). */
export function agendaMonthUtcRange(year: number, month: number): { gte: Date; lte: Date } {
  const first = `${year}-${String(month).padStart(2, '0')}-01`
  const nextYear = month === 12 ? year + 1 : year
  const nextMonth = month === 12 ? 1 : month + 1
  const firstNext = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`
  const gte = parseAppointmentLocalDateTime(first, '00:00')
  const lte = new Date(parseAppointmentLocalDateTime(firstNext, '00:00').getTime() - 1)
  return { gte, lte }
}

/** Etiqueta larga del día de agenda (es-MX, zona AMI). */
export function formatAgendaDayHeading(dateStr: string, timeZone = AMI_APPOINTMENT_TIMEZONE): string {
  const d = parseAppointmentLocalDateTime(dateStr, '12:00')
  return d.toLocaleDateString('es-MX', {
    timeZone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}
