import { z } from 'zod'

export const createAppointmentInputSchema = z.object({
  workerId: z.string().trim().min(1, 'Selecciona un trabajador'),
  companyId: z.string().trim().min(1, 'Selecciona una empresa'),
  branchId: z.string().trim().min(1, 'Selecciona una sucursal'),
  scheduledAt: z.union([z.date(), z.string()]),
  notes: z.string().optional(),
  source: z.string().optional(),
  serviceProfileId: z.string().nullable().optional(),
})

export const rescheduleAppointmentBodySchema = z.object({
  date: z.string().trim().min(1, 'La fecha es obligatoria'),
  time: z.string().trim().min(1, 'La hora es obligatoria'),
})
