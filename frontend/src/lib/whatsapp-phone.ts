/** Dígitos E.164 sin + (México: prefijo 52). */
export function normalizeWhatsAppPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 10) return `52${digits}`
  if (digits.length === 12 && digits.startsWith('52')) return digits
  return digits
}

export function isValidWhatsAppPhone(raw: string): boolean {
  return normalizeWhatsAppPhone(raw).length >= 12
}

export function buildWhatsAppWebUrl(phone: string, message: string): string {
  const normalizedPhone = normalizeWhatsAppPhone(phone)
  return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`
}
