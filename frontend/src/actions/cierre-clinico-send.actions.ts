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
import { readPersistedPdfBytes } from '@/lib/clinical/study-pdf-for-zip'
import { renderPatientHealthDictamenToMemory } from '@/lib/patient-dictamen-pdf'
import { readPatientHealthRecommendations } from '@/lib/clinical/dictamen-audience'
import {
  resolveStudiesFromEvent,
  resolveWorkerPersonalDetails,
  summarizeExtractedData,
} from '@/lib/dictamen-summary'
import { resolveSmeLogoDataUrl } from '@/lib/sme-brand'

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

function buildPatientRecommendationsEmailHtml(input: {
  patient: string
  folioShort: string
  filename: string
}): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; }
    .header { background: linear-gradient(135deg, #064e3b 0%, #047857 100%); color: #ffffff; padding: 24px 28px; }
    .header h1 { margin: 0 0 4px; font-size: 19px; font-weight: 700; }
    .header p { margin: 0; font-size: 12px; color: #a7f3d0; }
    .content { padding: 28px; }
    .intro { font-size: 14px; line-height: 1.5; color: #334155; margin-bottom: 20px; }
    .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 20px; }
    .card-table { width: 100%; border-collapse: collapse; }
    .card-table td { padding: 5px 0; font-size: 13px; }
    .card-label { color: #64748b; font-weight: 600; width: 140px; }
    .card-value { color: #0f172a; font-weight: 600; text-align: right; }
    .attachment-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 14px; margin-bottom: 20px; font-size: 13px; color: #166534; line-height: 1.4; }
    .footer { background: #f1f5f9; padding: 18px 28px; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Soluciones Médico Empresariales</h1>
      <p>Orientación Preventiva y Salud Integral</p>
    </div>
    <div class="content">
      <p class="intro">
        Estimado(a) <strong>${input.patient}</strong>,<br><br>
        Te compartimos tus <strong>Recomendaciones Médicas y de Bienestar</strong> derivadas de tu reciente evaluación de salud:
      </p>
      <div class="card">
        <table class="card-table">
          <tr>
            <td class="card-label">Paciente:</td>
            <td class="card-value">${input.patient}</td>
          </tr>
          <tr>
            <td class="card-label">Folio:</td>
            <td class="card-value">${input.folioShort}</td>
          </tr>
        </table>
      </div>
      <div class="attachment-box">
        🩺 <strong>Archivo adjunto:</strong> ${input.filename}<br>
        Contiene tus recomendaciones personalizadas para el cuidado preventivo de tu salud y estilo de vida.
      </div>
      <p style="font-size: 11px; color: #64748b; line-height: 1.4; margin: 0;">
        <em>Nota de confidencialidad:</em> Este documento contiene información de salud personal confidencial para tu beneficio y orientación médica.
      </p>
    </div>
    <div class="footer">
      ${SME_LEGAL_NAME} · Cuidado de la Salud y Medicina Preventiva
    </div>
  </div>
</body>
</html>`
}

export interface SendCierreClinicoInput {
  eventId: string
  channel: 'email' | 'whatsapp'
  recipientType?: 'company' | 'worker'
  recipientEmail?: string
  additionalEmails?: string[]
  recipientPhone?: string
  additionalPhones?: string[]
}

export async function sendCierreClinico(
  input: SendCierreClinicoInput,
): Promise<{ success: boolean; error?: string }> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { success: false, error: 'No autenticado' }
  if (!STAFF.has(session.user.role as string)) {
    return { success: false, error: 'Sin permiso para enviar el cierre clínico' }
  }

  const isWorkerTarget = input.recipientType === 'worker'

  const event = await prisma.medicalEvent.findUnique({
    where: { id: input.eventId },
    select: {
      id: true,
      worker: {
        select: {
          firstName: true,
          lastName: true,
          universalId: true,
          dob: true,
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
          id: true,
          finalDiagnosis: true,
          recommendations: true,
          signedAt: true,
          patientPdfUrl: true,
          validator: {
            select: {
              fullName: true,
              professionalLicense: true,
            },
          },
        },
      },
      studies: {
        select: {
          serviceName: true,
          extractedData: true,
        },
      },
      eventTests: {
        select: {
          id: true,
          testNameSnapshot: true,
          status: true,
          selectedOption: true,
          resultNotes: true,
          clinicalContext: true,
          test: { select: { name: true } },
          extractionSnapshots: {
            select: { structuredData: true },
            take: 1,
            orderBy: { createdAt: 'desc' },
          },
        },
      },
    },
  })
  if (!event) return { success: false, error: 'Expediente no encontrado' }

  const patient = `${event.worker.firstName} ${event.worker.lastName}`.trim()
  const companyName = event.worker.company?.name || 'Empresa Cliente'
  const ped = (event.exam?.physicalExamData as Record<string, unknown> | null) ?? {}
  const aptitud = (ped.aptitud as string | null) || null
  const folioShort = event.id.slice(0, 8).toUpperCase()

  let fileBuffer: Buffer
  let filename: string
  let mimetype: string

  if (isWorkerTarget) {
    // Al trabajador ÚNICAMENTE se le envían sus recomendaciones de salud (PDF personal)
    mimetype = 'application/pdf'
    filename = `Recomendaciones-Salud-${event.worker.universalId || event.id}.pdf`

    let patientBytes: Uint8Array | null = null
    if (event.verdict?.patientPdfUrl) {
      patientBytes = await readPersistedPdfBytes(event.verdict.patientPdfUrl)
    }

    if (patientBytes) {
      fileBuffer = Buffer.from(patientBytes)
    } else {
      const personal = resolveWorkerPersonalDetails(ped, event.worker)
      const healthRecommendations =
        readPatientHealthRecommendations(ped) ||
        event.verdict?.recommendations ||
        'Mantener estilos de vida saludables, alimentación balanceada y seguimiento médico preventivo.'

      const resolved = resolveStudiesFromEvent(
        event.studies,
        event.eventTests,
        ped,
      )
      const studiesForPatient = resolved.map((s) => ({
        serviceName: s.serviceName,
        findings: summarizeExtractedData(s.extractedData),
      }))
      const logoUrl = await resolveSmeLogoDataUrl()

      fileBuffer = await renderPatientHealthDictamenToMemory({
        signedAt: event.verdict?.signedAt ?? new Date(),
        eventId: event.id,
        verdictId: event.verdict?.id ?? event.id,
        worker: {
          firstName: event.worker.firstName,
          lastName: event.worker.lastName,
          universalId: event.worker.universalId,
          companyName: event.worker.company?.name ?? null,
          age: personal.edad,
          gender: personal.sexo,
          position: personal.puesto,
        },
        healthRecommendations,
        validator: {
          fullName: event.verdict?.validator?.fullName || 'Médico Validador',
          professionalLicense: event.verdict?.validator?.professionalLicense ?? null,
        },
        studies: studiesForPatient,
        logoUrl,
      })
    }
  } else {
    // A la empresa / cliente: Expediente completo de Cierre Clínico (ZIP con Dictamen Ocupacional, Estudios, etc.)
    mimetype = 'application/zip'
    try {
      const built = await buildCierreClinicoZip(event.id)
      fileBuffer = Buffer.from(built.zip)
      filename = built.filename
    } catch (err) {
      if (err instanceof CierreClinicoError) {
        return { success: false, error: 'No se pudo armar el cierre clínico para enviarlo.' }
      }
      return { success: false, error: 'No se pudo armar el cierre clínico.' }
    }
  }

  // ── Canal Email ─────────────────────────────────────────────────────────────
  if (input.channel === 'email') {
    const candidateEmails = [
      input.recipientEmail?.trim(),
      ...(input.additionalEmails ?? []).map((e) => e.trim()),
    ].filter((e): e is string => Boolean(e && e.includes('@')))

    if (candidateEmails.length === 0) {
      if (isWorkerTarget) {
        if (event.worker.email?.trim()) candidateEmails.push(event.worker.email.trim())
      } else {
        if (event.worker.company?.email?.trim()) candidateEmails.push(event.worker.company.email.trim())
        for (const re of event.worker.reportEmails ?? []) {
          if (re.email?.trim()) candidateEmails.push(re.email.trim())
        }
      }
    }

    const uniqueEmails = Array.from(new Set(candidateEmails))
    if (uniqueEmails.length === 0) {
      return {
        success: false,
        error: isWorkerTarget
          ? 'No se proporcionó ningún correo electrónico válido para el trabajador.'
          : 'No se proporcionó ningún correo electrónico válido para la empresa.',
      }
    }

    const to = uniqueEmails.join(', ')
    const subject = isWorkerTarget
      ? `Recomendaciones de Salud y Bienestar — ${patient}`
      : `Cierre Clínico — ${patient} (${companyName})`

    const html = isWorkerTarget
      ? buildPatientRecommendationsEmailHtml({
          patient,
          folioShort,
          filename,
        })
      : buildCierreClinicoEmailHtml({
          patient,
          companyName,
          folioShort,
          verdictAptitud: aptitud,
          filename,
        })

    const text = isWorkerTarget
      ? `Estimado(a) ${patient},\n\nAdjuntamos tus recomendaciones médicas y preventivas de salud emitidas por ${SME_LEGAL_NAME}.\n\nFolio: ${folioShort}\nArchivo adjunto: ${filename}\n\n${SME_LEGAL_NAME}`
      : `Estimado cliente,\n\nAdjuntamos el expediente digital de cierre clínico correspondiente a: ${patient} (${companyName}).\n\nFolio: ${folioShort}\nArchivo adjunto: ${filename}\n\n${SME_LEGAL_NAME}`

    const mailed = await sendSmtpMail({
      purpose: 'results',
      to,
      subject,
      text,
      html,
      attachments: [{ filename, content: fileBuffer }],
    })

    if (mailed.skipped) {
      return { success: false, error: 'El correo saliente (SendGrid / SMTP) no está activo o configurado.' }
    }
    if (!mailed.success) {
      return { success: false, error: mailed.error ?? 'No se pudo enviar el correo electrónico.' }
    }
    return { success: true }
  }

  // ── Canal WhatsApp ──────────────────────────────────────────────────────────
  const candidatePhones: string[] = [
    input.recipientPhone?.trim(),
    ...(input.additionalPhones ?? []).map((p) => p.trim()),
  ].filter((p): p is string => Boolean(p))

  if (candidatePhones.length === 0) {
    const fallbackPhone = isWorkerTarget
      ? event.worker.phone
      : event.worker.company?.phone
    if (fallbackPhone?.trim()) candidatePhones.push(fallbackPhone.trim())
  }

  const validPhones = Array.from(new Set(candidatePhones))
    .map((p) => normalizeWhatsAppPhone(p))
    .filter((p) => isValidWhatsAppPhone(p))

  if (validPhones.length === 0) {
    const attempted = input.recipientPhone?.trim() || (isWorkerTarget ? event.worker.phone : event.worker.company?.phone) || 'vacío'
    return {
      success: false,
      error: `El teléfono "${attempted}" no es un número válido de 10 dígitos para WhatsApp.`,
    }
  }

  let sentCount = 0
  let lastError: string | undefined

  for (const phone of validPhones) {
    const sent = await sendWhatsAppDocumentMessage({
      phone,
      fileName: filename,
      mimetype,
      dataBase64: fileBuffer.toString('base64'),
      caption: isWorkerTarget
        ? `Hola ${patient}, te compartimos tus recomendaciones médicas y de bienestar de Soluciones Médico Empresariales. ${SME_LEGAL_NAME}`
        : `Cierre clínico de ${patient} (${companyName}). ${SME_LEGAL_NAME}`,
      auditContext: isWorkerTarget ? 'cierre_clinico_paciente' : 'cierre_clinico_empresa',
      entityId: event.id,
    })

    if (sent.sent) {
      sentCount++
    } else if (sent.skipped) {
      lastError = 'El servicio institucional de WhatsApp no está conectado actualmente.'
    } else {
      lastError = sent.error ?? 'Error enviando por WhatsApp.'
    }
  }

  if (sentCount === 0) {
    return { success: false, error: lastError || 'No se pudo enviar el archivo por WhatsApp.' }
  }

  return { success: true }
}
