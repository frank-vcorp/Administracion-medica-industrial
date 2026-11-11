import {
  SME_BRAND_LINE,
  SME_LEGAL_NAME,
  SME_PDF_FOOTER,
} from '@/lib/brand-constants'
import { PORTAL_PRIVACY_PATH, PORTAL_TERMS_PATH } from '@/lib/portal-legal'
import { escapeHtml } from '@/lib/emails/escape-html'

/** Colores institucionales SME (ver `globals.css` @theme). */
const SME_PRIMARY = '#00afaa'
const SME_SECONDARY = '#592c82'
const SME_TEXT = '#636569'
const SME_SURFACE = '#f9fafb'
const SME_BORDER = '#e2e8f0'

export type PortalAccessEmailContentArgs = {
  companyName: string
  loginEmail: string
  temporaryPassword: string
  loginUrl: string
}

function appBaseFromLoginUrl(loginUrl: string): string {
  try {
    const u = new URL(loginUrl)
    return u.origin
  } catch {
    return loginUrl.replace(/\/login\/?$/, '')
  }
}

export function buildPortalAccessEmailText(args: PortalAccessEmailContentArgs): string {
  const base = appBaseFromLoginUrl(args.loginUrl)
  const termsUrl = `${base}${PORTAL_TERMS_PATH}`
  const privacyUrl = `${base}${PORTAL_PRIVACY_PATH}`

  return [
    SME_LEGAL_NAME,
    '',
    `Se habilitó el portal cliente para ${args.companyName}.`,
    '',
    '── Credenciales de acceso ──',
    `Usuario: ${args.loginEmail}`,
    `Contraseña temporal: ${args.temporaryPassword}`,
    '',
    `Acceder al portal: ${args.loginUrl}`,
    '',
    'En su primer ingreso deberá:',
    '• Aceptar los términos y condiciones y el aviso de privacidad',
    '• Definir una contraseña nueva',
    '',
    `Términos: ${termsUrl}`,
    `Privacidad: ${privacyUrl}`,
    '',
    'No comparta estas credenciales fuera de su organización.',
    '',
    SME_PDF_FOOTER,
  ].join('\n')
}

export function buildPortalAccessEmailHtml(args: PortalAccessEmailContentArgs): string {
  const base = appBaseFromLoginUrl(args.loginUrl)
  const termsUrl = `${base}${PORTAL_TERMS_PATH}`
  const privacyUrl = `${base}${PORTAL_PRIVACY_PATH}`

  const company = escapeHtml(args.companyName)
  const loginEmail = escapeHtml(args.loginEmail)
  const tempPass = escapeHtml(args.temporaryPassword)
  const loginUrl = escapeHtml(args.loginUrl)
  const termsUrlEsc = escapeHtml(termsUrl)
  const privacyUrlEsc = escapeHtml(privacyUrl)
  const legalName = escapeHtml(SME_LEGAL_NAME)
  const brandLine = escapeHtml(SME_BRAND_LINE)
  const footer = escapeHtml(SME_PDF_FOOTER)

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Acceso al portal cliente</title>
</head>
<body style="margin:0;padding:0;background-color:${SME_SURFACE};font-family:Inter,ui-sans-serif,system-ui,-apple-system,sans-serif;color:${SME_TEXT};">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:${SME_SURFACE};padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;background:#ffffff;border:1px solid ${SME_BORDER};border-radius:12px;overflow:hidden;">
          <tr>
            <td style="background:linear-gradient(135deg, ${SME_SECONDARY} 0%, #6b3d9e 100%);padding:28px 32px;">
              <p style="margin:0;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:rgba(255,255,255,0.85);font-weight:600;">${legalName}</p>
              <h1 style="margin:8px 0 0;font-size:22px;line-height:1.3;font-weight:700;color:#ffffff;">Portal cliente</h1>
              <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.9);">${brandLine}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155;">
                Se habilitó el acceso al portal para <strong style="color:#0f172a;">${company}</strong>.
                Utilice las credenciales siguientes para su primer ingreso.
              </p>

              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:${SME_SURFACE};border:1px solid ${SME_BORDER};border-radius:10px;margin:0 0 24px;">
                <tr>
                  <td style="padding:20px 22px;">
                    <p style="margin:0 0 4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#64748b;">Credenciales</p>
                    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-top:12px;">
                      <tr>
                        <td style="padding:8px 0;font-size:13px;color:#64748b;width:140px;vertical-align:top;">Usuario</td>
                        <td style="padding:8px 0;font-size:15px;font-weight:600;color:#0f172a;font-family:ui-monospace,Menlo,Consolas,monospace;">${loginEmail}</td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0;font-size:13px;color:#64748b;vertical-align:top;border-top:1px solid ${SME_BORDER};">Contraseña temporal</td>
                        <td style="padding:8px 0;font-size:15px;font-weight:600;color:#0f172a;font-family:ui-monospace,Menlo,Consolas,monospace;border-top:1px solid ${SME_BORDER};">${tempPass}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 28px;">
                <tr>
                  <td align="center">
                    <a href="${loginUrl}" style="display:inline-block;background-color:${SME_PRIMARY};color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:14px 32px;border-radius:8px;mso-padding-alt:0;">Acceder al portal</a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#475569;font-weight:600;">Primer ingreso</p>
              <ul style="margin:0 0 20px;padding-left:20px;font-size:14px;line-height:1.65;color:#475569;">
                <li style="margin-bottom:6px;">Acepte los <a href="${termsUrlEsc}" style="color:${SME_SECONDARY};">términos y condiciones</a> del portal.</li>
                <li style="margin-bottom:6px;">Acepte el <a href="${privacyUrlEsc}" style="color:${SME_SECONDARY};">aviso de privacidad</a>.</li>
                <li>Defina una contraseña nueva de acceso.</li>
              </ul>

              <p style="margin:0;padding:14px 16px;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;font-size:13px;line-height:1.5;color:#92400e;">
                <strong>Seguridad:</strong> No comparta estas credenciales fuera de su organización. Si no solicitó este acceso, contacte a ${legalName}.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;background:${SME_SURFACE};border-top:1px solid ${SME_BORDER};">
              <p style="margin:0;font-size:11px;line-height:1.55;color:#94a3b8;text-align:center;">${footer}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}
