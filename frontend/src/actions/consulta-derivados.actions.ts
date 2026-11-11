'use server'

import { revalidatePath } from 'next/cache'
import { getServerSession } from 'next-auth/next'
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { authOptions } from '@/auth'
import { logAudit } from '@/actions/audit.actions'
import { isConsultaMedicaTestName } from '@/lib/clinical/consulta-medica'
import {
  CONSULTA_DERIVADOS_SOURCE,
  consultaDerivadoAuditMatches,
} from '@/lib/clinical/consulta-derivados'
import { zFreeTextMax } from '@/lib/text/zod-free-text'

const CLINICAL_ROLES = new Set([
  'SUPERADMIN',
  'ADMIN',
  'DOCTOR_GENERAL',
  'DOCTOR_VALIDATOR',
  'RECEPTIONIST',
  'CAPTURIST',
])

/** Alineado con `getMedicalTests` en medical-profiles.actions. */
const CATALOG_LEGACY_HIDDEN = ['GEN-01', 'GEN-02'] as const

export type ConsultaDerivadosCatalogItem = {
  id: string
  name: string
  code: string
  categoryName: string
}

async function assertClinicalAccess(): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return { ok: false, error: 'No autenticado.' }
  }
  if (!CLINICAL_ROLES.has(session.user.role ?? '')) {
    return { ok: false, error: 'No tienes permisos para derivar estudios desde consulta.' }
  }
  return { ok: true, userId: session.user.id }
}

const AddDerivadosSchema = z.object({
  eventId: z.string().min(1),
  consultaEventTestId: z.string().min(1),
  medicalTestIds: z.array(z.string().uuid()).min(1, 'Selecciona al menos una prueba.').max(25),
})

const RemoveDerivadoSchema = z.object({
  eventId: z.string().min(1),
  consultaEventTestId: z.string().min(1),
  eventTestId: z.string().min(1),
  reason: zFreeTextMax(500, 3),
})

export type ConsultaDerivadoAddedItem = {
  id: string
  name: string
  code: string | null
  status: string
  hasCapture: boolean
}

/**
 * Catálogo de MedicalTest aún no presentes en la papeleta del evento
 * (misma fuente que /admin/services, excluye legacy y consulta médica).
 */
export async function getConsultaDerivadosCatalog(eventId: string): Promise<{
  success: boolean
  tests?: ConsultaDerivadosCatalogItem[]
  error?: string
}> {
  const access = await assertClinicalAccess()
  if (!access.ok) return { success: false, error: access.error }
  if (!eventId) return { success: false, error: 'eventId requerido.' }

  const event = await prisma.medicalEvent.findUnique({
    where: { id: eventId },
    select: { id: true },
  })
  if (!event) return { success: false, error: 'Evento no encontrado.' }

  const onEvent = await prisma.eventTest.findMany({
    where: { eventId },
    select: { testId: true },
  })
  const onEventIds = new Set(
    onEvent.map((row) => row.testId).filter((id): id is string => Boolean(id)),
  )

  const catalog = await prisma.medicalTest.findMany({
    where: { code: { notIn: [...CATALOG_LEGACY_HIDDEN] } },
    select: {
      id: true,
      name: true,
      code: true,
      category: { select: { name: true } },
    },
    orderBy: [{ category: { name: 'asc' } }, { name: 'asc' }],
  })

  const tests = catalog
    .filter((t) => !onEventIds.has(t.id) && !isConsultaMedicaTestName(t.name))
    .map((t) => ({
      id: t.id,
      name: t.name,
      code: t.code,
      categoryName: t.category.name,
    }))

  return { success: true, tests }
}

/**
 * Instancia EventTest en el MedicalEvent (igual semántica que check-in desde perfil).
 */
export async function addConsultaDerivadosStudies(input: {
  eventId: string
  consultaEventTestId: string
  medicalTestIds: string[]
}): Promise<{
  success: boolean
  added?: number
  createdEventTestIds?: string[]
  error?: string
}> {
  const access = await assertClinicalAccess()
  if (!access.ok) return { success: false, error: access.error }

  const parsed = AddDerivadosSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Datos inválidos.',
    }
  }

  const { eventId, consultaEventTestId, medicalTestIds } = parsed.data
  const uniqueIds = [...new Set(medicalTestIds)]

  const consultaEt = await prisma.eventTest.findUnique({
    where: { id: consultaEventTestId },
    select: { id: true, eventId: true, testNameSnapshot: true },
  })
  if (!consultaEt || consultaEt.eventId !== eventId) {
    return { success: false, error: 'La consulta médica no pertenece a este evento.' }
  }
  if (!isConsultaMedicaTestName(consultaEt.testNameSnapshot)) {
    return { success: false, error: 'El estudio indicado no es consulta médica.' }
  }

  const medicalEvent = await prisma.medicalEvent.findUnique({
    where: { id: eventId },
    select: { id: true, workerId: true },
  })
  if (!medicalEvent) return { success: false, error: 'Evento no encontrado.' }

  const existing = await prisma.eventTest.findMany({
    where: { eventId },
    select: { testId: true },
  })
  const existingIds = new Set(
    existing.map((r) => r.testId).filter((id): id is string => Boolean(id)),
  )

  const testsToAdd = await prisma.medicalTest.findMany({
    where: {
      id: { in: uniqueIds },
      code: { notIn: [...CATALOG_LEGACY_HIDDEN] },
    },
    select: { id: true, name: true },
  })

  if (testsToAdd.length === 0) {
    return { success: false, error: 'Ninguna prueba válida seleccionada.' }
  }

  const creatable = testsToAdd.filter(
    (t) => !existingIds.has(t.id) && !isConsultaMedicaTestName(t.name),
  )
  if (creatable.length === 0) {
    return {
      success: false,
      error: 'Las pruebas seleccionadas ya están en la papeleta o no se pueden agregar.',
    }
  }

  try {
    const created = await prisma.$transaction(async (tx) => {
      const rows: { id: string }[] = []
      for (const test of creatable) {
        const row = await tx.eventTest.create({
          data: {
            eventId,
            testId: test.id,
            testNameSnapshot: test.name,
            status: 'PENDING',
          },
          select: { id: true },
        })
        rows.push(row)
      }
      return rows
    })

    for (const row of created) {
      await logAudit('CREATE', 'EventTest', row.id, {
        eventId,
        source: CONSULTA_DERIVADOS_SOURCE,
        consultaEventTestId,
        workerId: medicalEvent.workerId,
      })
    }

    revalidatePath(`/events/${eventId}`)
    return {
      success: true,
      added: created.length,
      createdEventTestIds: created.map((r) => r.id),
    }
  } catch (err) {
    console.error('[addConsultaDerivadosStudies]', err)
    return { success: false, error: 'No se pudieron agregar los estudios a la papeleta.' }
  }
}

