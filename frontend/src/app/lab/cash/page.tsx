/**
 * @file Página de Caja de laboratorio — lista de órdenes pendientes de pago.
 * @id IMPL-20260708-19 — Fase 3 NOVA absorción (G).
 * @backup context/SPECs/SPEC_IMPL-20260707-SLICES-D-G-FINAL.md §2 (FASE 3)
 */
import Link from "next/link";
import { CashList } from "./_components/CashList";

export const dynamic = "force-dynamic";

export default function LabCashPage() {
  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Caja de Laboratorio</h1>
          <p className="text-sm text-slate-500">
            Órdenes activas con saldo pendiente. Registra pagos rápidos o abre el detalle.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/lab/cash-closing"
            className="px-3 py-1.5 text-xs font-medium rounded border border-slate-300 text-slate-700 bg-white hover:bg-slate-50"
          >
            📊 Corte de caja
          </Link>
          <Link
            href="/lab/results"
            className="px-3 py-1.5 text-xs font-medium rounded border border-slate-300 text-slate-700 bg-white hover:bg-slate-50"
          >
            📋 Worklist
          </Link>
        </div>
      </div>

      <CashList />
    </div>
  );
}