'use server'

import { getServerSession } from 'next-auth/next'
import { z } from 'zod'
import { authOptions } from '@/auth'
import prisma from '@/lib/prisma'
import { callWhatsAppGateway } from '@/lib/whatsapp-gateway-client'
import { buildWhatsAppWebUrl, isValidWhatsAppPhone, normalizeWhatsAppPhone } from '@/lib/whatsapp-phone'

const ROW_ID = 'default'

const SendSchema = z.object({
  phone: z.string().min(10).max(20),
  text: z.string().min(1).max(4000),
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

export async function sendWhatsAppTextMessage(input: {
  phone: string
  text: string
  auditContext?: string
  entityId?: string
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
