'use server'

import { revalidatePath } from 'next/cache'
import { getServerSession } from 'next-auth/next'
import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { authOptions } from '@/auth'
import { upsertWorkerClinicalHistory } from '@/actions/clinical-history.actions'
import { validateCertificadoMedicoPayload } from '@/lib/clinical/certificado-medico-validate'
import type { CertificadoMedicoPayload } from '@/schemas/clinical/certificado-medico.schema'
import {
  isCertificadoMedicoTestName,
  parseCertificadoMedicoDraftContext,
} from '@/lib/clinical/certificado-medico'
import { isConsultaMedicaTestName } from '@/lib/clinical/consulta-medica'
import { denyIfClosedCaptureUnauthorized } from '@/lib/clinical/papeleta-readonly'
import { resolveCertificadoMedicoMetadata } from '@/lib/clinical/certificado-medico-metadata'
import { renderCertificadoMedicoToMemory } from '@/lib/certificado-medico-pdf'
import { loadCertificadoMedicoPdfInput } from '@/lib/certificado-medico-pdf-data'
import { sendSmtpMail } from '@/lib/smtp-mail'
import { sendWhatsAppDocumentMessage } from '@/actions/whatsapp-send.actions'
import { isValidWhatsAppPhone, normalizeWhatsAppPhone } from '@/lib/whatsapp-phone'
import { SME_LEGAL_NAME } from '@/lib/brand-constants'

const CLINICAL_ROLES = new Set([
  'SUPERADMIN',
  'ADMIN',
  'DOCTOR_GENERAL',
  'DOCTOR_VALIDATOR',
  'RECEPTIONIST',
  'CAPTURIST',
])

export type SaveCertificadoMedicoResult =
  | { success: true; payload: CertificadoMedicoPayload; updatedAt: string }
  | { success: false; error: string; fieldErrors?: Record<string, string[]>; technicalDetail?: string }

async function assertClinicalAccess():
  Promise<{ ok: true; role: string } | { ok: false; error: string }> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return { ok: false, error: 'No autenticado.' }
  }
  const role = session.user.role ?? ''
  if (!CLINICAL_ROLES.has(role)) {
    return { ok: false, error: 'No tienes permisos para capturar certificado médico.' }
  }
  return { ok: true, role }
}

