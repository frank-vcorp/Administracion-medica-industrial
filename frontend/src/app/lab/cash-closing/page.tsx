/**
 * @file Página de Reporte de cierre de caja — Fase 3 NOVA absorción (G).
 * @id IMPL-20260708-19
 * @backup context/SPECs/SPEC_IMPL-20260707-SLICES-D-G-FINAL.md §2 (FASE 3)
 */
import Link from "next/link";
import { ClosingReport } from "./_components/ClosingReport";

export const dynamic = "force-dynamic";

export default function LabCashClosingPage() {
  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Corte de Caja</h1>
          <p className="text-sm text-slate-500">
            Reporte consolidado por rango de fechas con totales y desglose por método de pago.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/lab/cash"
            className="px-3 py-1.5 text-xs font-medium rounded border border-slate-300 text-slate-700 bg-white hover:bg-slate-50"
          >
            ← Volver a Caja
          </Link>
        </div>
      </div>

      <ClosingReport />
    </div>
  );
}