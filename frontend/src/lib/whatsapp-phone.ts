/**
 * Dígitos para WhatsApp. En México el celular se registra como 521
 * más los 10 dígitos. Sin ese 1, Baileys no entrega el mensaje.
 */
export function normalizeWhatsAppPhone(raw: string): string {
  let digits = raw.replace(/\D/g, '')
  if (digits.startsWith('00')) digits = digits.slice(2)
  if (digits.length === 10) return `521${digits}`
  if (digits.length === 12 && digits.startsWith('52')) return `521${digits.slice(2)}`
  if (digits.length === 13 && digits.startsWith('521')) return digits
  return digits
}

export function isValidWhatsAppPhone(raw: string): boolean {
  return normalizeWhatsAppPhone(raw).length >= 12
}

export function buildWhatsAppWebUrl(phone: string, message: string): string {
  const normalizedPhone = normalizeWhatsAppPhone(phone)
  return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`
}
