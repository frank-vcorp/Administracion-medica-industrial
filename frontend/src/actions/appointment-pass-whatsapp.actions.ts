'use server'

import { getServerSession } from 'next-auth/next'
import { z } from 'zod'
import { authOptions } from '@/auth'
import prisma from '@/lib/prisma'
import { buildAppointmentPassWhatsAppMessage } from '@/lib/appointment-pass-whatsapp-message'
import { createOrReplacePrefilledInvitationForAppointment } from '@/lib/prefilled-invitation-server'
import { deliverWhatsAppPassWithTriptych } from '@/lib/whatsapp-pass-delivery'

const AppointmentIdSchema = z.object({
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

export type AppointmentPassWhatsAppResult = {
  sent: boolean
  triptychSent: boolean
  skipped: boolean
  fallbackWaUrl?: string
  error?: string
  /** Texto exacto enviado (o que se intentó enviar) por Baileys. */
  messageText?: string
  /** Enlace de prellenado incluido en el mensaje. */
  prefillUrl?: string
}

/**
 * Dispara Baileys al crear o reenviar el pase de cita: mensaje con datos de la cita,
 * enlace de prellenado y tríptico PDF (`tips-para-pacientes.pdf`).
 * Autoriza staff o usuarios `COMPANY_CLIENT` dueños de la cita/trabajador.
 */
export async function sendAppointmentPassWhatsApp(
  appointmentId: string,
  options?: { prefillUrl?: string | null; includePrefillLink?: boolean },
): Promise<AppointmentPassWhatsAppResult> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return { sent: false, triptychSent: false, skipped: false, error: 'No autenticado' }
  }

  const parsed = AppointmentIdSchema.safeParse({ appointmentId })
  if (!parsed.success) {
    return { sent: false, triptychSent: false, skipped: false, error: 'Cita no válida' }
  }

  const appointment = await prisma.appointment.findUnique({
    where: { id: parsed.data.appointmentId },
    include: {
      worker: {
        select: { firstName: true, lastName: true, phone: true, companyId: true },
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

  const role = String(session.user.role ?? '')
  const userCompanyId =
    typeof session.user.companyId === 'string' ? session.user.companyId.trim() : ''
  const isStaff = STAFF_ROLES.has(role)
  const isOwnerCompanyClient =
    role === 'COMPANY_CLIENT' &&
    Boolean(userCompanyId) &&
    (appointment.companyId === userCompanyId || appointment.worker.companyId === userCompanyId)

  if (!isStaff && !isOwnerCompanyClient) {
    return {
      sent: false,
      triptychSent: false,
      skipped: false,
      error: 'Sin permiso para enviar pase de esta cita',
    }
  }

  const rawPhone = appointment.worker.phone?.trim() ?? ''
  if (rawPhone.replace(/\D/g, '').length < 10) {
    return { sent: false, triptychSent: false, skipped: true, error: 'Sin teléfono del paciente' }
  }

  let resolvedPrefillUrl: string | undefined = options?.prefillUrl?.trim() || undefined
  if (!resolvedPrefillUrl && options?.includePrefillLink !== false) {
    try {
      const invite = await createOrReplacePrefilledInvitationForAppointment({
        appointmentId: appointment.id,
        generatedById: session.user.id,
        scheduledAt: appointment.scheduledAt,
        channel: 'WHATSAPP',
      })
      resolvedPrefillUrl = invite.prefillUrl
    } catch (err) {
      console.error(
        '[sendAppointmentPassWhatsApp] Error generando enlace de prellenado:',
        err instanceof Error ? err.message : 'unknown',
      )
    }
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
    prefillUrl: resolvedPrefillUrl,
  })

  const wa = await deliverWhatsAppPassWithTriptych({
    phone: rawPhone,
    text: messageText,
    actorUserId: session.user.id,
    actorRole: role,
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
    prefillUrl: resolvedPrefillUrl,
  }
}
