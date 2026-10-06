'use server'

import { randomBytes } from 'node:crypto'
import { getServerSession } from 'next-auth/next'
import { revalidatePath } from 'next/cache'
import { authOptions } from '@/auth'
import { isAdminLike } from '@/lib/auth/roles'
import prisma from '@/lib/prisma'
import { canEncryptAppSecrets, encryptAppSecret } from '@/lib/app-secret-crypto'
import {
  callWhatsAppGateway,
  isWhatsAppGatewayConfigured,
  probeWhatsAppGatewayHealth,
} from '@/lib/whatsapp-gateway-client'

const ROW_ID = 'default'

export type WhatsAppBaileysPublicSettings = {
  gatewayConfigured: boolean
  gatewayUrl: string
  gatewaySecretSuffix: string | null
  gatewayReachable: boolean
  canStoreSecrets: boolean
  enabled: boolean
  status: string
  linkedPhone: string | null
  qrDataUrl: string | null
  lastError: string | null
}

function emptySettings(partial?: Partial<WhatsAppBaileysPublicSettings>): WhatsAppBaileysPublicSettings {
  return {
    gatewayConfigured: false,
    gatewayUrl: '',
    gatewaySecretSuffix: null,
    gatewayReachable: false,
    canStoreSecrets: canEncryptAppSecrets(),
    enabled: false,
    status: 'disconnected',
    linkedPhone: null,
    qrDataUrl: null,
    lastError: null,
    ...partial,
  }
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

async function buildSettingsFromRow(
  row: Awaited<ReturnType<typeof prisma.whatsAppBaileysConfig.findUnique>>,
  live?: {
    status?: string
    linkedPhone?: string | null
    qrDataUrl?: string | null
    lastError?: string | null
  },
): Promise<WhatsAppBaileysPublicSettings> {
  const configured = await isWhatsAppGatewayConfigured()
  const health = configured ? await probeWhatsAppGatewayHealth() : { ok: false }
  return emptySettings({
    gatewayConfigured: configured,
    gatewayUrl: row?.gatewayUrl ?? '',
    gatewaySecretSuffix: row?.gatewaySecretSuffix ?? null,
    gatewayReachable: health.ok,
    enabled: row?.enabled ?? false,
    status: live?.status ?? row?.status ?? 'disconnected',
    linkedPhone: live?.linkedPhone ?? row?.linkedPhone ?? null,
    qrDataUrl: live?.qrDataUrl ?? null,
    lastError: live?.lastError ?? row?.lastError ?? null,
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
      error: 'Falta migración whatsapp_baileys_config. Ejecute prisma migrate deploy.',
    }
  }

  const configured = await isWhatsAppGatewayConfigured()
  const hasStored =
    Boolean(row?.gatewayUrl?.trim()) &&
    Boolean(row?.gatewaySecretCiphertext && row.gatewaySecretNonce && row.gatewaySecretTag)

  if (!configured) {
    return {
      success: true,
      settings: emptySettings({
        gatewayUrl: row?.gatewayUrl ?? '',
        gatewaySecretSuffix: row?.gatewaySecretSuffix ?? null,
        gatewayConfigured: hasStored,
        enabled: row?.enabled ?? false,
        status: row?.status ?? 'disconnected',
        linkedPhone: row?.linkedPhone ?? null,
        lastError: hasStored
          ? 'Servidor registrado pero el secret no se pudo usar en este entorno. Soporte puede sincronizar WHATSAPP_GATEWAY_* en Vercel o pulse Guardar servidor.'
          : 'Pulse «Guardar servidor» una vez (URL ya precargada) o contacte soporte.',
      }),
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
      settings: await buildSettingsFromRow(row, {
        lastError: live.error ?? 'No se pudo contactar el gateway WhatsApp',
      }),
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
    settings: await buildSettingsFromRow(row, {
      status: d.status,
      linkedPhone: d.linkedPhone,
      qrDataUrl: d.qrDataUrl,
      lastError: d.lastError,
    }),
  }
}

export async function saveWhatsAppGatewaySettings(input: {
  gatewayUrl: string
  gatewaySecret?: string
}): Promise<{
  success: boolean
  settings?: WhatsAppBaileysPublicSettings
  error?: string
  oneTimeSecretForRailway?: string
}> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { success: false, error: 'No autenticado' }
  if (!isAdminLike(session.user.role)) {
    return { success: false, error: 'Se requiere rol ADMIN o SUPERADMIN' }
  }
  if (!canEncryptAppSecrets()) {
    return { success: false, error: 'Falta NEXTAUTH_SECRET para cifrar el secret del gateway.' }
  }

  const url = input.gatewayUrl.trim().replace(/\/$/, '')
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return { success: false, error: 'URL del gateway inválida (use https://...)' }
  }

  const existing = await prisma.whatsAppBaileysConfig.findUnique({ where: { id: ROW_ID } })
  let secret = input.gatewaySecret?.trim() ?? ''
  let oneTimeSecretForRailway: string | undefined

  if (!secret) {
    if (existing?.gatewaySecretCiphertext) {
      // mantener secret previo
    } else {
      secret = randomBytes(24).toString('hex')
      oneTimeSecretForRailway = secret
    }
  }

  let cipher: ReturnType<typeof encryptAppSecret> | undefined
  let suffix = existing?.gatewaySecretSuffix ?? null
  if (secret) {
    cipher = encryptAppSecret(secret)
    suffix = secret.slice(-4)
  }

  await prisma.whatsAppBaileysConfig.upsert({
    where: { id: ROW_ID },
    create: {
      id: ROW_ID,
      gatewayUrl: url,
      gatewaySecretCiphertext: cipher?.ciphertext,
      gatewaySecretNonce: cipher?.nonce,
      gatewaySecretTag: cipher?.tag,
      gatewaySecretSuffix: suffix,
      status: 'disconnected',
      enabled: false,
      updatedBy: session.user.id,
    },
    update: {
      gatewayUrl: url,
      ...(cipher
        ? {
            gatewaySecretCiphertext: cipher.ciphertext,
            gatewaySecretNonce: cipher.nonce,
            gatewaySecretTag: cipher.tag,
            gatewaySecretSuffix: suffix,
          }
        : {}),
      updatedBy: session.user.id,
    },
  })

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: 'WHATSAPP_GATEWAY_CONFIG_UPDATE',
      entity: 'WhatsAppBaileysConfig',
      entityId: ROW_ID,
      details: { gatewayUrl: url, secretRotated: Boolean(input.gatewaySecret?.trim()) },
    },
  })

  revalidatePath('/admin/settings')
  const refreshed = await getWhatsAppBaileysSettings()
  return { ...refreshed, oneTimeSecretForRailway }
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
