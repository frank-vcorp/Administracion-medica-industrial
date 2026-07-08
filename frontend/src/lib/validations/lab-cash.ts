/**
 * @file Schemas Zod para Fase 3 NOVA — F (PDF) + G (Caja, Cortesías).
 * @id IMPL-20260708-19
 * @backup context/SPECs/SPEC_IMPL-20260707-SLICES-D-G-FINAL.md §2 (FASE 3)
 *
 * Réplica 1:1 del enum PaymentMethod en backend/app/schemas/lab_cash.py.
 */
import { z } from "zod";

// ---------------------------------------------------------------------------
// PaymentMethod
// ---------------------------------------------------------------------------
export const paymentMethodSchema = z.enum([
  "CASH",
  "CARD",
  "TRANSFER",
  "CHECK",
  "OTHER",
]);
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;

export const PAYMENT_METHODS: PaymentMethod[] = [
  "CASH",
  "CARD",
  "TRANSFER",
  "CHECK",
  "OTHER",
];

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  CASH: "Efectivo",
  CARD: "Tarjeta",
  TRANSFER: "Transferencia",
  CHECK: "Cheque",
  OTHER: "Otro",
};

// ---------------------------------------------------------------------------
// Register payment (POST /orders/{id}/payments)
// ---------------------------------------------------------------------------
export const registerPaymentSchema = z.object({
  amount: z
    .number({ message: "Monto debe ser numérico" })
    .positive("El monto debe ser mayor a 0")
    .finite("Monto debe ser finito")
    .max(99999999.99, "Monto fuera de rango"),
  method: paymentMethodSchema,
  reference: z.string().max(200).optional().nullable(),
  currency: z.string().max(8).optional().nullable(),
});
export type RegisterPaymentInput = z.infer<typeof registerPaymentSchema>;

// ---------------------------------------------------------------------------
// Mark courtesy (POST /orders/{id}/courtesy)
// ---------------------------------------------------------------------------
export const markCourtesySchema = z.object({
  reason: z
    .string()
    .min(3, "El motivo debe tener al menos 3 caracteres")
    .max(500, "El motivo no puede exceder 500 caracteres"),
});
export type MarkCourtesyInput = z.infer<typeof markCourtesySchema>;

// ---------------------------------------------------------------------------
// Cash closing query
// ---------------------------------------------------------------------------
export const cashClosingQuerySchema = z.object({
  dateFrom: z.string().optional().nullable(),
  dateTo: z.string().optional().nullable(),
});
export type CashClosingQueryInput = z.infer<typeof cashClosingQuerySchema>;