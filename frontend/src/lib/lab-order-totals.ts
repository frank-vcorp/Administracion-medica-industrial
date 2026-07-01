/**
 * @file Helper puro para cálculo de totales de una LabOrder.
 * @id IMPL-20260701-03 — Slice B NOVA absorción (ARCH-20260701-03).
 * @backup context/SPECs/SPEC_IMPL-20260701-SLICE-B-RECEPCION.md
 *
 * Single source of truth cliente/servidor. El backend Python
 * (backend/app/services/lab_order_service.py::calculate_totals) reusa
 * la misma fórmula. Cualquier cambio debe replicarse en ambos.
 */
export interface LabOrderItemAmountInput {
  price: number;
  discountAmount?: number;
  discountPct?: number;
}

export interface LabOrderTotals {
  subtotal: number;
  iva: number;
  total: number;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

export function calculateItemAmount(
  price: number,
  discountAmount: number = 0,
  discountPct: number = 0
): number {
  const pctDiscount = (price || 0) * ((discountPct || 0) / 100);
  return round2(Math.max(0, (price || 0) - (discountAmount || 0) - pctDiscount));
}

export function calculateTotals(
  items: LabOrderItemAmountInput[],
  ivaPct: number = 16
): LabOrderTotals {
  const subtotal = (items || []).reduce(
    (sum, i) => sum + calculateItemAmount(i.price, i.discountAmount ?? 0, i.discountPct ?? 0),
    0
  );
  const iva = round2(subtotal * ((ivaPct || 0) / 100));
  const total = round2(subtotal + iva);
  return {
    subtotal: round2(subtotal),
    iva,
    total,
  };
}
