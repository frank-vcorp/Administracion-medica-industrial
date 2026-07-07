/**
 * @file Tabla semántica HTML para los 8 mods LIS (sin jQuery DataTables).
 * @id IMPL-20260630-06 — Slice A NOVA absorción (ARCH-20260630-02).
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  listLabCatalogActionV2,
  deleteLabCatalogAction,
} from "@/actions/lab-catalog.actions";
import { type LabCatalogMod } from "@/lib/validations/lab-catalog";
import type { CatalogDef } from "../_lib/catalog-defs";

type Item = Record<string, unknown>;

export default function CatalogTable({
  mod,
  def,
  onEdit,
}: {
  mod: LabCatalogMod;
  def: CatalogDef;
  onEdit: (item: Item) => void;
}) {
  const [items, setItems] = useState<Item[]>([]);
  const [recordsTotal, setRecordsTotal] = useState(0);
  const [recordsFiltered, setRecordsFiltered] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0); // 0-based
  const [pageSize] = useState(10);
  const [orderDir, setOrderDir] = useState<"asc" | "desc">("asc");
  const [orderColumn, setOrderColumn] = useState(0);
  const [pendingDelete, setPendingDelete] = useState<Item | null>(null);
  const [actionInProgress, setActionInProgress] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await listLabCatalogActionV2({
      mod,
      draw: page + 1,
      start: page * pageSize,
      length: pageSize,
      search,
      orderColumn,
      orderDir,
    });
    if (result.ok) {
      setItems(result.data.data as Item[]);
      setRecordsTotal(result.data.recordsTotal);
      setRecordsFiltered(result.data.recordsFiltered);
    } else {
      setError(result.error);
      setItems([]);
    }
    setLoading(false);
  }, [mod, page, pageSize, search, orderColumn, orderDir]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // Reset a página 0 cuando cambia el mod o búsqueda
  useEffect(() => {
    setPage(0);
  }, [mod, search]);

  const totalPages = Math.max(1, Math.ceil(recordsFiltered / pageSize));

  function handleSort(colIdx: number) {
    if (colIdx === orderColumn) {
      setOrderDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setOrderColumn(colIdx);
      setOrderDir("asc");
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    const id = String(pendingDelete.id);
    setActionInProgress(true);
    const result = await deleteLabCatalogAction({ mod, id });
    setActionInProgress(false);
    if (result.ok) {
      setPendingDelete(null);
      await fetchData();
    } else {
      setError(result.error);
      setPendingDelete(null);
    }
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
      {/* Buscador */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 p-4 border-b border-slate-200">
        <div>
          <h3 className="text-base font-semibold text-slate-800">{def.label}</h3>
          <p className="text-xs text-slate-500">
            {recordsFiltered} resultado{recordsFiltered === 1 ? "" : "s"}
            {recordsTotal !== recordsFiltered && ` (de ${recordsTotal} totales)`}
          </p>
        </div>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`Buscar en ${def.label.toLowerCase()}…`}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-full md:w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              {def.tableColumns.map((col, idx) => (
                <th
                  key={col.key}
                  scope="col"
                  className="px-4 py-2 text-left text-xs font-medium text-slate-600 uppercase tracking-wider cursor-pointer select-none"
                  onClick={() => col.sortable !== false && handleSort(idx)}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    {orderColumn === idx && (
                      <span className="text-blue-600">{orderDir === "asc" ? "▲" : "▼"}</span>
                    )}
                  </span>
                </th>
              ))}
              <th scope="col" className="px-4 py-2 text-right text-xs font-medium text-slate-600 uppercase tracking-wider">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-100">
            {loading && (
              <tr>
                <td colSpan={def.tableColumns.length + 1} className="px-4 py-8 text-center text-sm text-slate-500">
                  Cargando…
                </td>
              </tr>
            )}
            {!loading && error && (
              <tr>
                <td colSpan={def.tableColumns.length + 1} className="px-4 py-8 text-center text-sm text-red-600">
                  Error: {error}
                </td>
              </tr>
            )}
            {!loading && !error && items.length === 0 && (
              <tr>
                <td colSpan={def.tableColumns.length + 1} className="px-4 py-12 text-center text-sm text-slate-500">
                  Sin resultados. Use "+ Nuevo" para crear el primer registro.
                </td>
              </tr>
            )}
            {!loading &&
              !error &&
              items.map((item, rowIdx) => (
                <tr key={String(item.id) || rowIdx} className="hover:bg-slate-50">
                  {def.tableColumns.map((col) => {
                    const raw = item[col.key];
                    return (
                      <td key={col.key} className="px-4 py-2 text-sm text-slate-700 whitespace-nowrap">
                        {col.render ? col.render(raw) : raw === null || raw === undefined ? "—" : String(raw)}
                      </td>
                    );
                  })}
                  <td className="px-4 py-2 text-sm text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => onEdit(item)}
                      className="text-blue-600 hover:text-blue-800 font-medium mr-3"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingDelete(item)}
                      className="text-red-600 hover:text-red-800 font-medium"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      <div className="flex items-center justify-between p-3 border-t border-slate-200 text-sm">
        <span className="text-slate-500">
          Página {page + 1} de {totalPages}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="px-3 py-1 rounded-lg border border-slate-300 bg-white text-slate-700 disabled:opacity-50 hover:bg-slate-50"
          >
            ← Anterior
          </button>
          {Array.from({ length: totalPages }, (_, i) => i)
            .filter((i) => Math.abs(i - page) <= 2)
            .map((i) => (
              <button
                key={i}
                type="button"
                onClick={() => setPage(i)}
                className={`px-3 py-1 rounded-lg border ${
                  i === page
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                }`}
              >
                {i + 1}
              </button>
            ))}
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="px-3 py-1 rounded-lg border border-slate-300 bg-white text-slate-700 disabled:opacity-50 hover:bg-slate-50"
          >
            Siguiente →
          </button>
        </div>
      </div>

      {/* Modal de confirmación de borrado */}
      {pendingDelete && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-slate-800">¿Eliminar registro?</h3>
            <p className="mt-2 text-sm text-slate-600">
              Vas a desactivar el elemento{" "}
              <span className="font-medium">
                {String(pendingDelete[def.idDisplayKey] ?? pendingDelete.id)}
              </span>{" "}
              del catálogo <strong>{def.label}</strong>. Esta acción es un soft delete
              (active=false) y es reversible por un administrador.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                disabled={actionInProgress}
                className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 text-sm hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={actionInProgress}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {actionInProgress ? "Eliminando…" : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}