'use server'

import { revalidatePath } from 'next/cache'
import { getServerSession } from 'next-auth/next'
import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { authOptions } from '@/auth'
import { upsertWorkerClinicalHistory } from '@/actions/clinical-history.actions'
import { validateConsultaMedicaPayload } from '@/lib/clinical/consulta-medica-validate'
import type { ConsultaMedicaPayload } from '@/schemas/clinical/consulta-medica.schema'
import { isConsultaMedicaTestName } from '@/lib/clinical/consulta-medica'

const CLINICAL_ROLES = new Set([
  'SUPERADMIN',
  'ADMIN',
  'DOCTOR_GENERAL',
  'DOCTOR_VALIDATOR',
  'RECEPTIONIST',
  'CAPTURIST',
])

export type SaveConsultaMedicaResult =
  | { success: true; payload: ConsultaMedicaPayload; updatedAt: string }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> }

async function assertClinicalAccess(): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return { ok: false, error: 'No autenticado.' }
  }
  if (!CLINICAL_ROLES.has(session.user.role ?? '')) {
    return { ok: false, error: 'No tienes permisos para capturar consulta médica.' }
  }
  return { ok: true, userId: session.user.id }
}

export async function saveConsultaMedica(
  eventTestId: string,
  eventId: string,
  workerId: string,
  rawPayload: unknown,
  options: { finalize?: boolean } = {},
): Promise<SaveConsultaMedicaResult> {
  const access = await assertClinicalAccess()
  if (!access.ok) return { success: false, error: access.error }

  const validation = validateConsultaMedicaPayload(rawPayload, options.finalize ? 'final' : 'draft')
  if (!validation.valid) {
    return {
      success: false,
      error: validation.error,
      fieldErrors: validation.fieldErrors,
    }
  }
  const payload = validation.payload

  const eventTest = await prisma.eventTest.findUnique({
    where: { id: eventTestId },
    select: {
      id: true,
      eventId: true,
      testNameSnapshot: true,
      event: { select: { workerId: true } },
    },
  })
  if (!eventTest) {
    return { success: false, error: 'El estudio no existe.' }
  }
  if (eventTest.eventId !== eventId) {
    return { success: false, error: 'El estudio no pertenece al evento indicado.' }
  }
  if (eventTest.event.workerId !== workerId) {
    return { success: false, error: 'El paciente no coincide con el evento.' }
  }
  if (!isConsultaMedicaTestName(eventTest.testNameSnapshot)) {
    return { success: false, error: 'Este estudio no es una consulta médica.' }
  }

  const antecedentesPayload = payload.antecedentes
  const hasAntecedentes =
    antecedentesPayload &&
    typeof antecedentesPayload === 'object' &&
    Object.values(antecedentesPayload).some(
      (v) => v !== null && v !== undefined && (typeof v !== 'object' || Object.keys(v as object).length > 0),
    )
  if (hasAntecedentes) {
    const hc = await upsertWorkerClinicalHistory(workerId, antecedentesPayload)
    if (!hc.success) {
      return { success: false, error: hc.error ?? 'No se pudo actualizar el historial clínico.' }
    }
  }

  const toStore: ConsultaMedicaPayload = {
    ...payload,
    cerrada_at: options.finalize ? new Date().toISOString() : payload.cerrada_at,
  }

  try {
    const updated = await prisma.eventTest.update({
      where: { id: eventTestId },
      data: {
        clinicalContext: toStore as unknown as Prisma.InputJsonValue,
        status: options.finalize ? 'RESULT_REGISTERED' : 'IN_PROGRESS',
      },
      select: { updatedAt: true },
    })
    revalidatePath(`/events/${eventId}`)
    return {
      success: true,
      payload: toStore,
      updatedAt: updated.updatedAt.toISOString(),
    }
  } catch (err) {
    console.error('[saveConsultaMedica]', err)
    return { success: false, error: 'No se pudo guardar la consulta.' }
  }
}
