import { normalizeWhatsAppPhone } from '@/lib/whatsapp-phone'

/** Logística AMI — default 442 114 4615 (México). */
export function getPortalLogisticsWhatsAppPhone(): string {
  const raw = process.env.PORTAL_LOGISTICS_WHATSAPP?.trim() || '4421144615'
  return normalizeWhatsAppPhone(raw)
}
