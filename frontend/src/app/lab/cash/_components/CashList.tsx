/**
 * @file Lista de órdenes pendientes de pago — Caja de laboratorio.
 * @id IMPL-20260708-19 — Fase 3 NOVA absorción — G Caja.
 * @backup context/SPECs/SPEC_IMPL-20260707-SLICES-D-G-FINAL.md §2 (FASE 3)
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  getPendingCashOrdersAction,
  type CashPaymentsSummary as _CashPaymentsSummary,
} from "@/actions/lab-cash.actions";
import { registerLabPaymentAction } from "@/actions/lab-cash.actions";
import {
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABEL,
  type PaymentMethod,
} from "@/lib/validations/lab-cash";

interface PendingOrder {
  id: string;
  folio: number | null;
  status: string;
  patientName: string;
  patientCode: string;
  companyName: string | null;
  total: number;
  paidTotal: number;
  balance: number;
  isCourtesy: boolean;
  createdAt: string;
}

export function CashList() {
  const [orders, setOrders] = useState<PendingOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeOrder, setActiveOrder] = useState<PendingOrder | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await getPendingCashOrdersAction();
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      setOrders([]);
      return;
    }
    setOrders(res.data);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch inicial al montar; SPEC FIX-20260729-01-BASELINE.
    load();
  }, [load]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800">Órdenes pendientes de pago</h2>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="px-3 py-1.5 text-xs font-medium rounded border border-slate-300 text-slate-700 hover:bg-slate-50"
        >
          {loading ? "Cargando..." : "🔄 Refrescar"}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      {loading && orders.length === 0 && (
        <p className="text-xs text-slate-500">Cargando órdenes...</p>
      )}

      {!loading && orders.length === 0 && !error && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 text-center">
          <p className="text-sm text-slate-600">
            ✨ No hay órdenes pendientes de pago.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {orders.map((o) => (
          <div
            key={o.id}
            className="bg-white rounded-lg shadow-sm border border-slate-200 p-3"
          >
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="text-xs font-bold text-slate-800">
                  Folio {o.folio ?? "s/folio"}
                </div>
                <div className="text-xs text-slate-600">
                  {o.patientName}{" "}
                  <span className="text-slate-400 font-mono">[{o.patientCode}]</span>
                </div>
                {o.companyName && (
                  <div className="text-[10px] text-slate-500">{o.companyName}</div>
                )}
              </div>
              <span
                className={`px-2 py-0.5 text-[10px] font-medium rounded border ${
                  o.isCourtesy
                    ? "bg-amber-100 text-amber-800 border-amber-300"
                    : o.balance === 0
                    ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                    : "bg-red-100 text-red-800 border-red-300"
                }`}
              >
                {o.isCourtesy ? "CORTESÍA" : o.balance === 0 ? "PAGADO" : "PENDIENTE"}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-1 mb-2 text-center text-[10px]">
              <div className="bg-slate-50 rounded p-1">
                <div className="text-slate-500 uppercase">Total</div>
                <div className="font-bold text-slate-800">${o.total.toFixed(2)}</div>
              </div>
              <div className="bg-emerald-50 rounded p-1">
                <div className="text-emerald-700 uppercase">Cobrado</div>
                <div className="font-bold text-emerald-700">${o.paidTotal.toFixed(2)}</div>
              </div>
              <div className={`${o.balance > 0 ? "bg-red-50" : "bg-slate-50"} rounded p-1`}>
                <div className={`${o.balance > 0 ? "text-red-700" : "text-slate-500"} uppercase`}>
                  Pendiente
                </div>
                <div className={`font-bold ${o.balance > 0 ? "text-red-700" : "text-slate-800"}`}>
                  ${o.balance.toFixed(2)}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <Link
                href={`/lab/results/${o.id}`}
                className="text-[10px] text-blue-700 hover:underline"
              >
                Ver detalle →
              </Link>
              {o.balance > 0 && !o.isCourtesy && (
                <button
                  type="button"
                  onClick={() => setActiveOrder(o)}
                  className="px-2 py-1 text-[10px] font-medium rounded bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  + Pago rápido
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {activeOrder && (
        <QuickPayModal
          order={activeOrder}
          onClose={() => setActiveOrder(null)}
          onSaved={async () => {
            setActiveOrder(null);
            await load();
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modal: pago rápido desde /lab/cash
// ---------------------------------------------------------------------------
function QuickPayModal({
  order,
  onClose,
  onSaved,
}: {
  order: PendingOrder;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [amount, setAmount] = useState<string>(order.balance.toFixed(2));
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [reference, setReference] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const numAmount = Number(amount);
    if (!Number.isFinite(numAmount) || numAmount <= 0) {
      setError("El monto debe ser un número mayor a 0.");
      return;
    }
    setBusy(true);
    const res = await registerLabPaymentAction(order.id, {
      amount: numAmount,
      method,
      reference: reference.trim() || null,
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    await onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl border border-slate-200 w-full max-w-md p-5">
        <div className="mb-3">
          <h3 className="text-base font-semibold text-slate-800">Pago rápido</h3>
          <p className="text-xs text-slate-500">
            Folio {order.folio} · {order.patientName} · Pendiente: ${order.balance.toFixed(2)}
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Monto (MXN)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              autoFocus
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Forma de pago</label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as PaymentMethod)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {PAYMENT_METHOD_LABEL[m]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Referencia (opcional)
            </label>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Ej. últimos 4 dígitos, SPEI ref, cheque #"
              maxLength={200}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          {error && (
            <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="px-3 py-1.5 text-xs font-medium rounded border border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={busy}
              className="px-3 py-1.5 text-xs font-medium rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {busy ? "Guardando..." : "Registrar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}