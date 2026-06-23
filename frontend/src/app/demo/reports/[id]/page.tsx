// Vista de proyecto demo en /demo/reports/[id]
// Server component: lee el proyecto desde datos estáticos y renderiza
// tabla de trabajadores + botón "Reporte Masivo" (client island).

import Link from 'next/link';
import { notFound } from 'next/navigation';

import { DemoBanner } from '@/components/demo/DemoBanner';
import { DemoReportLauncher } from '@/components/demo/DemoReportLauncher';
import { getDemoProjectById } from '@/lib/demo/demo-data';

interface PageProps {
  // Next.js 16: params es Promise.
  params: Promise<{ id: string }>;
}

export const dynamic = 'force-static';

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const project = getDemoProjectById(id);
  return {
    title: project
      ? `${project.empresa} | Demo Reportes UMM`
      : 'Proyecto demo no encontrado | AMI',
  };
}

export default async function DemoProjectPage({ params }: PageProps) {
  const { id } = await params;
  const project = getDemoProjectById(id);

  if (!project) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <DemoBanner />

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <Link
              href="/demo/reports"
              className="text-xs text-blue-600 hover:underline"
            >
              &larr; Volver al listado demo
            </Link>
            <h1 className="text-2xl font-bold text-slate-900 mt-1">
              {project.empresa}
            </h1>
            <p className="text-sm text-slate-500">{project.empresaLegal}</p>
          </div>
          <DemoReportLauncher project={project} />
        </div>

        <section className="bg-white border border-slate-200 rounded-lg p-5">
          <h2 className="text-base font-semibold text-slate-900 mb-3">
            Datos del estudio
          </h2>
          <dl className="grid grid-cols-2 md:grid-cols-4 gap-y-3 text-sm">
            <div>
              <dt className="text-slate-500">Fecha</dt>
              <dd className="font-medium text-slate-900">{project.fecha}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Trabajadores</dt>
              <dd className="font-medium text-slate-900">
                {project.trabajadores.length}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">ID demo</dt>
              <dd className="font-mono text-xs text-slate-700">{project.id}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Origen</dt>
              <dd className="font-medium text-slate-900">
                CONCENTRADO GENERAL EJEMPLO.xlsx
              </dd>
            </div>
          </dl>
        </section>

        <section>
          <h2 className="text-base font-semibold text-slate-900 mb-3">
            Trabajadores ({project.trabajadores.length})
          </h2>
          <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-600">
                  <th className="px-3 py-2 font-semibold">Folio</th>
                  <th className="px-3 py-2 font-semibold">Nombre</th>
                  <th className="px-3 py-2 font-semibold">Sexo</th>
                  <th className="px-3 py-2 font-semibold">Área</th>
                  <th className="px-3 py-2 font-semibold">Antigüedad</th>
                  <th className="px-3 py-2 font-semibold">DX Audio</th>
                  <th className="px-3 py-2 font-semibold">Espiro</th>
                  <th className="px-3 py-2 font-semibold">RX Tórax</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {project.trabajadores.map((w) => (
                  <tr key={w.folio} className="hover:bg-slate-50">
                    <td className="px-3 py-2 font-mono text-xs">{w.folio}</td>
                    <td className="px-3 py-2 font-medium text-slate-900">
                      {w.nombre}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs ${
                          w.sexo === 'MASCULINO'
                            ? 'bg-blue-50 text-blue-700'
                            : 'bg-pink-50 text-pink-700'
                        }`}
                      >
                        {w.sexo === 'MASCULINO' ? 'M' : 'F'}
                      </span>
                    </td>
                    <td className="px-3 py-2">{w.area}</td>
                    <td className="px-3 py-2">{w.antiguedad}</td>
                    <td className="px-3 py-2">{w.audiometria.dx}</td>
                    <td className="px-3 py-2">{w.espirometria.patron}</td>
                    <td className="px-3 py-2">
                      {w.rxTorax.impresion === 'N/A' ? (
                        <span className="text-slate-400">N/A</span>
                      ) : (
                        'OK'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <footer className="text-xs text-slate-500 pt-4">
          <p>
            Vista de proyecto demo. La generaci&oacute;n de XLSX y PDF se realiza
            completamente en el navegador a partir de los datos hardcodeados.
          </p>
        </footer>
      </main>
    </div>
  );
}
