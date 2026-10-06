'use server'

import { getServerSession } from 'next-auth/next'
import { revalidatePath } from 'next/cache'
import { authOptions } from '@/auth'
import { isAdminLike } from '@/lib/auth/roles'
import prisma from '@/lib/prisma'
import {
  canEncryptAppSecrets,
  encryptAppSecret,
} from '@/lib/app-secret-crypto'
import { describeSmtpTransportBlockReason, resolveSmtpTransport } from '@/lib/smtp-config'
import { sendSmtpMail } from '@/lib/smtp-mail'
import { SENDGRID_SMTP_ROW_ID, SendGridSmtpSaveSchema } from '@/schemas/sendgrid-smtp.schema'

export type SendGridSmtpPublicSettings = {
  configured: boolean
  enabled: boolean
  host: string
  port: number
  username: string
  apiKeySuffix: string | null
  fromAddress: string
  fromPortalAccess: string
  fromResults: string
  fromReceipts: string
  updatedAt: string | null
  source: 'db' | 'env' | 'none'
  envFallbackActive: boolean
  canStoreSecrets: boolean
}

function emptyPublic(): SendGridSmtpPublicSettings {
  const envActive = Boolean(process.env.SMTP_HOST?.trim() && process.env.SMTP_PORT?.trim())
  return {
    configured: false,
    enabled: false,
    host: 'smtp.sendgrid.net',
    port: 465,
    username: 'apikey',
    apiKeySuffix: null,
    fromAddress: '',
    fromPortalAccess: '',
    fromResults: '',
    fromReceipts: '',
    updatedAt: null,
    source: envActive ? 'env' : 'none',
    envFallbackActive: envActive,
    canStoreSecrets: canEncryptAppSecrets(),
  }
}

export async function getSendGridSmtpSettings(): Promise<{
  success: boolean
  settings?: SendGridSmtpPublicSettings
  error?: string
}> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return { success: false, error: 'No autenticado' }
  if (!isAdminLike(session.user.role)) {
    return { success: false, error: 'Se requiere rol ADMIN o SUPERADMIN' }
  }

  let row: Awaited<ReturnType<typeof prisma.sendGridSmtpConfig.findUnique>>
  try {
    row = await prisma.sendGridSmtpConfig.findUnique({
      where: { id: SENDGRID_SMTP_ROW_ID },
    })
  } catch (err) {
    console.error('[SendGrid] get settings failed:', err)
    const msg =
      err && typeof err === 'object' && 'code' in err && err.code === 'P2021'
        ? 'Falta aplicar la migración de base de datos (sendgrid_smtp_config). Ejecute migrate deploy en Railway.'
        : 'No se pudo leer la configuración SendGrid. Revise logs del servidor.'
    return {
      success: true,
      settings: emptyPublic(),
      error: msg,
    }
  }

  const envActive = Boolean(process.env.SMTP_HOST?.trim() && process.env.SMTP_PORT?.trim())

  if (!row) {
    return { success: true, settings: emptyPublic() }
  }

  const hasKey = Boolean(row.apiKeyCiphertext && row.apiKeyNonce && row.apiKeyTag)

  return {
    success: true,
    settings: {
      configured: hasKey,
      enabled: row.enabled,
      host: row.host,
      port: row.port,
      username: row.username,
      apiKeySuffix: row.apiKeySuffix,
      fromAddress: row.fromAddress ?? '',
      fromPortalAccess: row.fromPortalAccess ?? '',
      fromResults: row.fromResults ?? '',
      fromReceipts: row.fromReceipts ?? '',
      updatedAt: row.updatedAt.toISOString(),
      source: hasKey && row.enabled ? 'db' : envActive ? 'env' : 'none',
      envFallbackActive: envActive,
      canStoreSecrets: canEncryptAppSecrets(),
    },
  }
}

