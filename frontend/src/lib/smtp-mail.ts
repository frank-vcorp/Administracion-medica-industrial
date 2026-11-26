import nodemailer from 'nodemailer'
import { resolveSmtpFromAddress, resolveSmtpTransport, type SmtpMailPurpose } from '@/lib/smtp-config'

export type SendSmtpMailArgs = {
  purpose: SmtpMailPurpose
  to: string
  subject: string
  text: string
  /** Cuerpo HTML (multipart/alternative junto con `text`). */
  html?: string
  attachments?: Array<
    | { filename: string; content: Buffer }
    | { filename: string; content: string; encoding: 'base64' }
  >
  /** Prueba admin: remitente guardado aunque SendGrid esté desactivado en producción. */
  forProbe?: boolean
}

const SME_SMTP_FROM_NAME = 'Soluciones Médico Empresariales'

export function formatSmtpFromWithBrand(rawFrom: string): string {
  const trimmed = rawFrom.trim()
  if (!trimmed) return rawFrom
  if (trimmed.includes('<') && trimmed.includes('>')) return trimmed
  return `"${SME_SMTP_FROM_NAME}" <${trimmed}>`
}

export function buildSendGridDisableClickTrackHeaders(transport: {
  host: string
  source: 'sendgrid_db' | 'env'
}): Record<string, string> | undefined {
  if (
    transport.source === 'sendgrid_db' ||
    transport.host.toLowerCase().includes('sendgrid')
  ) {
    return {
      'X-SMTPAPI': JSON.stringify({
        filters: {
          clicktrack: {
            settings: {
              enable: 0,
              enable_text: 0,
            },
          },
        },
      }),
    }
  }
  return undefined
}

export async function sendSmtpMail(
  args: SendSmtpMailArgs,
): Promise<{ success: boolean; error?: string; skipped?: boolean }> {
  const transportConfig = await resolveSmtpTransport({ forProbe: args.forProbe })
  if (!transportConfig) {
    return { success: true, skipped: true }
  }

  try {
    const transporter = nodemailer.createTransport({
      host: transportConfig.host,
      port: transportConfig.port,
      secure: transportConfig.secure,
      auth: transportConfig.auth,
    })

    const from = await resolveSmtpFromAddress(args.purpose, {
      ignoreEnabled: args.forProbe,
    })

    await transporter.sendMail({
      from: formatSmtpFromWithBrand(from),
      to: args.to,
      subject: args.subject,
      text: args.text,
      html: args.html,
      attachments: args.attachments,
      headers: buildSendGridDisableClickTrackHeaders(transportConfig),
    })

    return { success: true }
  } catch (err) {
    console.error('[SMTP] sendMail failed:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Error al enviar correo',
    }
  }
}
