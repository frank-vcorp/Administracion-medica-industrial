import { z } from 'zod'

/** Identificadores obligatorios en uploadEventTestFile (validación servidor). */
export const eventTestUploadIdsSchema = z.object({
  eventTestId: z.string().uuid('eventTestId inválido'),
  eventId: z.string().uuid('eventId inválido'),
})
