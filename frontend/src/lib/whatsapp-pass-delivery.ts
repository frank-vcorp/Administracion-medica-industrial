import prisma from '@/lib/prisma'
import { parseDataUrlBase64 } from '@/lib/appointment-qr'
import { callWhatsAppGateway } from '@/lib/whatsapp-gateway-client'
import { buildWhatsAppWebUrl, isValidWhatsAppPhone, normalizeWhatsAppPhone } from '@/lib/whatsapp-phone'
import {
  PATIENT_PREPARATION_TRIPTYCH_FILENAME,
  readPatientPreparationTriptychPdf,
  resolvePublicPatientTriptychUrl,
} from '@/lib/patient-preparation-triptych'

const ROW_ID = 'default'

export async function isAutoWhatsAppEnabled(): Promise<boolean> {
  const row = await prisma.whatsAppBaileysConfig.findUnique({ where: { id: ROW_ID } })
  return Boolean(row?.enabled)
}

/**
 * Envía el tríptico de preparación (`tips-para-pacientes.pdf`) vía Baileys
 * (`send-document-key` → base64 → enlace público) asumiendo autorización verificada por el caller.
 */
export async function deliverPatientPreparationTriptychWhatsApp(input: {
  phone: string
  actorUserId: string
  actorRole: string
  caption?: string
  auditContext?: string
  entityId?: string
}): Promise<{ success: boolean; sent: boolean; error?: string }> {
  if (!(await isAutoWhatsAppEnabled())) {
    return { success: true, sent: false }
  }

  const phone = normalizeWhatsAppPhone(input.phone)
  if (!isValidWhatsAppPhone(phone)) {
    return { success: false, sent: false, error: 'Teléfono inválido' }
  }

  const live = await callWhatsAppGateway({
    path: '/v1/messages/send-document-key',
    method: 'POST',
    role: input.actorRole,
    userId: input.actorUserId,
    body: {
      to: phone,
      documentKey: 'patient_preparation_triptych',
      caption:
        input.caption ?? 'Tríptico de preparación para su cita médica (Tips para pacientes).',
    },
  })

  if (live.ok && live.data && (live.data as { sent?: boolean }).sent) {
    await prisma.auditLog.create({
      data: {
        userId: input.actorUserId,
        action: 'WHATSAPP_DOCUMENT_SENT',
        entity: input.auditContext ?? 'appointment_pass',
        entityId: input.entityId ?? null,
        details: {
          phoneSuffix: phone.slice(-4),
          fileName: PATIENT_PREPARATION_TRIPTYCH_FILENAME,
          documentKey: 'patient_preparation_triptych',
          delivery: 'document_key',
        },
      },
    })
    return { success: true, sent: true }
  }

  try {
    const triptych = await readPatientPreparationTriptychPdf()
    const legacy = await callWhatsAppGateway({
      path: '/v1/messages/send-document',
      method: 'POST',
      role: input.actorRole,
      userId: input.actorUserId,
      body: {
        to: phone,
        fileName: PATIENT_PREPARATION_TRIPTYCH_FILENAME,
        mimetype: 'application/pdf',
        dataBase64: triptych.toString('base64'),
        caption:
          input.caption ?? 'Tríptico de preparación para su cita médica (Tips para pacientes).',
      },
    })
    if (legacy.ok && legacy.data && (legacy.data as { sent?: boolean }).sent) {
      await prisma.auditLog.create({
        data: {
          userId: input.actorUserId,
          action: 'WHATSAPP_DOCUMENT_SENT',
          entity: input.auditContext ?? 'appointment_pass',
          entityId: input.entityId ?? null,
          details: {
            phoneSuffix: phone.slice(-4),
            fileName: PATIENT_PREPARATION_TRIPTYCH_FILENAME,
            delivery: 'document_base64',
          },
        },
      })
      return { success: true, sent: true }
    }
  } catch {
    /* continuar a fallback de enlace */
  }

  const triptychUrl = resolvePublicPatientTriptychUrl()
  const linkText = `📄 Tríptico de preparación para su cita:\n${triptychUrl}`
  const linkSend = await callWhatsAppGateway({
    path: '/v1/messages/send',
    method: 'POST',
    role: input.actorRole,
    userId: input.actorUserId,
    body: { to: phone, text: linkText },
  })
  if (linkSend.ok && linkSend.data && (linkSend.data as { sent?: boolean }).sent) {
    await prisma.auditLog.create({
      data: {
        userId: input.actorUserId,
        action: 'WHATSAPP_MESSAGE_SENT',
        entity: input.auditContext ?? 'appointment_pass',
        entityId: input.entityId ?? null,
        details: {
          phoneSuffix: phone.slice(-4),
          delivery: 'triptych_public_link',
        },
      },
    })
    return { success: true, sent: true }
  }

  return {
    success: false,
    sent: false,
    error: live.error ?? linkSend.error ?? 'No se pudo adjuntar el tríptico por WhatsApp',
  }
}

