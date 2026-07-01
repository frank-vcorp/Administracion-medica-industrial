/**
 * @file Panel de fecha y hora de entrega de resultados.
 * @id IMPL-20260701-03 — Slice B Recepción.
 */
"use client";

interface Props {
  deliveryDate?: string | null;
  deliveryTime?: string | null;
  onChange: (next: { deliveryDate?: string | null; deliveryTime?: string | null }) => void;
  readOnly?: boolean;
}

export function LabOrderDeliveryPanel({ deliveryDate, deliveryTime, onChange, readOnly }: Props) {
  return (
    <div className="border rounded bg-white p-3 flex items-end gap-3 text-sm">
      <div className="flex-1">
        <label className="block text-xs font-medium text-gray-700 mb-1">Fecha entrega</label>
        <input
          type="date"
          value={deliveryDate ?? ""}
          disabled={readOnly}
          onChange={(e) => onChange({ deliveryDate: e.target.value, deliveryTime })}
          className="w-full px-2 py-1 border rounded text-sm"
        />
      </div>
      <div className="flex-1">
        <label className="block text-xs font-medium text-gray-700 mb-1">Hora entrega</label>
        <input
          type="time"
          value={deliveryTime ?? ""}
          disabled={readOnly}
          onChange={(e) => onChange({ deliveryDate, deliveryTime: e.target.value })}
          className="w-full px-2 py-1 border rounded text-sm"
        />
      </div>
    </div>
  );
}
