/**
 * @file Página principal de Recepción de Laboratorio (Fase 1 — B-v2).
 * @id IMPL-20260707-17 — Fase 1 NOVA absorción (ARCH-20260707-17).
 *
 * IMPL-20260707-17: Vista principal = bandeja de papeletas con EventTest SAMPLE_TAKEN
 * de cat=Laboratorio. Admisión manual queda como fallback (`?mode=manual`).
 *
 * Next.js 16+ requiere `await searchParams`.
 */
import Link from "next/link";
import { InfoBanner } from "@/components/shared/InfoBanner";
import { PendingOrdersTable } from "./_components/PendingOrdersTable";
import { ManualAdmissionForm } from "./_components/ManualAdmissionForm";

export const dynamic = "force-dynamic";

type SP = {
  list?: string;
  orderId?: string;
  edit?: string;
  workerId?: string;
  medicalEventId?: string;
  mode?: string;
  branchId?: string;
};

export default async function LabReceptionPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  const orderId = sp.orderId || sp.edit;
  const isManual = sp.mode === "manual";

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Recepción de Laboratorio</h2>
          <p className="text-sm text-slate-500">
            {isManual
              ? "Admisión manual — pacientes sin papeleta previa."
              : "Bandeja de papeletas con muestras de laboratorio pendientes."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!isManual ? (
            <Link
              href="/lab/reception?mode=manual"
              className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Admisión manual (fallback)
            </Link>
          ) : (
            <Link
              href="/lab/reception"
              className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors"
            >
              ← Volver a bandeja
            </Link>
          )}
        </div>
      </div>

      <InfoBanner
        icon={<span aria-hidden>🧬</span>}
        title="Módulo LAB — Fase 1 — B-v2 bandeja papeletas + E catálogo"
      >
        Backend FastAPI en <code className="bg-slate-100 px-1 rounded text-xs">/api/v1/lab/pending-orders</code>
        {" "}+ <code className="bg-slate-100 px-1 rounded text-xs">/api/v1/medical_tests/lab-catalog</code>.
        Trigger automático al marcar EventTest como SAMPLE_TAKEN.
      </InfoBanner>

      {isManual ? (
        <ManualAdmissionForm orderId={orderId} />
      ) : (
        <PendingOrdersTable initialBranchId={sp.branchId ?? null} />
      )}
    </div>
  );
}