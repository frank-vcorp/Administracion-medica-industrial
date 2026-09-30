/**
 * Tiempo en sede: desde check-in hasta salida (checkout) o hasta ahora si sigue en curso.
 */

export function visitDurationMinutes(
  checkIn: Date | string | null | undefined,
  end: Date | string | null | undefined = new Date(),
): number | null {
  if (!checkIn) return null
  const start = new Date(checkIn)
  const finish = end ? new Date(end) : new Date()
  if (Number.isNaN(start.getTime()) || Number.isNaN(finish.getTime())) return null
  const diffMs = finish.getTime() - start.getTime()
  if (diffMs < 0) return null
  return Math.floor(diffMs / 60_000)
}

export function formatVisitDurationMinutes(totalMinutes: number | null): string | null {
  if (totalMinutes === null) return null
  if (totalMinutes < 1) return '< 1 min'
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) return `${minutes} min`
  if (minutes === 0) return `${hours} h`
  return `${hours} h ${minutes} min`
}

export function formatVisitDuration(
  checkIn: Date | string | null | undefined,
  end?: Date | string | null | undefined,
): string | null {
  return formatVisitDurationMinutes(visitDurationMinutes(checkIn, end))
}
