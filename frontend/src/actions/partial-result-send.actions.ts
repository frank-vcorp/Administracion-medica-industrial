'use server'

import fs from 'node:fs/promises'
import path from 'node:path'

import { getServerSession } from 'next-auth'
import { z } from 'zod'

import { authOptions } from '@/auth'
import {
  evaluatePartialSendEligibility,
  interpretationFromPredxSnapshot,
  isLaboratoryEventTest,
  listSendableLabTestsForPartial,
  type PartialSendEventInput,
  type PartialSendEventTest,
} from '@/lib/clinical/partial-result-send'
import { buildNotPerformedTestIdSet } from '@/lib/clinical/reception-checkout'
import { buildStudyInterpretationFromSnapshot } from '@/lib/clinical/study-status-display'
import { tryReadSourceFromBackend } from '@/lib/zip-cierre-clinico'
import prisma from '@/lib/prisma'

const REPO_UPLOAD_DIR = path.join(process.cwd(), '..', 'uploads')

const sendPartialSchema = z.object({
  eventId: z.string().uuid(),
  eventTestIds: z.array(z.string().uuid()).min(1),
  recipientEmail: z.string().email(),
})

export type PartialSendLabOption = {
  id: string
  label: string
  hasAttachment: boolean
}

export type PartialSendOffer =
  | { success: false; error: string }
  | {
      success: true
      eligible: false
      reason: string
      patientName: string
      defaultEmails: string[]
    }
  | {
      success: true
      eligible: true
      patientName: string
      companyName: string
      defaultEmails: string[]
      labOptions: PartialSendLabOption[]
    }

async function requireSessionUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions)
  return session?.user?.id ?? null
}

function uniqueEmails(...lists: (string | null | undefined)[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of lists) {
    if (!raw) continue
    const e = raw.trim().toLowerCase()
    if (!e || seen.has(e)) continue
    seen.add(e)
    out.push(raw.trim())
  }
  return out
}

type LoadedPartialEvent = {
  id: string
  patientName: string
  companyName: string
  defaultEmails: string[]
  partialInput: PartialSendEventInput
  testsById: Map<string, PartialSendEventTest & { validatedPdfUrl?: string | null }>
}

