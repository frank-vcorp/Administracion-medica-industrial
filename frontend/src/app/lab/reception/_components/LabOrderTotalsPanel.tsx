/**
 * @file Panel live de totales (Subtotal / IVA / Total) en admisión LabOrder.
 * @id IMPL-20260701-03 — Slice B Recepción.
 * Usa el helper puro lab-order-totals.ts (single source of truth).
 */
"use client";

import { calculateTotals } from "@/lib/lab-order-totals";
import type { LabOrderItemInput } from "@/lib/validations/lab-order";

interface Props {
  items: LabOrderItemInput[];
  ivaPct?: number;
}

export function LabOrderTotalsPanel({ items, ivaPct = 16 }: Props) {
  const { subtotal, iva, total } = calculateTotals(items, ivaPct);
  return (
    <div className="border rounded bg-gray-50 p-3 text-sm">
      <div className="flex justify-between py-1">
        <span>Subtotal:</span>
        <span className="font-mono">${subtotal.toFixed(2)}</span>
      </div>
      <div className="flex justify-between py-1">
        <span>IVA ({ivaPct}%):</span>
        <span className="font-mono">${iva.toFixed(2)}</span>
      </div>
      <div className="flex justify-between py-2 border-t mt-1 text-lg font-bold">
        <span>TOTAL:</span>
        <span className="font-mono text-blue-700">${total.toFixed(2)}</span>
      </div>
    </div>
  );
}
