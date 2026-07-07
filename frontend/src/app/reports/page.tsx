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
  const canGenerate = REPORT_ROLES.includes(role);

  // UI-20260706-04: Versión ultra-minimalista para identificar causa del 500.
  // Solo verificamos que la página renderiza sin queries Prisma.
  return (
    <div className="container mx-auto p-6 space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold text-slate-900">📊 Reportes Masivos</h1>
        <p className="text-slate-600">
          Genera concentrados XLSX o EBOOKs PDF navegables por proyecto.
        </p>
        <p className="text-sm text-slate-500 italic">
          Versión simplificada — UI-20260706-04 debug.
        </p>
      </header>

      <section className="bg-white border border-slate-200 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-slate-900 mb-3">
          Acceso directo
        </h2>
        <p className="text-sm text-slate-700">
          Para generar un reporte, ve a{' '}
          <Link href="/projects" className="text-blue-600 hover:underline font-medium">
            /projects
          </Link>{' '}
          y selecciona el proyecto deseado.
        </p>
      </section>

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
        {canGenerate && (
          <p className="text-sm text-slate-500 italic">
            Lista de proyectos próximamente. Mientras tanto, ve a{' '}
            <Link href="/projects" className="text-blue-600 hover:underline">
              /projects
            </Link>{' '}
            y selecciona un proyecto.
          </p>
        )}
      </section>

      {/* SECCIÓN 2: Historial reciente */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-slate-900">
          Historial reciente
        </h2>
        <p className="text-sm text-slate-500 italic">
          El historial se está reconstruyendo. Por ahora ve a{' '}
          <Link href="/projects" className="text-blue-600 hover:underline">
            /projects
          </Link>{' '}
          y selecciona un proyecto para ver los reportes generados.
        </p>
      </section>
    </div>
  );
}
