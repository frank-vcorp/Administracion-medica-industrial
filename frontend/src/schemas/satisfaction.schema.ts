import { z } from 'zod'

const likert = z.number().int().min(1).max(5)

export const SatisfactionSurveySchema = z.object({
  eventId: z.string().uuid(),
  turno: z.string().min(1).max(100),
  overall: likert,
  qTrato: likert,
  qEscucha: likert,
  qResolucion: likert,
  qEspera: likert,
  qLimpieza: likert,
  qPrivacidad: likert,
  recomienda: likert,
  comentario: z.string().max(2000).optional(),
  channel: z.enum(['TABLET', 'WHATSAPP_LINK', 'DIRECT']).default('DIRECT'),
})

export type SatisfactionSurveyInput = z.infer<typeof SatisfactionSurveySchema>
