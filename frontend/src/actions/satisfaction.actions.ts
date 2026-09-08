'use server'

import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/auth'
import prisma from '@/lib/prisma'
import { z } from 'zod'

const SatisfactionSchema = z.object({
  eventId: z.string().uuid().optional(),
  score: z.number().int().min(1).max(10),
  comment: z.string().max(2000).optional(),
})

export async function submitSatisfactionSurvey(input: {
  eventId?: string
  score: number
  comment?: string
}) {
  const parsed = SatisfactionSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: 'Datos de encuesta inválidos' }
  }

  const { eventId, score, comment } = parsed.data

  if (eventId) {
    const event = await prisma.medicalEvent.findUnique({
      where: { id: eventId },
      select: { id: true },
    })
    if (!event) {
      return { success: false, error: 'Expediente no encontrado' }
    }
  }

  const session = await getServerSession(authOptions)

  await prisma.auditLog.create({
    data: {
      userId: session?.user?.id,
      action: 'PATIENT_SATISFACTION',
      entity: eventId ? 'MedicalEvent' : 'PatientSatisfaction',
      entityId: eventId ?? null,
      details: {
        score,
        comment: comment?.trim() || null,
        submittedAt: new Date().toISOString(),
      },
    },
  })

  return { success: true }
}
