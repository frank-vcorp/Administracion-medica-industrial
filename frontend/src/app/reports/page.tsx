/**
 * @file Página índice de Reportes Masivos.
 * @description Server-side render (Next.js 16 con `force-dynamic`) que lista los
 *              proyectos con al menos un trabajador asignado para poder generar
 *              reportes masivos (XLSX / EBOOK), más el historial reciente del
 *              usuario actual.
 * @id IMPL-20260706-01
 * @spec context/interconsultas/HANDOFF_UI-20260706-01_SOFIA_MENU-REPORTES.md
 * @see context/SPECs/SPEC_ARCH-20260623-01-MODULO-REPORTES-MASIVOS.md
 *
 * Adaptaciones verificadas en el código existente:
 *   - `authOptions` proviene de `@/auth` (no `@/lib/auth`).
 *   - `prisma` proviene de `@/lib/prisma`.
 *   - `ProjectMassiveReportButton` requiere `projectId` + `workers[]`; abre el
 *     modal internamente (no pasamos `variant`).
 *   - Modelo `ProjectReport` mantiene campos `fileUrlPdf` / `fileUrlXlsx`
 *     (el formato runtime canónico ahora es `EBOOK` reemplazando a `PDF`,
 *     pero ambos campos persisten en Prisma).
 *
 * Decisión de INTEGRA 2026-07-06: REEMPLAZAR la página huérfana mock
 * (`StatsBox` 1,240 atenciones, botón "Descargar PDF" sin handler, dropdown
 * sin funcionalidad) por esta vista índice real.
 */
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/auth';
import prisma from '@/lib/prisma';
import { ProjectMassiveReportButton } from '@/components/projects/ProjectMassiveReportButton';

export const dynamic = 'force-dynamic';

// Roles habilitados para generar Reportes Masivos
// (consistente con /projects/[id]/page.tsx — ARCH-20260623-01).
const REPORT_ROLES = ['ADMIN', 'DOCTOR_GENERAL', 'RECEPTIONIST'];

export default async function ReportsIndexPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/login');
  }

  const role = (session.user?.role as string | undefined) ?? '';
  const userId = session.user?.id ?? '';
  const canGenerate = REPORT_ROLES.includes(role);

  // ── Query batched #1 ───────────────────────────────────────────────────────
  // Lista de proyectos con conteo de trabajadores + nombre de empresa.
  // Una sola consulta cubre la rejilla (evita N+1 al pintar la card).
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

  // Filtramos en memoria: solo mostramos proyectos con al menos 1 trabajador,
  // porque sin trabajadores no hay nada que reportar.
  const projectsWithWorkers = projects.filter((p) => p._count.workers > 0);

  // ── Query batched #2 ───────────────────────────────────────────────────────
  // Para los proyectos que SÍ tienen trabajadores y el usuario puede generar,
  // precargamos el subset que `ProjectMassiveReportButton` exige
  // (workers → event.eventTests). Se hace en UNA consulta con `in` y se
  // agrupa por projectId en memoria, en lugar de N queries por proyecto.
  let workersByProject = new Map<
    string,
    Array<{
      id?: string;
      event: {
        eventTests: Array<{ status: string; resultNotes?: string | null }>;
      } | null;
    }>
  >();

  if (canGenerate && projectsWithWorkers.length > 0) {
    const projectIds = projectsWithWorkers.map((p) => p.id);

    const projectWorkers = await prisma.projectWorker.findMany({
      where: { projectId: { in: projectIds } },
      select: {
        projectId: true,
        workerId: true,
        event: {
          select: {
            eventTests: {
              select: { status: true, resultNotes: true },
            },
          },
        },
      },
      orderBy: { addedAt: 'desc' },
    });

    const grouped = new Map<
      string,
      Array<{
        id?: string;
        event: {
          eventTests: Array<{ status: string; resultNotes?: string | null }>;
        } | null;
      }>
    >();

    for (const pw of projectWorkers) {
      const bucket = grouped.get(pw.projectId) ?? [];
      bucket.push({
        id: pw.workerId,
        event: pw.event
          ? {
              eventTests: pw.event.eventTests.map((et) => ({
                status: et.status as string,
                resultNotes: et.resultNotes,
              })),
            }
          : null,
      });
      grouped.set(pw.projectId, bucket);
    }

    workersByProject = grouped;
  }

  // ── Query batched #3 ───────────────────────────────────────────────────────
  // Historial reciente de reportes generados por el usuario actual.
  const recentReports = await prisma.projectReport.findMany({
    where: { generatedById: userId },
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
      <header className="space-y-2">
        <h1 className="text-3xl font-bold text-slate-900">📊 Reportes Masivos</h1>
        <p className="text-slate-600">
          Genera concentrados XLSX o EBOOKs PDF navegables por proyecto.
        </p>
      </header>

      {/* SECCIÓN 1: Generar nuevo reporte */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-slate-900">
          Generar nuevo reporte
        </h2>
        {!canGenerate && (
          <p className="text-sm text-slate-500 italic">
            Tu rol ({role || 'sin rol'}) no permite generar reportes. Contacta
            a un administrador si necesitas acceso.
          </p>
        )}
        {canGenerate && projectsWithWorkers.length === 0 && (
          <p className="text-sm text-slate-500 italic">
            No hay proyectos con trabajadores asignados. Agrega trabajadores
            en la vista de detalle de cada proyecto para poder generar un
            reporte masivo.
          </p>
        )}
        {canGenerate && projectsWithWorkers.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projectsWithWorkers.map((project) => {
              const workers = workersByProject.get(project.id) ?? [];
              return (
                <div
                  key={project.id}
                  className="bg-white border border-slate-200 rounded-lg p-4 space-y-3"
                >
                  <div>
                    <h3 className="font-semibold text-slate-900">
                      {project.name}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {project.company?.name ?? 'Sin empresa'}
                    </p>
                    <p className="text-xs text-slate-500">
                      {project._count.workers} trabajador(es)
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <ProjectMassiveReportButton
                      projectId={project.id}
                      workers={workers}
                    />
                    <Link
                      href={`/projects/${project.id}`}
                      className="inline-flex items-center px-3 py-2 text-xs text-blue-600 hover:underline"
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

      {/* SECCIÓN 2: Historial reciente */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-slate-900">
          Historial reciente
        </h2>
        {recentReports.length === 0 ? (
          <p className="text-sm text-slate-500 italic">
            Aún no has generado reportes.
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
                  <tr key={report.id} className="border-t border-slate-100">
                    <td className="px-4 py-2 text-xs text-slate-600">
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
                    <td className="px-4 py-2 text-xs space-x-2">
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
