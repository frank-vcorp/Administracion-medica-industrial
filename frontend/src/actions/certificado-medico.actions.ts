'use server'

import { revalidatePath } from 'next/cache'
import { getServerSession } from 'next-auth/next'
import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { authOptions } from '@/auth'
import { upsertWorkerClinicalHistory } from '@/actions/clinical-history.actions'
import { validateCertificadoMedicoPayload } from '@/lib/clinical/certificado-medico-validate'
import type { CertificadoMedicoPayload } from '@/schemas/clinical/certificado-medico.schema'
import {
  isCertificadoMedicoTestName,
  parseCertificadoMedicoDraftContext,
} from '@/lib/clinical/certificado-medico'
import { denyIfClosedCaptureUnauthorized } from '@/lib/clinical/papeleta-readonly'
import { resolveCertificadoMedicoMetadata } from '@/lib/clinical/certificado-medico-metadata'

const CLINICAL_ROLES = new Set([
  'SUPERADMIN',
  'ADMIN',
  'DOCTOR_GENERAL',
  'DOCTOR_VALIDATOR',
  'RECEPTIONIST',
  'CAPTURIST',
])

export type SaveCertificadoMedicoResult =
  | { success: true; payload: CertificadoMedicoPayload; updatedAt: string }
  | { success: false; error: string; fieldErrors?: Record<string, string[]>; technicalDetail?: string }

async function assertClinicalAccess():
  Promise<{ ok: true; role: string } | { ok: false; error: string }> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return { ok: false, error: 'No autenticado.' }
  }
  const role = session.user.role ?? ''
  if (!CLINICAL_ROLES.has(role)) {
    return { ok: false, error: 'No tienes permisos para capturar certificado médico.' }
  }
  return { ok: true, role }
}

export async function saveCertificadoMedico(
  eventTestId: string,
  eventId: string,
  workerId: string,
  rawPayload: unknown,
  options: { finalize?: boolean; autosave?: boolean } = {},
): Promise<SaveCertificadoMedicoResult> {
  const access = await assertClinicalAccess()
  if (!access.ok) return { success: false, error: access.error }

  const session = await getServerSession(authOptions)

  const eventTest = await prisma.eventTest.findUnique({
    where: { id: eventTestId },
    select: {
      id: true,
      eventId: true,
      testNameSnapshot: true,
      clinicalContext: true,
      event: {
        select: {
          workerId: true,
          checkInDate: true,
          createdAt: true,
          worker: {
            select: {
              nationalId: true,
              clinicalHistory: { select: { data: true } },
            },
          },
        },
      },
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
  if (!isCertificadoMedicoTestName(eventTest.testNameSnapshot)) {
    return { success: false, error: 'Este estudio no es un certificado médico.' }
  }

  const priorClosed = Boolean(
    parseCertificadoMedicoDraftContext(eventTest.clinicalContext)?.cerrada_at?.trim(),
  )
  const closedGuard = denyIfClosedCaptureUnauthorized(priorClosed, access.role)
  if (!closedGuard.ok) return { success: false, error: closedGuard.error }

  const validationMode =
    priorClosed || !options.finalize
      ? 'draft'
      : 'final'

  const validation = validateCertificadoMedicoPayload(rawPayload, validationMode)
  if (!validation.valid) {
    return {
      success: false,
      error: validation.error,
      fieldErrors: validation.fieldErrors,
    }
  }
  let payload = validation.payload

  let doctorFullName: string | null = null
  let doctorLicense: string | null = null
  if (session?.user?.id) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { fullName: true, professionalLicense: true },
    })
    doctorFullName = user?.fullName ?? null
    doctorLicense = user?.professionalLicense ?? null
  }

  const longitudinalData =
    eventTest.event.worker.clinicalHistory?.data &&
    typeof eventTest.event.worker.clinicalHistory.data === 'object' &&
    !Array.isArray(eventTest.event.worker.clinicalHistory.data)
      ? (eventTest.event.worker.clinicalHistory.data as Record<string, unknown>)
      : null

  const eventAt = eventTest.event.checkInDate ?? eventTest.event.createdAt
  const metadata = resolveCertificadoMedicoMetadata({
    parsed: payload,
    workerNationalId: eventTest.event.worker.nationalId,
    longitudinalData,
    doctorFullName,
    doctorLicense,
    sessionUserName: session?.user?.name ?? null,
    eventAt,
  })
  payload = { ...payload, ...metadata }

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

  const toStore: CertificadoMedicoPayload = {
    ...payload,
    cerrada_at: priorClosed
      ? (payload.cerrada_at ?? parseCertificadoMedicoDraftContext(eventTest.clinicalContext)?.cerrada_at)
      : options.finalize
        ? new Date().toISOString()
        : payload.cerrada_at,
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
    if (!options.autosave) {
      revalidatePath(`/events/${eventId}`)
    }
    return {
      success: true,
      payload: toStore,
      updatedAt: updated.updatedAt.toISOString(),
    }
  } catch (err) {
    console.error('[saveCertificadoMedico]', err)
    return {
      success: false,
      error: 'No se pudo guardar el certificado por un problema del servidor o de red.',
      technicalDetail: err instanceof Error ? err.message : 'unknown_error',
    }
  }
}

