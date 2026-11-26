'use server'

import { getServerSession } from 'next-auth/next'
import { z } from 'zod'
import { authOptions } from '@/auth'
import prisma from '@/lib/prisma'
import { callWhatsAppGateway } from '@/lib/whatsapp-gateway-client'
import { isValidWhatsAppPhone, normalizeWhatsAppPhone } from '@/lib/whatsapp-phone'
import {
  deliverPatientPreparationTriptychWhatsApp,
  deliverWhatsAppPassWithTriptych,
  isAutoWhatsAppEnabled,
} from '@/lib/whatsapp-pass-delivery'

const SendSchema = z.object({
  phone: z.string().min(10).max(20),
  text: z.string().min(1).max(4000),
  auditContext: z.string().max(80).optional(),
  entityId: z.string().max(64).optional(),
  attachPatientTriptych: z.boolean().optional(),
})

const SendDocumentSchema = z.object({
  phone: z.string().min(10).max(20),
  fileName: z.string().min(1).max(120),
  mimetype: z.string().min(3).max(80),
  dataBase64: z.string().min(8).max(20_000_000),
  caption: z.string().max(500).optional(),
  auditContext: z.string().max(80).optional(),
  entityId: z.string().max(64).optional(),
})

const STAFF_ROLES = new Set([
  'ADMIN',
  'SUPERADMIN',
  'RECEPTIONIST',
  'DOCTOR_GENERAL',
  'DOCTOR_VALIDATOR',
  'CAPTURIST',
  'VENDEDOR',
])

/**
 * S23-03: adjunta el tríptico de preparación vía Baileys después del pase de texto.
 * Usa `POST /v1/messages/send-document-key` (PDF en assets del gateway, sin base64).
 */
export async function attachPatientPreparationTriptychWhatsApp(input: {
  phone: string
  caption?: string
  auditContext?: string
  entityId?: string
}): Promise<{ success: boolean; sent: boolean; error?: string }> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return { success: false, sent: false, error: 'No autenticado' }
  }
  if (!STAFF_ROLES.has(session.user.role as string)) {
    return { success: false, sent: false, error: 'Sin permiso' }
  }

  return deliverPatientPreparationTriptychWhatsApp({
    phone: input.phone,
    actorUserId: session.user.id,
    actorRole: session.user.role as string,
    caption: input.caption,
    auditContext: input.auditContext,
    entityId: input.entityId,
  })
}

export async function sendWhatsAppTextMessage(input: {
  phone: string
  text: string
  auditContext?: string
  entityId?: string
  attachPatientTriptych?: boolean
}): Promise<{
  success: boolean
  sent: boolean
  skipped: boolean
  triptychSent?: boolean
  fallbackWaUrl?: string
  error?: string
}> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return { success: false, sent: false, skipped: false, error: 'No autenticado' }
  }
  if (!STAFF_ROLES.has(session.user.role as string)) {
    return { success: false, sent: false, skipped: false, error: 'Sin permiso para enviar WhatsApp' }
  }

  const parsed = SendSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      sent: false,
      skipped: false,
      error: parsed.error.issues[0]?.message ?? 'Datos inválidos',
    }
  }

  return deliverWhatsAppPassWithTriptych({
    phone: parsed.data.phone,
    text: parsed.data.text,
    actorUserId: session.user.id,
    actorRole: session.user.role as string,
    auditContext: parsed.data.auditContext,
    entityId: parsed.data.entityId,
    attachPatientTriptych: parsed.data.attachPatientTriptych,
  })
}

export async function sendWhatsAppDocumentMessage(input: {
  phone: string
  fileName: string
  mimetype: string
  dataBase64: string
  caption?: string
  auditContext?: string
  entityId?: string
}): Promise<{
  success: boolean
  sent: boolean
  skipped: boolean
  error?: string
}> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return { success: false, sent: false, skipped: false, error: 'No autenticado' }
  }
  if (!STAFF_ROLES.has(session.user.role as string)) {
    return { success: false, sent: false, skipped: false, error: 'Sin permiso para enviar WhatsApp' }
  }

  const parsed = SendDocumentSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      sent: false,
      skipped: false,
      error: parsed.error.issues[0]?.message ?? 'Datos inválidos',
    }
  }

  const phone = normalizeWhatsAppPhone(parsed.data.phone)
  if (!isValidWhatsAppPhone(phone)) {
    return { success: false, sent: false, skipped: false, error: 'Teléfono inválido para WhatsApp' }
  }

  if (!(await isAutoWhatsAppEnabled())) {
    return { success: true, sent: false, skipped: true }
  }

  const live = await callWhatsAppGateway({
    path: '/v1/messages/send-document',
    method: 'POST',
    role: session.user.role as string,
    userId: session.user.id,
    body: {
      to: phone,
      fileName: parsed.data.fileName,
      mimetype: parsed.data.mimetype,
      dataBase64: parsed.data.dataBase64,
      caption: parsed.data.caption,
    },
  })

  if (live.ok && live.data && (live.data as { sent?: boolean }).sent) {
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'WHATSAPP_DOCUMENT_SENT',
        entity: parsed.data.auditContext ?? 'WhatsApp',
        entityId: parsed.data.entityId ?? null,
        details: { phoneSuffix: phone.slice(-4), fileName: parsed.data.fileName },
      },
    })
    return { success: true, sent: true, skipped: false }
  }

  return {
    success: false,
    sent: false,
    skipped: false,
    error: live.error ?? 'No se pudo enviar documento por WhatsApp',
  }
}