export async function saveCertificadoMedico(
  eventTestId: string,
  eventId: string,
  workerId: string,
  rawPayload: unknown,
  options: { finalize?: boolean; autosave?: boolean } = {},
): Promise<SaveCertificadoMedicoResult> {
  const access = await assertClinicalAccess()
  if (!access.ok) return { success: false, error: access.error }

  const session = await getServerSession(authOptions)

  const eventTest = await prisma.eventTest.findUnique({
    where: { id: eventTestId },
    select: {
      id: true,
      eventId: true,
      testNameSnapshot: true,
      clinicalContext: true,
      event: {
        select: {
          workerId: true,
          checkInDate: true,
          createdAt: true,
          worker: {
            select: {
              nationalId: true,
              clinicalHistory: { select: { data: true } },
            },
          },
        },
      },
    },
  })
  if (!eventTest) {
    return { success: false, error: 'El estudio no existe.' }
  }
  if (eventTest.eventId !== eventId) {
    return { success: false, error: 'El estudio no pertenece al evento indicado.' }
  }
  if (eventTest.event.workerId !== workerId) {
    return { success: false, error: 'El paciente no coincide con el evento.' }
  }
  if (!isCertificadoMedicoTestName(eventTest.testNameSnapshot)) {
    return { success: false, error: 'Este estudio no es un certificado médico.' }
  }

  const priorClosed = Boolean(
    parseCertificadoMedicoDraftContext(eventTest.clinicalContext)?.cerrada_at?.trim(),
  )
  const closedGuard = denyIfClosedCaptureUnauthorized(priorClosed, access.role)
  if (!closedGuard.ok) return { success: false, error: closedGuard.error }

  const validationMode =
    priorClosed || !options.finalize
      ? 'draft'
      : 'final'

  const validation = validateCertificadoMedicoPayload(rawPayload, validationMode)
  if (!validation.valid) {
    return {
      success: false,
      error: validation.error,
      fieldErrors: validation.fieldErrors,
    }
  }
  let payload = validation.payload

  let doctorFullName: string | null = null
  let doctorLicense: string | null = null
  if (session?.user?.id) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { fullName: true, professionalLicense: true },
    })
    doctorFullName = user?.fullName ?? null
    doctorLicense = user?.professionalLicense ?? null
  }

  const longitudinalData =
    eventTest.event.worker.clinicalHistory?.data &&
    typeof eventTest.event.worker.clinicalHistory.data === 'object' &&
    !Array.isArray(eventTest.event.worker.clinicalHistory.data)
      ? (eventTest.event.worker.clinicalHistory.data as Record<string, unknown>)
      : null

  const eventAt = eventTest.event.checkInDate ?? eventTest.event.createdAt
  const metadata = resolveCertificadoMedicoMetadata({
    parsed: payload,
    workerNationalId: eventTest.event.worker.nationalId,
    longitudinalData,
    doctorFullName,
    doctorLicense,
    sessionUserName: session?.user?.name ?? null,
    eventAt,
  })
  payload = { ...payload, ...metadata }

  const antecedentesPayload = payload.antecedentes
  const hasAntecedentes =
    antecedentesPayload &&
    typeof antecedentesPayload === 'object' &&
    Object.values(antecedentesPayload).some(
      (v) => v !== null && v !== undefined && (typeof v !== 'object' || Object.keys(v as object).length > 0),
    )
  if (hasAntecedentes) {
    const hc = await upsertWorkerClinicalHistory(workerId, antecedentesPayload)
    if (!hc.success) {
      return { success: false, error: hc.error ?? 'No se pudo actualizar el historial clínico.' }
    }
  }

  const toStore: CertificadoMedicoPayload = {
    ...payload,
    cerrada_at: priorClosed
      ? (payload.cerrada_at ?? parseCertificadoMedicoDraftContext(eventTest.clinicalContext)?.cerrada_at)
      : options.finalize
        ? new Date().toISOString()
        : payload.cerrada_at,
  }

  try {
    const updated = await prisma.eventTest.update({
      where: { id: eventTestId },
      data: {
        clinicalContext: toStore as unknown as Prisma.InputJsonValue,
        status: options.finalize ? 'COMPLETED' : 'IN_PROGRESS',
      },
      select: { updatedAt: true },
    })

    // Los eventos exclusivos de Certificado Médico / Consulta Médica terminan
    // en el Paso 2 sin requerir firma final (VALIDATING / dictamen general).
    if (options.finalize) {
      const siblingTests = await prisma.eventTest.findMany({
        where: { eventId },
        select: { testNameSnapshot: true, status: true },
      })
      const activeTests = siblingTests.filter(
        (t) => t.status !== 'CANCELLED' && t.status !== 'SKIPPED',
      )
      const isStandaloneCertificadoEvent =
        activeTests.length > 0 &&
        activeTests.every(
          (t) =>
            isCertificadoMedicoTestName(t.testNameSnapshot) ||
            isConsultaMedicaTestName(t.testNameSnapshot),
        )
      const allDone = activeTests.every(
        (t) => t.status === 'COMPLETED' || t.status === 'RESULT_REGISTERED',
      )
      if (isStandaloneCertificadoEvent && allDone) {
        await prisma.medicalEvent.update({
          where: { id: eventId },
          data: { status: 'COMPLETED' },
        })
        revalidatePath('/appointments')
        revalidatePath('/reception')
        revalidatePath('/validation')
      }
    }

    if (!options.autosave) {
      revalidatePath(`/events/${eventId}`)
    }
    return {
      success: true,
      payload: toStore,
      updatedAt: updated.updatedAt.toISOString(),
    }
  } catch (err) {
    console.error('[saveCertificadoMedico]', err)
    return {
      success: false,
      error: 'No se pudo guardar el certificado por un problema del servidor o de red.',
      technicalDetail: err instanceof Error ? err.message : 'unknown_error',
    }
  }
}

