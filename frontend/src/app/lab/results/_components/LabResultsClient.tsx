/**
 * @file Cliente principal de /lab/results — orquesta filtros + tabla de órdenes + tabs.
 * @id IMPL-20260707-16 — Slice C Resultados.
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getLabResultsAction } from "@/actions/lab-result.actions";
import type { LabResultStatus } from "@/lib/validations/lab-result";
import { getStatusColor, getStatusLabel } from "@/lib/lab-result-utils";

interface Props {
  initialStatus: string;
}

const TABS: { key: LabResultStatus; label: string }[] = [
  { key: "PENDING", label: "Pendientes" },
  { key: "REPORTED", label: "Reportados" },
  { key: "AUTHORIZED", label: "Autorizados" },
  { key: "VALIDATED", label: "Validados" },
  { key: "INVALIDATED", label: "Inválidos" },
];

interface ResultRow {
  id: string;
  status: LabResultStatus;
  valueNumber: number | null;
  valueText: string | null;
  analyteCode: string | null;
  analyteName: string | null;
  unitSymbol: string | null;
  isOutOfRange: boolean;
  isCritical: boolean;
  createdAt: string;
}

export function LabResultsClient({ initialStatus }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<LabResultStatus>(
    (initialStatus as LabResultStatus) || "PENDING"
  );
  const [rows, setRows] = useState<ResultRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [folioFilter, setFolioFilter] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await getLabResultsAction({
      draw: 1,
      start: 0,
      length: 50,
      search: folioFilter,
      status,
    });
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      setRows([]);
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setRows(res.data.data as any);
  }, [status, folioFilter]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- refetch al cambiar filtros.
    refresh();
  }, [refresh]);

  function handleStatusChange(next: LabResultStatus) {
    setStatus(next);
    const params = new URLSearchParams(searchParams.toString());
    params.set("status", next);
    router.replace(`/lab/results?${params.toString()}`);
  }

  const filtered = search
    ? rows.filter((r) => {
        const q = search.toLowerCase();
        return (
          (r.analyteCode ?? "").toLowerCase().includes(q) ||
          (r.analyteName ?? "").toLowerCase().includes(q) ||
          (r.valueText ?? "").toLowerCase().includes(q)
        );
      })
    : rows;

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-1 overflow-x-auto">
          {TABS.map((t) => {
            const active = status === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => handleStatusChange(t.key)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  active
                    ? "border-blue-600 text-blue-700"
                    : "border-transparent text-slate-600 hover:text-slate-800 hover:border-slate-300"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Filtros */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Buscar</label>
          <input
            type="text"
            placeholder="Analito o valor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Folio LabOrder</label>
          <input
            type="number"
            placeholder="Ej. 1001"
            value={folioFilter}
            onChange={(e) => setFolioFilter(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex items-end">
          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            className="bg-slate-700 hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {loading ? "Cargando..." : "Refrescar"}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      {/* Tabla */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-700 text-xs uppercase tracking-wider">
            <tr>
              <th className="px-3 py-2 text-left">Estado</th>
              <th className="px-3 py-2 text-left">Analito</th>
              <th className="px-3 py-2 text-left">Valor</th>
              <th className="px-3 py-2 text-left">Unidad</th>
              <th className="px-3 py-2 text-left">Flags</th>
              <th className="px-3 py-2 text-left">Capturado</th>
              <th className="px-3 py-2 text-left">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-slate-500 text-sm">
                  {loading ? "Cargando..." : "Sin resultados para este estado"}
                </td>
              </tr>
            )}
            {filtered.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50">
                <td className="px-3 py-2">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded border ${getStatusColor(
                      r.status
                    )}`}
                  >
                    {getStatusLabel(r.status)}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <div className="font-medium text-slate-800">{r.analyteCode ?? "—"}</div>
                  <div className="text-xs text-slate-500">{r.analyteName ?? ""}</div>
                </td>
                <td className="px-3 py-2 font-mono">
                  {r.valueNumber !== null && r.valueNumber !== undefined
                    ? r.valueNumber
                    : r.valueText ?? "—"}
                </td>
                <td className="px-3 py-2 text-slate-600">{r.unitSymbol ?? "—"}</td>
                <td className="px-3 py-2">
                  {r.isCritical && (
                    <span className="inline-block px-2 py-0.5 text-xs font-semibold rounded bg-red-100 text-red-800 border border-red-300">
                      CRÍTICO
                    </span>
                  )}
                  {!r.isCritical && r.isOutOfRange && (
                    <span className="inline-block px-2 py-0.5 text-xs font-semibold rounded bg-amber-100 text-amber-800 border border-amber-300">
                      FUERA DE RANGO
                    </span>
                  )}
                  {!r.isOutOfRange && !r.isCritical && (
                    <span className="inline-block px-2 py-0.5 text-xs text-slate-500">
                      Normal
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-xs text-slate-500">
                  {r.createdAt ? new Date(r.createdAt).toLocaleString() : "—"}
                </td>
                <td className="px-3 py-2">
                  <Link
                    href={`/lab/results/order/${r.id}`}
                    className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                  >
                    Ver
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-500 italic">
        Para ver el detalle de una orden con todos sus analitos, ve a{" "}
        <Link href="/lab/reception" className="text-blue-600 hover:underline">
          Recepción
        </Link>{" "}
        y selecciona una LabOrder confirmada.
      </p>
    </div>
  );
}