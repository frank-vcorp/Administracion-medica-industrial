import { z } from 'zod'
import {
  RAYOS_X_MAX_FILES,
  rayosXAttachmentItemSchema,
} from '@/lib/clinical/rayos-x-attachments'
import { ecgParametersPayloadSchema } from '@/lib/clinical/ecg-parameters'

/** Identificadores obligatorios en uploadEventTestFile (validación servidor). */
export const eventTestUploadIdsSchema = z.object({
  eventTestId: z.string().uuid('eventTestId inválido'),
  eventId: z.string().uuid('eventId inválido'),
})

export const attachRayosXPlatesSchema = eventTestUploadIdsSchema.extend({
  mode: z.enum(['replace', 'append']),
  newPlates: z.array(rayosXAttachmentItemSchema).min(1).max(RAYOS_X_MAX_FILES),
  triggeredByUserId: z.string().trim().min(1).max(120).optional(),
})

export const updateRayosXAttachmentLabelSchema = eventTestUploadIdsSchema.extend({
  fileUrl: z.string().min(1),
  projectionLabel: z.string().trim().max(60).nullable(),
})

export const removeRayosXAttachmentSchema = eventTestUploadIdsSchema.extend({
  fileUrl: z.string().min(1),
})

export const saveEcgClinicalParametersSchema = eventTestUploadIdsSchema.extend({
  parameters: ecgParametersPayloadSchema,
})
