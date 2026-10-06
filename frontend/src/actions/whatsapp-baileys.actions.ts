'use server'

import { getServerSession } from 'next-auth/next'
import { revalidatePath } from 'next/cache'
import { authOptions } from '@/auth'
import { isAdminLike } from '@/lib/auth/roles'
import prisma from '@/lib/prisma'
import {
  callWhatsAppGateway,
  isWhatsAppGatewayConfigured,
} from '@/lib/whatsapp-gateway-client'

const ROW_ID = 'default'

export type WhatsAppBaileysPublicSettings = {
  gatewayConfigured: boolean
  enabled: boolean
  status: string
  linkedPhone: string | null
  qrDataUrl: string | null
  lastError: string | null
}

async function upsertRowFromGateway(args: {
  userId: string
  status?: string
  linkedPhone?: string | null
  lastError?: string | null
}): Promise<void> {
  await prisma.whatsAppBaileysConfig.upsert({
    where: { id: ROW_ID },
    create: {
      id: ROW_ID,
      enabled: false,
      status: args.status ?? 'disconnected',
      linkedPhone: args.linkedPhone ?? null,
      lastError: args.lastError ?? null,
      updatedBy: args.userId,
    },
    update: {
      ...(args.status !== undefined ? { status: args.status } : {}),
      ...(args.linkedPhone !== undefined ? { linkedPhone: args.linkedPhone } : {}),
      ...(args.lastError !== undefined ? { lastError: args.lastError } : {}),
      updatedBy: args.userId,
    },
  })
}

export async function getWhatsAppBaileysSettings(): Promise<{
  success: boolean
  settings?: WhatsAppBaileysPublicSettings
  error?: string
}> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { success: false, error: 'No autenticado' }
  if (!isAdminLike(session.user.role)) {
    return { success: false, error: 'Se requiere rol ADMIN o SUPERADMIN' }
  }

  let row: Awaited<ReturnType<typeof prisma.whatsAppBaileysConfig.findUnique>>
  try {
    row = await prisma.whatsAppBaileysConfig.findUnique({ where: { id: ROW_ID } })
  } catch (err) {
    console.error('[WhatsApp] get settings DB failed:', err)
    return {
      success: false,
      error:
        'Falta la migración whatsapp_baileys_config. Ejecute prisma migrate deploy en Railway.',
    }
  }

  if (!isWhatsAppGatewayConfigured()) {
    return {
      success: true,
      settings: {
        gatewayConfigured: false,
        enabled: row?.enabled ?? false,
        status: row?.status ?? 'disconnected',
        linkedPhone: row?.linkedPhone ?? null,
        qrDataUrl: null,
        lastError:
          row?.lastError ??
          'Configure WHATSAPP_GATEWAY_URL y WHATSAPP_GATEWAY_SECRET (servicio Baileys en Railway).',
      },
    }
  }

  const live = await callWhatsAppGateway({
    path: '/v1/admin/status',
    method: 'GET',
    role: session.user.role as string,
    userId: session.user.id,
  })

  if (!live.ok || !live.data) {
    return {
      success: true,
      settings: {
        gatewayConfigured: true,
        enabled: row?.enabled ?? false,
        status: row?.status ?? 'disconnected',
        linkedPhone: row?.linkedPhone ?? null,
        qrDataUrl: null,
        lastError: live.error ?? 'No se pudo contactar el gateway WhatsApp',
      },
      error: live.error,
    }
  }

  const d = live.data
  await upsertRowFromGateway({
    userId: session.user.id,
    status: d.status ?? 'disconnected',
    linkedPhone: d.linkedPhone ?? null,
    lastError: d.lastError ?? null,
  })

  return {
    success: true,
    settings: {
      gatewayConfigured: true,
      enabled: row?.enabled ?? false,
      status: d.status ?? 'disconnected',
      linkedPhone: d.linkedPhone ?? null,
      qrDataUrl: d.qrDataUrl ?? null,
      lastError: d.lastError ?? null,
    },
  }
}

export async function saveWhatsAppBaileysEnabled(enabled: boolean): Promise<{
  success: boolean
  settings?: WhatsAppBaileysPublicSettings
  error?: string
}> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { success: false, error: 'No autenticado' }
  if (!isAdminLike(session.user.role)) {
    return { success: false, error: 'Se requiere rol ADMIN o SUPERADMIN' }
  }

  await prisma.whatsAppBaileysConfig.upsert({
    where: { id: ROW_ID },
    create: {
      id: ROW_ID,
      enabled,
      status: 'disconnected',
      updatedBy: session.user.id,
    },
    update: { enabled, updatedBy: session.user.id },
  })

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: 'WHATSAPP_BAILEYS_ENABLED_UPDATE',
      entity: 'WhatsAppBaileysConfig',
      entityId: ROW_ID,
      details: { enabled },
    },
  })

  revalidatePath('/admin/settings')
  return getWhatsAppBaileysSettings()
}

export async function startWhatsAppBaileysPairing(): Promise<{
  success: boolean
  settings?: WhatsAppBaileysPublicSettings
  error?: string
}> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { success: false, error: 'No autenticado' }
  if (!isAdminLike(session.user.role)) {
    return { success: false, error: 'Se requiere rol ADMIN o SUPERADMIN' }
  }

  const live = await callWhatsAppGateway({
    path: '/v1/admin/connect',
    method: 'POST',
    role: session.user.role as string,
    userId: session.user.id,
  })

  if (!live.ok) {
    return { success: false, error: live.error ?? 'No se pudo iniciar el QR' }
  }

  revalidatePath('/admin/settings')
  return getWhatsAppBaileysSettings()
}

export async function disconnectWhatsAppBaileys(): Promise<{
  success: boolean
  settings?: WhatsAppBaileysPublicSettings
  error?: string
}> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { success: false, error: 'No autenticado' }
  if (!isAdminLike(session.user.role)) {
    return { success: false, error: 'Se requiere rol ADMIN o SUPERADMIN' }
  }

  const live = await callWhatsAppGateway({
    path: '/v1/admin/disconnect',
    method: 'POST',
    role: session.user.role as string,
    userId: session.user.id,
  })

  if (!live.ok) {
    return { success: false, error: live.error ?? 'No se pudo cerrar sesión WhatsApp' }
  }

  revalidatePath('/admin/settings')
  return getWhatsAppBaileysSettings()
}
