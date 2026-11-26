'use server'

import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import prisma from '@/lib/prisma'
import { SME_LEGAL_NAME } from '@/lib/brand-constants'
import { sendSmtpMail } from '@/lib/smtp-mail'
import { isValidWhatsAppPhone, normalizeWhatsAppPhone } from '@/lib/whatsapp-phone'
import { sendWhatsAppDocumentMessage } from '@/actions/whatsapp-send.actions'
import {
  buildCierreClinicoZip,
  CierreClinicoError,
} from '@/lib/zip-cierre-clinico'

const STAFF = new Set([
  'ADMIN',
  'SUPERADMIN',
  'RECEPTIONIST',
  'DOCTOR_GENERAL',
  'DOCTOR_VALIDATOR',
  'CAPTURIST',
])

export interface CierreClinicoContactInfo {
  success: boolean
  patientName?: string
  companyName?: string | null
  companyEmail?: string | null
  companyPhone?: string | null
  workerEmail?: string | null
  workerPhone?: string | null
  additionalEmails?: string[]
  error?: string
}

export async function getCierreClinicoContactInfo(
  eventId: string,
): Promise<CierreClinicoContactInfo> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { success: false, error: 'No autenticado' }
  if (!STAFF.has(session.user.role as string)) {
    return { success: false, error: 'Sin permiso para consultar contactos de envío' }
  }

  const event = await prisma.medicalEvent.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      worker: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          company: {
            select: {
              name: true,
              email: true,
              phone: true,
            },
          },
          reportEmails: { select: { email: true }, take: 5 },
        },
      },
    },
  })
  if (!event) return { success: false, error: 'Expediente no encontrado' }

  const patientName = `${event.worker.firstName} ${event.worker.lastName}`.trim()
  const companyName = event.worker.company?.name ?? null
  const companyEmail = event.worker.company?.email?.trim() ?? null
  const companyPhone = event.worker.company?.phone?.trim() ?? null
  const workerEmail = event.worker.email?.trim() ?? null
  const workerPhone = event.worker.phone?.trim() ?? null
  const additionalEmails = (event.worker.reportEmails ?? [])
    .map((r) => r.email.trim())
    .filter(Boolean)

  return {
    success: true,
    patientName,
    companyName,
    companyEmail,
    companyPhone,
    workerEmail,
    workerPhone,
    additionalEmails,
  }
}

