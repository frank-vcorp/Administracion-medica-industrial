import prisma from '@/lib/prisma'
import { decryptAppSecret } from '@/lib/app-secret-crypto'

const ROW_ID = 'default'

export type ResolvedWhatsAppGateway = {
  baseUrl: string
  secret: string
  source: 'db' | 'env'
}

export async function resolveWhatsAppGateway(): Promise<ResolvedWhatsAppGateway | null> {
  const envUrl =
    process.env.WHATSAPP_GATEWAY_URL?.trim() ||
    process.env.NEXT_PUBLIC_WHATSAPP_GATEWAY_URL?.trim() ||
    ''
  const envSecret = process.env.WHATSAPP_GATEWAY_SECRET?.trim() || ''
  if (envUrl && envSecret) {
    return { baseUrl: envUrl.replace(/\/$/, ''), secret: envSecret, source: 'env' }
  }

  const row = await prisma.whatsAppBaileysConfig.findUnique({ where: { id: ROW_ID } })
  const url = row?.gatewayUrl?.trim()
  if (!url) return null
  if (!row.gatewaySecretCiphertext || !row.gatewaySecretNonce || !row.gatewaySecretTag) {
    return null
  }

  try {
    const secret = decryptAppSecret({
      ciphertext: Buffer.from(row.gatewaySecretCiphertext),
      nonce: Buffer.from(row.gatewaySecretNonce),
      tag: Buffer.from(row.gatewaySecretTag),
    })
    return { baseUrl: url.replace(/\/$/, ''), secret, source: 'db' }
  } catch (err) {
    console.error('[WhatsApp] decrypt gateway secret failed:', err)
    return null
  }
}
