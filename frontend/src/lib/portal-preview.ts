import { createHmac, timingSafeEqual } from 'node:crypto'

export const PORTAL_PREVIEW_COOKIE = 'ami_portal_preview'

function previewSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET
  if (!secret) {
    throw new Error('NEXTAUTH_SECRET requerido para vista previa del portal')
  }
  return secret
}

function signCompanyId(companyId: string): string {
  return createHmac('sha256', previewSecret()).update(companyId).digest('hex').slice(0, 24)
}

/** Valor firmado para cookie httpOnly: `<companyId>.<sig>` */
export function buildPortalPreviewCookieValue(companyId: string): string {
  return `${companyId}.${signCompanyId(companyId)}`
}

export function verifyPortalPreviewCookieValue(raw: string | undefined | null): string | null {
  if (!raw) return null
  const dot = raw.lastIndexOf('.')
  if (dot <= 0) return null
  const companyId = raw.slice(0, dot)
  const sig = raw.slice(dot + 1)
  if (!/^[0-9a-f-]{36}$/i.test(companyId) || !/^[0-9a-f]{24}$/i.test(sig)) {
    return null
  }
  const expected = signCompanyId(companyId)
  try {
    const a = Buffer.from(sig, 'utf8')
    const b = Buffer.from(expected, 'utf8')
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  } catch {
    return null
  }
  return companyId
}
