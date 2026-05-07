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
import { revalidatePath } from 'next/cache'

export async function getEventTimeline(eventId: string) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { success: false, error: 'No autenticado', data: null }
  if (session.user.role !== 'ADMIN') {
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
  if (session.user.role !== 'ADMIN') {
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
