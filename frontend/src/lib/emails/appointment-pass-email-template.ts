import {
  SME_BRAND_LINE,
  SME_LEGAL_NAME,
  SME_PDF_FOOTER,
} from '@/lib/brand-constants'
import { escapeHtml } from '@/lib/emails/escape-html'

const SME_PRIMARY = '#00afaa'
const SME_SECONDARY = '#592c82'
const SME_TEXT = '#636569'
const SME_SURFACE = '#f9fafb'
const SME_BORDER = '#e2e8f0'

export type AppointmentPassEmailTemplateArgs = {
  firstName: string
  lastName: string
  dateLabel: string
  timeLabel: string
  branchName: string
  branchAddress?: string | null
  expedientId?: string | null
  profileName?: string | null
  testNames: string[]
  prefillUrl?: string | null
  triptychUrl: string
  hasInlineQr?: boolean
}

export function buildAppointmentPassEmailContent(
  args: AppointmentPassEmailTemplateArgs,
): { subject: string; text: string; html: string } {
  const subject = 'Confirmación de cita médica — Soluciones Médico Empresariales'
  const patientFullName = `${args.firstName} ${args.lastName}`.trim()
  const pruebas =
    args.testNames.length > 0
      ? args.testNames.join(', ')
      : args.profileName?.trim() || 'Según perfil clínico asignado'
  const prefill = args.prefillUrl?.trim() || null
  const triptych = args.triptychUrl.trim()

  const textLines = [
    SME_LEGAL_NAME,
    '',
    `Hola ${args.firstName},`,
    '',
    'Tu cita médica en Soluciones Médico Empresariales está confirmada:',
    '',
    `Paciente: ${patientFullName}`,
    `Fecha: ${args.dateLabel}`,
    `Hora: ${args.timeLabel}`,
    `Sucursal: ${args.branchName}`,
    args.branchAddress?.trim() ? `Dirección: ${args.branchAddress.trim()}` : '',
    `Pruebas: ${pruebas}`,
    args.expedientId?.trim() ? `Expediente: ${args.expedientId.trim()}` : '',
    '',
  ].filter((line, index) => line !== '' || index === 1 || index === 3 || index === 5)

  if (prefill) {
    textLines.push(
      'Completa tus antecedentes médicos antes de tu cita en este enlace:',
      prefill,
      '',
    )
  }

  textLines.push(
    `Tríptico de preparación (Tips para pacientes): ${triptych}`,
    '',
    'Presenta este correo o tu pase en recepción al llegar.',
    '',
    SME_PDF_FOOTER,
  )

  const escFirst = escapeHtml(args.firstName)
  const escPatient = escapeHtml(patientFullName)
  const escDate = escapeHtml(args.dateLabel)
  const escTime = escapeHtml(args.timeLabel)
  const escBranch = escapeHtml(args.branchName)
  const escAddress = args.branchAddress?.trim() ? escapeHtml(args.branchAddress.trim()) : null
  const escPruebas = escapeHtml(pruebas)
  const escExpedient = args.expedientId?.trim() ? escapeHtml(args.expedientId.trim()) : null
  const escPrefill = prefill ? escapeHtml(prefill) : null
  const escTriptych = escapeHtml(triptych)
  const legalName = escapeHtml(SME_LEGAL_NAME)
  const brandLine = escapeHtml(SME_BRAND_LINE)
  const footer = escapeHtml(SME_PDF_FOOTER)

  const prefillSectionHtml = escPrefill
    ? `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:10px;margin:0 0 20px;">
        <tr>
          <td style="padding:18px 20px;">
            <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:${SME_SECONDARY};">Prellenado de antecedentes médicos</p>
            <p style="margin:0 0 14px;font-size:13px;line-height:1.5;color:#475569;">Ahorra tiempo en recepción completando tus antecedentes antes de acudir a tu cita:</p>
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 10px;">
              <tr>
                <td>
                  <a clicktracking="off" href="${escPrefill}" style="display:inline-block;background-color:${SME_PRIMARY};color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:12px 24px;border-radius:8px;">Completar antecedentes previos</a>
                </td>
              </tr>
            </table>
            <p style="margin:0;font-size:11px;line-height:1.4;color:#64748b;word-break:break-all;">
              Enlace directo: <a clicktracking="off" href="${escPrefill}" style="color:${SME_SECONDARY};">${escPrefill}</a>
            </p>
          </td>
        </tr>
      </table>`
    : ''

  const qrSectionHtml = args.hasInlineQr
    ? `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#ffffff;border:1px solid ${SME_BORDER};border-radius:10px;margin:0 0 20px;">
        <tr>
          <td align="center" style="padding:18px 20px;">
            <p style="margin:0 0 10px;font-size:13px;font-weight:700;color:${SME_SECONDARY};">Pase QR de check-in</p>
            <img src="cid:appointment-qr" width="176" height="176" alt="Código QR de cita" style="display:block;margin:0 auto;border-radius:8px;" />
            <p style="margin:10px 0 0;font-size:12px;color:#475569;">Muestra este código QR en recepción al llegar.</p>
          </td>
        </tr>
      </table>`
    : ''

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Confirmación de cita médica</title>
</head>
<body style="margin:0;padding:0;background-color:${SME_SURFACE};font-family:Inter,ui-sans-serif,system-ui,-apple-system,sans-serif;color:${SME_TEXT};">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:${SME_SURFACE};padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;background:#ffffff;border:1px solid ${SME_BORDER};border-radius:12px;overflow:hidden;">
          <tr>
            <td style="background:linear-gradient(135deg, ${SME_SECONDARY} 0%, #6b3d9e 100%);padding:26px 32px;">
              <p style="margin:0;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:rgba(255,255,255,0.85);font-weight:600;">${legalName}</p>
              <h1 style="margin:8px 0 0;font-size:22px;line-height:1.3;font-weight:700;color:#ffffff;">Confirmación de cita médica</h1>
              <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.9);">${brandLine}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px;">
              <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#334155;">
                Hola <strong style="color:#0f172a;">${escFirst}</strong>, tu cita médica está confirmada. Te compartimos los detalles para tu atención:
              </p>

              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:${SME_SURFACE};border:1px solid ${SME_BORDER};border-radius:10px;margin:0 0 20px;">
                <tr>
                  <td style="padding:18px 20px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td style="padding:6px 0;font-size:12px;color:#64748b;width:110px;vertical-align:top;">Paciente</td>
                        <td style="padding:6px 0;font-size:14px;font-weight:600;color:#0f172a;">${escPatient}</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;font-size:12px;color:#64748b;border-top:1px solid ${SME_BORDER};vertical-align:top;">Fecha y hora</td>
                        <td style="padding:6px 0;font-size:14px;font-weight:600;color:#0f172a;border-top:1px solid ${SME_BORDER};">${escDate} · ${escTime}</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;font-size:12px;color:#64748b;border-top:1px solid ${SME_BORDER};vertical-align:top;">Sucursal</td>
                        <td style="padding:6px 0;font-size:14px;color:#0f172a;border-top:1px solid ${SME_BORDER};">
                          <strong>${escBranch}</strong>${escAddress ? `<br /><span style="font-size:12px;color:#64748b;">${escAddress}</span>` : ''}
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;font-size:12px;color:#64748b;border-top:1px solid ${SME_BORDER};vertical-align:top;">Pruebas</td>
                        <td style="padding:6px 0;font-size:13px;color:#334155;border-top:1px solid ${SME_BORDER};">${escPruebas}</td>
                      </tr>
                      ${escExpedient ? `<tr>
                        <td style="padding:6px 0;font-size:12px;color:#64748b;border-top:1px solid ${SME_BORDER};vertical-align:top;">Expediente</td>
                        <td style="padding:6px 0;font-size:13px;font-weight:600;color:#0f172a;font-family:ui-monospace,Menlo,Consolas,monospace;border-top:1px solid ${SME_BORDER};">${escExpedient}</td>
                      </tr>` : ''}
                    </table>
                  </td>
                </tr>
              </table>

              ${qrSectionHtml}

              ${prefillSectionHtml}

              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f0fdfa;border:1px solid #99f6e4;border-radius:10px;margin:0 0 20px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#0f766e;">Tríptico de preparación (Tips para pacientes)</p>
                    <p style="margin:0 0 12px;font-size:13px;line-height:1.5;color:#115e59;">Consulta las recomendaciones previas antes de acudir a tu examen médico:</p>
                    <a clicktracking="off" href="${escTriptych}" style="display:inline-block;background-color:#ffffff;border:1px solid ${SME_PRIMARY};color:#0f766e;text-decoration:none;font-size:13px;font-weight:700;padding:10px 18px;border-radius:8px;">Descargar tríptico de preparación (PDF)</a>
                  </td>
                </tr>
              </table>

              <p style="margin:0;font-size:13px;line-height:1.5;color:#475569;">
                Presenta este correo o tu pase en recepción al llegar a la sucursal.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 32px;background:${SME_SURFACE};border-top:1px solid ${SME_BORDER};">
              <p style="margin:0;font-size:11px;line-height:1.55;color:#94a3b8;text-align:center;">${footer}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  return { subject, text: textLines.join('\n'), html }
}
