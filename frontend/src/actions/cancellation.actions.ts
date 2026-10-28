'use server'

import { revalidatePath } from 'next/cache'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import prisma from '@/lib/prisma'
import { logAudit } from '@/actions/audit.actions'
import {
  APPOINTMENT_CANCELLABLE_STATUSES,
  cancelAppointmentInputSchema,
  cancelPapeletaInputSchema,
} from '@/lib/cancellation'

const STAFF_ROLES = new Set([
  'SUPERADMIN',
  'ADMIN',
  'RECEPTIONIST',
  'DOCTOR_GENERAL',
  'DOCTOR_VALIDATOR',
  'CAPTURIST',
])

async function assertStaff() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { ok: false as const, error: 'No autenticado.' }
  if (!STAFF_ROLES.has(session.user.role ?? '')) {
    return { ok: false as const, error: 'No tienes permiso para cancelar.' }
  }
  return { ok: true as const, userId: session.user.id }
}

export async function cancelAppointment(input: { appointmentId: string; reason: string }) {
  const access = await assertStaff()
  if (!access.ok) return { success: false as const, error: access.error }

  const parsed = cancelAppointmentInputSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false as const,
      error: parsed.error.issues[0]?.message ?? 'Datos de cancelación inválidos.',
    }
  }

  const current = await prisma.appointment.findUnique({
    where: { id: parsed.data.appointmentId },
    select: { id: true, status: true },
  })
  if (!current) return { success: false as const, error: 'Cita no encontrada.' }
  if (current.status === 'CANCELLED') {
    return { success: false as const, error: 'La cita ya está cancelada.' }
  }
  if (current.status === 'COMPLETED') {
    return {
      success: false as const,
      error: 'La cita ya tuvo ingreso. Cancela la papeleta si la atención no debe continuar.',
    }
  }
  if (!APPOINTMENT_CANCELLABLE_STATUSES.includes(current.status as (typeof APPOINTMENT_CANCELLABLE_STATUSES)[number])) {
    return { success: false as const, error: `No se puede cancelar una cita en estado ${current.status}.` }
  }

  const cancelledAt = new Date()
  await prisma.appointment.update({
    where: { id: current.id },
    data: {
      status: 'CANCELLED',
      cancellationReason: parsed.data.reason,
      cancelledAt,
    },
  })

  await logAudit('UPDATE', 'Appointment', current.id, {
    previousStatus: current.status,
    newStatus: 'CANCELLED',
    cancellationReason: parsed.data.reason,
  })

  revalidatePath('/appointments')
  return { success: true as const }
}

export async function cancelPapeleta(input: { eventId: string; reason: string }) {
  const access = await assertStaff()
  if (!access.ok) return { success: false as const, error: access.error }

  const parsed = cancelPapeletaInputSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false as const,
      error: parsed.error.issues[0]?.message ?? 'Datos de cancelación inválidos.',
    }
  }

  const current = await prisma.medicalEvent.findUnique({
    where: { id: parsed.data.eventId },
    select: { id: true, status: true },
  })
  if (!current) return { success: false as const, error: 'Papeleta no encontrada.' }
  if (current.status === 'CANCELED') {
    return { success: false as const, error: 'La papeleta ya está cancelada.' }
  }

  const cancelledAt = new Date()
  await prisma.medicalEvent.update({
    where: { id: current.id },
    data: {
      status: 'CANCELED',
      cancellationReason: parsed.data.reason,
      cancelledAt,
    },
  })

  await logAudit('UPDATE', 'MedicalEvent', current.id, {
    previousStatus: current.status,
    newStatus: 'CANCELED',
    cancellationReason: parsed.data.reason,
  })

  revalidatePath(`/events/${current.id}`)
  revalidatePath('/reception')
  revalidatePath('/appointments')
  return { success: true as const }
}
