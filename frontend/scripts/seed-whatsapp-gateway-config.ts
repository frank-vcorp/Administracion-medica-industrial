/**
 * Uso (producción):
 *   GATEWAY_URL=https://... GATEWAY_SECRET=... npx tsx scripts/seed-whatsapp-gateway-config.ts
 */
import { PrismaClient } from '@prisma/client'
import { createCipheriv, createHash, randomBytes } from 'node:crypto'

const ROW_ID = 'default'

function masterKey(): Buffer {
  const b64 = process.env.ENCRYPTION_KEY?.trim()
  if (b64) {
    const key = Buffer.from(b64, 'base64')
    if (key.length !== 32) throw new Error('ENCRYPTION_KEY inválida')
    return key
  }
  const secret = process.env.NEXTAUTH_SECRET?.trim()
  if (!secret) throw new Error('NEXTAUTH_SECRET o ENCRYPTION_KEY requerido')
  return createHash('sha256').update(secret, 'utf8').digest()
}

function encrypt(plaintext: string) {
  const nonce = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', masterKey(), nonce)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  return { ciphertext, nonce, tag: cipher.getAuthTag() }
}

async function main() {
  const url = process.env.GATEWAY_URL?.trim()
  let secret = process.env.GATEWAY_SECRET?.trim()
  if (!url) throw new Error('GATEWAY_URL requerido')
  if (!secret) {
    secret = randomBytes(24).toString('hex')
    console.info(`GATEWAY_SECRET generado: ${secret}`)
  }

  const { ciphertext, nonce, tag } = encrypt(secret)
  const prisma = new PrismaClient()
  await prisma.whatsAppBaileysConfig.upsert({
    where: { id: ROW_ID },
    create: {
      id: ROW_ID,
      gatewayUrl: url.replace(/\/$/, ''),
      gatewaySecretCiphertext: ciphertext,
      gatewaySecretNonce: nonce,
      gatewaySecretTag: tag,
      gatewaySecretSuffix: secret.slice(-4),
      status: 'disconnected',
      enabled: false,
    },
    update: {
      gatewayUrl: url.replace(/\/$/, ''),
      gatewaySecretCiphertext: ciphertext,
      gatewaySecretNonce: nonce,
      gatewaySecretTag: tag,
      gatewaySecretSuffix: secret.slice(-4),
    },
  })
  await prisma.$disconnect()
  console.info('OK whatsapp_baileys_config actualizado')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
