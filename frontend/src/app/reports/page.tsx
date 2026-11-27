/**
 * @file Página índice de Reportes Masivos y Diagnóstico Situacional (UMM).
 * @description Server-side render (Next.js 16 con `force-dynamic`) que lista los
 *              proyectos / campañas de Unidades Médicas Móviles con métricas reales
 *              y acceso directo para generar y descargar el EBOOK PDF (Diagnóstico
 *              Situacional + Expedientes) y Concentrado Excel (.xlsx).
 */
import Link from 'next/link';
import { getServerSession } from 'next-auth/next';
import {
  Building2,
  Calendar,
  Download,
  ExternalLink,
  FileBarChart,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  FolderKanban,
  Truck,
  Users,
} from 'lucide-react';
import { authOptions } from '@/auth';
import prisma from '@/lib/prisma';
import { ProjectMassiveReportButton } from '@/components/projects/ProjectMassiveReportButton';

export const dynamic = 'force-dynamic';

const REPORT_ROLES = [
  'SUPERADMIN',
  'ADMIN',
  'DOCTOR_GENERAL',
  'DOCTOR_VALIDATOR',
  'RECEPTIONIST',
];

const PROJECT_STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Borrador',
  CONFIRMED: 'Confirmado',
  IN_PROGRESS: 'En curso',
  COMPLETED: 'Completado',
  CANCELLED: 'Cancelado',
};

const REPORT_STATUS_BADGE: Record<string, string> = {
  READY: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  PROCESSING: 'bg-blue-50 text-blue-700 border-blue-200',
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
  FAILED: 'bg-red-50 text-red-700 border-red-200',
};

