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

/** Rango UTC que cubre un día de agenda (00:00–23:59:59.999) en zona AMI. */
export function agendaDayUtcRange(dateStr: string): { gte: Date; lte: Date } {
  const gte = parseAppointmentLocalDateTime(dateStr, '00:00')
  const lte = new Date(parseAppointmentLocalDateTime(dateStr, '23:59').getTime() + 59_999)
  return { gte, lte }
}
