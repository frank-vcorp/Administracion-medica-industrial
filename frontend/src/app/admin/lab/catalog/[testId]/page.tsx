/**
 * @file Editor especializado de un MedicalTest con sus analitos y rangos.
 * @id IMPL-20260707-17 — Fase 1 NOVA absorción — E.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { InfoBanner } from "@/components/shared/InfoBanner";
import { getLabCatalogTestAction } from "@/actions/study.actions";
import { LabAnalyteEditor } from "../_components/LabAnalyteEditor";

export const dynamic = "force-dynamic";

export default async function LabCatalogTestEditorPage({
  params,
}: {
  params: Promise<{ testId: string }>;
}) {
  const { testId } = await params;
  const result = await getLabCatalogTestAction(testId);
  if (!result.ok) {
    if (result.code === "NOT_FOUND") notFound();
    return (
      <div className="p-8 bg-red-50 border border-red-200 rounded-2xl">
        <h2 className="text-lg font-bold text-red-700 mb-2">Error</h2>
        <p className="text-red-600 text-sm">{result.error}</p>
      </div>
    );
  }
  const test = result.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">
            {test.code} — {test.name}
          </h2>
          <p className="text-sm text-slate-500 font-mono">
            {test.novaClave ?? "—"} · {test.analytes.length} analito(s) ·{" "}
            {test.daysToResult ?? "—"} día(s) resultado
          </p>
        </div>
        <Link
          href="/admin/lab/catalog"
          className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
        >
          ← Volver al catálogo
        </Link>
      </div>

      <InfoBanner
        icon={<span aria-hidden>🧪</span>}
        title="Editor de analitos y rangos de referencia"
      >
        Agregue, edite o elimine analitos del estudio. Cada analito puede tener
        múltiples rangos de referencia por sexo y edad (en meses).
      </InfoBanner>

      <LabAnalyteEditor testId={test.id} initialAnalytes={test.analytes} />
    </div>
  );
}