/**
 * @file Client component que renderiza el checklist de cutover.
 * @id IMPL-20260708-FINAL — Fase 4 NOVA absorción (I Cutover y deprecación).
 * @backup context/SPECs/MIGRATION-NOVA-MAPPING.md
 *
 * Muestra:
 *  - Estado global (listo / pendiente)
 *  - Tabla con los 9 slices del roadmap
 *  - Lista de acciones operativas para Frank
 *  - Confirmación de AMI como sistema único
 */
"use client";

import type { FC } from "react";

type SliceStatus = "closed" | "partial" | "in_progress" | "pending";

type CutoverStatus = {
  ready: boolean;
  slices: Record<string, SliceStatus>;
  completed: string[];
  pending: string[];
  nova_deprecated: boolean;
  next_actions: string[];
};

const SLICE_DESCRIPTIONS: Record<string, string> = {
  A: "Catálogos base (unidades, muestras, recipientes, métodos, etc.)",
  "B-v2": "Recepción con bandeja de papeletas + trigger SAMPLE_TAKEN",
  C: "Captura de resultados y ciclo P/R/A/V",
  D: "Trazabilidad muestra→proceso→entrega",
  E: "Catálogo avanzado de estudios + seed de 5 típicos",
  F: "Reportes PDF (etiquetas, resultados, recibos)",
  G: "Caja, cortesías y corte de caja",
  H: "Migración de datos NOVA (catálogos + órdenes del último mes)",
  I: "Cutover y deprecación NOVA",
};

const STATUS_LABEL: Record<SliceStatus, string> = {
  closed: "Cerrado",
  partial: "Parcial",
  in_progress: "En curso",
  pending: "Pendiente",
};

const STATUS_BADGE: Record<SliceStatus, string> = {
  closed: "bg-emerald-100 text-emerald-800 border-emerald-300",
  partial: "bg-amber-100 text-amber-800 border-amber-300",
  in_progress: "bg-sky-100 text-sky-800 border-sky-300",
  pending: "bg-slate-100 text-slate-700 border-slate-300",
};

const Props: FC<{ status: CutoverStatus }> = ({ status }) => {
  const sliceEntries = Object.entries(status.slices);
  const closedCount = status.completed.length;

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      <header className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-bold text-slate-900">
          Cutover NOVA → AMI
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Estado del roadmap de absorción NOVA → AMI. 9 slices en total.
        </p>
      </header>

      {/* Resumen global */}
      <section
        className={`rounded-lg border p-5 ${
          status.ready
            ? "bg-emerald-50 border-emerald-300 text-emerald-900"
            : "bg-amber-50 border-amber-300 text-amber-900"
        }`}
        data-testid="cutover-summary"
      >
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-lg font-semibold">
              {status.ready
                ? "✅ AMI es el sistema único"
                : `⏳ ${status.pending.length} slice(s) pendiente(s)`}
            </h2>
            <p className="text-sm mt-1">
              {closedCount} de {sliceEntries.length} slices cerrados.
              {status.nova_deprecated
                ? " NOVA está formalmente deprecado."
                : " NOVA sigue siendo la fuente operativa hasta completar el cutover."}
            </p>
          </div>
          <span
            className={`text-xs px-3 py-1 rounded-full font-medium border ${
              status.ready
                ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                : "bg-amber-100 text-amber-800 border-amber-300"
            }`}
            data-testid="cutover-status-badge"
          >
            {status.ready ? "READY" : "IN_PROGRESS"}
          </span>
        </div>
      </section>

      {/* Tabla de slices */}
      <section>
        <h2 className="text-base font-semibold text-slate-800 mb-3">
          Roadmap de absorción (9 fases)
        </h2>
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-sm" data-testid="slices-table">
            <thead className="bg-slate-50 text-slate-700 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-2">Slice</th>
                <th className="text-left px-4 py-2">Descripción</th>
                <th className="text-left px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {sliceEntries.map(([key, statusKey]) => (
                <tr
                  key={key}
                  className="border-t border-slate-200"
                  data-testid={`slice-row-${key}`}
                >
                  <td className="px-4 py-2 font-mono font-medium text-slate-800">
                    {key}
                  </td>
                  <td className="px-4 py-2 text-slate-700">
                    {SLICE_DESCRIPTIONS[key] || "—"}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`inline-block text-xs px-2 py-1 rounded-full font-medium border ${STATUS_BADGE[statusKey as SliceStatus]}`}
                      data-testid={`slice-badge-${key}`}
                    >
                      {STATUS_LABEL[statusKey as SliceStatus]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Acciones operativas */}
      <section>
        <h2 className="text-base font-semibold text-slate-800 mb-3">
          Acciones operativas pendientes
        </h2>
        {status.next_actions.length === 0 ? (
          <div className="rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-900 p-4 text-sm">
            ✅ No hay acciones pendientes. AMI está listo como sistema único.
            Notifica a Lolis / Leticia / Dra. Erika que NOVA Connection
            queda deprecado.
          </div>
        ) : (
          <ol className="space-y-2" data-testid="next-actions-list">
            {status.next_actions.map((action, i) => (
              <li
                key={i}
                className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700"
              >
                <span className="font-medium text-slate-900 mr-2">
                  {i + 1}.
                </span>
                {action}
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* Confirmación de sistema único */}
      <section className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
        <h3 className="font-semibold text-slate-800 mb-2">
          AMI como sistema único
        </h3>
        <p>
          Cuando todos los slices estén <code>closed</code>, AMI captura
          el 100% del flujo de laboratorio: admisión (bandeja de papeletas),
          catálogo LIS, captura de resultados, validación, entrega y caja.
          NOVA Connection queda archivado como fuente histórica y de
          consulta. El banner <em>“NOVA deprecado”</em> se mostrará en
          todas las rutas <code>/admin/lab/*</code> y <code>/lab/*</code>.
        </p>
      </section>
    </div>
  );
};

export default Props;