async function loadPartialSendContext(eventId: string): Promise<LoadedPartialEvent | null> {
  const event = await prisma.medicalEvent.findUnique({
    where: { id: eventId },
    include: {
      worker: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
          reportEmails: { select: { email: true } },
          company: { select: { name: true } },
        },
      },
      exam: { select: { physicalExamData: true } },
      appointment: {
        select: {
          serviceProfile: {
            select: {
              reportEmails: { select: { email: true } },
            },
          },
        },
      },
      labOrders: { select: { id: true }, take: 1 },
      eventTests: {
        select: {
          id: true,
          status: true,
          testNameSnapshot: true,
          fileUrl: true,
          test: {
            select: {
              categoryId: true,
              category: { select: { name: true } },
            },
          },
          extractionSnapshots: {
            where: { isSuperseded: false },
            orderBy: { version: 'desc' },
            take: 1,
            select: {
              aiPrediagnoses: {
                where: { isSuperseded: false },
                orderBy: { version: 'desc' },
                take: 1,
                select: {
                  clinicalState: true,
                  doctorReviews: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                    select: {
                      doctorStatus: true,
                      validatedPdfUrl: true,
                      validatedPdfError: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  if (!event) return null

  const timelineEntries = await prisma.papeletaTimelineEntry.findMany({
    where: {
      eventId,
      eventTestId: { not: null },
      entryType: { in: ['ADMIN_INCIDENCE', 'STUDY_NOT_PERFORMED'] },
    },
    select: { eventTestId: true, entryType: true },
  })
  const notPerformedTestIds = buildNotPerformedTestIdSet(timelineEntries)

  const testsById = new Map<
    string,
    PartialSendEventTest & { validatedPdfUrl?: string | null }
  >()

  const eventTests: PartialSendEventTest[] = event.eventTests.map((test) => {
    const latestPredx = test.extractionSnapshots?.[0]?.aiPrediagnoses?.[0]
    const latestReview = latestPredx?.doctorReviews?.[0]
    const interpretation =
      latestPredx && latestReview
        ? buildStudyInterpretationFromSnapshot({
            snapshot: { clinicalState: latestPredx.clinicalState },
            existingReview: { doctorStatus: latestReview.doctorStatus },
          })
        : latestPredx
          ? interpretationFromPredxSnapshot(
              latestPredx.clinicalState,
              latestReview?.doctorStatus,
            )
          : null

    const hasValidatedPdf = Boolean(
      latestReview?.validatedPdfUrl && !latestReview?.validatedPdfError,
    )

    const row: PartialSendEventTest & { validatedPdfUrl?: string | null } = {
      id: test.id,
      status: test.status,
      testNameSnapshot: test.testNameSnapshot,
      fileUrl: test.fileUrl,
      test: test.test,
      interpretation,
      hasValidatedPdf,
      validatedPdfUrl: hasValidatedPdf ? latestReview?.validatedPdfUrl : null,
    }
    testsById.set(test.id, row)
    return row
  })

  const profileEmails =
    event.appointment?.serviceProfile?.reportEmails?.map((r) => r.email) ?? []
  const workerEmails = event.worker.reportEmails.map((r) => r.email)

  const defaultEmails = uniqueEmails(...profileEmails, ...workerEmails, event.worker.email)

  const physicalExamData =
    event.exam?.physicalExamData && typeof event.exam.physicalExamData === 'object'
      ? (event.exam.physicalExamData as Record<string, unknown>)
      : null

  return {
    id: event.id,
    patientName: `${event.worker.firstName} ${event.worker.lastName}`,
    companyName: event.worker.company?.name ?? '—',
    defaultEmails,
    partialInput: {
      eventTests,
      examPhysicalExamData: physicalExamData,
      hasLabOrder: event.labOrders.length > 0,
      notPerformedTestIds: notPerformedTestIds,
    },
    testsById,
  }
}

function sanitizeFilenamePart(value: string): string {
  return value.replace(/[^\w.-]+/g, '_').slice(0, 80)
}

async function readAttachmentForTest(
  test: PartialSendEventTest & { validatedPdfUrl?: string | null },
): Promise<{ filename: string; content: Buffer } | null> {
  const label = sanitizeFilenamePart(test.testNameSnapshot ?? 'laboratorio')

  if (test.validatedPdfUrl) {
    const rel = test.validatedPdfUrl.replace(/^\/+/, '')
    const abs = path.join(REPO_UPLOAD_DIR, rel)
    try {
      const content = await fs.readFile(abs)
      const base = path.basename(rel)
      return { filename: base.endsWith('.pdf') ? base : `${label}.pdf`, content }
    } catch {
      // fallback a fileUrl
    }
  }

  if (test.fileUrl) {
    const bytes = await tryReadSourceFromBackend(test.fileUrl)
    if (bytes) {
      const ext = test.fileUrl.split('.').pop()?.toLowerCase()
      const suffix = ext && ext.length <= 5 ? `.${ext}` : '.pdf'
      return { filename: `${label}${suffix}`, content: Buffer.from(bytes) }
    }

    const trimmed = test.fileUrl.trim()
    if (trimmed.startsWith('/uploads/')) {
      const abs = path.join(REPO_UPLOAD_DIR, trimmed.slice('/uploads/'.length))
      try {
        const content = await fs.readFile(abs)
        const base = path.basename(abs)
        return { filename: base || `${label}.pdf`, content }
      } catch {
        return null
      }
    }
  }

  return null
}

async function dispatchPartialResultEmail(args: {
  eventId: string
  patientName: string
  companyName: string
  recipientEmail: string
  attachments: Array<{ filename: string; content: Buffer }>
}): Promise<{ success: boolean; error?: string }> {
  const { sendSmtpMail } = await import('@/lib/smtp-mail')
  const result = await sendSmtpMail({
    purpose: 'results',
    to: args.recipientEmail,
    subject: `Resultados parciales de laboratorio — ${args.patientName}`,
    text:
      `Adjuntamos resultados parciales de laboratorio correspondientes a la atención en ${args.companyName}.\n\n` +
      `Paciente: ${args.patientName}\n` +
      `Folio de expediente: ${args.eventId}\n\n` +
      `Este envío no sustituye el dictamen final de aptitud. Recibirá el cierre clínico cuando todos los estudios estén completos.\n\n` +
      `Administración Médica Industrial`,
    attachments: args.attachments.map((a) => ({
      filename: a.filename,
      content: a.content,
    })),
  })

  if (result.skipped) {
    console.info(
      `[PARTIAL_SEND] (sin SMTP) evento ${args.eventId} → ${args.recipientEmail} (${args.attachments.length} adjuntos)`,
    )
    return { success: true }
  }

  if (!result.success) {
    return { success: false, error: result.error ?? 'Fallo al enviar correo' }
  }

  return { success: true }
}

export async function getPartialSendOffer(eventId: string): Promise<PartialSendOffer> {
  const userId = await requireSessionUserId()
  if (!userId) {
    return { success: false, error: 'No autenticado.' }
  }

  if (!eventId) {
    return { success: false, error: 'eventId requerido.' }
  }

  const ctx = await loadPartialSendContext(eventId)
  if (!ctx) {
    return { success: false, error: 'Expediente no encontrado.' }
  }

  const gate = evaluatePartialSendEligibility(ctx.partialInput)
  if (!gate.eligible) {
    return {
      success: true,
      eligible: false,
      reason: gate.reason,
      patientName: ctx.patientName,
      defaultEmails: ctx.defaultEmails,
    }
  }

  const sendable = listSendableLabTestsForPartial(ctx.partialInput)
  const labOptions: PartialSendLabOption[] = sendable.map((t) => ({
    id: t.id,
    label: t.testNameSnapshot ?? 'Laboratorio',
    hasAttachment: true,
  }))

  return {
    success: true,
    eligible: true,
    patientName: ctx.patientName,
    companyName: ctx.companyName,
    defaultEmails: ctx.defaultEmails,
    labOptions,
  }
}

export async function sendPartialResultEmail(
  input: z.infer<typeof sendPartialSchema>,
): Promise<{ success: boolean; error?: string }> {
  const userId = await requireSessionUserId()
  if (!userId) {
    return { success: false, error: 'No autenticado.' }
  }

  const parsed = sendPartialSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: 'Datos inválidos.' }
  }

  const { eventId, eventTestIds, recipientEmail } = parsed.data

  const ctx = await loadPartialSendContext(eventId)
  if (!ctx) {
    return { success: false, error: 'Expediente no encontrado.' }
  }

  const gate = evaluatePartialSendEligibility(ctx.partialInput)
  if (!gate.eligible) {
    return { success: false, error: gate.reason }
  }

  const sendableIds = new Set(
    listSendableLabTestsForPartial(ctx.partialInput).map((t) => t.id),
  )
  for (const id of eventTestIds) {
    if (!sendableIds.has(id)) {
      return { success: false, error: 'Una o más pruebas no son elegibles para envío parcial.' }
    }
    const test = ctx.testsById.get(id)
    if (!test || !isLaboratoryEventTest(test)) {
      return { success: false, error: 'Solo se pueden enviar pruebas de laboratorio.' }
    }
  }

  const attachments: Array<{ filename: string; content: Buffer }> = []
  for (const id of eventTestIds) {
    const test = ctx.testsById.get(id)
    if (!test) continue
    const file = await readAttachmentForTest(test)
    if (!file) {
      return {
        success: false,
        error: `No se pudo leer el archivo de «${test.testNameSnapshot ?? id}».`,
      }
    }
    attachments.push(file)
  }

  if (attachments.length === 0) {
    return { success: false, error: 'No hay archivos para adjuntar.' }
  }

  const mail = await dispatchPartialResultEmail({
    eventId,
    patientName: ctx.patientName,
    companyName: ctx.companyName,
    recipientEmail,
    attachments,
  })

  if (!mail.success) {
    return mail
  }

  await prisma.resultDeliveryLog.create({
    data: {
      medicalEventId: eventId,
      mode: 'PARTIAL_LAB',
      eventTestIds: eventTestIds,
      recipientEmails: [recipientEmail],
      sentByUserId: userId,
    },
  })

  return { success: true }
}
