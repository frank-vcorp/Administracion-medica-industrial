/**
 * Envío de credenciales temporales del portal B2B (SendGrid SMTP vía Configuración o env SMTP_*).
 */

import { sendSmtpMail } from '@/lib/smtp-mail'
import {
  buildPortalAccessEmailHtml,
  buildPortalAccessEmailText,
} from '@/lib/emails/portal-access-email-template'

export function buildPortalAccessEmailSubject(companyName: string): string {
  return `Credenciales de acceso al Portal de Medicina Laboral — ${companyName}`
}

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
    subject: buildPortalAccessEmailSubject(args.companyName),
    text: buildPortalAccessEmailText(args),
    html: buildPortalAccessEmailHtml(args),
  })

  if (result.skipped) {
    console.info(
      `[PORTAL_ACCESS] (sin SMTP) credenciales para ${args.loginEmail} @ ${args.companyName}`,
    )
  }

  return result
}
