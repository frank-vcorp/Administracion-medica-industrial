/**
 * @file Detalle de Proyecto de Visita Medica.
 * @description Pagina server-side que muestra la empresa, trabajadores y
 *              accesos al modal de Reporte Masivo (ARCH-20260623-01).
 * @id IMPL-20260630-03
 * @see context/SPECs/SPEC_ARCH-20260623-01-MODULO-REPORTES-MASIVOS.md
 */
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/auth'
import prisma from '@/lib/prisma'
import { ProjectMassiveReportButton } from '@/components/projects/ProjectMassiveReportButton'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function ProjectDetailPage({ params }: PageProps) {
  const { id } = await params

  const session = await getServerSession(authOptions)
  const role = (session?.user?.role as string | undefined) ?? 'COMPANY_CLIENT'

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      company: { select: { id: true, name: true } },
      workers: {
        include: {
          worker: {
            select: {
              id: true,
              universalId: true,
              firstName: true,
              lastName: true,
            },
          },
          event: {
            select: {
              id: true,
              status: true,
              eventTests: {
                select: {
                  id: true,
                  status: true,
                  resultNotes: true,
                },
              },
            },
          },
        },
        orderBy: { addedAt: 'desc' },
      },
      _count: { select: { workers: true } },
    },
  })

  if (!project) {
    notFound()
  }

  // Roles habilitados para generar Reportes Masivos (ARCH-20260623-01).
  const allowedRoles = ['ADMIN', 'DOCTOR_GENERAL', 'RECEPTIONIST']
  const canGenerateReport = allowedRoles.includes(role)

  // Shape consumido por ProjectMassiveReportModal (via conteos helper).
  // Mapeo explicito al subset de campos requeridos para evitar pasar
  // el modelo Prisma completo y mantener el contrato del modal.
  const workersForModal = project.workers.map((pw) => ({
    id: pw.workerId,
    event: pw.event
      ? {
          eventTests: pw.event.eventTests.map((et) => ({
            status: et.status as string,
            resultNotes: et.resultNotes,
          })),
        }
      : null,
  }))

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-slate-500">
        <Link href="/projects" className="hover:text-slate-800 transition-colors">
          Proyectos
        </Link>
        <span>›</span>
        <span className="text-slate-800 font-medium">{project.name}</span>
      </nav>

      {/* Encabezado */}
      <header className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">{project.name}</h1>
            <span
              className={`text-xs font-bold uppercase px-2 py-1 rounded-full border ${
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
          <p className="text-sm text-slate-600 mt-1">
            {project.company?.name ?? 'Sin empresa asignada'}
          </p>
          <div className="flex flex-wrap gap-4 mt-2 text-sm text-slate-600">
            <span>
              🗓️ {new Date(project.startDate).toLocaleDateString()} —{' '}
              {new Date(project.endDate).toLocaleDateString()}
            </span>
            {project.branchId && (
              <span>🏢 Sucursal AMI: {project.branchId}</span>
            )}
            {project.unitRef && <span>🏭 Unidad: {project.unitRef}</span>}
          </div>
        </div>

        {canGenerateReport && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <ProjectMassiveReportButton
              projectId={project.id}
              workers={workersForModal}
            />
          </div>
        )}
      </header>

      {/* Lista de trabajadores */}
      <section>
        <h2 className="text-lg font-semibold text-slate-900 mb-3">
          Trabajadores ({project._count.workers})
        </h2>
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          {project.workers.length === 0 ? (
            <div className="px-6 py-8 text-center text-sm text-slate-500">
              Este proyecto aún no tiene trabajadores asignados.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-slate-700">
                    Nombre
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-700">
                    Universal ID
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-700">
                    Recepción
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-700">
                    Evento clínico
                  </th>
                </tr>
              </thead>
              <tbody>
                {project.workers.map((pw) => (
                  <tr
                    key={pw.workerId}
                    className="border-b border-slate-100 last:border-b-0"
                  >
                    <td className="px-4 py-3 text-slate-900">
                      {pw.worker.firstName} {pw.worker.lastName}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">
                      {pw.worker.universalId}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs font-bold uppercase px-2 py-1 rounded-full border ${
                          pw.receptionStatus === 'CHECKED_IN'
                            ? 'bg-green-50 text-green-700 border-green-200'
                            : pw.receptionStatus === 'ARRIVED'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-slate-50 text-slate-700 border-slate-200'
                        }`}
                      >
                        {pw.receptionStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {pw.event ? (
                        <Link
                          href={`/events/${pw.event.id}`}
                          className="text-blue-600 hover:underline text-xs"
                        >
                          {pw.event.status} · Ver →
                        </Link>
                      ) : (
                        <span className="text-xs text-slate-400">
                          Sin evento aún
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {project.notes && (
        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-3">Notas</h2>
          <div className="bg-white rounded-lg border border-slate-200 p-4 text-sm text-slate-700 whitespace-pre-line">
            {project.notes}
          </div>
        </section>
      )}
    </div>
  )
}