/**
 * Envía un mensaje de texto por Baileys y opcionalmente adjunta el tríptico de preparación.
 * La autorización debe haber sido validada previamente por la Server Action llamadora.
 */
export async function deliverWhatsAppPassWithTriptych(input: {
  phone: string
  text: string
  actorUserId: string
  actorRole: string
  auditContext?: string
  entityId?: string
  attachPatientTriptych?: boolean
  qrImageDataUrl?: string | null
  qrCaption?: string
}): Promise<{
  success: boolean
  sent: boolean
  skipped: boolean
  qrSent?: boolean
  triptychSent?: boolean
  fallbackWaUrl?: string
  error?: string
}> {
  const phone = normalizeWhatsAppPhone(input.phone)
  if (!isValidWhatsAppPhone(phone)) {
    return { success: false, sent: false, skipped: false, error: 'Teléfono inválido para WhatsApp' }
  }

  const fallbackWaUrl = buildWhatsAppWebUrl(phone, input.text)

  if (!(await isAutoWhatsAppEnabled())) {
    return { success: true, sent: false, skipped: true, fallbackWaUrl }
  }

  const live = await callWhatsAppGateway({
    path: '/v1/messages/send',
    method: 'POST',
    role: input.actorRole,
    userId: input.actorUserId,
    body: { to: phone, text: input.text },
  })

  if (live.ok && live.data && (live.data as { sent?: boolean }).sent) {
    let qrSent = false
    const parsedQr = parseDataUrlBase64(input.qrImageDataUrl)
    if (parsedQr) {
      const qrLive = await callWhatsAppGateway({
        path: '/v1/messages/send-image',
        method: 'POST',
        role: input.actorRole,
        userId: input.actorUserId,
        body: {
          to: phone,
          dataBase64: parsedQr.dataBase64,
          mimetype: parsedQr.mimetype,
          caption: input.qrCaption,
        },
      })
      qrSent = Boolean(qrLive.ok && qrLive.data && (qrLive.data as { sent?: boolean }).sent)
    }

    let triptychSent = false
    if (input.attachPatientTriptych) {
      const triptych = await deliverPatientPreparationTriptychWhatsApp({
        phone: input.phone,
        actorUserId: input.actorUserId,
        actorRole: input.actorRole,
        auditContext: input.auditContext ?? 'appointment_pass',
        entityId: input.entityId,
      })
      triptychSent = triptych.sent
    }
    await prisma.auditLog.create({
      data: {
        userId: input.actorUserId,
        action: 'WHATSAPP_MESSAGE_SENT',
        entity: input.auditContext ?? 'WhatsApp',
        entityId: input.entityId ?? null,
        details: { phoneSuffix: phone.slice(-4), qrSent, triptychSent },
      },
    })
    return { success: true, sent: true, skipped: false, qrSent, triptychSent }
  }

  return {
    success: true,
    sent: false,
    skipped: false,
    fallbackWaUrl,
    error: live.error ?? 'No se pudo enviar por WhatsApp automático',
  }
}
