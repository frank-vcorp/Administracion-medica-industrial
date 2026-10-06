import { resolveSmtpFromAddress, resolveSmtpTransport, type SmtpMailPurpose } from '@/lib/smtp-config'

export type SendSmtpMailArgs = {
  purpose: SmtpMailPurpose
  to: string
  subject: string
  text: string
  attachments?: Array<
    | { filename: string; content: Buffer }
    | { filename: string; content: string; encoding: 'base64' }
  >
  /** Prueba admin: remitente guardado aunque SendGrid esté desactivado en producción. */
  forProbe?: boolean
}

export async function sendSmtpMail(
  args: SendSmtpMailArgs,
): Promise<{ success: boolean; error?: string; skipped?: boolean }> {
  const transportConfig = await resolveSmtpTransport()
  if (!transportConfig) {
    return { success: true, skipped: true }
  }

  try {
    const nodemailerPkg = 'nodemailer'
    const nodemailer = await import(/* webpackIgnore: true */ nodemailerPkg).catch(() => null)
    if (!nodemailer) {
      return { success: false, error: 'Servicio de correo no disponible.' }
    }

    const transporter = nodemailer.createTransport({
      host: transportConfig.host,
      port: transportConfig.port,
      secure: transportConfig.secure,
      auth: transportConfig.auth,
    })

    const from = await resolveSmtpFromAddress(args.purpose)

    await transporter.sendMail({
      from,
      to: args.to,
      subject: args.subject,
      text: args.text,
      attachments: args.attachments,
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