export interface GenerateExploracionFisicaInput {
  organos: Record<string, { estado: 'NORMAL' | 'ANORMAL'; detalle: string }>
  tatuajes?: string
  formato?: 'sistemas' | 'narrativo'
}

export interface GenerateExploracionFisicaResult {
  ok: boolean
  texto: string
  source?: 'minimax' | 'template' | 'template_fallback'
  error?: string
}

export async function generateExploracionFisicaIA(
  input: GenerateExploracionFisicaInput,
): Promise<GenerateExploracionFisicaResult> {
  const access = await assertClinicalAccess()
  if (!access.ok) return { ok: false, texto: '', error: access.error }

  const baseUrl =
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    process.env.BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://localhost:8000'

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 25_000)

    const res = await fetch(`${baseUrl}/api/v2/clinical/generate-exploracion-fisica`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal: controller.signal,
    })
    clearTimeout(timer)

    if (res.ok) {
      const data = await res.json()
      if (data && typeof data.texto === 'string' && data.texto.trim()) {
        return { ok: true, texto: data.texto.trim(), source: data.source }
      }
    }
  } catch (err) {
    console.warn('[generateExploracionFisicaIA] Backend error o timeout, usando fallback local', err)
  }

  const getF = (k: string, norm: string) => {
    const o = input.organos?.[k]
    if (o?.estado === 'ANORMAL' && o.detalle?.trim()) return o.detalle.trim()
    return norm
  }

  const neurol = `Consciente, orientado en sus cuatro esferas. ${getF('fuerza', 'Fuerza 5/5 (Daniels), sensibilidad y reflejos osteotendinosos conservados.')} ${getF('romberg_tandem', 'Coordinación, Romberg y marcha en tándem normales.')}`
  const cabezaCuello = `${getF('boca', 'Mucosa oral hidratada, dentadura completa sin caries ni sarro, faringe normal.')} ${getF('ojos', 'Pupilas isocóricas normorreflécticas, globos oculares sin alteraciones.')} ${getF('oidos', 'Conductos auditivos permeables.')}`
  const piel = input.tatuajes?.trim()
    ? `Tatuajes en ${input.tatuajes.trim()}.`
    : 'Sin lesiones ni alteraciones aparentes.'

  const fallback = [
    `Neurológico: ${neurol}`,
    `Cabeza y cuello: ${cabezaCuello}`,
    `Tórax: ${getF('torax', 'Mesomórfico, amplexión y amplexación normales, auscultación cardiopulmonar sin alteraciones.')}`,
    `Abdomen: ${getF('abdomen', 'Globoso, depresible, no doloroso.')}`,
    `Extremidades: ${getF('extremidades', 'Íntegras, eutróficas, llenado capilar inmediato, sin edema.')}`,
    `Piel: ${piel}`,
    `Romberg: ${getF('romberg_tandem', 'Negativo.')}`,
    `Tándem: ${getF('romberg_tandem', 'Negativo.')}`,
  ].join('\n')

  return { ok: true, texto: fallback, source: 'template_fallback' }
}

