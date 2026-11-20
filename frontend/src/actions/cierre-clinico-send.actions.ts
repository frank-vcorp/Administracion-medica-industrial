'use server'

import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import prisma from '@/lib/prisma'
import { SME_LEGAL_NAME } from '@/lib/brand-constants'
import { sendSmtpMail } from '@/lib/smtp-mail'
import { isValidWhatsAppPhone, normalizeWhatsAppPhone } from '@/lib/whatsapp-phone'
import { sendWhatsAppDocumentMessage } from '@/actions/whatsapp-send.actions'
import {
  buildCierreClinicoZip,
  CierreClinicoError,
} from '@/lib/zip-cierre-clinico'

const STAFF = new Set([
  'ADMIN',
  'SUPERADMIN',
  'RECEPTIONIST',
  'DOCTOR_GENERAL',
  'DOCTOR_VALIDATOR',
  'CAPTURIST',
])

export async function sendCierreClinico(input: {
  eventId: string
  channel: 'email' | 'whatsapp'
}): Promise<{ success: boolean; error?: string }> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { success: false, error: 'No autenticado' }
  if (!STAFF.has(session.user.role as string)) {
    return { success: false, error: 'Sin permiso para enviar el cierre clínico' }
  }

  const event = await prisma.medicalEvent.findUnique({
    where: { id: input.eventId },
    select: {
      id: true,
      worker: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          reportEmails: { select: { email: true }, take: 3 },
        },
      },
    },
  })
  if (!event) return { success: false, error: 'Expediente no encontrado' }

  let zip: Buffer
  let filename: string
  try {
    const built = await buildCierreClinicoZip(event.id)
    zip = Buffer.from(built.zip)
    filename = built.filename
  } catch (err) {
    if (err instanceof CierreClinicoError) {
      return { success: false, error: 'No se pudo armar el cierre clínico para enviarlo.' }
    }
    return { success: false, error: 'No se pudo armar el cierre clínico.' }
  }

  const patient = `${event.worker.firstName} ${event.worker.lastName}`.trim()

  if (input.channel === 'email') {
    const to = event.worker.email?.trim() || event.worker.reportEmails[0]?.email?.trim()
    if (!to) return { success: false, error: 'El trabajador no tiene correo.' }
    const mailed = await sendSmtpMail({
      purpose: 'results',
      to,
      subject: `Cierre clínico — ${patient}`,
      text:
        `Adjuntamos el cierre clínico de ${patient}.\n\n` +
        `Folio: ${event.id}\n\n${SME_LEGAL_NAME}`,
      attachments: [{ filename, content: zip }],
    })
    if (mailed.skipped) {
      return { success: false, error: 'El correo saliente no está configurado.' }
    }
    if (!mailed.success) return { success: false, error: mailed.error ?? 'No se pudo enviar el correo.' }
    return { success: true }
  }

  const phone = normalizeWhatsAppPhone(event.worker.phone ?? '')
  if (!isValidWhatsAppPhone(phone)) {
    return { success: false, error: 'El trabajador no tiene un teléfono válido para WhatsApp.' }
  }
  const sent = await sendWhatsAppDocumentMessage({
    phone,
    fileName: filename,
    mimetype: 'application/zip',
    dataBase64: zip.toString('base64'),
    caption: `Cierre clínico de ${patient}. ${SME_LEGAL_NAME}`,
    auditContext: 'cierre_clinico',
    entityId: event.id,
  })
  if (sent.skipped) {
    return { success: false, error: 'WhatsApp Baileys no está activo.' }
  }
  if (!sent.sent) {
    return { success: false, error: sent.error ?? 'Baileys no pudo enviar el archivo.' }
  }
  return { success: true }
}
