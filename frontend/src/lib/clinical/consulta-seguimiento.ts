import type { ConsultaMedicaPayload } from '@/schemas/clinical/consulta-medica.constants'
import {
  AMI_APPOINTMENT_TIMEZONE,
  formatAppointmentAgendaDateString,
  formatAppointmentAgendaTime,
} from '@/lib/appointment-scheduling'

export type ProximaCitaFields = Pick<
  ConsultaMedicaPayload,
  'proxima_cita_fecha' | 'proxima_cita_hora' | 'proxima_cita_appointment_id'
>

/** Arma el fragmento de próxima cita que guarda la consulta. Omite vacíos. */
export function buildProximaCitaFields(input: {
  fecha: string
  hora: string
  appointmentId: string
}): ProximaCitaFields {
  const fecha = input.fecha.trim()
  const hora = input.hora.trim()
  const appointmentId = input.appointmentId.trim()
  return {
    ...(fecha ? { proxima_cita_fecha: fecha } : {}),
    ...(hora ? { proxima_cita_hora: hora } : {}),
    ...(appointmentId ? { proxima_cita_appointment_id: appointmentId } : {}),
  }
}

/** Línea para la nota/receta. Null si el médico no indicó seguimiento. */
export function formatProximaCitaLine(
  payload: Partial<ProximaCitaFields> | null | undefined,
): string | null {
  const fecha = payload?.proxima_cita_fecha?.trim()
  const hora = payload?.proxima_cita_hora?.trim()
  const appointmentId = payload?.proxima_cita_appointment_id?.trim()
  if (!fecha && !hora && !appointmentId) return null
  const when = [fecha, hora].filter(Boolean).join(' · ')
  if (when) return when
  return `Cita vinculada: ${appointmentId}`
}

/** Fecha y hora que ve el médico y las que se imprimen en la nota. */
export function formatScheduledFollowUp(scheduledAt: Date): {
  fecha: string
  hora: string
  dateInput: string
  timeInput: string
} {
  const dateInput = formatAppointmentAgendaDateString(scheduledAt)
  const timeInput = formatAppointmentAgendaTime(scheduledAt).replace(/\s/g, '')
  const fecha = new Intl.DateTimeFormat('es-MX', {
    timeZone: AMI_APPOINTMENT_TIMEZONE,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(scheduledAt)
  return { fecha, hora: timeInput, dateInput, timeInput }
}
