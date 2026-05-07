/**
 * @fileoverview Servicio de escritura del cronograma operativo persistente de papeleta.
 * Las funciones de escritura nunca lanzan excepciones para no bloquear el flujo clínico.
 * @id IMPL-20260507-08
 * @spec context/SPECs/SPEC_ARCH-20260507-08-CRONOGRAMA-PAPELETA-ADMIN.md
 * @backup context/checkpoints/CHK_IMPL-20260507-08-CRONOGRAMA-PAPELETA-ADMIN.md
 */

import prisma from '@/lib/prisma'
import { TimelineEntryType } from '@prisma/client'

export interface TimelineEntryInput {
  eventId: string
  eventTestId?: string
  entryType: TimelineEntryType
  area?: string
  title: string
  description?: string
  occurredAt?: Date
  createdById?: string
  metadata?: Record<string, unknown>
}

/**
 * Escribe una entrada en el cronograma operativo.
 * Nunca propaga errores — esta capa es observabilidad, no control de flujo.
 * ARCH-20260507-08: Principio rector: no pedir doble captura cuando el sistema ya conoce el movimiento.
 */
export async function writeTimelineEntry(input: TimelineEntryInput): Promise<void> {
  try {
    await prisma.papeletaTimelineEntry.create({
      data: {
        eventId: input.eventId,
        eventTestId: input.eventTestId ?? null,
        entryType: input.entryType,
        area: input.area ?? 'general',
        title: input.title,
        description: input.description ?? null,
        occurredAt: input.occurredAt ?? new Date(),
        createdById: input.createdById ?? null,
        visibility: 'ADMIN_ONLY',
        metadata: input.metadata ?? undefined,
      },
    })
  } catch (err) {
    // No-throw: log silencioso, nunca interrumpe el flujo clínico
    console.error('[timeline] writeTimelineEntry error:', err)
  }
}

/**
 * Obtiene todas las entradas del cronograma para un evento, ordenadas cronológicamente.
 * Solo para uso en server actions/server components (requiere verificación de rol en el caller).
 */
export async function getTimelineForEvent(eventId: string) {
  return prisma.papeletaTimelineEntry.findMany({
    where: { eventId },
    orderBy: { occurredAt: 'asc' },
    include: {
      createdBy: {
        select: { id: true, fullName: true, role: true },
      },
    },
  })
}
