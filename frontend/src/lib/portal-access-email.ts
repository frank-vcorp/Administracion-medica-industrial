/**
 * Envío de credenciales temporales del portal B2B (SendGrid SMTP vía Configuración o env SMTP_*).
 */

import { sendSmtpMail } from '@/lib/smtp-mail'

export async function sendPortalAccessCredentialsEmail(args: {
  to: string
  companyName: string
  loginEmail: string
  temporaryPassword: string
  loginUrl: string
}): Promise<{ success: boolean; error?: string; skipped?: boolean }> {
  const result = await sendSmtpMail({
    purpose: 'portal',
    to: args.to,
    subject: `Acceso al portal cliente — ${args.companyName}`,
    text:
      `Administración Médica Industrial\n\n` +
      `Se habilitó el portal para ${args.companyName}.\n\n` +
      `URL de acceso: ${args.loginUrl}\n` +
      `Usuario: ${args.loginEmail}\n` +
      `Contraseña temporal: ${args.temporaryPassword}\n\n` +
      `En su primer ingreso deberá aceptar los términos y condiciones, ` +
      `el aviso de privacidad y definir una contraseña nueva.\n\n` +
      `No comparta estas credenciales fuera de su organización.`,
  })

  if (result.skipped) {
    console.info(
      `[PORTAL_ACCESS] (sin SMTP) credenciales para ${args.loginEmail} @ ${args.companyName}`,
    )
  }

  return result
}
