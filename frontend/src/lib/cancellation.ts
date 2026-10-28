import { z } from 'zod'

export const cancellationReasonSchema = z
  .string()
  .trim()
  .min(3, 'Escribe el motivo de la cancelación (mínimo 3 caracteres).')
  .max(500, 'El motivo no puede pasar de 500 caracteres.')

export const cancelAppointmentInputSchema = z.object({
  appointmentId: z.string().uuid('Cita no válida.'),
  reason: cancellationReasonSchema,
})

export const cancelPapeletaInputSchema = z.object({
  eventId: z.string().uuid('Papeleta no válida.'),
  reason: cancellationReasonSchema,
})

export const APPOINTMENT_CANCELLABLE_STATUSES = ['SCHEDULED', 'CONFIRMED', 'NO_SHOW'] as const

export const PAPELETA_CLOSED_STATUSES = ['CANCELED'] as const
