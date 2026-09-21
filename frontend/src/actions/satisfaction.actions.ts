'use server'

import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/auth'
import prisma from '@/lib/prisma'
import { SatisfactionSurveySchema } from '@/schemas/satisfaction.schema'
import type { SatisfactionSurveyInput } from '@/schemas/satisfaction.schema'
import { revalidatePath } from 'next/cache'

export async function getEventSurveyPrefill(eventId: string) {
  if (!eventId) return { success: false as const, error: 'eventId requerido' }

  const event = await prisma.medicalEvent.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      worker: {
        select: {
          firstName: true,
          lastName: true,
          company: { select: { name: true } },
        },
      },
      satisfactionSurveys: { select: { id: true } },
    },
  })

  if (!event) {
    return { success: false as const, error: 'Expediente no encontrado' }
  }

  return {
    success: true as const,
    data: {
      eventId: event.id,
      nombre: event.worker.firstName,
      apellidos: event.worker.lastName,
      empresa: event.worker.company?.name ?? '',
      alreadySubmitted: event.satisfactionSurveys.length > 0,
    },
  }
}

export async function submitSatisfactionSurvey(input: SatisfactionSurveyInput) {
  const parsed = SatisfactionSurveySchema.safeParse(input)
  if (!parsed.success) {
    return { success: false as const, error: 'Datos de encuesta inválidos' }
  }

  const data = parsed.data

  const event = await prisma.medicalEvent.findUnique({
    where: { id: data.eventId },
    select: {
      id: true,
      workerId: true,
      billingCompanyId: true,
      branchId: true,
      worker: { select: { companyId: true } },
      satisfactionSurveys: { select: { id: true } },
    },
  })

  if (!event) {
    return { success: false as const, error: 'Expediente no encontrado' }
  }

  if (event.satisfactionSurveys.length > 0) {
    return { success: false as const, error: 'Ya existe una encuesta para este expediente' }
  }

  const session = await getServerSession(authOptions)

  await prisma.$transaction([
    prisma.satisfactionSurvey.create({
      data: {
        eventId: data.eventId,
        workerId: event.workerId,
        companyId: event.billingCompanyId ?? event.worker.companyId,
        branchId: event.branchId,
        turno: data.turno.trim(),
        overall: data.overall,
        qTrato: data.qTrato,
        qEscucha: data.qEscucha,
        qResolucion: data.qResolucion,
        qEspera: data.qEspera,
        qLimpieza: data.qLimpieza,
        qPrivacidad: data.qPrivacidad,
        recomienda: data.recomienda,
        comentario: data.comentario?.trim() || null,
        channel: data.channel,
      },
    }),
    prisma.auditLog.create({
      data: {
        userId: session?.user?.id,
        action: 'PATIENT_SATISFACTION',
        entity: 'MedicalEvent',
        entityId: data.eventId,
        details: {
          overall: data.overall,
          recomienda: data.recomienda,
          channel: data.channel,
          submittedAt: new Date().toISOString(),
        },
      },
    }),
  ])

  revalidatePath('/reports/satisfaction')
  revalidatePath(`/workers/${event.workerId}`)
  return { success: true as const }
}

export async function getSatisfactionSurveysByWorker(workerId: string) {
  const surveys = await prisma.satisfactionSurvey.findMany({
    where: { workerId },
    orderBy: { submittedAt: 'desc' },
    include: {
      event: { select: { id: true, dischargedAt: true } },
    },
  })

  const pendingEvents = await prisma.medicalEvent.findMany({
    where: {
      workerId,
      dischargedAt: { not: null },
      satisfactionSurveys: { none: {} },
      status: { not: 'CANCELED' },
    },
    select: {
      id: true,
      dischargedAt: true,
      checkInDate: true,
    },
    orderBy: { dischargedAt: 'desc' },
    take: 20,
  })

  return {
    surveys: surveys.map((s) => ({
      id: s.id,
      eventId: s.eventId,
      turno: s.turno,
      overall: s.overall,
      recomienda: s.recomienda,
      qTrato: s.qTrato,
      qEscucha: s.qEscucha,
      qResolucion: s.qResolucion,
      qEspera: s.qEspera,
      qLimpieza: s.qLimpieza,
      qPrivacidad: s.qPrivacidad,
      comentario: s.comentario,
      channel: s.channel,
      submittedAt: s.submittedAt.toISOString(),
    })),
    pendingSurveyEventIds: pendingEvents.map((e) => ({
      eventId: e.id,
      dischargedAt: e.dischargedAt?.toISOString() ?? null,
    })),
  }
}

export type SatisfactionReportFilters = {
  from?: string
  to?: string
  companyId?: string
  branchId?: string
  channel?: 'TABLET' | 'WHATSAPP_LINK' | 'DIRECT'
}

export async function getSatisfactionReport(filters: SatisfactionReportFilters = {}) {
  const where: Record<string, unknown> = {}

  if (filters.from || filters.to) {
    where.submittedAt = {
      ...(filters.from ? { gte: new Date(filters.from) } : {}),
      ...(filters.to ? { lte: new Date(`${filters.to}T23:59:59.999`) } : {}),
    }
  }
  if (filters.companyId) where.companyId = filters.companyId
  if (filters.branchId) where.branchId = filters.branchId
  if (filters.channel) where.channel = filters.channel

  const surveys = await prisma.satisfactionSurvey.findMany({
    where,
    orderBy: { submittedAt: 'desc' },
    include: {
      worker: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          universalId: true,
          company: { select: { id: true, name: true } },
        },
      },
      event: { select: { branch: { select: { id: true, name: true } } } },
    },
  })

  const count = surveys.length
  const avg = (values: number[]) =>
    values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0

  const overalls = surveys.map((s) => s.overall)
  const recomiendas = surveys.map((s) => s.recomienda)

  return {
    kpis: {
      count,
      avgOverall: avg(overalls),
      recommendRate:
        recomiendas.length === 0
          ? 0
          : (recomiendas.filter((r) => r >= 4).length / recomiendas.length) * 100,
      avgTrato: avg(surveys.map((s) => s.qTrato)),
      avgEscucha: avg(surveys.map((s) => s.qEscucha)),
      avgResolucion: avg(surveys.map((s) => s.qResolucion)),
      avgEspera: avg(surveys.map((s) => s.qEspera)),
      avgLimpieza: avg(surveys.map((s) => s.qLimpieza)),
      avgPrivacidad: avg(surveys.map((s) => s.qPrivacidad)),
    },
    rows: surveys.map((s) => ({
      id: s.id,
      eventId: s.eventId,
      workerId: s.worker.id,
      patientName: `${s.worker.firstName} ${s.worker.lastName}`,
      universalId: s.worker.universalId,
      companyId: s.worker.company?.id ?? null,
      companyName: s.worker.company?.name ?? '—',
      branchName: s.event.branch?.name ?? '—',
      turno: s.turno,
      overall: s.overall,
      recomienda: s.recomienda,
      channel: s.channel,
      comentario: s.comentario,
      submittedAt: s.submittedAt.toISOString(),
    })),
  }
}
