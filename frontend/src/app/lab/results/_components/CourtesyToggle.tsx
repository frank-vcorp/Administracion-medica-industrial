/**
 * @file Toggle de cortesía para una LabOrder (Fase 3 NOVA — G Caja).
 * @id IMPL-20260708-19
 * @backup context/SPECs/SPEC_IMPL-20260707-SLICES-D-G-FINAL.md §2 (FASE 3)
 *
 * Permite marcar una orden como cortesía (cargo 0) con motivo obligatorio.
 * Si ya está marcada, muestra los datos y permite quitarla.
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  clearLabCourtesyAction,
  getLabCourtesyAction,
  markLabCourtesyAction,
  type CourtesyRow,
} from "@/actions/lab-cash.actions";

interface Props {
  orderId: string;
  refreshKey?: number;
}

export function CourtesyToggle({ orderId, refreshKey = 0 }: Props) {
  const [current, setCurrent] = useState<CourtesyRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showInput, setShowInput] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await getLabCourtesyAction(orderId);
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      setCurrent(null);
      return;
    }
    setCurrent(res.data);
  }, [orderId]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  async function handleMark() {
    if (reason.trim().length < 3) {
      setError("El motivo debe tener al menos 3 caracteres.");
      return;
    }
    setError(null);
    setBusy(true);
    const res = await markLabCourtesyAction(orderId, { reason: reason.trim() });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setShowInput(false);
    setReason("");
    await load();
  }

  async function handleClear() {
    if (!confirm("¿Quitar la marca de cortesía de esta orden?")) return;
    setBusy(true);
    const res = await clearLabCourtesyAction(orderId);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    await load();
  }

  if (loading && !current && !showInput) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <h3 className="text-base font-semibold text-slate-800">Cortesía</h3>
        {current ? (
          <button
            type="button"
            onClick={handleClear}
            disabled={busy}
            className="px-3 py-1.5 text-xs font-medium rounded border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {busy ? "..." : "Quitar cortesía"}
          </button>
        ) : showInput ? null : (
          <button
            type="button"
            onClick={() => {
              setShowInput(true);
              setError(null);
            }}
            className="px-3 py-1.5 text-xs font-medium rounded bg-amber-600 text-white hover:bg-amber-700"
          >
            Marcar como cortesía
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 mb-2">
          {error}
        </div>
      )}

      {current && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <div className="font-semibold mb-1">⚠️ Orden marcada como CORTESÍA</div>
          <div>
            <span className="text-amber-700">Motivo:</span> {current.reason}
          </div>
          {current.approvedByFullName && (
            <div>
              <span className="text-amber-700">Aprobado por:</span> {current.approvedByFullName}
            </div>
          )}
          <div className="text-[10px] text-amber-600 mt-1">
            {new Date(current.createdAt).toLocaleString()}
          </div>
        </div>
      )}

      {showInput && !current && (
        <div className="space-y-2">
          <label className="block text-xs font-medium text-slate-700">
            Motivo de la cortesía (mínimo 3 caracteres)
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            maxLength={500}
            autoFocus
            placeholder="Ej. Convenio corporativo VIP / Estudio de control interno"
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setShowInput(false);
                setReason("");
                setError(null);
              }}
              disabled={busy}
              className="px-3 py-1.5 text-xs font-medium rounded border border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleMark}
              disabled={busy || reason.trim().length < 3}
              className="px-3 py-1.5 text-xs font-medium rounded bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {busy ? "Guardando..." : "Confirmar cortesía"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}