function buildCierreClinicoEmailHtml(input: {
  patient: string
  companyName: string
  folioShort: string
  verdictAptitud?: string | null
  filename: string
}): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; }
    .header { background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: #ffffff; padding: 24px 28px; }
    .header h1 { margin: 0 0 4px; font-size: 19px; font-weight: 700; }
    .header p { margin: 0; font-size: 12px; color: #94a3b8; }
    .content { padding: 28px; }
    .intro { font-size: 14px; line-height: 1.5; color: #334155; margin-bottom: 20px; }
    .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 20px; }
    .card-table { width: 100%; border-collapse: collapse; }
    .card-table td { padding: 5px 0; font-size: 13px; }
    .card-label { color: #64748b; font-weight: 600; width: 140px; }
    .card-value { color: #0f172a; font-weight: 600; text-align: right; }
    .badge { display: inline-block; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; background: #ecfdf5; color: #047857; }
    .attachment-box { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 14px; margin-bottom: 20px; font-size: 13px; color: #1e40af; line-height: 1.4; }
    .footer { background: #f1f5f9; padding: 18px 28px; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Soluciones Médico Empresariales</h1>
      <p>Sistema Clínico Digital · Medicina Laboral</p>
    </div>
    <div class="content">
      <p class="intro">
        Estimado cliente / responsable,<br><br>
        Le hacemos entrega del <strong>Expediente de Cierre Clínico Digital</strong> correspondiente a la evaluación médica ocupacional:
      </p>
      <div class="card">
        <table class="card-table">
          <tr>
            <td class="card-label">Trabajador:</td>
            <td class="card-value">${input.patient}</td>
          </tr>
          <tr>
            <td class="card-label">Empresa:</td>
            <td class="card-value">${input.companyName}</td>
          </tr>
          <tr>
            <td class="card-label">Folio:</td>
            <td class="card-value">${input.folioShort}</td>
          </tr>
          ${input.verdictAptitud ? `
          <tr>
            <td class="card-label">Dictamen de Aptitud:</td>
            <td class="card-value"><span class="badge">${input.verdictAptitud}</span></td>
          </tr>` : ''}
        </table>
      </div>
      <div class="attachment-box">
        📦 <strong>Archivo adjunto:</strong> ${input.filename}<br>
        Contiene el Dictamen Médico General firmado digitalmente, el reporte de recomendaciones y los resultados de los estudios aplicados.
      </div>
      <p style="font-size: 11px; color: #64748b; line-height: 1.4; margin: 0;">
        <em>Nota de confidencialidad:</em> Este mensaje y sus archivos adjuntos son confidenciales y destinados exclusivamente a las partes autorizadas de conformidad con la normativa de salud y protección de datos personales.
      </p>
    </div>
    <div class="footer">
      ${SME_LEGAL_NAME} · Atención y Validación Médica Industrial
    </div>
  </div>
</body>
</html>`
}

export async function sendCierreClinico(input: {
  eventId: string
  channel: 'email' | 'whatsapp'
  recipientEmail?: string
  additionalEmails?: string[]
  recipientPhone?: string
}): Promise<{ success: boolean; error?: string }> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { success: false, error: 'No autenticado' }
  if (!STAFF.has(session.user.role as string)) {
    return { success: false, error: 'Sin permiso para enviar el cierre clínico' }
  }

  const event = await prisma.medicalEvent.findUnique({
    where: { id: input.eventId },
    select: {
      id: true,
      worker: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          company: {
            select: {
              name: true,
              email: true,
              phone: true,
            },
          },
          reportEmails: { select: { email: true }, take: 5 },
        },
      },
      exam: {
        select: {
          physicalExamData: true,
        },
      },
      verdict: {
        select: {
          finalDiagnosis: true,
        },
      },
    },
  })
  if (!event) return { success: false, error: 'Expediente no encontrado' }

  let zip: Buffer
  let filename: string
  try {
    const built = await buildCierreClinicoZip(event.id)
    zip = Buffer.from(built.zip)
    filename = built.filename
  } catch (err) {
    if (err instanceof CierreClinicoError) {
      return { success: false, error: 'No se pudo armar el cierre clínico para enviarlo.' }
    }
    return { success: false, error: 'No se pudo armar el cierre clínico.' }
  }

  const patient = `${event.worker.firstName} ${event.worker.lastName}`.trim()
  const companyName = event.worker.company?.name || 'Empresa Cliente'
  const ped = (event.exam?.physicalExamData as Record<string, unknown> | null) ?? {}
  const aptitud = (ped.aptitud as string | null) || null

  if (input.channel === 'email') {
    // Resolver correos destino
    const candidateEmails = [
      input.recipientEmail?.trim(),
      ...(input.additionalEmails ?? []).map((e) => e.trim()),
    ].filter((e): e is string => Boolean(e && e.includes('@')))

    // Fallbacks si no se pasaron destinatarios explícitos
    if (candidateEmails.length === 0) {
      if (event.worker.company?.email?.trim()) candidateEmails.push(event.worker.company.email.trim())
      if (event.worker.email?.trim()) candidateEmails.push(event.worker.email.trim())
      for (const re of event.worker.reportEmails ?? []) {
        if (re.email?.trim()) candidateEmails.push(re.email.trim())
      }
    }

    const uniqueEmails = Array.from(new Set(candidateEmails))
    if (uniqueEmails.length === 0) {
      return { success: false, error: 'No se proporcionó ningún correo electrónico válido de destino.' }
    }

    const to = uniqueEmails.join(', ')
    const folioShort = event.id.slice(0, 8).toUpperCase()
    const emailHtml = buildCierreClinicoEmailHtml({
      patient,
      companyName,
      folioShort,
      verdictAptitud: aptitud,
      filename,
    })

    const mailed = await sendSmtpMail({
      purpose: 'results',
      to,
      subject: `Cierre Clínico — ${patient} (${companyName})`,
      text:
        `Estimado cliente,\n\n` +
        `Adjuntamos el expediente digital de cierre clínico correspondiente a: ${patient} (${companyName}).\n\n` +
        `Folio: ${folioShort}\n\n` +
        `Archivo adjunto: ${filename}\n\n` +
        `${SME_LEGAL_NAME}`,
      html: emailHtml,
      attachments: [{ filename, content: zip }],
    })

    if (mailed.skipped) {
      return { success: false, error: 'El correo saliente (SendGrid / SMTP) no está activo o configurado.' }
    }
    if (!mailed.success) {
      return { success: false, error: mailed.error ?? 'No se pudo enviar el correo electrónico.' }
    }
    return { success: true }
  }

  // Canal WhatsApp
  const rawPhone = input.recipientPhone?.trim() || event.worker.phone || event.worker.company?.phone || ''
  const phone = normalizeWhatsAppPhone(rawPhone)
  if (!isValidWhatsAppPhone(phone)) {
    return {
      success: false,
      error: `El teléfono "${rawPhone || 'vacío'}" no es un número válido de 10 dígitos para WhatsApp.`,
    }
  }

  const sent = await sendWhatsAppDocumentMessage({
    phone,
    fileName: filename,
    mimetype: 'application/zip',
    dataBase64: zip.toString('base64'),
    caption: `Cierre clínico de ${patient} (${companyName}). ${SME_LEGAL_NAME}`,
    auditContext: 'cierre_clinico',
    entityId: event.id,
  })

  if (sent.skipped) {
    return { success: false, error: 'El servicio institucional de WhatsApp no está conectado actualmente.' }
  }
  if (!sent.sent) {
    return { success: false, error: sent.error ?? 'No se pudo enviar el archivo por WhatsApp.' }
  }
  return { success: true }
}
