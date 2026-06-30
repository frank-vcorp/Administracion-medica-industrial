/**
 * @fileoverview Constantes y tipos compartidos del módulo de pagos (ARCH-20260630-01)
 * @description Separado de payment.actions.ts porque los archivos 'use server'
 *              solo permiten exportar funciones async.
 * @id IMPL-20260630-01
 * @spec context/SPECs/SPEC_ARCH-20260630-01-MODAL-PAGO-RECIBO-PAPELETA.md
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

export interface PaymentHistoryItem {
  id: string
  amount: string
  method: string
  reference: string | null
  receiptSent: boolean
  receiptEmail: string | null
  createdAt: string
  createdByName: string
}