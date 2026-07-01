/**
 * @file Listado paginado de LabOrders (panel derecho en /lab/reception).
 * @id IMPL-20260701-03 — Slice B Recepción.
 *
 * Server Component: carga inicial vía listLabOrdersAction en mount.
 * Mantenerlo mínimo: tabla + paginación + acciones Ver/Editar/Cancelar.
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
    <div className="border rounded bg-white">
      <div className="px-3 py-2 border-b bg-gray-50 flex items-center justify-between">
        <h3 className="font-semibold text-sm">Órdenes recientes</h3>
        <span className="text-xs text-gray-500">{recordsTotal} total</span>
      </div>
      <div className="p-2 border-b">
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
          className="w-full px-2 py-1 border rounded text-xs"
        />
      </div>
      {error && (
        <div className="px-3 py-2 text-xs text-red-700 bg-red-50 border-b">
          {error}
        </div>
      )}
      <table className="w-full text-xs">
        <thead className="bg-gray-100">
          <tr>
            <th className="px-2 py-1 text-left">Folio</th>
            <th className="px-2 py-1 text-left">Paciente</th>
            <th className="px-2 py-1 text-right">Total</th>
            <th className="px-2 py-1">Estado</th>
            <th className="px-2 py-1">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {loading && (
            <tr>
              <td colSpan={5} className="px-2 py-3 text-center text-gray-500 italic">
                Cargando...
              </td>
            </tr>
          )}
          {!loading && rows.length === 0 && (
            <tr>
              <td colSpan={5} className="px-2 py-3 text-center text-gray-500 italic">
                Sin órdenes. Crea una con el formulario.
              </td>
            </tr>
          )}
          {rows.map((r) => (
            <tr key={r.id} className="border-t">
              <td className="px-2 py-1 font-mono">{r.folio ?? "—"}</td>
              <td className="px-2 py-1">{r.paciente ?? "—"}</td>
              <td className="px-2 py-1 text-right">${Number(r.total ?? 0).toFixed(2)}</td>
              <td className="px-2 py-1 text-center">
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] ${
                    r.status === "DRAFT"
                      ? "bg-yellow-100 text-yellow-800"
                      : r.status === "SAVED"
                      ? "bg-blue-100 text-blue-800"
                      : r.status === "CANCELLED"
                      ? "bg-red-100 text-red-800"
                      : "bg-gray-100 text-gray-800"
                  }`}
                >
                  {r.status}
                </span>
              </td>
              <td className="px-2 py-1 text-center space-x-1">
                <button
                  type="button"
                  onClick={() => onVer(r.id)}
                  disabled={busyId === r.id}
                  className="text-blue-700 hover:underline"
                  title="Ver"
                >
                  Ver
                </button>
                {r.status === "DRAFT" && (
                  <button
                    type="button"
                    onClick={() => router.push(`/lab/reception?edit=${r.id}`)}
                    className="text-amber-700 hover:underline"
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
                    className="text-red-700 hover:underline"
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
      <div className="p-2 border-t flex items-center justify-between text-xs">
        <button
          type="button"
          onClick={() => {
            setStart(Math.max(0, start - length));
            setDraw(draw + 1);
          }}
          disabled={start === 0}
          className="px-2 py-1 border rounded disabled:opacity-50"
        >
          ← Anterior
        </button>
        <span className="text-gray-500">
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
          className="px-2 py-1 border rounded disabled:opacity-50"
        >
          Siguiente →
        </button>
      </div>
    </div>
  );
}
