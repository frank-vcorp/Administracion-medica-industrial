'use server'

import { getServerSession } from 'next-auth/next'
import { z } from 'zod'
import { authOptions } from '@/auth'
import prisma from '@/lib/prisma'
import { callWhatsAppGateway } from '@/lib/whatsapp-gateway-client'
import { buildWhatsAppWebUrl, isValidWhatsAppPhone, normalizeWhatsAppPhone } from '@/lib/whatsapp-phone'
import {
  PATIENT_PREPARATION_TRIPTYCH_FILENAME,
} from '@/lib/patient-preparation-triptych'

const ROW_ID = 'default'

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

async function isAutoWhatsAppEnabled(): Promise<boolean> {
  const row = await prisma.whatsAppBaileysConfig.findUnique({ where: { id: ROW_ID } })
  return Boolean(row?.enabled)
}

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
    role: session.user.role as string,
    userId: session.user.id,
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
        userId: session.user.id,
        action: 'WHATSAPP_DOCUMENT_SENT',
        entity: input.auditContext ?? 'appointment_pass',
        entityId: input.entityId ?? null,
        details: {
          phoneSuffix: phone.slice(-4),
          fileName: PATIENT_PREPARATION_TRIPTYCH_FILENAME,
          documentKey: 'patient_preparation_triptych',
        },
      },
    })
    return { success: true, sent: true }
  }

  return {
    success: false,
    sent: false,
    error: live.error ?? 'No se pudo adjuntar el tríptico por WhatsApp',
  }
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

  const phone = normalizeWhatsAppPhone(parsed.data.phone)
  if (!isValidWhatsAppPhone(phone)) {
    return { success: false, sent: false, skipped: false, error: 'Teléfono inválido para WhatsApp' }
  }

  const fallbackWaUrl = buildWhatsAppWebUrl(phone, parsed.data.text)

  if (!(await isAutoWhatsAppEnabled())) {
    return { success: true, sent: false, skipped: true, fallbackWaUrl }
  }

  const live = await callWhatsAppGateway({
    path: '/v1/messages/send',
    method: 'POST',
    role: session.user.role as string,
    userId: session.user.id,
    body: { to: phone, text: parsed.data.text },
  })

  if (live.ok && live.data && (live.data as { sent?: boolean }).sent) {
    if (parsed.data.attachPatientTriptych) {
      await attachPatientPreparationTriptychWhatsApp({
        phone: parsed.data.phone,
        auditContext: parsed.data.auditContext ?? 'appointment_pass',
        entityId: parsed.data.entityId,
      })
    }
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'WHATSAPP_MESSAGE_SENT',
        entity: parsed.data.auditContext ?? 'WhatsApp',
        entityId: parsed.data.entityId ?? null,
        details: { phoneSuffix: phone.slice(-4) },
      },
    })
    return { success: true, sent: true, skipped: false }
  }

  return {
    success: true,
    sent: false,
    skipped: false,
    fallbackWaUrl,
    error: live.error ?? 'No se pudo enviar por WhatsApp automático',
  }
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
