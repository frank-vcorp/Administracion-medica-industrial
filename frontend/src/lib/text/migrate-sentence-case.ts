import { applySentenceCase } from '@/lib/text/sentence-case'

const CIE_CODE = /^[A-Z]\d{2}(\.\d{1,4})?$/i

const SKIP_KEY = new Set(
  [
    'email',
    'phone',
    'url',
    'fileurl',
    'token',
    'tokenhash',
    'hash',
    'id',
    'uuid',
    'code',
    'cie',
    'cie10',
    'cie_10',
    'codigo_cie',
    'codigocie',
    'rfc',
    'nationalid',
    'universalid',
    'qrcode',
    'qr',
    'clave',
    'novaclave',
    'signatureurl',
    'signaturehash',
    'pdfurl',
    'professionallicense',
    'validatorSnapshotProfessionalLicense',
  ].map((k) => k.toLowerCase()),
)

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const URL_RE = /^(https?:\/\/|\/|data:|mailto:|tel:)/i

function lastKey(path: string): string {
  const parts = path.split('.')
  return parts[parts.length - 1] ?? path
}

export function shouldMigrateFreeTextString(value: string, keyPath: string): boolean {
  if (!value || typeof value !== 'string') return false
  if (!value.trim()) return false
  const key = lastKey(keyPath).toLowerCase()
  if (SKIP_KEY.has(key)) return false
  if (EMAIL_RE.test(value.trim())) return false
  if (URL_RE.test(value.trim())) return false
  if (CIE_CODE.test(value.trim())) return false
  return true
}

export function migrateFreeTextString(value: string, keyPath: string): string {
  if (!shouldMigrateFreeTextString(value, keyPath)) return value
  return applySentenceCase(value)
}

/** Recorre JSON clínico; no altera claves de exclusión ni URLs/emails/CIE. */
export function migrateJsonFreeText(value: unknown, keyPath = 'root'): unknown {
  if (value === null || value === undefined) return value
  if (typeof value === 'string') {
    return migrateFreeTextString(value, keyPath)
  }
  if (Array.isArray(value)) {
    return value.map((item, i) => migrateJsonFreeText(item, `${keyPath}[${i}]`))
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const childPath = `${keyPath}.${k}`
      const keyLower = k.toLowerCase()
      if (SKIP_KEY.has(keyLower)) {
        out[k] = v
        continue
      }
      out[k] = migrateJsonFreeText(v, childPath)
    }
    return out
  }
  return value
}
