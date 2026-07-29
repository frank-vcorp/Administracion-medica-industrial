/**
 * @file Listado paginado de LabOrders (panel derecho en /lab/reception).
 * @id IMPL-20260701-03 — Slice B Recepción.
 *
 * Server Component: carga inicial vía listLabOrdersAction en mount.
 * Mantenerlo mínimo: tabla + paginación + acciones Ver/Editar/Cancelar.
 *
 * IMPL-20260706-02: refactor visual a paleta AMI.
 */
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  cancelLabOrderAction,
  getLabOrderAction,
  listLabOrdersAction,
} from "@/actions/lab-order.actions";

interface LabOrderRow {
  id: string;
  folio?: number | null;
  fecha?: string | null;
  paciente?: string | null;
  medico?: string | null;
  empresa?: string | null;
  total: number;
  status: string;
  itemCount?: number;
}

function statusBadge(status: string): string {
  switch (status) {
    case "DRAFT":
      return "bg-amber-100 text-amber-800";
    case "SAVED":
      return "bg-blue-100 text-blue-800";
    case "CANCELLED":
      return "bg-red-100 text-red-800";
    default:
      return "bg-slate-100 text-slate-800";
  }
}

export function LabOrdersList() {
  const router = useRouter();
  const [rows, setRows] = useState<LabOrderRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draw, setDraw] = useState(1);
  const [length] = useState(25);
  const [start, setStart] = useState(0);
  const [recordsTotal, setRecordsTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    const result = await listLabOrdersAction({
      draw,
      start,
      length,
      search: search || undefined,
    });
    if (!result.ok) {
      setError(result.error);
      setRows([]);
    } else {
      setRows(result.data.data as unknown as LabOrderRow[]);
      setRecordsTotal(result.data.recordsFiltered);
    }
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- recarga cliente al cambiar draw/start (DataTable server-side).
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draw, start]);

  async function onVer(id: string) {
    setBusyId(id);
    const res = await getLabOrderAction(id);
    setBusyId(null);
    if (res.ok) {
      router.push(`/lab/reception?orderId=${id}`);
    } else {
      alert(`No se pudo cargar: ${res.error}`);
    }
  }

  async function onCancelar(id: string) {
    const motivo = prompt("Motivo de cancelación (min 3 caracteres):");
    if (!motivo) return;
    setBusyId(id);
    const res = await cancelLabOrderAction(id, motivo);
    setBusyId(null);
    if (!res.ok) {
      alert(`Error: ${res.error}`);
    } else {
      void load();
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
        <h3 className="font-semibold text-sm text-slate-800">Órdenes recientes</h3>
        <span className="text-xs text-slate-500">{recordsTotal} total</span>
      </div>
      <div className="p-3 border-b border-slate-200">
        <input
          type="text"
          placeholder="Buscar paciente / folio / médico..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              setDraw(1);
              setStart(0);
              void load();
            }
          }}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      {error && (
        <div className="px-4 py-2 text-xs text-red-700 bg-red-50 border-b border-red-200">
          {error}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-slate-700">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Folio
              </th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Paciente
              </th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Total
              </th>
              <th className="px-3 py-2 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Estado
              </th>
              <th className="px-3 py-2 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-slate-500 italic">
                  Cargando…
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-slate-500 italic">
                  Sin órdenes. Crea una con el formulario.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50">
                <td className="px-3 py-2 font-mono text-slate-600">{r.folio ?? "—"}</td>
                <td className="px-3 py-2 text-slate-800">{r.paciente ?? "—"}</td>
                <td className="px-3 py-2 text-right">
                  ${Number(r.total ?? 0).toFixed(2)}
                </td>
                <td className="px-3 py-2 text-center">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold ${statusBadge(
                      r.status
                    )}`}
                  >
                    {r.status}
                  </span>
                </td>
                <td className="px-3 py-2 text-center space-x-2 whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => onVer(r.id)}
                    disabled={busyId === r.id}
                    className="text-blue-600 hover:text-blue-800 font-medium"
                    title="Ver"
                  >
                    Ver
                  </button>
                  {r.status === "DRAFT" && (
                    <button
                      type="button"
                      onClick={() => router.push(`/lab/reception?edit=${r.id}`)}
                      className="text-amber-700 hover:text-amber-900 font-medium"
                      title="Editar"
                    >
                      Editar
                    </button>
                  )}
                  {r.status === "DRAFT" && (
                    <button
                      type="button"
                      onClick={() => onCancelar(r.id)}
                      disabled={busyId === r.id}
                      className="text-red-600 hover:text-red-800 font-medium"
                      title="Cancelar"
                    >
                      ×
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="p-3 border-t border-slate-200 flex items-center justify-between text-xs">
        <button
          type="button"
          onClick={() => {
            setStart(Math.max(0, start - length));
            setDraw(draw + 1);
          }}
          disabled={start === 0}
          className="px-3 py-1 border border-slate-300 rounded-lg bg-white text-slate-700 disabled:opacity-50 hover:bg-slate-50 transition-colors"
        >
          ← Anterior
        </button>
        <span className="text-slate-500">
          {start + 1} – {Math.min(start + length, recordsTotal)}
        </span>
        <button
          type="button"
          onClick={() => {
            if (start + length < recordsTotal) {
              setStart(start + length);
              setDraw(draw + 1);
            }
          }}
          disabled={start + length >= recordsTotal}
          className="px-3 py-1 border border-slate-300 rounded-lg bg-white text-slate-700 disabled:opacity-50 hover:bg-slate-50 transition-colors"
        >
          Siguiente →
        </button>
      </div>
    </div>
  );
}