export async function saveSendGridSmtpSettings(input: {
  port: number
  enabled: boolean
  fromAddress: string
  fromPortalAccess: string
  fromResults: string
  fromReceipts: string
  apiKey?: string
}): Promise<{ success: boolean; settings?: SendGridSmtpPublicSettings; error?: string }> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { success: false, error: 'No autenticado' }
  if (!isAdminLike(session.user.role)) {
    return { success: false, error: 'Se requiere rol ADMIN o SUPERADMIN' }
  }

  if (!canEncryptAppSecrets()) {
    return {
      success: false,
      error: 'Falta ENCRYPTION_KEY o NEXTAUTH_SECRET para guardar la API key de forma segura.',
    }
  }

  const parsed = SendGridSmtpSaveSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  }

  const data = parsed.data
  const apiKeyTrim = data.apiKey?.trim() ?? ''

  const existing = await prisma.sendGridSmtpConfig.findUnique({
    where: { id: SENDGRID_SMTP_ROW_ID },
  })

  if (!apiKeyTrim && !existing?.apiKeyCiphertext) {
    return { success: false, error: 'Indique la API key de SendGrid (contraseña SMTP).' }
  }

  let cipher: ReturnType<typeof encryptAppSecret> | undefined
  let apiKeySuffix = existing?.apiKeySuffix ?? null

  if (apiKeyTrim) {
    cipher = encryptAppSecret(apiKeyTrim)
    apiKeySuffix = apiKeyTrim.slice(-4)
  }

  await prisma.sendGridSmtpConfig.upsert({
    where: { id: SENDGRID_SMTP_ROW_ID },
    create: {
      id: SENDGRID_SMTP_ROW_ID,
      host: 'smtp.sendgrid.net',
      port: data.port,
      username: 'apikey',
      enabled: data.enabled,
      fromAddress: data.fromAddress?.trim() || null,
      fromPortalAccess: data.fromPortalAccess?.trim() || null,
      fromResults: data.fromResults?.trim() || null,
      fromReceipts: data.fromReceipts?.trim() || null,
      apiKeyCiphertext: cipher?.ciphertext,
      apiKeyNonce: cipher?.nonce,
      apiKeyTag: cipher?.tag,
      apiKeySuffix,
      updatedBy: session.user.id,
    },
    update: {
      port: data.port,
      enabled: data.enabled,
      fromAddress: data.fromAddress?.trim() || null,
      fromPortalAccess: data.fromPortalAccess?.trim() || null,
      fromResults: data.fromResults?.trim() || null,
      fromReceipts: data.fromReceipts?.trim() || null,
      ...(cipher
        ? {
            apiKeyCiphertext: cipher.ciphertext,
            apiKeyNonce: cipher.nonce,
            apiKeyTag: cipher.tag,
            apiKeySuffix,
          }
        : {}),
      updatedBy: session.user.id,
    },
  })

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: 'SENDGRID_SMTP_CONFIG_UPDATE',
      entity: 'SendGridSmtpConfig',
      entityId: SENDGRID_SMTP_ROW_ID,
      details: {
        port: data.port,
        enabled: data.enabled,
        apiKeyRotated: Boolean(apiKeyTrim),
      },
    },
  })

  revalidatePath('/admin/settings')
  return getSendGridSmtpSettings()
}

export async function probeSendGridSmtpConnection(testRecipient?: string): Promise<{
  success: boolean
  error?: string
  skipped?: boolean
}> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return { success: false, error: 'No autenticado' }
  if (!isAdminLike(session.user.role)) {
    return { success: false, error: 'Se requiere rol ADMIN o SUPERADMIN' }
  }

  const transport = await resolveSmtpTransport({ forProbe: true })
  if (!transport) {
    const hint = await describeSmtpTransportBlockReason()
    return {
      success: false,
      error:
        hint ??
        'SMTP no configurado. Guarde la API key o configure SMTP_HOST en el servidor.',
    }
  }

  const to =
    testRecipient?.trim() ||
    session.user.email?.trim() ||
    ''
  if (!to) {
    return { success: false, error: 'Indique un correo de prueba o use un usuario con email.' }
  }

  const result = await sendSmtpMail({
    purpose: 'default',
    forProbe: true,
    to,
    subject: 'Prueba SendGrid — Administración Médica Industrial',
    text:
      'Este mensaje confirma que la configuración SMTP (SendGrid) responde correctamente.\n\n' +
      `Origen efectivo: ${transport.source}\n` +
      `Servidor: ${transport.host}:${transport.port}\n\n` +
      'Administración Médica Industrial',
  })

  if (result.skipped) {
    return { success: false, error: 'Transporte SMTP no disponible.' }
  }
  return result
}
