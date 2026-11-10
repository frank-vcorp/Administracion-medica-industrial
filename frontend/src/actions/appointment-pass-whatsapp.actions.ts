'use server'

import { z } from 'zod'
import prisma from '@/lib/prisma'
import { buildAppointmentPassWhatsAppMessage } from '@/lib/appointment-pass-whatsapp-message'
import { sendWhatsAppTextMessage } from '@/actions/whatsapp-send.actions'

const AppointmentIdSchema = z.object({
  appointmentId: z.string().uuid(),
})

export type AppointmentPassWhatsAppResult = {
  sent: boolean
  triptychSent: boolean
  skipped: boolean
  fallbackWaUrl?: string
  error?: string
  /** Texto exacto enviado (o que se intentó enviar) por Baileys. */
  messageText?: string
}

/**
 * Dispara Baileys al crear la cita: mensaje con datos de la cita + tríptico PDF.
 */
export async function sendAppointmentPassWhatsApp(
  appointmentId: string,
): Promise<AppointmentPassWhatsAppResult> {
  const parsed = AppointmentIdSchema.safeParse({ appointmentId })
  if (!parsed.success) {
    return { sent: false, triptychSent: false, skipped: false, error: 'Cita no válida' }
  }

  const appointment = await prisma.appointment.findUnique({
    where: { id: parsed.data.appointmentId },
    include: {
      worker: {
        select: { firstName: true, lastName: true, phone: true },
      },
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
    return { sent: false, triptychSent: false, skipped: false, error: 'Cita no encontrada' }
  }

  const rawPhone = appointment.worker.phone?.trim() ?? ''
  if (rawPhone.replace(/\D/g, '').length < 10) {
    return { sent: false, triptychSent: false, skipped: true, error: 'Sin teléfono del paciente' }
  }

  const messageText = buildAppointmentPassWhatsAppMessage({
    firstName: appointment.worker.firstName,
    lastName: appointment.worker.lastName,
    scheduledAt: appointment.scheduledAt,
    branchName: appointment.branch.name,
    branchAddress: appointment.branch.address,
    expedientId: appointment.expedientId,
    profileName: appointment.serviceProfile?.name ?? null,
    testNames:
      appointment.serviceProfile?.tests.map((t) => t.test.name).filter(Boolean) ?? [],
  })

  const wa = await sendWhatsAppTextMessage({
    phone: rawPhone,
    text: messageText,
    auditContext: 'appointment_pass',
    entityId: appointment.id,
    attachPatientTriptych: true,
  })

  return {
    sent: wa.sent,
    triptychSent: Boolean(wa.triptychSent),
    skipped: wa.skipped,
    fallbackWaUrl: wa.fallbackWaUrl,
    error: wa.error,
    messageText,
  }
}