export default async function ReportsIndexPage() {
  const session = await getServerSession(authOptions);
  const role = (session?.user?.role as string | undefined) ?? '';
  const canGenerate = REPORT_ROLES.includes(role);

  const backendBaseUrl = (
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    ''
  )
    .trim()
    .replace(/\/+$/, '');

  const [projects, recentReports] = await Promise.all([
    prisma.project.findMany({
      orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
      include: {
        company: { select: { id: true, name: true } },
        mobileUnit: { select: { id: true, name: true, plate: true } },
        branch: { select: { id: true, name: true } },
        _count: { select: { workers: true, reports: true } },
        workers: {
          include: {
            event: {
              select: {
                id: true,
                status: true,
                verdict: { select: { id: true, pdfUrl: true } },
                eventTests: {
                  select: { status: true, resultNotes: true },
                },
              },
            },
          },
        },
        reports: {
          orderBy: { generatedAt: 'desc' },
          take: 1,
        },
      },
    }),
    prisma.projectReport.findMany({
      orderBy: { generatedAt: 'desc' },
      take: 20,
      include: {
        project: {
          select: {
            id: true,
            name: true,
            company: { select: { name: true } },
          },
        },
        generatedBy: {
          select: {
            fullName: true,
            email: true,
          },
        },
      },
    }),
  ]);

  const totalWorkers = projects.reduce((acc, p) => acc + p._count.workers, 0);
  const totalVerdicts = projects.reduce(
    (acc, p) =>
      acc + p.workers.filter((pw) => Boolean(pw.event?.verdict?.pdfUrl)).length,
    0,
  );
  const readyReportsCount = recentReports.filter((r) => r.status === 'READY').length;

  return (
    <div className="container mx-auto p-6 space-y-8">
      {/* Encabezado */}
      <header className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-4">
          <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#592c82]/15 text-[#592c82]">
            <FileBarChart className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Reportes Masivos y Diagnóstico Situacional (UMM)
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Al cierre de campaña en Unidad Móvil o clínica, genera el{' '}
              <span className="font-semibold text-slate-800">
                Ebook PDF consolidado
              </span>{' '}
              (Diagnóstico Situacional con gráficas epidemiológicas + expedientes y
              dictámenes individuales listo para imprimir y navegar) y el{' '}
              <span className="font-semibold text-slate-800">
                Concentrado General en Excel
              </span>
              .
            </p>
          </div>
        </div>
        <Link
          href="/projects"
          className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-[#592c82]/20 bg-[#592c82]/5 px-4 py-2.5 text-sm font-semibold text-[#592c82] transition-colors hover:bg-[#592c82]/10"
        >
          <FolderKanban className="h-4 w-4" />
          Ir a Proyectos
        </Link>
      </header>

      {/* KPIs */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Proyectos UMM
            </span>
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#592c82]/12 text-[#592c82]">
              <FolderKanban className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">{projects.length}</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Trabajadores en proyectos
            </span>
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-blue-600">
              <Users className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">{totalWorkers}</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Expedientes dictaminados
            </span>
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <FileCheck2 className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">{totalVerdicts}</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Entregables listos
            </span>
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-teal-50 text-teal-600">
              <Download className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">{readyReportsCount}</p>
        </div>
      </section>

      {/* Sección 1: Proyectos */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">
            Proyectos y campañas disponibles
          </h2>
          {!canGenerate && (
            <span className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-3 py-1">
              Rol ({role || 'sin sesión'}) en solo lectura
            </span>
          )}
        </div>

        {projects.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <span className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#592c82]/12 text-[#592c82]">
              <FolderKanban className="h-6 w-6" />
            </span>
            <p className="font-semibold text-slate-700">
              No hay proyectos registrados todavía.
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Crea una campaña en{' '}
              <Link href="/projects" className="font-semibold text-[#592c82] hover:underline">
                Proyectos
              </Link>{' '}
              y asigna trabajadores para generar su Diagnóstico Situacional y Concentrado Excel.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {projects.map((p) => {
              const workersForModal = p.workers.map((pw) => ({
                id: pw.workerId,
                event: pw.event
                  ? {
                      eventTests: pw.event.eventTests.map((et) => ({
                        status: et.status as string,
                        resultNotes: et.resultNotes,
                      })),
                    }
                  : null,
              }));
              const verdictCount = p.workers.filter((pw) =>
                Boolean(pw.event?.verdict?.pdfUrl),
              ).length;
              const unitLabel = p.mobileUnit
                ? `${p.mobileUnit.name}${p.mobileUnit.plate ? ` · ${p.mobileUnit.plate}` : ''}`
                : p.unitRef || p.branch?.name || 'Sin asignar';

              return (
                <article
                  key={p.id}
                  className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:flex-row lg:items-center lg:justify-between"
                >
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <Link
                        href={`/projects/${p.id}`}
                        className="text-base font-bold text-slate-900 hover:text-[#592c82] hover:underline"
                      >
                        {p.name}
                      </Link>
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700">
                        {PROJECT_STATUS_LABEL[p.status] ?? p.status}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-slate-600">
                      <span className="inline-flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5 text-[#592c82]" />
                        {p.company?.name ?? 'Sin empresa asignada'}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Truck className="h-3.5 w-3.5 text-[#592c82]" />
                        {unitLabel}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-[#592c82]" />
                        {new Date(p.startDate).toLocaleDateString('es-MX')} —{' '}
                        {new Date(p.endDate).toLocaleDateString('es-MX')}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs">
                      <span className="font-bold text-slate-800">{p._count.workers}</span>
                      <span className="text-slate-500">trabajadores</span>
                      <span className="text-slate-300">|</span>
                      <span className="font-bold text-emerald-700">{verdictCount}</span>
                      <span className="text-slate-500">dictaminados</span>
                    </div>

                    <Link
                      href={`/projects/${p.id}`}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Ver proyecto
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>

                    {canGenerate && (
                      <ProjectMassiveReportButton
                        projectId={p.id}
                        workers={workersForModal}
                      />
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Sección 2: Historial de entregables */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">
          Historial de entregables generados
        </h2>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          {recentReports.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-slate-500">
              Aún no se han generado entregables masivos. Selecciona un proyecto arriba y presiona{' '}
              <span className="font-semibold text-slate-700">Generar Reporte Masivo</span>.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <tr>
                  <th className="px-4 py-3 text-left">Fecha</th>
                  <th className="px-4 py-3 text-left">Proyecto / Empresa</th>
                  <th className="px-4 py-3 text-left">Formato</th>
                  <th className="px-4 py-3 text-left">Estado</th>
                  <th className="px-4 py-3 text-left">Solicitado por</th>
                  <th className="px-4 py-3 text-right">Descargas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentReports.map((rep) => {
                  const canDownloadXlsx =
                    rep.status === 'READY' &&
                    (Boolean(rep.fileUrlXlsx) ||
                      rep.format === 'XLSX' ||
                      rep.format === 'BOTH');
                  const canDownloadPdf =
                    rep.status === 'READY' &&
                    (Boolean(rep.fileUrlPdf) ||
                      rep.format === 'EBOOK' ||
                      rep.format === 'PDF' ||
                      rep.format === 'BOTH');

                  return (
                    <tr key={rep.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">
                        {new Date(rep.generatedAt).toLocaleString('es-MX')}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/projects/${rep.projectId}`}
                          className="font-semibold text-slate-800 hover:text-[#592c82] hover:underline"
                        >
                          {rep.project.name}
                        </Link>
                        {rep.project.company?.name && (
                          <p className="text-xs text-slate-500">
                            {rep.project.company.name}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-700">
                        {rep.format}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
                            REPORT_STATUS_BADGE[rep.status] ??
                            'bg-slate-50 text-slate-700 border-slate-200'
                          }`}
                        >
                          {rep.status}
                        </span>
                        {rep.status === 'FAILED' && rep.errorMessage && (
                          <p
                            className="mt-1 max-w-xs truncate text-[11px] text-red-600"
                            title={rep.errorMessage}
                          >
                            {rep.errorMessage}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {rep.generatedBy?.fullName || rep.generatedBy?.email || '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {rep.status === 'READY' ? (
                          <div className="inline-flex flex-wrap items-center justify-end gap-2">
                            {canDownloadPdf && (
                              <a
                                href={`${backendBaseUrl}/api/v2/projects/${rep.projectId}/reports/${rep.id}/download?format=pdf`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 rounded-lg bg-[#592c82] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#49226b]"
                              >
                                <FileText className="h-3.5 w-3.5" />
                                Ebook PDF
                              </a>
                            )}
                            {canDownloadXlsx && (
                              <a
                                href={`${backendBaseUrl}/api/v2/projects/${rep.projectId}/reports/${rep.id}/download?format=xlsx`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                              >
                                <FileSpreadsheet className="h-3.5 w-3.5" />
                                Concentrado XLSX
                              </a>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
