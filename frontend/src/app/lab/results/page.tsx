/**
 * @file Página principal de Resultados de Laboratorio (Slice C).
 * @id IMPL-20260707-16 — Slice C NOVA absorción.
 *
 * Server Component: lee `?status=` desde searchParams.
 * Layout: filtros + tabs + tabla. La interactividad pesada
 * (DataTables fetch) se delega a LabResultsClient.
 */
import { LabResultsClient } from "./_components/LabResultsClient";
import { InfoBanner } from "@/components/shared/InfoBanner";

export const dynamic = "force-dynamic";

type SP = { status?: string };

export default async function LabResultsPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  const status = sp.status ?? "PENDING";

  return (
    <div className="space-y-6">
      <InfoBanner
        icon={<span aria-hidden>🧪</span>}
        title="Módulo LAB — Slice C — Resultados demo"
      >
        Captura + ciclo P/R/A/V + bitácora auditoría + integración con papeleta AMI.
      </InfoBanner>

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Resultados de Laboratorio</h2>
          <p className="text-sm text-slate-500">
            Hoja de trabajo con analitos, ciclo de vida y bitácora de auditoría.
          </p>
        </div>
      </div>

      <LabResultsClient initialStatus={status} />
    </div>
  );
}