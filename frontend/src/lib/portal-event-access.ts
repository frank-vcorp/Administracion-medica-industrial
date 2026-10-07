import { getServerSession } from 'next-auth'
import { UserRole } from '@prisma/client'
import { authOptions } from '@/auth'
import { isAdminLike, isSellerLike } from '@/lib/auth/roles'
import { readPreviewCompanyIdFromCookies, resolvePortalCompanyAccess } from '@/lib/portal-access'
import prisma from '@/lib/prisma'

export async function resolvePortalCompanyIdForSession(): Promise<string | null> {
  try {
    const access = await resolvePortalCompanyAccess()
    return access.companyId
  } catch {
    return null
  }
}

/** Dictamen / archivos portal: cliente B2B o staff en vista previa de esa empresa. */
export async function canAccessPortalCompanyData(workerCompanyId: string | null): Promise<boolean> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return false

  const role = session.user.role
  if (
    role === UserRole.SUPERADMIN ||
    role === UserRole.DOCTOR_GENERAL ||
    role === UserRole.DOCTOR_VALIDATOR
  ) {
    return true
  }

  if (role === UserRole.COMPANY_CLIENT) {
    return Boolean(workerCompanyId && session.user.companyId === workerCompanyId)
  }

  if (isAdminLike(role) || isSellerLike(role)) {
    const previewCompanyId = await readPreviewCompanyIdFromCookies()
    return Boolean(previewCompanyId && workerCompanyId && previewCompanyId === workerCompanyId)
  }

  return false
}

export async function assertPortalEventAccess(eventId: string): Promise<void> {
  const event = await prisma.medicalEvent.findUnique({
    where: { id: eventId },
    select: { worker: { select: { companyId: true } } },
  })
  if (!event) throw new Error('Evento no encontrado')
  const ok = await canAccessPortalCompanyData(event.worker.companyId)
  if (!ok) throw new Error('Sin permiso')
}

export async function assertPortalEventTestAccess(eventTestId: string): Promise<{
  eventTestId: string
  eventId: string
}> {
  const row = await prisma.eventTest.findUnique({
    where: { id: eventTestId },
    select: {
      id: true,
      eventId: true,
      event: { select: { worker: { select: { companyId: true } } } },
    },
  })
  if (!row) throw new Error('Estudio no encontrado')
  const ok = await canAccessPortalCompanyData(row.event.worker.companyId)
  if (!ok) throw new Error('Sin permiso')
  return { eventTestId: row.id, eventId: row.eventId }
}

export async function assertPortalWorkerAccess(workerId: string): Promise<void> {
  const worker = await prisma.worker.findUnique({
    where: { id: workerId },
    select: { companyId: true },
  })
  if (!worker) throw new Error('Trabajador no encontrado')
  const ok = await canAccessPortalCompanyData(worker.companyId)
  if (!ok) throw new Error('Sin permiso')
}

export async function assertPortalAppointmentAccess(appointmentId: string): Promise<void> {
  const apt = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    select: { worker: { select: { companyId: true } } },
  })
  if (!apt) throw new Error('Cita no encontrada')
  const ok = await canAccessPortalCompanyData(apt.worker.companyId)
  if (!ok) throw new Error('Sin permiso')
}

export function isEventTestDeliverableReady(status: string): boolean {
  return status === 'RESULT_REGISTERED' || status === 'COMPLETED'
}