export interface GenerateExploracionFisicaInput {
  organos: Record<string, { estado: 'NORMAL' | 'ANORMAL'; detalle: string }>
  tatuajes?: string
  formato?: 'sistemas' | 'narrativo'
}

export interface GenerateExploracionFisicaResult {
  ok: boolean
  texto: string
  source?: 'minimax' | 'template' | 'template_fallback'
  error?: string
}

export async function generateExploracionFisicaIA(
  input: GenerateExploracionFisicaInput,
): Promise<GenerateExploracionFisicaResult> {
  const access = await assertClinicalAccess()
  if (!access.ok) return { ok: false, texto: '', error: access.error }

  const baseUrl =
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    process.env.BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://localhost:8000'

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 25_000)

    const res = await fetch(`${baseUrl}/api/v2/clinical/generate-exploracion-fisica`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal: controller.signal,
    })
    clearTimeout(timer)

    if (res.ok) {
      const data = await res.json()
      if (data && typeof data.texto === 'string' && data.texto.trim()) {
        return { ok: true, texto: data.texto.trim(), source: data.source }
      }
    }
  } catch (err) {
    console.warn('[generateExploracionFisicaIA] Backend error o timeout, usando fallback local', err)
  }

  const getF = (k: string, norm: string) => {
    const o = input.organos?.[k]
    if (o?.estado === 'ANORMAL' && o.detalle?.trim()) return o.detalle.trim()
    return norm
  }

  const neurol = `Consciente, orientado en sus cuatro esferas. ${getF('fuerza', 'Fuerza 5/5 (Daniels), sensibilidad y reflejos osteotendinosos conservados.')} ${getF('romberg_tandem', 'Coordinación, Romberg y marcha en tándem normales.')}`
  const cabezaCuello = `${getF('boca', 'Mucosa oral hidratada, dentadura completa sin caries ni sarro, faringe normal.')} ${getF('ojos', 'Pupilas isocóricas normorreflécticas, globos oculares sin alteraciones.')} ${getF('oidos', 'Conductos auditivos permeables.')}`
  const piel = input.tatuajes?.trim()
    ? `Tatuajes en ${input.tatuajes.trim()}.`
    : 'Sin lesiones ni alteraciones aparentes.'

  const fallback = [
    `Neurológico: ${neurol}`,
    `Cabeza y cuello: ${cabezaCuello}`,
    `Tórax: ${getF('torax', 'Mesomórfico, amplexión y amplexación normales, auscultación cardiopulmonar sin alteraciones.')}`,
    `Abdomen: ${getF('abdomen', 'Globoso, depresible, no doloroso.')}`,
    `Extremidades: ${getF('extremidades', 'Íntegras, eutróficas, llenado capilar inmediato, sin edema.')}`,
    `Piel: ${piel}`,
    `Romberg: ${getF('romberg_tandem', 'Negativo.')}`,
    `Tándem: ${getF('romberg_tandem', 'Negativo.')}`,
  ].join('\n')

  return { ok: true, texto: fallback, source: 'template_fallback' }
}
