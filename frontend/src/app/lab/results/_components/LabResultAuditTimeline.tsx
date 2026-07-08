/**
 * @file Timeline de auditoría de LabResult para una LabOrder.
 * @id IMPL-20260707-16 — Slice C Resultados.
 *
 * Carga todas las LabResult de la orden y muestra sus eventos de auditoría.
 */
"use client";

import { useEffect, useState } from "react";
import { getLabResultAction } from "@/actions/lab-result.actions";

interface Props {
  orderId: string;
  refreshKey: number;
}

interface AuditEvent {
  id: string;
  action: string;
  fromStatus: string | null;
  toStatus: string | null;
  reason: string | null;
  userId: string;
  createdAt: string | Date;
}

const ACTION_LABEL: Record<string, string> = {
  CREATE: "Creado",
  UPDATE_VALUE: "Valor actualizado",
  REPORT: "Reportado",
  AUTHORIZE: "Autorizado",
  VALIDATE: "Validado",
  INVALIDATE: "Invalidado",
  OUT_OF_RANGE_DETECTED: "Fuera de rango detectado",
};

const ACTION_COLOR: Record<string, string> = {
  CREATE: "bg-slate-100 text-slate-700 border-slate-300",
  UPDATE_VALUE: "bg-blue-100 text-blue-700 border-blue-300",
  REPORT: "bg-blue-100 text-blue-700 border-blue-300",
  AUTHORIZE: "bg-indigo-100 text-indigo-700 border-indigo-300",
  VALIDATE: "bg-emerald-100 text-emerald-700 border-emerald-300",
  INVALIDATE: "bg-red-100 text-red-700 border-red-300",
  OUT_OF_RANGE_DETECTED: "bg-amber-100 text-amber-700 border-amber-300",
};

export function LabResultAuditTimeline({ orderId, refreshKey }: Props) {
  const [events, setEvents] = useState<Array<AuditEvent & { analyteCode: string | null }>>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      // Cargamos los items de la orden + sus LabResults + audits
      const res = await fetch(`/api/v1/lab/results?orderId=${orderId}&draw=1&start=0&length=50`);
      if (!res.ok || cancelled) {
        setLoading(false);
        return;
      }
      const data = await res.json();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows: any[] = data.data ?? [];
      const all: Array<AuditEvent & { analyteCode: string | null }> = [];
      for (const r of rows) {
        const detail = await getLabResultAction(r.id);
        if (detail.ok) {
          for (const a of detail.data.auditEvents) {
            all.push({ ...a, analyteCode: r.analyteCode ?? null });
          }
        }
      }
      if (!cancelled) {
        all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setEvents(all);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orderId, refreshKey]);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
      <h3 className="text-base font-semibold text-slate-800 mb-3">
        Bitácora de Auditoría
      </h3>
      {loading && <p className="text-xs text-slate-500">Cargando eventos...</p>}
      {!loading && events.length === 0 && (
        <p className="text-xs text-slate-500">Sin eventos registrados.</p>
      )}
      <ul className="space-y-2">
        {events.map((e) => (
          <li
            key={e.id}
            className="flex items-start gap-3 border-l-2 border-slate-200 pl-3 py-1"
          >
            <span
              className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded border ${
                ACTION_COLOR[e.action] ?? "bg-slate-100 text-slate-700 border-slate-300"
              }`}
            >
              {ACTION_LABEL[e.action] ?? e.action}
            </span>
            <div className="flex-1 text-xs">
              <div className="text-slate-700">
                {e.analyteCode && (
                  <span className="font-mono mr-2">{e.analyteCode}</span>
                )}
                {e.fromStatus && e.toStatus && e.fromStatus !== e.toStatus && (
                  <span className="text-slate-500">
                    {e.fromStatus} → {e.toStatus}
                  </span>
                )}
              </div>
              {e.reason && (
                <div className="text-slate-600 italic">Motivo: {e.reason}</div>
              )}
              <div className="text-slate-400 mt-0.5">
                {new Date(e.createdAt).toLocaleString()} · user {e.userId.slice(0, 8)}…
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}