import {
  formatAppointmentAgendaDateString,
  formatAppointmentAgendaTime,
} from '@/lib/appointment-scheduling'

export type AppointmentPassMessageInput = {
  firstName: string
  lastName: string
  scheduledAt: Date
  branchName: string
  branchAddress?: string | null
  expedientId?: string | null
  profileName?: string | null
  testNames: string[]
  prefillUrl?: string | null
}

/** Texto Baileys al confirmar cita (S23-03). */
export function buildAppointmentPassWhatsAppMessage(input: AppointmentPassMessageInput): string {
  const dateLabel = formatAppointmentAgendaDateString(input.scheduledAt)
  const timeLabel = formatAppointmentAgendaTime(input.scheduledAt)
  const pruebas =
    input.testNames.length > 0
      ? input.testNames.join(', ')
      : (input.profileName?.trim() || 'Según perfil clínico asignado')

  const lines = [
    `Hola ${input.firstName},`,
    '',
    'Tu cita médica en AMI está confirmada:',
    '',
    `Paciente: ${input.firstName} ${input.lastName}`,
    `Fecha: ${dateLabel}`,
    `Hora: ${timeLabel}`,
    `Sucursal: ${input.branchName}`,
  ]

  if (input.branchAddress?.trim()) {
    lines.push(`Dirección: ${input.branchAddress.trim()}`)
  }

  lines.push(`Pruebas: ${pruebas}`)

  if (input.expedientId?.trim()) {
    lines.push(`Expediente: ${input.expedientId.trim()}`)
  }

  if (input.prefillUrl?.trim()) {
    lines.push(
      '',
      'Completa tus antecedentes médicos antes de tu cita en este enlace:',
      input.prefillUrl.trim(),
    )
  }

  lines.push(
    '',
    'Presenta este mensaje en recepción. A continuación recibirás el tríptico de preparación (Tips para pacientes).',
  )

  return lines.join('\n')
}

/** Mensaje directo para paciente que ya está en clínica: únicamente enlace de prellenado. */
export function buildPrefillLinkOnlyWhatsAppMessage(input: {
  firstName: string
  prefillUrl: string
}): string {
  return [
    `Hola ${input.firstName},`,
    '',
    'Completa tus antecedentes médicos en este enlace:',
    input.prefillUrl.trim(),
  ].join('\n')
}
