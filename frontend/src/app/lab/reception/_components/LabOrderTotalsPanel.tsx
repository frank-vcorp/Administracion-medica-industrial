/**
 * @file Panel live de totales (Subtotal / IVA / Total) en admisión LabOrder.
 * @id IMPL-20260701-03 — Slice B Recepción.
 * Usa el helper puro lab-order-totals.ts (single source of truth).
 *
 * IMPL-20260706-02: refactor visual a paleta AMI.
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
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 text-sm">
      <div className="flex justify-between py-1 text-slate-700">
        <span>Subtotal:</span>
        <span className="font-mono">${subtotal.toFixed(2)}</span>
      </div>
      <div className="flex justify-between py-1 text-slate-700">
        <span>IVA ({ivaPct}%):</span>
        <span className="font-mono">${iva.toFixed(2)}</span>
      </div>
      <div className="flex justify-between py-2 border-t border-slate-200 mt-1 text-lg font-bold text-slate-800">
        <span>TOTAL:</span>
        <span className="font-mono text-blue-700">${total.toFixed(2)}</span>
      </div>
    </div>
  );
}