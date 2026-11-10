'use server'

import { revalidatePath } from 'next/cache'
import { getServerSession } from 'next-auth/next'
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { authOptions } from '@/auth'
import { logAudit } from '@/actions/audit.actions'
import { isConsultaMedicaTestName } from '@/lib/clinical/consulta-medica'

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
        source: 'consulta_derivados',
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
