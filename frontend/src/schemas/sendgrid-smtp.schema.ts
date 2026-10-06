import { z } from 'zod'

export const SENDGRID_SMTP_ROW_ID = 'sendgrid' as const

/** Puertos documentados por SendGrid para SMTP relay. */
export const SENDGRID_SMTP_PORTS = [465, 587, 25] as const

const optionalEmail = z.preprocess(
  (v) => (typeof v === 'string' ? v.trim() : ''),
  z.union([z.literal(''), z.string().email('Correo inválido')]),
)

export const SendGridSmtpSaveSchema = z.object({
  port: z.coerce.number().int().refine((p) => (SENDGRID_SMTP_PORTS as readonly number[]).includes(p), {
    message: 'Puerto SMTP no válido para SendGrid',
  }),
  enabled: z.boolean(),
  fromAddress: optionalEmail,
  fromPortalAccess: optionalEmail,
  fromResults: optionalEmail,
  fromReceipts: optionalEmail,
  /** Vacío = mantener API key existente */
  apiKey: z.string().optional(),
})

export type SendGridSmtpSaveInput = z.infer<typeof SendGridSmtpSaveSchema>
