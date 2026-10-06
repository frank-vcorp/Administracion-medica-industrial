import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

const GCM_NONCE_BYTES = 12
const GCM_KEY_BYTES = 32

function loadMasterKey(): Buffer {
  const b64 = process.env.ENCRYPTION_KEY?.trim()
  if (b64) {
    const key = Buffer.from(b64, 'base64')
    if (key.length !== GCM_KEY_BYTES) {
      throw new Error('ENCRYPTION_KEY debe ser 32 bytes en base64')
    }
    return key
  }
  const secret = process.env.NEXTAUTH_SECRET?.trim()
  if (!secret) {
    throw new Error('Configure ENCRYPTION_KEY o NEXTAUTH_SECRET para cifrar secretos')
  }
  return createHash('sha256').update(secret, 'utf8').digest()
}

export function encryptAppSecret(plaintext: string): {
  ciphertext: Buffer
  nonce: Buffer
  tag: Buffer
} {
  const key = loadMasterKey()
  const nonce = randomBytes(GCM_NONCE_BYTES)
  const cipher = createCipheriv('aes-256-gcm', key, nonce)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return { ciphertext, nonce, tag }
}

export function decryptAppSecret(args: {
  ciphertext: Buffer
  nonce: Buffer
  tag: Buffer
}): string {
  const key = loadMasterKey()
  const decipher = createDecipheriv('aes-256-gcm', key, args.nonce)
  decipher.setAuthTag(args.tag)
  return Buffer.concat([decipher.update(args.ciphertext), decipher.final()]).toString('utf8')
}

export function canEncryptAppSecrets(): boolean {
  try {
    loadMasterKey()
    return true
  } catch {
    return false
  }
}
