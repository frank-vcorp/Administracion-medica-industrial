/**
 * @fileoverview Server Actions del cronograma operativo persistente de papeleta.
 * getEventTimeline: obtiene entradas para un evento (ADMIN).
 * addAdminIncidence: registra una incidencia manual (ADMIN exclusivo, no bloqueante).
 * @id IMPL-20260507-08
 * @spec context/SPECs/SPEC_ARCH-20260507-08-CRONOGRAMA-PAPELETA-ADMIN.md
 * @backup context/checkpoints/CHK_IMPL-20260507-08-CRONOGRAMA-PAPELETA-ADMIN.md
 */
'use server'

import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import { getTimelineForEvent, writeTimelineEntry } from '@/lib/timeline.service'
import { isAdminLike } from '@/lib/auth/roles'
import { revalidatePath } from 'next/cache'
import prisma from '@/lib/prisma'

const STUDY_NOT_PERFORMED_ROLES = ['ADMIN', 'SUPERADMIN', 'RECEPTIONIST', 'DOCTOR', 'CAPTURIST'] as const

export async function getEventTimeline(eventId: string) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { success: false, error: 'No autenticado', data: null }
  if (!isAdminLike(session.user.role)) {
    return { success: false, error: 'Solo administradores pueden consultar el cronograma', data: null }
  }
  if (!eventId) return { success: false, error: 'eventId requerido', data: null }
  try {
    const entries = await getTimelineForEvent(eventId)
    return { success: true, data: JSON.parse(JSON.stringify(entries)) }
  } catch (err) {
    console.error('[timeline] getEventTimeline error:', err)
    return { success: false, error: 'Error al obtener cronograma', data: null }
  }
}

export async function addAdminIncidence(
  eventId: string,
  payload: {
    title: string
    description?: string
    area?: string
    occurredAt?: string
  }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { success: false, error: 'No autenticado' }
  if (!isAdminLike(session.user.role)) {
    return { success: false, error: 'Solo administradores pueden registrar incidencias en el cronograma' }
  }
  if (!eventId || !payload.title?.trim()) {
    return { success: false, error: 'Datos incompletos: eventId y title son obligatorios' }
  }

  await writeTimelineEntry({
    eventId,
    entryType: 'ADMIN_INCIDENCE',
    area: payload.area?.trim() || 'general',
    title: payload.title.trim(),
    description: payload.description?.trim() || undefined,
    occurredAt: payload.occurredAt ? new Date(payload.occurredAt) : new Date(),
    createdById: session.user.id,
  })

  revalidatePath(`/events/${eventId}`)
  return { success: true }
}

/** Registra estudio no realizado: incidencia + SKIPPED (SPEC ARCH-20260921-01 §6). */
export async function registerStudyNotPerformed(
  eventId: string,
  payload: {
    eventTestId: string
    title: string
    description?: string
  },
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { success: false, error: 'No autenticado' }

  const role = session.user.role
  if (!STUDY_NOT_PERFORMED_ROLES.includes(role as (typeof STUDY_NOT_PERFORMED_ROLES)[number])) {
    return { success: false, error: 'No tienes permiso para registrar esta incidencia' }
  }

  if (!eventId || !payload.eventTestId || !payload.title?.trim()) {
    return { success: false, error: 'eventId, eventTestId y title son obligatorios' }
  }

  const eventTest = await prisma.eventTest.findFirst({
    where: { id: payload.eventTestId, eventId },
    select: { id: true, testNameSnapshot: true },
  })
  if (!eventTest) {
    return { success: false, error: 'Estudio no encontrado en este expediente' }
  }

  await prisma.$transaction([
    prisma.eventTest.update({
      where: { id: payload.eventTestId },
      data: { status: 'SKIPPED' },
    }),
    prisma.papeletaTimelineEntry.create({
      data: {
        eventId,
        eventTestId: payload.eventTestId,
        entryType: 'STUDY_NOT_PERFORMED',
        title: payload.title.trim(),
        description: payload.description?.trim() || null,
        createdById: session.user.id,
        visibility: 'ADMIN_ONLY',
      },
    }),
    prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'STUDY_NOT_PERFORMED',
        entity: 'EventTest',
        entityId: payload.eventTestId,
        details: {
          eventId,
          title: payload.title.trim(),
          testName: eventTest.testNameSnapshot,
        },
      },
    }),
  ])

  revalidatePath(`/events/${eventId}`)
  revalidatePath('/reception')
  return { success: true }
}
