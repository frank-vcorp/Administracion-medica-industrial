/**
 * @file Reporte de corte de caja — Fase 3 NOVA absorción (G).
 * @id IMPL-20260708-19
 * @backup context/SPECs/SPEC_IMPL-20260707-SLICES-D-G-FINAL.md §2 (FASE 3)
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import { getCashClosingAction, type CashClosingReport } from "@/actions/lab-cash.actions";
import { PAYMENT_METHOD_LABEL, type PaymentMethod } from "@/lib/validations/lab-cash";

export function ClosingReport() {
  const [report, setReport] = useState<CashClosingReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  const load = useCallback(async (from?: string, to?: string) => {
    setLoading(true);
    setError(null);
    const res = await getCashClosingAction({
      dateFrom: from || null,
      dateTo: to || null,
    });
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      setReport(null);
      return;
    }
    setReport(res.data);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function handleApplyFilter() {
    load(dateFrom || undefined, dateTo || undefined);
  }

  function handleToday() {
    const today = new Date().toISOString().slice(0, 10);
    setDateFrom(today);
    setDateTo(today);
    load(today, today);
  }

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3">
        <h2 className="text-base font-semibold text-slate-800 mb-2">Corte de caja</h2>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">
              Desde
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-2 py-1.5 text-xs border border-slate-300 rounded"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">
              Hasta
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-2 py-1.5 text-xs border border-slate-300 rounded"
            />
          </div>
          <button
            type="button"
            onClick={handleApplyFilter}
            disabled={loading}
            className="px-3 py-1.5 text-xs font-medium rounded bg-slate-800 text-white hover:bg-slate-900"
          >
            Aplicar
          </button>
          <button
            type="button"
            onClick={handleToday}
            disabled={loading}
            className="px-3 py-1.5 text-xs font-medium rounded border border-slate-300 text-slate-700 hover:bg-slate-50"
          >
            Hoy
          </button>
          <button
            type="button"
            onClick={() => {
              setDateFrom("");
              setDateTo("");
              load();
            }}
            disabled={loading}
            className="px-3 py-1.5 text-xs font-medium rounded border border-slate-300 text-slate-700 hover:bg-slate-50"
          >
            Últimas 24h
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      {loading && !report && (
        <p className="text-xs text-slate-500">Cargando reporte...</p>
      )}

      {report && (
        <>
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
            <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-3">
              Rango: {new Date(report.dateFrom).toLocaleString()} →{" "}
              {new Date(report.dateTo).toLocaleString()}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
              <KpiCard label="Órdenes" value={report.totalOrders} color="slate" />
              <KpiCard label="Facturadas" value={report.billedOrders} color="blue" />
              <KpiCard label="Cortesías" value={report.courtesyOrders} color="amber" />
              <KpiCard label="Pagos" value={report.paymentsCount} color="emerald" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-3">
              <MoneyCard label="Total facturado" value={report.totalBilled} color="slate" />
              <MoneyCard label="Total cobrado" value={report.totalCollected} color="emerald" />
              <MoneyCard
                label="Saldo pendiente"
                value={report.balancePending}
                color={report.balancePending > 0 ? "red" : "emerald"}
              />
            </div>

            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-2">Por método de pago</h3>
              {report.byMethod.length === 0 ? (
                <p className="text-xs text-slate-500 italic">Sin pagos en el rango.</p>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-slate-500 border-b border-slate-200">
                      <th className="py-1.5 font-medium">Método</th>
                      <th className="py-1.5 font-medium text-right">Cantidad</th>
                      <th className="py-1.5 font-medium text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.byMethod.map((row) => (
                      <tr key={row.method} className="border-b border-slate-100">
                        <td className="py-1.5">
                          {PAYMENT_METHOD_LABEL[row.method as PaymentMethod] ?? row.method}
                        </td>
                        <td className="py-1.5 text-right font-mono">{row.count}</td>
                        <td className="py-1.5 text-right font-mono font-medium">
                          ${row.total.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="mt-3 pt-3 border-t border-slate-100 text-[10px] text-slate-400">
              Reporte generado el {new Date(report.generatedAt).toLocaleString()}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: "slate" | "blue" | "amber" | "emerald";
}) {
  const colorClass = {
    slate: "bg-slate-50 text-slate-800",
    blue: "bg-blue-50 text-blue-800",
    amber: "bg-amber-50 text-amber-800",
    emerald: "bg-emerald-50 text-emerald-800",
  }[color];
  return (
    <div className={`${colorClass} rounded p-2 text-center`}>
      <div className="text-[10px] uppercase tracking-wider opacity-70">{label}</div>
      <div className="text-lg font-bold">{value}</div>
    </div>
  );
}

function MoneyCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: "slate" | "emerald" | "red";
}) {
  const colorClass = {
    slate: "bg-slate-50 text-slate-800",
    emerald: "bg-emerald-50 text-emerald-800",
    red: "bg-red-50 text-red-800",
  }[color];
  return (
    <div className={`${colorClass} rounded p-3`}>
      <div className="text-[10px] uppercase tracking-wider opacity-70">{label}</div>
      <div className="text-xl font-bold font-mono">${value.toFixed(2)}</div>
    </div>
  );
}