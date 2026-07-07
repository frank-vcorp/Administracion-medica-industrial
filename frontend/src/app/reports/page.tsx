/**
 * @file Página índice de Reportes Masivos.
 * @description Server-side render (Next.js 16 con `force-dynamic`) que lista los
 *              proyectos con al menos un trabajador asignado para poder generar
 *              reportes masivos (XLSX / EBOOK), más el historial reciente
 *              GLOBAL de reportes generados (sin filtro por usuario, porque
 *              NextAuth con `session.strategy: 'jwt'` no inyecta `user.id`).
 * @id IMPL-20260706-06
 * @spec context/interconsultas/HANDOFF_UI-20260706-01_SOFIA_MENU-REPORTES.md
 * @see context/SPECs/SPEC_ARCH-20260623-01-MODULO-REPORTES-MASIVOS.md
 *
 * Adaptaciones verificadas en el código existente:
 *   - `authOptions` proviene de `@/auth` (no `@/lib/auth`).
 *   - `prisma` proviene de `@/lib/prisma`.
 *   - `ProjectMassiveReportButton` requiere `projectId` + `workers[]`. Para
 *     evitar el nested select `event.eventTests` (Prisma 6), cargamos los
 *     IDs de ProjectWorker por separado y los mapeamos a
 *     `{ id: workerId, event: null }`.
 *   - Modelo `ProjectReport` mantiene campos `fileUrlPdf` / `fileUrlXlsx`
 *     (el formato runtime canónico ahora es `EBOOK` reemplazando a `PDF`,
 *     pero ambos campos persisten en Prisma).
 *
 * Decisión de INTEGRA 2026-07-06: Reemplaza la versión UI-20260706-05
 * minimalista. Restaura la lista de proyectos y el historial global.
 *
 * Reglas inquebrantables aplicadas:
 *   - NO usar `redirect()` (causa 500 si no es la última instrucción).
 *   - NO filtrar ProjectReport por `generatedById` (NextAuth JWT no tiene
 *     `user.id` por default; filtro con `''` causa 500).
 *   - NO usar nested select `event.eventTests` (compatibilidad Prisma 6).
 */
import Link from 'next/link';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/auth';
import prisma from '@/lib/prisma';
import { ProjectMassiveReportButton } from '@/components/projects/ProjectMassiveReportButton';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';  // Requerido: Prisma no funciona en Edge runtime

// Roles habilitados para generar Reportes Masivos
// (consistente con /projects/[id]/page.tsx — ARCH-20260623-01).
const REPORT_ROLES = ['ADMIN', 'DOCTOR_GENERAL', 'RECEPTIONIST'];

