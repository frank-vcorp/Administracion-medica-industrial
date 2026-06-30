/**
 * @fileoverview Constantes y tipos compartidos del módulo de pagos (ARCH-20260630-01)
 * @description Separado de payment.actions.ts porque los archivos 'use server'
 *              solo permiten exportar funciones async.
 * @id IMPL-20260630-01
 * @id IMPL-20260630-02 — WhatsApp Web receipt support
 * @spec context/SPECs/SPEC_ARCH-20260630-01-MODAL-PAGO-RECIBO-PAPELETA.md
 * @spec context/SPECs/SPEC_ARCH-20260630-02-WHATSAPP-RECIBO.md
 */

export const PAYMENT_METHODS = [
  'EFECTIVO',
  'TARJETA',
  'TRANSFERENCIA',
  'CHEQUE',
  'OTRO',
] as const

export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

const METHOD_LABELS: Record<PaymentMethod, string> = {
  EFECTIVO: 'Efectivo',
  TARJETA: 'Tarjeta',
  TRANSFERENCIA: 'Transferencia',
  CHEQUE: 'Cheque',
  OTRO: 'Otro',
}

export function getPaymentMethodLabel(method: string): string {
  return METHOD_LABELS[method as PaymentMethod] ?? method
}

// ──────────────────────────────────────────────────────────────────
// ARCH-20260630-02: Plantilla y helper para WhatsApp Web URL
// ──────────────────────────────────────────────────────────────────

/**
 * Normaliza un teléfono a formato E.164 sin signos para wa.me.
 * Acepta formatos: +5215512345678, 5215512345678, 15512345678, etc.
 */
export function normalizeWhatsAppPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  // Si no trae código de país (52 por defecto México), prefijar.
  if (digits.length === 10) return `52${digits}`
  if (digits.length === 12 && digits.startsWith('52')) return digits
  return digits
}

/**
 * Construye URL de WhatsApp Web con mensaje prellenado y link al PDF.
 * No adjunta archivo directamente — WhatsApp Web no lo soporta por URL scheme,
 * por eso pasamos el link de descarga temporal del PDF en el mensaje.
 */
export function buildWhatsAppShareUrl(
  phone: string,
  message: string
): string {
  const normalizedPhone = normalizeWhatsAppPhone(phone)
  const encodedMessage = encodeURIComponent(message)
  return `https://wa.me/${normalizedPhone}?text=${encodedMessage}`
}

/**
 * Mensaje por defecto del recibo para WhatsApp.
 */
export function buildDefaultReceiptMessage(args: {
  amount: string
  methodLabel: string
  paymentId: string
  workerName: string
  downloadUrl?: string | null
}): string {
  const lines = [
    `Hola, te compartimos el comprobante de pago.`,
    ``,
    `*Trabajador:* ${args.workerName}`,
    `*Monto:* $${args.amount}`,
    `*Método:* ${args.methodLabel}`,
    `*Folio:* ${args.paymentId.slice(0, 8)}`,
  ]
  if (args.downloadUrl) {
    lines.push(``, `📄 *Recibo:* ${args.downloadUrl}`)
  }
  lines.push(``, `— Administración Médica Industrial`)
  return lines.join('\n')
}

export interface PaymentHistoryItem {
  id: string
  amount: string
  method: string
  reference: string | null
  receiptSent: boolean
  receiptEmail: string | null
  createdAt: string
  createdByName: string
  // ARCH-20260630-02: WhatsApp fields
  receiptWhatsAppSent?: boolean
  receiptWhatsAppPhone?: string | null
  receiptWhatsAppAt?: string | null
}