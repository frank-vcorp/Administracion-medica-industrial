/**
 * @file Debug aislado: SOLO Query 1 (Project + _count.workers).
 * @description Paso 1 del aislamiento — mantiene solo la query más similar
 *              al patrón probado en /projects/[id]/page.tsx.
 * @id IMPL-20260706-08
 * @spec context/interconsultas/HANDOFF_UI-20260706-01_SOFIA_MENU-REPORTES.md
 * @see context/SPECs/SPEC_ARCH-20260623-01-MODULO-REPORTES-MASIVOS.md
 *
 * Reglas de aislamiento (debug 2026-07-06):
 *   - Solo Query 1 activa (proyectos con _count.workers).
 *   - Queries 2 (ProjectWorker) y 3 (ProjectReport) comentadas.
 *   - Render mínimo: JSON.stringify del resultado (sin componentes cliente).
 *   - Sin auth, sin lógica de roles, sin ProjectMassiveReportButton.
 *
 * Hipótesis de despliegue:
 *   - SI esta query funciona → descartar problema de infraestructura
 *     (Prisma client, conexión DB, runtime). Pasar a Paso 3 (Query 3 sola).
 *   - SI esta query falla → problema sistémico, NO relacionado con
 *     ninguna query individual. Escalar a INTEGRA.
 */
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs'; // Requerido: Prisma no funciona en Edge runtime

export default async function ReportsIndexPage() {
  // ── Query 1 (única activa en este paso) ───────────────────────────────────
  // Mismo patrón que /projects/[id]/page.tsx:27-59 (que funciona en prod).
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

  // ── Query 2 DESHABILITADA (Paso 1) ────────────────────────────────────────
  // const projectWorkers =
  //   projects.length === 0
  //     ? []
  //     : await prisma.projectWorker.findMany({
  //         where: { projectId: { in: projects.map((p) => p.id) } },
  //         select: { projectId: true, workerId: true },
  //       });

  // ── Query 3 DESHABILITADA (Paso 1) ────────────────────────────────────────
  // const recentReports = await prisma.projectReport.findMany({
  //   select: {
  //     id: true,
  //     projectId: true,
  //     format: true,
  //     status: true,
  //     fileUrlXlsx: true,
  //     fileUrlPdf: true,
  //     generatedAt: true,
  //     project: { select: { id: true, name: true } },
  //   },
  //   orderBy: { generatedAt: 'desc' },
  //   take: 20,
  // });

  return (
    <div className="container mx-auto p-6 space-y-4">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">
          Debug Query 1 (Project + _count.workers)
        </h1>
        <p className="text-sm text-slate-600">
          IMPL-20260706-08 — Paso 1 del aislamiento. Queries 2 y 3
          comentadas. Render mínimo sin componentes cliente.
        </p>
      </header>

      <section>
        <h2 className="text-lg font-semibold text-slate-800">
          Resultado ({projects.length} proyectos)
        </h2>
        <pre className="bg-slate-50 border border-slate-200 rounded p-4 overflow-auto text-xs">
          {JSON.stringify(projects, null, 2)}
        </pre>
      </section>
    </div>
  );
}