'use server'

import { z } from 'zod'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/auth'
import prisma from '@/lib/prisma'
import { sendSmtpMail } from '@/lib/smtp-mail'
import {
  PATIENT_PREPARATION_TRIPTYCH_FILENAME,
  readPatientPreparationTriptychPdf,
  resolvePublicPatientTriptychUrl,
} from '@/lib/patient-preparation-triptych'
import { logAudit } from '@/actions/audit.actions'
import { parseDataUrlBase64 } from '@/lib/appointment-qr'
import { formatAppointmentAgendaDateString, formatAppointmentAgendaTime } from '@/lib/appointment-scheduling'
import { createOrReplacePrefilledInvitationForAppointment } from '@/lib/prefilled-invitation-server'
import { buildAppointmentPassEmailContent } from '@/lib/emails/appointment-pass-email-template'

const SendPassEmailSchema = z.object({
  appointmentId: z.string().uuid(),
})

const STAFF_ROLES = new Set([
  'ADMIN',
  'SUPERADMIN',
  'RECEPTIONIST',
  'DOCTOR_GENERAL',
  'DOCTOR_VALIDATOR',
  'CAPTURIST',
  'VENDEDOR',
])

const MAX_EMAIL_PDF_BYTES = 15 * 1024 * 1024

export type AppointmentPassEmailResult = {
  success: boolean
  sent: boolean
  skipped?: boolean
  error?: string
  prefillUrl?: string
}

export async function sendAppointmentPassEmail(
  appointmentId: string,
  options?: { prefillUrl?: string | null },
): Promise<AppointmentPassEmailResult> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return { success: false, sent: false, error: 'No autenticado' }
  }

  const parsed = SendPassEmailSchema.safeParse({ appointmentId })
  if (!parsed.success) {
    return { success: false, sent: false, error: 'Cita no válida' }
  }

  const appointment = await prisma.appointment.findUnique({
    where: { id: parsed.data.appointmentId },
    include: {
      worker: { select: { firstName: true, lastName: true, email: true, companyId: true } },
      branch: { select: { name: true, address: true } },
      serviceProfile: {
        select: {
          name: true,
          tests: { select: { test: { select: { name: true } } } },
        },
      },
    },
  })

  if (!appointment) {
    return { success: false, sent: false, error: 'Cita no encontrada' }
  }

  const role = String(session.user.role ?? '')
  const userCompanyId =
    typeof session.user.companyId === 'string' ? session.user.companyId.trim() : ''
  const isStaff = STAFF_ROLES.has(role)
  const isOwnerCompanyClient =
    role === 'COMPANY_CLIENT' &&
    Boolean(userCompanyId) &&
    (appointment.companyId === userCompanyId || appointment.worker.companyId === userCompanyId)

  if (!isStaff && !isOwnerCompanyClient) {
    return { success: false, sent: false, error: 'Sin permiso para enviar correo de esta cita' }
  }

  const email = appointment.worker.email?.trim()
  if (!email) {
    return { success: true, sent: false, skipped: true }
  }

  let resolvedPrefillUrl: string | undefined = options?.prefillUrl?.trim() || undefined
  if (!resolvedPrefillUrl) {
    try {
      const invite = await createOrReplacePrefilledInvitationForAppointment({
        appointmentId: appointment.id,
        generatedById: session.user.id,
        scheduledAt: appointment.scheduledAt,
        channel: 'LINK',
      })
      resolvedPrefillUrl = invite.prefillUrl
    } catch (err) {
      console.error(
        '[sendAppointmentPassEmail] Error generando enlace de prellenado:',
        err instanceof Error ? err.message : 'unknown',
      )
    }
  }

  const attachments: Array<{ filename: string; content: Buffer; cid?: string }> = []
  let hasInlineQr = false
  const parsedQr = parseDataUrlBase64(appointment.qrCode)
  if (parsedQr) {
    const qrBuffer = Buffer.from(parsedQr.dataBase64, 'base64')
    if (qrBuffer.byteLength > 0) {
      attachments.push({
        filename: 'pase-qr.png',
        content: qrBuffer,
        cid: 'appointment-qr',
      })
      hasInlineQr = true
    }
  }

  let triptychAttached = false
  try {
    const triptych = await readPatientPreparationTriptychPdf()
    if (triptych.byteLength > 0 && triptych.byteLength <= MAX_EMAIL_PDF_BYTES) {
      attachments.push({ filename: PATIENT_PREPARATION_TRIPTYCH_FILENAME, content: triptych })
      triptychAttached = true
    }
  } catch (err) {
    console.warn(
      '[sendAppointmentPassEmail] Tríptico no adjuntado; se envía con enlace directo:',
      err instanceof Error ? err.message : 'unknown',
    )
  }

  const dateLabel = formatAppointmentAgendaDateString(appointment.scheduledAt)
  const timeLabel = formatAppointmentAgendaTime(appointment.scheduledAt)
  const triptychUrl = resolvePublicPatientTriptychUrl()
  const content = buildAppointmentPassEmailContent({
    firstName: appointment.worker.firstName,
    lastName: appointment.worker.lastName,
    dateLabel,
    timeLabel,
    branchName: appointment.branch?.name ?? 'Clínica AMI',
    branchAddress: appointment.branch?.address ?? null,
    expedientId: appointment.expedientId,
    profileName: appointment.serviceProfile?.name ?? null,
    testNames:
      appointment.serviceProfile?.tests.map((t) => t.test.name).filter(Boolean) ?? [],
    prefillUrl: resolvedPrefillUrl,
    triptychUrl,
    hasInlineQr,
  })

  const mail = await sendSmtpMail({
    purpose: 'portal',
    to: email,
    subject: content.subject,
    text: content.text,
    html: content.html,
    attachments: attachments.length > 0 ? attachments : undefined,
  })

  if (mail.skipped) {
    return { success: true, sent: false, skipped: true, prefillUrl: resolvedPrefillUrl }
  }
  if (!mail.success) {
    return {
      success: false,
      sent: false,
      error: mail.error ?? 'Error al enviar correo',
      prefillUrl: resolvedPrefillUrl,
    }
  }

  await logAudit('APPOINTMENT_PASS_EMAIL_SENT', 'Appointment', appointment.id, {
    emailDomain: email.split('@')[1] ?? 'unknown',
    hasPrefillUrl: Boolean(resolvedPrefillUrl),
    triptychAttached,
    hasInlineQr,
  })

  return { success: true, sent: true, prefillUrl: resolvedPrefillUrl }
}
