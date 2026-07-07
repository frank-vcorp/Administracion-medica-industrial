/**
 * @file Panel de fecha y hora de entrega de resultados.
 * @id IMPL-20260701-03 — Slice B Recepción.
 *
 * IMPL-20260706-02: refactor visual a paleta AMI.
 */
"use client";

interface Props {
  deliveryDate?: string | null;
  deliveryTime?: string | null;
  onChange: (next: { deliveryDate?: string | null; deliveryTime?: string | null }) => void;
  readOnly?: boolean;
}

const INPUT =
  "w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100";
const LABEL = "block text-xs font-medium text-slate-700 mb-1";

export function LabOrderDeliveryPanel({ deliveryDate, deliveryTime, onChange, readOnly }: Props) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 flex flex-col sm:flex-row sm:items-end gap-3 text-sm">
      <div className="flex-1">
        <label className={LABEL}>Fecha entrega</label>
        <input
          type="date"
          value={deliveryDate ?? ""}
          disabled={readOnly}
          onChange={(e) => onChange({ deliveryDate: e.target.value, deliveryTime })}
          className={INPUT}
        />
      </div>
      <div className="flex-1">
        <label className={LABEL}>Hora entrega</label>
        <input
          type="time"
          value={deliveryTime ?? ""}
          disabled={readOnly}
          onChange={(e) => onChange({ deliveryDate, deliveryTime: e.target.value })}
          className={INPUT}
        />
      </div>
    </div>
  );
}