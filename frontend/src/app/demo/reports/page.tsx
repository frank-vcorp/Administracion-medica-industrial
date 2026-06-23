// Listado de proyectos demo disponibles.
// No consume backend ni base de datos. Es 100% standalone.

import Link from 'next/link';

import { DemoBanner } from '@/components/demo/DemoBanner';
import { getDemoProjects } from '@/lib/demo/demo-data';

export const dynamic = 'force-static';

export const metadata = {
  title: 'Demo Reportes Masivos UMM | AMI',
  description: 'Demo navegable del Módulo de Reportes Masivos UMM (datos estáticos).',
};

export default function DemoReportsListPage() {
  const projects = getDemoProjects();

  return (
    <div className="min-h-screen bg-slate-50">
      <DemoBanner />

      <main className="max-w-5xl mx-auto px-6 py-10">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">
            M&oacute;dulo de Reportes Masivos UMM &mdash; Demo
          </h1>
          <p className="text-slate-600 mt-2 max-w-3xl">
            Vista previa navegable del nuevo m&oacute;dulo de reportes masivos. Esta
            secci&oacute;n trabaja con datos est&aacute;ticos extra&iacute;dos del archivo{' '}
            <code className="bg-slate-200 px-1 rounded text-sm">
              CONCENTRADO GENERAL EJEMPLO.xlsx
            </code>{' '}
            y no toca la base de datos productiva.
          </p>
        </header>

        <section>
          <h2 className="text-lg font-semibold text-slate-800 mb-4">
            Proyectos demo disponibles
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {projects.map((p) => (
              <Link
                key={p.id}
                href={`/demo/reports/${p.id}`}
                className="block bg-white border border-slate-200 rounded-lg p-5 hover:border-blue-400 hover:shadow-md transition"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">
                      {p.empresa}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      {p.empresaLegal}
                    </p>
                  </div>
                  <span className="text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 px-2 py-1 rounded">
                    DEMO
                  </span>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-y-2 text-sm">
                  <dt className="text-slate-500">Fecha</dt>
                  <dd className="text-slate-900 font-medium">{p.fecha}</dd>
                  <dt className="text-slate-500">Trabajadores</dt>
                  <dd className="text-slate-900 font-medium">
                    {p.trabajadores.length}
                  </dd>
                </dl>
              </Link>
            ))}
          </div>
        </section>

        <footer className="mt-12 text-xs text-slate-500">
          <p>
            Este demo es 100% standalone. No consulta la base de datos ni el backend
            de AMI. Implementaci&oacute;n de referencia para validar el M&oacute;dulo de
            Reportes Masivos UMM antes de invertir en la versi&oacute;n productiva.
          </p>
        </footer>
      </main>
    </div>
  );
}
