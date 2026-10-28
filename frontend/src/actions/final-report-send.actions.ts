'use server'

import { z } from 'zod'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/auth'
import prisma from '@/lib/prisma'
import { resolveExamenMedicoEntregablePdfForEvent } from '@/lib/examen-medico-pdf'
import { sendWhatsAppDocumentMessage } from '@/actions/whatsapp-send.actions'
import { readEmployerAptitudLaboral } from '@/lib/clinical/dictamen-audience'
import { logAudit } from '@/actions/audit.actions'

const SendSchema = z.object({
  eventId: z.string().uuid(),
  phone: z.string().min(10).max(20),
})

const CLINICAL_ROLES = new Set(['SUPERADMIN', 'DOCTOR_GENERAL', 'DOCTOR_VALIDATOR', 'ADMIN'])

export async function sendEmployerFinalReportWhatsApp(input: {
  eventId: string
  phone: string
}): Promise<{ success: boolean; sent: boolean; skipped?: boolean; error?: string }> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return { success: false, sent: false, error: 'No autenticado' }
  }
  if (!CLINICAL_ROLES.has(session.user.role as string)) {
    return { success: false, sent: false, error: 'Sin permiso' }
  }

  const parsed = SendSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, sent: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  }

  const event = await prisma.medicalEvent.findUnique({
    where: { id: parsed.data.eventId },
    select: {
      id: true,
      worker: { select: { firstName: true, lastName: true, universalId: true } },
      verdict: { select: { signedAt: true, pdfUrl: true } },
      exam: { select: { physicalExamData: true } },
    },
  })

  if (!event?.verdict?.signedAt) {
    return { success: false, sent: false, error: 'El reporte final aún no está emitido' }
  }

  const aptitud = readEmployerAptitudLaboral(
    (event.exam?.physicalExamData as Record<string, unknown> | null) ?? null,
  )
  if (!aptitud) {
    return { success: false, sent: false, error: 'Falta aptitud laboral en el expediente' }
  }

  const pdfBytes = await resolveExamenMedicoEntregablePdfForEvent(parsed.data.eventId, prisma)
  if (!pdfBytes || pdfBytes.length === 0) {
    return { success: false, sent: false, error: 'No se pudo generar el reporte final' }
  }

  const fileName = `ReporteFinal-${event.worker.universalId}.pdf`
  const caption = `Hola ${event.worker.firstName}, adjuntamos el reporte final de aptitud laboral (${aptitud}).`

  const wa = await sendWhatsAppDocumentMessage({
    phone: parsed.data.phone,
    fileName,
    mimetype: 'application/pdf',
    dataBase64: Buffer.from(pdfBytes).toString('base64'),
    caption,
    auditContext: 'employer_final_report',
    entityId: parsed.data.eventId,
  })

  if (wa.sent) {
    await logAudit('EMPLOYER_FINAL_REPORT_WHATSAPP', 'MedicalEvent', event.id, {
      phoneSuffix: parsed.data.phone.replace(/\D/g, '').slice(-4),
    })
  }

  return {
    success: wa.success,
    sent: wa.sent,
    skipped: wa.skipped,
    error: wa.error,
  }
}
