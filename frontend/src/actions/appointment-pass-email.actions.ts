'use server'

import { z } from 'zod'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/auth'
import prisma from '@/lib/prisma'
import { sendSmtpMail } from '@/lib/smtp-mail'
import {
  PATIENT_PREPARATION_TRIPTYCH_FILENAME,
  readPatientPreparationTriptychPdf,
} from '@/lib/patient-preparation-triptych'
import { logAudit } from '@/actions/audit.actions'
import { formatAppointmentAgendaDateString, formatAppointmentAgendaTime } from '@/lib/appointment-scheduling'

const SendPassEmailSchema = z.object({
  appointmentId: z.string().uuid(),
})

export async function sendAppointmentPassEmail(appointmentId: string): Promise<{
  success: boolean
  sent: boolean
  skipped?: boolean
  error?: string
}> {
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
      worker: { select: { firstName: true, lastName: true, email: true } },
      branch: { select: { name: true, address: true } },
    },
  })

  if (!appointment) {
    return { success: false, sent: false, error: 'Cita no encontrada' }
  }

  const email = appointment.worker.email?.trim()
  if (!email) {
    return { success: true, sent: false, skipped: true }
  }

  const dateLabel = formatAppointmentAgendaDateString(appointment.scheduledAt)
  const timeLabel = formatAppointmentAgendaTime(appointment.scheduledAt)
  const text = [
    `Hola ${appointment.worker.firstName},`,
    '',
    `Tu cita médica en AMI está confirmada para el ${dateLabel} a las ${timeLabel}.`,
    appointment.branch
      ? `Sucursal: ${appointment.branch.name}${appointment.branch.address ? ` — ${appointment.branch.address}` : ''}`
      : '',
    appointment.expedientId ? `Expediente: ${appointment.expedientId}` : '',
    '',
    'Adjuntamos el tríptico de preparación. Presenta tu pase en recepción.',
  ]
    .filter(Boolean)
    .join('\n')

  let triptych: Buffer
  try {
    triptych = await readPatientPreparationTriptychPdf()
  } catch {
    return { success: false, sent: false, error: 'No se encontró el tríptico de preparación' }
  }

  const mail = await sendSmtpMail({
    purpose: 'portal',
    to: email,
    subject: 'Confirmación de cita médica AMI',
    text,
    attachments: [{ filename: PATIENT_PREPARATION_TRIPTYCH_FILENAME, content: triptych }],
  })

  if (mail.skipped) {
    return { success: true, sent: false, skipped: true }
  }
  if (!mail.success) {
    return { success: false, sent: false, error: mail.error ?? 'Error al enviar correo' }
  }

  await logAudit('APPOINTMENT_PASS_EMAIL_SENT', 'Appointment', appointment.id, {
    emailDomain: email.split('@')[1] ?? 'unknown',
  })

  return { success: true, sent: true }
}
