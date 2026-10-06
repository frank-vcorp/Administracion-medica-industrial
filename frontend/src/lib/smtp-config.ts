import prisma from '@/lib/prisma'
import { decryptAppSecret } from '@/lib/app-secret-crypto'
import { SENDGRID_SMTP_ROW_ID } from '@/schemas/sendgrid-smtp.schema'

export type SmtpMailPurpose = 'portal' | 'results' | 'receipts' | 'default'

export type ResolvedSmtpTransport = {
  host: string
  port: number
  secure: boolean
  auth?: { user: string; pass: string }
  source: 'sendgrid_db' | 'env'
}

const SENDGRID_DEFAULT_HOST = 'smtp.sendgrid.net'
const SENDGRID_DEFAULT_USER = 'apikey'

function envTransport(): ResolvedSmtpTransport | null {
  const smtpHost = process.env.SMTP_HOST?.trim()
  const smtpPort = process.env.SMTP_PORT?.trim()
  if (!smtpHost || !smtpPort) return null
  const port = Number(smtpPort)
  const smtpUser = process.env.SMTP_USER?.trim()
  const smtpPass = process.env.SMTP_PASS?.trim()
  return {
    host: smtpHost,
    port,
    secure: port === 465,
    auth: smtpUser && smtpPass ? { user: smtpUser, pass: smtpPass } : undefined,
    source: 'env',
  }
}

async function dbTransport(options?: {
  /** Prueba de conexión: usa credenciales guardadas aunque el toggle esté apagado. */
  ignoreEnabled?: boolean
}): Promise<ResolvedSmtpTransport | null> {
  const row = await prisma.sendGridSmtpConfig.findUnique({
    where: { id: SENDGRID_SMTP_ROW_ID },
  })
  if (!row?.enabled && !options?.ignoreEnabled) return null
  if (!row.apiKeyCiphertext || !row.apiKeyNonce || !row.apiKeyTag) return null

  let apiKey: string
  try {
    apiKey = decryptAppSecret({
      ciphertext: Buffer.from(row.apiKeyCiphertext),
      nonce: Buffer.from(row.apiKeyNonce),
      tag: Buffer.from(row.apiKeyTag),
    })
  } catch (err) {
    console.error('[SMTP] No se pudo descifrar API key SendGrid:', err)
    return null
  }

  return {
    host: row.host || SENDGRID_DEFAULT_HOST,
    port: row.port,
    secure: row.port === 465,
    auth: {
      user: row.username || SENDGRID_DEFAULT_USER,
      pass: apiKey,
    },
    source: 'sendgrid_db',
  }
}

/** BD SendGrid (si está habilitada) gana sobre variables SMTP_* de entorno. */
export async function resolveSmtpTransport(options?: {
  forProbe?: boolean
}): Promise<ResolvedSmtpTransport | null> {
  const fromDb = await dbTransport({ ignoreEnabled: options?.forProbe })
  if (fromDb) return fromDb
  return envTransport()
}

export async function describeSmtpTransportBlockReason(): Promise<string | null> {
  const row = await prisma.sendGridSmtpConfig.findUnique({
    where: { id: SENDGRID_SMTP_ROW_ID },
  })
  const hasKey = Boolean(row?.apiKeyCiphertext && row.apiKeyNonce && row.apiKeyTag)
  if (hasKey && row && !row.enabled) {
    return 'SendGrid está guardado pero desactivado. Marque «Usar SendGrid configurado aquí (activo)» y pulse Guardar.'
  }
  if (!hasKey && !envTransport()) {
    return 'SMTP no configurado. Guarde la API key de SendGrid o configure SMTP_HOST en el servidor.'
  }
  if (hasKey && row?.enabled) {
    return 'No se pudo usar SendGrid (revise que NEXTAUTH_SECRET no haya cambiado tras guardar la API key).'
  }
  return null
}

export async function resolveSmtpFromAddress(
  purpose: SmtpMailPurpose,
  options?: { ignoreEnabled?: boolean },
): Promise<string> {
  const row = await prisma.sendGridSmtpConfig.findUnique({
    where: { id: SENDGRID_SMTP_ROW_ID },
  })

  const pick = (v: string | null | undefined) => (v?.trim() ? v.trim() : null)

  if (row && (row.enabled || options?.ignoreEnabled)) {
    if (purpose === 'portal' && pick(row.fromPortalAccess)) return row.fromPortalAccess!.trim()
    if (purpose === 'results' && pick(row.fromResults)) return row.fromResults!.trim()
    if (purpose === 'receipts' && pick(row.fromReceipts)) return row.fromReceipts!.trim()
    if (pick(row.fromAddress)) return row.fromAddress!.trim()
  }

  if (purpose === 'portal') {
    return (
      process.env.PORTAL_ACCESS_EMAIL_FROM?.trim() ??
      process.env.RESULTS_EMAIL_FROM?.trim() ??
      process.env.PAYMENT_RECEIPT_FROM?.trim() ??
      'no-reply@ami.local'
    )
  }
  if (purpose === 'results') {
    return (
      process.env.RESULTS_EMAIL_FROM?.trim() ??
      process.env.PAYMENT_RECEIPT_FROM?.trim() ??
      'no-reply@ami.local'
    )
  }
  if (purpose === 'receipts') {
    return process.env.PAYMENT_RECEIPT_FROM?.trim() ?? 'no-reply@ami.local'
  }
  return process.env.PAYMENT_RECEIPT_FROM?.trim() ?? 'no-reply@ami.local'
}
