/**
 * @file Timeline de trazabilidad de LabOrder (D — Fase 2 NOVA).
 * @id IMPL-20260707-18
 * @backup context/SPECs/SPEC_IMPL-20260707-SLICES-D-G-FINAL.md §2
 *
 * Muestra cronológicamente los LabTraceEvent de la LabOrder con badges
 * de color por tipo. Carga vía getLabTraceAction y soporta recargar
 * con `refreshKey`.
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getLabTraceAction,
  type LabTraceEventRow,
} from "@/actions/lab-trace.actions";

interface Props {
  orderId: string;
  refreshKey?: number;
}

const EVENT_LABEL: Record<string, string> = {
  SAMPLE_RECEIVED: "Muestra recibida",
  PROCESS_STARTED: "Proceso iniciado",
  ANALYSIS_DONE: "Análisis terminado",
  VALIDATED: "Validado",
  DELIVERED: "Entregado",
};

const EVENT_COLOR: Record<string, string> = {
  SAMPLE_RECEIVED: "bg-sky-100 text-sky-800 border-sky-300",
  PROCESS_STARTED: "bg-indigo-100 text-indigo-800 border-indigo-300",
  ANALYSIS_DONE: "bg-blue-100 text-blue-800 border-blue-300",
  VALIDATED: "bg-emerald-100 text-emerald-800 border-emerald-300",
  DELIVERED: "bg-teal-100 text-teal-800 border-teal-300",
};

const EVENT_ICON: Record<string, string> = {
  SAMPLE_RECEIVED: "🧪",
  PROCESS_STARTED: "⚙️",
  ANALYSIS_DONE: "🔬",
  VALIDATED: "✅",
  DELIVERED: "📤",
};

export function LabTraceTimeline({ orderId, refreshKey = 0 }: Props) {
  const [rows, setRows] = useState<LabTraceEventRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await getLabTraceAction(orderId);
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      setRows([]);
      return;
    }
    setRows(res.data.rows);
  }, [orderId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- recarga intencional del timeline.
    load();
  }, [load, refreshKey]);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-semibold text-slate-800">
          Trazabilidad operativa
        </h3>
        <span className="text-[10px] uppercase tracking-wider text-slate-400 font-mono">
          {rows.length} evento{rows.length === 1 ? "" : "s"}
        </span>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 mb-3">
          {error}
        </div>
      )}

      {loading && rows.length === 0 && (
        <p className="text-xs text-slate-500">Cargando eventos...</p>
      )}

      {!loading && rows.length === 0 && !error && (
        <p className="text-xs text-slate-500">
          Aún no hay eventos registrados. El primero se crea automáticamente al
          confirmar la orden (SAMPLE_RECEIVED).
        </p>
      )}

      <ol className="relative space-y-3 border-l-2 border-slate-200 pl-4">
        {rows.map((r) => {
          const label = EVENT_LABEL[r.event] ?? r.event;
          const color = EVENT_COLOR[r.event] ?? "bg-slate-100 text-slate-700 border-slate-300";
          const icon = EVENT_ICON[r.event] ?? "•";
          return (
            <li key={r.id} className="relative">
              <span className="absolute -left-[22px] top-0.5 w-4 h-4 rounded-full bg-white border-2 border-slate-300 flex items-center justify-center text-[9px]">
                {icon}
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded border ${color}`}
                >
                  {label}
                </span>
                <span className="text-[11px] text-slate-500 font-mono">
                  {new Date(r.timestamp).toLocaleString()}
                </span>
              </div>
              <div className="mt-1 text-[11px] text-slate-600 space-y-0.5">
                {r.userFullName && (
                  <div>
                    <span className="text-slate-400">por</span>{" "}
                    <span className="font-medium text-slate-700">{r.userFullName}</span>
                  </div>
                )}
                {r.location && (
                  <div>
                    <span className="text-slate-400">lugar:</span>{" "}
                    <span className="font-mono">{r.location}</span>
                  </div>
                )}
                {r.notes && (
                  <div className="italic text-slate-600">
                    <span className="text-slate-400 not-italic">notas:</span> {r.notes}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
