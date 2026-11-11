import { z } from 'zod'
import { zFreeTextMax } from '@/lib/text/zod-free-text'

export const cancellationReasonSchema = zFreeTextMax(500, 3)

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
