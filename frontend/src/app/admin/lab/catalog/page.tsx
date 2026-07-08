/**
 * @file Editor del catálogo avanzado de estudios de Laboratorio.
 * @id IMPL-20260707-17 — Fase 1 NOVA absorción (ARCH-20260707-17) — E.
 *
 * Server Component. Lista estudios de cat=Laboratorio con sus analitos.
 * Botón "Ejecutar seed" para sembrar 5 estudios típicos.
 */
import Link from "next/link";
import { InfoBanner } from "@/components/shared/InfoBanner";
import { LabCatalogSeedButton } from "./_components/LabCatalogSeedButton";
import { getLabCatalogAction } from "@/actions/study.actions";

export const dynamic = "force-dynamic";

type SP = { search?: string };

export default async function LabCatalogAdminPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  const result = await getLabCatalogAction(sp.search ?? null);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Catálogo de Laboratorio</h2>
          <p className="text-sm text-slate-500">
            Editor especializado de estudios, analitos y rangos de referencia.
          </p>
        </div>
        <LabCatalogSeedButton />
      </div>

      <InfoBanner
        icon={<span aria-hidden>🧬</span>}
        title="Catálogo Avanzado — Estudios de Laboratorio"
      >
        Click en un estudio para editar sus analitos y rangos. Backend FastAPI en
        <code className="bg-slate-100 px-1 rounded text-xs mx-1">/api/v1/medical_tests/lab-catalog</code>.
      </InfoBanner>

      {/* Buscador simple */}
      <form method="GET" className="flex gap-2">
        <input
          type="text"
          name="search"
          defaultValue={sp.search ?? ""}
          placeholder="Buscar por clave o nombre..."
          className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          Buscar
        </button>
      </form>

      {!result.ok ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          Error: {result.error}
        </div>
      ) : result.data.rows.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8 text-center">
          <p className="text-sm text-slate-600 mb-2">
            No hay estudios de Laboratorio en el catálogo.
          </p>
          <p className="text-xs text-slate-500">
            Ejecute el seed para crear BH, QS, EGO, Perfil Lipídico y TP.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-left text-slate-600">
                <th className="px-4 py-2 font-medium">Clave</th>
                <th className="px-4 py-2 font-medium">Nombre</th>
                <th className="px-4 py-2 font-medium">NOVA Clave</th>
                <th className="px-4 py-2 font-medium">Analitos</th>
                <th className="px-4 py-2 font-medium">Días resultado</th>
                <th className="px-4 py-2 font-medium">Tipo</th>
                <th className="px-4 py-2 font-medium text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {result.data.rows.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2 font-mono text-slate-800 font-medium">{t.code}</td>
                  <td className="px-4 py-2 text-slate-700">{t.name}</td>
                  <td className="px-4 py-2 font-mono text-slate-500">{t.novaClave ?? "—"}</td>
                  <td className="px-4 py-2 text-slate-700">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                      {t.analytes.length}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-slate-700">{t.daysToResult ?? "—"}</td>
                  <td className="px-4 py-2">
                    {t.isProfile && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-700 mr-1">
                        Perfil
                      </span>
                    )}
                    {t.isPackage && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-purple-100 text-purple-700">
                        Paquete
                      </span>
                    )}
                    {!t.isProfile && !t.isPackage && <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Link
                      href={`/admin/lab/catalog/${t.id}`}
                      className="text-blue-700 hover:text-blue-900 underline text-xs font-medium"
                    >
                      Editar
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}