function buildCertificadoMedicoEmailHtml(input: {
  patient: string
  companyName?: string | null
  folio: string
  filename: string
  isWorker: boolean
}): string {
  const { patient, companyName, folio, filename, isWorker } = input
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Certificado Médico Laboral - SME</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
    .card { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
    .header { background: linear-gradient(135deg, #0f766e 0%, #0d9488 100%); padding: 24px 28px; color: #ffffff; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.01em; }
    .header p { margin: 6px 0 0 0; font-size: 13px; color: #ccfbf1; }
    .content { padding: 28px; line-height: 1.6; font-size: 14px; }
    .highlight-box { background: #f0fdfa; border-left: 4px solid #0d9488; padding: 14px 16px; border-radius: 0 8px 8px 0; margin: 18px 0; }
    .details { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px; }
    .details td { padding: 8px 0; border-bottom: 1px solid #f1f5f9; }
    .details td.label { color: #64748b; font-weight: 600; width: 130px; }
    .details td.val { color: #0f172a; font-weight: 500; }
    .footer { background: #f8fafc; padding: 16px 28px; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>Certificado Médico Laboral</h1>
      <p>Soluciones Médico Empresariales (SME)</p>
    </div>
    <div class="content">
      <p>Estimado(a) <strong>${isWorker ? patient : (companyName || 'Empresa Cliente')}</strong>,</p>
      <p>
        Adjunto a este correo encontrará el <strong>Certificado Médico Laboral</strong> oficial emitido tras la valoración médica ${isWorker ? 'realizada a su persona' : `de <strong>${patient}</strong>`}.
      </p>
      <div class="highlight-box">
        <strong>Documento adjunto:</strong> ${filename}
      </div>
      <table class="details">
        <tr>
          <td class="label">Paciente:</td>
          <td class="val">${patient}</td>
        </tr>
        ${companyName ? `<tr><td class="label">Empresa:</td><td class="val">${companyName}</td></tr>` : ''}
        <tr>
          <td class="label">Folio:</td>
          <td class="val"><code>${folio}</code></td>
        </tr>
      </table>
      <p style="font-size: 11px; color: #64748b; line-height: 1.4; margin-top: 20px;">
        <em>Nota de confidencialidad y validez:</em> Este documento digital ha sido emitido con firma médica y cédula profesional autorizada conforme a la normativa de salud laboral aplicable.
      </p>
    </div>
    <div class="footer">
      ${SME_LEGAL_NAME} · Salud Ocupacional y Medicina del Trabajo
    </div>
  </div>
</body>
</html>`
}

export interface SendCertificadoMedicoInput {
  eventId: string
  eventTestId?: string
  channel: 'email' | 'whatsapp'
  recipientType?: 'company' | 'worker'
  recipientEmail?: string
  additionalEmails?: string[]
  recipientPhone?: string
  additionalPhones?: string[]
}

export async function sendCertificadoMedico(
  input: SendCertificadoMedicoInput,
): Promise<{ success: boolean; error?: string }> {
  const access = await assertClinicalAccess()
  if (!access.ok) return { success: false, error: access.error }

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { success: false, error: 'No autenticado.' }

  const event = await prisma.medicalEvent.findUnique({
    where: { id: input.eventId },
    select: {
      id: true,
      worker: {
        select: {
          firstName: true,
          lastName: true,
          universalId: true,
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
      eventTests: {
        select: {
          id: true,
          testNameSnapshot: true,
          clinicalContext: true,
          test: { select: { name: true } },
        },
      },
    },
  })
  if (!event) return { success: false, error: 'Expediente no encontrado.' }

  const targetTest = input.eventTestId
    ? event.eventTests.find((t) => t.id === input.eventTestId)
    : event.eventTests.find((t) => isCertificadoMedicoTestName(t.testNameSnapshot || t.test?.name || ''))

  if (!targetTest) {
    return { success: false, error: 'No se encontró el estudio de certificado médico en este evento.' }
  }

  const parsed = parseCertificadoMedicoDraftContext(targetTest.clinicalContext)
  if (!parsed?.cerrada_at?.trim()) {
    return { success: false, error: 'El certificado médico debe cerrarse antes de enviarse.' }
  }

  const loaded = await loadCertificadoMedicoPdfInput(event.id, targetTest.id, {
    userId: session.user.id,
  })
  if (!loaded.ok) {
    return { success: false, error: loaded.message }
  }

  let fileBuffer: Buffer
  try {
    fileBuffer = await renderCertificadoMedicoToMemory(loaded.data)
  } catch (err) {
    console.error('[sendCertificadoMedico] Error al renderizar PDF:', err)
    return { success: false, error: 'Error al generar el archivo PDF del certificado médico.' }
  }

  const patient = `${event.worker.firstName} ${event.worker.lastName}`.trim()
  const companyName = event.worker.company?.name ?? null
  const folio = loaded.data.folio || `CM-${event.id.slice(0, 8).toUpperCase()}`
  const filename = `CertificadoMedico-${event.worker.universalId || targetTest.id.slice(0, 8)}.pdf`
  const isWorker = input.recipientType === 'worker'

  if (input.channel === 'email') {
    const candidateEmails = [
      input.recipientEmail?.trim(),
      ...(input.additionalEmails ?? []).map((e) => e.trim()),
    ].filter((e): e is string => Boolean(e && e.includes('@')))

    if (candidateEmails.length === 0) {
      if (isWorker) {
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
        error: isWorker
          ? 'No se proporcionó ningún correo electrónico válido para el paciente.'
          : 'No se proporcionó ningún correo electrónico válido para la empresa.',
      }
    }

    const to = uniqueEmails.join(', ')
    const subject = isWorker
      ? `Certificado Médico Laboral — ${patient}`
      : `Certificado Médico Laboral — ${patient}${companyName ? ` (${companyName})` : ''}`

    const html = buildCertificadoMedicoEmailHtml({
      patient,
      companyName,
      folio,
      filename,
      isWorker,
    })

    const text = isWorker
      ? `Estimado(a) ${patient},\n\nAdjunto encontrará su Certificado Médico Laboral oficial emitido por ${SME_LEGAL_NAME}.\n\nFolio: ${folio}\nArchivo adjunto: ${filename}\n\n${SME_LEGAL_NAME}`
      : `Estimado cliente,\n\nAdjunto encontrará el Certificado Médico Laboral oficial de ${patient}${companyName ? ` (${companyName})` : ''}.\n\nFolio: ${folio}\nArchivo adjunto: ${filename}\n\n${SME_LEGAL_NAME}`

    const mailSent = await sendSmtpMail({
      purpose: 'results',
      to,
      subject,
      text,
      html,
      attachments: [
        {
          filename,
          content: fileBuffer,
        },
      ],
    })

    if (mailSent.skipped) {
      return { success: false, error: 'El correo saliente (SendGrid / SMTP) no está activo o configurado.' }
    }
    if (!mailSent.success) {
      return { success: false, error: mailSent.error || 'Error al enviar el correo con el certificado.' }
    }

    return { success: true }
  }

  // Canal WhatsApp
  const candidatePhones = [
    input.recipientPhone?.trim(),
    ...(input.additionalPhones ?? []).map((p) => p.trim()),
  ].filter((p): p is string => Boolean(p))

  if (candidatePhones.length === 0) {
    const fallback = isWorker ? event.worker.phone : event.worker.company?.phone
    if (fallback?.trim()) candidatePhones.push(fallback.trim())
  }

  const validPhones = Array.from(new Set(candidatePhones))
    .map((p) => normalizeWhatsAppPhone(p))
    .filter((p) => isValidWhatsAppPhone(p))

  if (validPhones.length === 0) {
    const attempted = input.recipientPhone?.trim() || (isWorker ? event.worker.phone : event.worker.company?.phone) || 'vacío'
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
      mimetype: 'application/pdf',
      dataBase64: fileBuffer.toString('base64'),
      caption: isWorker
        ? `Hola ${patient}, te compartimos tu Certificado Médico Laboral emitido por Soluciones Médico Empresariales. ${SME_LEGAL_NAME}`
        : `Certificado Médico Laboral de ${patient}${companyName ? ` (${companyName})` : ''}. ${SME_LEGAL_NAME}`,
      auditContext: isWorker ? 'certificado_medico_paciente' : 'certificado_medico_empresa',
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
    return { success: false, error: lastError || 'No se pudo enviar el certificado por WhatsApp.' }
  }

  return { success: true }
}