export default async function ReportsIndexPage() {
  // Patrón consistente con /projects/[id]: session opcional con fallback.
  // Si session es null, role === '' y canGenerate === false. NO redirigimos.
  const session = await getServerSession(authOptions);
  const role = (session?.user?.role as string | undefined) ?? '';
  const canGenerate = REPORT_ROLES.includes(role);

  // Query 1: proyectos con conteo de trabajadores (select puro, sin include
  // para mantener compatibilidad con Prisma 6).
  const projects = await prisma.project.findMany({
    select: {
      id: true,
      name: true,
      status: true,
      startDate: true,
      company: { select: { id: true, name: true } },
      _count: { select: { workers: true } },
    },
    orderBy: { startDate: 'desc' },
    take: 50,
  });

  const projectsWithWorkers = projects.filter((p) => p._count.workers > 0);

  // Query 2: cargar solo los IDs de ProjectWorker para los proyectos
  // con trabajadores. Esto evita el nested select `event.eventTests`
  // que rompe en Prisma 6.
  const projectWorkers =
    projectsWithWorkers.length === 0
      ? []
      : await prisma.projectWorker.findMany({
          where: { projectId: { in: projectsWithWorkers.map((p) => p.id) } },
          select: { projectId: true, workerId: true },
        });

  // Agrupar IDs por proyecto para pasarlos al botón en formato mínimo.
  const workersByProjectId = new Map<string, string[]>();
  for (const pw of projectWorkers) {
    const list = workersByProjectId.get(pw.projectId);
    if (list) {
      list.push(pw.workerId);
    } else {
      workersByProjectId.set(pw.projectId, [pw.workerId]);
    }
  }

  // Query 3: historial GLOBAL de reportes (sin filtro por usuario).
  // NextAuth con JWT strategy no inyecta `user.id` en session por default,
  // por lo que filtrar por `generatedById: session.user.id` causa 500.
  const recentReports = await prisma.projectReport.findMany({
    select: {
      id: true,
      projectId: true,
      format: true,
      status: true,
      fileUrlXlsx: true,
      fileUrlPdf: true,
      generatedAt: true,
      project: { select: { id: true, name: true } },
    },
    orderBy: { generatedAt: 'desc' },
    take: 20,
  });

  return (
    <div className="container mx-auto p-6 space-y-8">
      {/* Header */}
      <header className="space-y-2">
        <h1 className="text-3xl font-bold text-slate-900">
          📊 Reportes Masivos
        </h1>
        <p className="text-slate-600">
          Genera concentrados XLSX o EBOOKs PDF navegables por proyecto.
        </p>
      </header>

      {/* SECCIÓN 1: Lista de proyectos */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-slate-900">
          Generar nuevo reporte
        </h2>

        {!canGenerate && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <p className="text-sm text-amber-900">
              Tu rol{' '}
              <strong>{role || 'sin rol'}</strong> no permite generar reportes.
              Contacta a un administrador si necesitas acceso.
            </p>
          </div>
        )}

        {canGenerate && projectsWithWorkers.length === 0 && (
          <p className="text-sm text-slate-500 italic">
            No hay proyectos con trabajadores asignados. Ve a{' '}
            <Link
              href="/projects"
              className="text-blue-600 hover:underline font-medium"
            >
              /projects
            </Link>{' '}
            y agrega trabajadores a un proyecto para comenzar.
          </p>
        )}

        {canGenerate && projectsWithWorkers.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projectsWithWorkers.map((project) => {
              const workerIds = workersByProjectId.get(project.id) ?? [];
              // Map a shape mínimo que ProjectMassiveReportButton acepta.
              // Pasamos event: null para evitar el nested select Prisma 6
              // (conteos.total se calcula correctamente; el server-side
              // recalcula completos/parciales al generar el reporte).
              const workersForModal = workerIds.map((id) => ({
                id,
                event: null,
              }));
              return (
                <div
                  key={project.id}
                  className="bg-white border border-slate-200 rounded-lg p-4 space-y-3"
                >
                  <div>
                    <h3 className="font-semibold text-slate-900 truncate">
                      {project.name}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {project.company?.name ?? 'Sin empresa'}
                    </p>
                    <p className="text-xs text-slate-500">
                      🗓️{' '}
                      {new Date(project.startDate).toLocaleDateString('es-MX')}
                    </p>
                    <p className="text-xs text-slate-500">
                      👥 {project._count.workers} trabajador(es)
                    </p>
                    <span
                      className={`inline-block text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border mt-2 ${
                        project.status === 'COMPLETED'
                          ? 'bg-green-50 text-green-700 border-green-200'
                          : project.status === 'IN_PROGRESS'
                          ? 'bg-blue-50 text-blue-700 border-blue-200'
                          : project.status === 'CANCELLED'
                          ? 'bg-red-50 text-red-700 border-red-200'
                          : 'bg-slate-50 text-slate-700 border-slate-200'
                      }`}
                    >
                      {project.status}
                    </span>
                  </div>
                  <div className="flex gap-2 pt-2 border-t border-slate-100">
                    <ProjectMassiveReportButton
                      projectId={project.id}
                      workers={workersForModal}
                    />
                    <Link
                      href={`/projects/${project.id}`}
                      className="text-xs text-blue-600 hover:underline self-center"
                    >
                      Ver proyecto →
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* SECCIÓN 2: Historial reciente (global, sin filtro de usuario) */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-slate-900">
          Historial reciente
        </h2>
        <p className="text-xs text-slate-500 italic">
          Mostrando los últimos 20 reportes generados por todos los usuarios.
        </p>

        {recentReports.length === 0 ? (
          <p className="text-sm text-slate-500 italic">
            Aún no se han generado reportes.
          </p>
        ) : (
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-700">
                    Fecha
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-700">
                    Proyecto
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-700">
                    Formato
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-700">
                    Estado
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-700">
                    Descargas
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentReports.map((report) => (
                  <tr
                    key={report.id}
                    className="border-t border-slate-100"
                  >
                    <td className="px-4 py-2 text-xs text-slate-600 whitespace-nowrap">
                      {new Date(report.generatedAt).toLocaleString('es-MX')}
                    </td>
                    <td className="px-4 py-2 text-xs text-slate-900">
                      {report.project?.name ?? '—'}
                    </td>
                    <td className="px-4 py-2 text-xs text-slate-600">
                      {report.format}
                    </td>
                    <td className="px-4 py-2 text-xs">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          report.status === 'READY'
                            ? 'bg-emerald-100 text-emerald-800'
                            : report.status === 'FAILED'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {report.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs">
                      <div className="flex gap-2">
                        {report.status === 'READY' && report.fileUrlPdf && (
                          <a
                            href={`/api/v2/projects/${report.projectId}/reports/${report.id}/download?format=ebook`}
                            className="text-blue-600 hover:underline"
                          >
                            EBOOK
                          </a>
                        )}
                        {report.status === 'READY' && report.fileUrlXlsx && (
                          <a
                            href={`/api/v2/projects/${report.projectId}/reports/${report.id}/download?format=xlsx`}
                            className="text-blue-600 hover:underline"
                          >
                            XLSX
                          </a>
                        )}
                        {report.status !== 'READY' && (
                          <span className="text-slate-400">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}