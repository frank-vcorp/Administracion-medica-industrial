/**
 * Resolución pura de destinos WhatsApp (sin Prisma).
 * Orden: lista AppConfig → PORTAL_LOGISTICS_WHATSAPP → default 4421144615.
 */
import { isValidWhatsAppPhone, normalizeWhatsAppPhone } from '@/lib/whatsapp-phone'
import type { PortalSpecialRequestWhatsAppConfig } from '@/schemas/portal-special-request-whatsapp.schema'

const FALLBACK_LOGISTICS_RAW = '4421144615'

export function resolvePortalSpecialRequestLogisticsPhones(
  config: PortalSpecialRequestWhatsAppConfig | null,
  envPortalLogistics: string | undefined,
): { phones: string[]; copyToSeller: boolean } {
  const copyToSeller = config?.copyToSeller ?? true
  const seen = new Set<string>()
  const out: string[] = []
  for (const p of config?.phones ?? []) {
    const n = normalizeWhatsAppPhone(String(p).trim())
    if (!isValidWhatsAppPhone(n)) continue
    if (seen.has(n)) continue
    seen.add(n)
    out.push(n)
  }
  const envRaw = envPortalLogistics?.trim()
  if (out.length === 0 && envRaw) {
    const n = normalizeWhatsAppPhone(envRaw)
    if (isValidWhatsAppPhone(n) && !seen.has(n)) {
      seen.add(n)
      out.push(n)
    }
  }
  if (out.length === 0) {
    const n = normalizeWhatsAppPhone(FALLBACK_LOGISTICS_RAW)
    if (isValidWhatsAppPhone(n)) out.push(n)
  }
  return { phones: out, copyToSeller }
}
