/**
 * @file Sección de pagos para una LabOrder (Fase 3 NOVA — G Caja).
 * @id IMPL-20260708-19
 * @backup context/SPECs/SPEC_IMPL-20260707-SLICES-D-G-FINAL.md §2 (FASE 3)
 *
 * Lista los pagos existentes de la LabOrder + botón "Registrar pago"
 * (modal) + total pendiente.
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getLabPaymentsAction,
  registerLabPaymentAction,
  type CashPaymentsSummary,
} from "@/actions/lab-cash.actions";
import {
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABEL,
  type PaymentMethod,
} from "@/lib/validations/lab-cash";

interface Props {
  orderId: string;
  refreshKey?: number;
}

export function PaymentSection({ orderId, refreshKey = 0 }: Props) {
  const [summary, setSummary] = useState<CashPaymentsSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await getLabPaymentsAction(orderId);
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      setSummary(null);
      return;
    }
    setSummary(res.data);
  }, [orderId]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h3 className="text-base font-semibold text-slate-800">Pagos</h3>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="px-3 py-1.5 text-xs font-medium rounded bg-emerald-600 text-white hover:bg-emerald-700"
        >
          + Registrar pago
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 mb-3">
          {error}
        </div>
      )}
      {message && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700 mb-3">
          {message}
        </div>
      )}

      {loading && !summary && (
        <p className="text-xs text-slate-500">Cargando pagos...</p>
      )}

      {summary && (
        <>
          {/* Totales */}
          <div className="grid grid-cols-3 gap-2 mb-3 text-center">
            <div className="bg-slate-50 rounded p-2">
              <div className="text-[10px] uppercase tracking-wider text-slate-500">Total</div>
              <div className="text-sm font-bold text-slate-800">${summary.orderTotal.toFixed(2)}</div>
            </div>
            <div className="bg-emerald-50 rounded p-2">
              <div className="text-[10px] uppercase tracking-wider text-emerald-700">Cobrado</div>
              <div className="text-sm font-bold text-emerald-700">${summary.paidTotal.toFixed(2)}</div>
            </div>
            <div className={`${summary.balance > 0 ? "bg-red-50" : "bg-slate-50"} rounded p-2`}>
              <div className={`text-[10px] uppercase tracking-wider ${summary.balance > 0 ? "text-red-700" : "text-slate-500"}`}>
                Pendiente
              </div>
              <div className={`text-sm font-bold ${summary.balance > 0 ? "text-red-700" : "text-slate-800"}`}>
                ${summary.balance.toFixed(2)}
              </div>
            </div>
          </div>

          {/* Lista de pagos */}
          {summary.rows.length === 0 ? (
            <p className="text-xs text-slate-500 italic">Aún no hay pagos registrados.</p>
          ) : (
            <ul className="space-y-2">
              {summary.rows.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between gap-2 px-3 py-2 bg-slate-50 rounded border border-slate-200"
                >
                  <div className="flex-1">
                    <div className="text-xs font-medium text-slate-800">
                      {PAYMENT_METHOD_LABEL[r.method as PaymentMethod] ?? r.method}
                      {r.reference && (
                        <span className="ml-2 text-[10px] text-slate-500 font-mono">
                          ref: {r.reference}
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {new Date(r.createdAt).toLocaleString()}
                      {r.userFullName && <> · por {r.userFullName}</>}
                    </div>
                  </div>
                  <div className="text-sm font-bold text-slate-800">${r.amount.toFixed(2)}</div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {showModal && summary && (
        <PaymentModal
          orderId={orderId}
          defaultAmount={Math.max(0, summary.balance)}
          onClose={() => setShowModal(false)}
          onSaved={async () => {
            setShowModal(false);
            setMessage("Pago registrado.");
            await load();
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modal: registrar pago
// ---------------------------------------------------------------------------
function PaymentModal({
  orderId,
  defaultAmount,
  onClose,
  onSaved,
}: {
  orderId: string;
  defaultAmount: number;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [amount, setAmount] = useState<string>(defaultAmount > 0 ? defaultAmount.toFixed(2) : "");
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
    const res = await registerLabPaymentAction(orderId, {
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
        <h3 className="text-base font-semibold text-slate-800 mb-3">Registrar pago</h3>
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