/**
 * Estudios extra creados desde esta consulta. Los del perfil o del check-in no entran.
 */
export async function listConsultaDerivadosAdded(
  eventId: string,
  consultaEventTestId: string,
): Promise<{
  success: boolean
  studies?: ConsultaDerivadoAddedItem[]
  error?: string
}> {
  const access = await assertClinicalAccess()
  if (!access.ok) return { success: false, error: access.error }
  if (!eventId || !consultaEventTestId) {
    return { success: false, error: 'Faltan datos de la consulta.' }
  }

  const audits = await prisma.auditLog.findMany({
    where: {
      action: 'CREATE',
      entity: 'EventTest',
      details: {
        path: ['consultaEventTestId'],
        equals: consultaEventTestId,
      },
    },
    select: { entityId: true, details: true },
  })
  const ids = [
    ...new Set(
      audits
        .filter(
          (row) =>
            row.entityId &&
            consultaDerivadoAuditMatches(row.details, eventId, consultaEventTestId),
        )
        .map((row) => row.entityId as string),
    ),
  ]
  if (ids.length === 0) return { success: true, studies: [] }

  const studies = await prisma.eventTest.findMany({
    where: { id: { in: ids }, eventId },
    select: {
      id: true,
      testNameSnapshot: true,
      status: true,
      fileUrl: true,
      test: { select: { code: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  return {
    success: true,
    studies: studies.map((row) => ({
      id: row.id,
      name: row.testNameSnapshot,
      code: row.test?.code ?? null,
      status: row.status,
      hasCapture: row.status !== 'PENDING' || Boolean(row.fileUrl),
    })),
  }
}

/**
 * Quita un estudio adicional de esta consulta. Exige motivo.
 * No borra estudios que ya venían en la papeleta.
 */
export async function removeConsultaDerivadoStudy(input: {
  eventId: string
  consultaEventTestId: string
  eventTestId: string
  reason: string
}): Promise<{ success: boolean; error?: string }> {
  const access = await assertClinicalAccess()
  if (!access.ok) return { success: false, error: access.error }

  const parsed = RemoveDerivadoSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Datos inválidos.',
    }
  }
  const { eventId, consultaEventTestId, eventTestId, reason } = parsed.data

  if (eventTestId === consultaEventTestId) {
    return { success: false, error: 'La consulta médica no se puede quitar desde aquí.' }
  }

  const consultaEt = await prisma.eventTest.findUnique({
    where: { id: consultaEventTestId },
    select: { id: true, eventId: true, testNameSnapshot: true },
  })
  if (!consultaEt || consultaEt.eventId !== eventId) {
    return { success: false, error: 'La consulta médica no pertenece a este evento.' }
  }
  if (!isConsultaMedicaTestName(consultaEt.testNameSnapshot)) {
    return { success: false, error: 'El estudio indicado no es consulta médica.' }
  }

  const target = await prisma.eventTest.findUnique({
    where: { id: eventTestId },
    select: {
      id: true,
      eventId: true,
      testNameSnapshot: true,
      status: true,
      fileUrl: true,
    },
  })
  if (!target || target.eventId !== eventId) {
    return { success: false, error: 'Ese estudio no está en esta papeleta.' }
  }

  const audits = await prisma.auditLog.findMany({
    where: { action: 'CREATE', entity: 'EventTest', entityId: eventTestId },
    select: { details: true },
  })
  const allowed = audits.some((row) =>
    consultaDerivadoAuditMatches(row.details, eventId, consultaEventTestId),
  )
  if (!allowed) {
    return {
      success: false,
      error: 'Solo se pueden quitar los estudios agregados desde esta consulta.',
    }
  }

  try {
    await prisma.eventTest.delete({ where: { id: eventTestId } })
    await logAudit('DELETE', 'EventTest', eventTestId, {
      eventId,
      source: CONSULTA_DERIVADOS_SOURCE,
      consultaEventTestId,
      reason,
      testNameSnapshot: target.testNameSnapshot,
      status: target.status,
      hadFile: Boolean(target.fileUrl),
    })
    revalidatePath(`/events/${eventId}`)
    return { success: true }
  } catch (err) {
    console.error('[removeConsultaDerivadoStudy]', err)
    return { success: false, error: 'No se pudo quitar el estudio de la papeleta.' }
  }
}
