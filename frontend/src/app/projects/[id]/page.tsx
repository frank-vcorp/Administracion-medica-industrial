/**
 * @file Detalle de Proyecto de Visita Médica.
 * @description Página server-side que muestra la empresa, unidad móvil, operación
 *              de trabajadores (alta Excel / manual / ingreso clínico) y accesos
 *              al modal de Reporte Masivo (ARCH-20260623-01).
 * @id IMPL-20260630-03
 * @see context/SPECs/SPEC_ARCH-20260623-01-MODULO-REPORTES-MASIVOS.md
 */
import { notFound } from 'next/navigation'
import Link from 'next/link'
import {
  Building2,
  Calendar,
  ClipboardCheck,
  Clock,
  FileCheck2,
  FolderKanban,
  Stethoscope,
  Truck,
  Users,
} from 'lucide-react'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/auth'
import prisma from '@/lib/prisma'
import { isAdminLike } from '@/lib/auth/roles'
import { getCompanies, getBranches } from '@/actions/admin.actions'
import { getMobileUnits } from '@/actions/mobile-unit.actions'
import {
  buildNotPerformedTestIdSet,
  isCheckoutEnabled,
  type ReceptionCheckoutTest,
} from '@/lib/clinical/reception-checkout'
import { isExamenMedicoCaptureClosed } from '@/lib/clinical/examen-medico-capture'
import { isExamenMedicoTestName } from '@/lib/clinical/examen-medico-variant'
import type { EventTestPipelineStatus } from '@/lib/clinical/study-status-display'
import { ProjectMassiveReportButton } from '@/components/projects/ProjectMassiveReportButton'
import {
  ProjectHeaderControls,
  ProjectWorkerRowActions,
  ProjectWorkersToolbar,
} from '@/components/projects/ProjectDetailControls'

export const dynamic = 'force-dynamic'

const PROJECT_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Borrador',
  CONFIRMED: 'Confirmado',
  IN_PROGRESS: 'En curso',
  COMPLETED: 'Completado',
  CANCELLED: 'Cancelado',
}

const RECEPTION_LABELS: Record<string, string> = {
  PENDING: 'Pendiente',
  ARRIVED: 'Llegó',
  CHECKED_IN: 'Ingresado',
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function ProjectDetailPage({ params }: PageProps) {
  const { id } = await params

  const session = await getServerSession(authOptions)
  const role = (session?.user?.role as string | undefined) ?? 'COMPANY_CLIENT'

  const canManage = ['SUPERADMIN', 'ADMIN', 'RECEPTIONIST'].includes(role)
  const canGenerateReport = [
    'SUPERADMIN',
    'ADMIN',
    'DOCTOR_GENERAL',
    'DOCTOR_VALIDATOR',
    'RECEPTIONIST',
  ].includes(role)

  const [project, companiesRaw, branchesRaw, mobileUnitsRaw] = await Promise.all([
    prisma.project.findUnique({
      where: { id },
      include: {
        company: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
        mobileUnit: { select: { id: true, name: true, plate: true } },
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
                dischargedAt: true,
                exam: {
                  select: {
                    physicalExamData: true,
                  },
                },
                verdict: {
                  select: {
                    id: true,
                    pdfUrl: true,
                    finalDiagnosis: true,
                  },
                },
                eventTests: {
                  select: {
                    id: true,
                    status: true,
                    testNameSnapshot: true,
                    resultNotes: true,
                  },
                  orderBy: { createdAt: 'asc' },
                },
              },
            },
          },
          orderBy: { addedAt: 'desc' },
        },
        reports: {
          orderBy: { generatedAt: 'desc' },
          take: 5,
        },
        _count: { select: { workers: true } },
      },
    }),
    canManage ? getCompanies() : Promise.resolve([]),
    canManage ? getBranches() : Promise.resolve([]),
    canManage ? getMobileUnits() : Promise.resolve([]),
  ])

  if (!project) {
    notFound()
  }

  const eventIds = project.workers
    .map((pw) => pw.event?.id)
    .filter((eventId): eventId is string => Boolean(eventId))

  const timelineEntries =
    eventIds.length === 0
      ? []
      : await prisma.papeletaTimelineEntry.findMany({
          where: {
            eventId: { in: eventIds },
            eventTestId: { not: null },
            entryType: { in: ['ADMIN_INCIDENCE', 'STUDY_NOT_PERFORMED'] },
          },
          select: { eventId: true, eventTestId: true, entryType: true },
        })

  const incidencesByEvent = new Map<string, Set<string>>()
  for (const entry of timelineEntries) {
    if (!entry.eventTestId) continue
    const set = incidencesByEvent.get(entry.eventId) ?? new Set<string>()
    for (const testId of buildNotPerformedTestIdSet([entry])) {
      set.add(testId)
    }
    incidencesByEvent.set(entry.eventId, set)
  }

  const checkoutReadyByEventId = new Map<string, boolean>()
  let pendingEntryCount = 0
  let inAttentionCount = 0
  let inValidationCount = 0
  let dictaminatedCount = 0

  for (const pw of project.workers) {
    if (!pw.event) {
      pendingEntryCount += 1
      continue
    }

    const hasVerdict = Boolean(pw.event.verdict?.pdfUrl)
    if (hasVerdict) {
      dictaminatedCount += 1
    } else if (pw.event.status !== 'CANCELED') {
      if (pw.event.dischargedAt === null) {
        inAttentionCount += 1
      } else {
        inValidationCount += 1
      }
    }

    const notPerformedIds = incidencesByEvent.get(pw.event.id) ?? new Set<string>()
    const physicalExamData =
      (pw.event.exam?.physicalExamData as Record<string, unknown> | null | undefined) ?? null
    const captureClosed = isExamenMedicoCaptureClosed(physicalExamData)
    const checkoutTests: ReceptionCheckoutTest[] = pw.event.eventTests.map((t) => ({
      id: t.id,
      status: t.status as EventTestPipelineStatus,
      testNameSnapshot: t.testNameSnapshot,
      examenCaptureClosed: isExamenMedicoTestName(t.testNameSnapshot)
        ? captureClosed || t.status === 'RESULT_REGISTERED' || t.status === 'COMPLETED'
        : undefined,
    }))
    checkoutReadyByEventId.set(
      pw.event.id,
      isCheckoutEnabled(
        {
          dischargedAt: pw.event.dischargedAt,
          eventTests: checkoutTests,
        },
        notPerformedIds,
      ),
    )
  }

  const operationalKpis = [
    {
      label: 'Por ingresar',
      value: pendingEntryCount,
      icon: Clock,
      iconClass: 'bg-slate-100 text-slate-600',
    },
    {
      label: 'En atención UMM',
      value: inAttentionCount,
      icon: Stethoscope,
      iconClass: 'bg-amber-50 text-amber-600',
    },
    {
      label: 'En validación médica',
      value: inValidationCount,
      icon: ClipboardCheck,
      iconClass: 'bg-violet-50 text-violet-700',
    },
    {
      label: 'Dictaminados',
      value: dictaminatedCount,
      icon: FileCheck2,
      iconClass: 'bg-emerald-50 text-emerald-600',
    },
  ]

  const companyOptions = companiesRaw.map((c: { id: string; name: string }) => ({
    id: c.id,
    name: c.name,
  }))
  const branchOptions = branchesRaw.map((b: { id: string; name: string }) => ({
    id: b.id,
    name: b.name,
  }))
  const mobileUnitOptions = mobileUnitsRaw.map(
    (u: { id: string; name: string; plate: string | null; status: string }) => ({
      id: u.id,
      name: u.name,
      plate: u.plate,
      status: u.status,
    })
  )

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

  const mobileUnitLabel = project.mobileUnit
    ? `${project.mobileUnit.name}${project.mobileUnit.plate ? ` · ${project.mobileUnit.plate}` : ''}`
    : project.unitRef

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-slate-500">
        <Link href="/projects" className="hover:text-[#592c82] transition-colors">
          Proyectos
        </Link>
        <span>›</span>
        <span className="text-slate-800 font-medium">{project.name}</span>
      </nav>

      {/* Encabezado */}
      <header className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#592c82]/15 text-[#592c82]">
              <FolderKanban className="h-5 w-5" />
            </span>
            <h1 className="text-2xl font-bold text-slate-900">{project.name}</h1>
            <span
              className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
                project.status === 'COMPLETED'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : project.status === 'IN_PROGRESS'
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : project.status === 'CONFIRMED'
                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                  : project.status === 'CANCELLED'
                  ? 'bg-red-50 text-red-700 border-red-200'
                  : 'bg-slate-50 text-slate-700 border-slate-200'
              }`}
            >
              {PROJECT_STATUS_LABELS[project.status] ?? project.status}
            </span>
          </div>
          <p className="text-sm text-slate-600 mt-2">
            {project.company?.name ?? 'Sin empresa asignada'}
          </p>
          <div className="flex flex-wrap gap-3 mt-3 text-sm text-slate-600">
            <span className="inline-flex items-center gap-2">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#592c82]/12 text-[#592c82]">
                <Calendar className="h-3.5 w-3.5" />
              </span>
              {new Date(project.startDate).toLocaleDateString('es-MX')} —{' '}
              {new Date(project.endDate).toLocaleDateString('es-MX')}
            </span>
            {project.branch?.name && (
              <span className="inline-flex items-center gap-2">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#592c82]/12 text-[#592c82]">
                  <Building2 className="h-3.5 w-3.5" />
                </span>
                Sucursal SME: {project.branch.name}
              </span>
            )}
            {mobileUnitLabel && (
              <span className="inline-flex items-center gap-2">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#592c82]/12 text-[#592c82]">
                  <Truck className="h-3.5 w-3.5" />
                </span>
                {project.mobileUnit ? (
                  <Link
                    href={`/admin/mobile-units/${project.mobileUnit.id}`}
                    className="font-medium text-[#592c82] hover:underline"
                  >
                    Unidad: {mobileUnitLabel}
                  </Link>
                ) : (
                  <span>Unidad: {mobileUnitLabel}</span>
                )}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col items-stretch lg:items-end gap-2.5 flex-shrink-0">
          <ProjectHeaderControls
            project={{
              id: project.id,
              name: project.name,
              status: project.status,
              companyId: project.companyId,
              startDate: project.startDate,
              endDate: project.endDate,
              branchId: project.branchId,
              mobileUnitId: project.mobileUnitId,
              unitRef: project.unitRef,
              notes: project.notes,
            }}
            companies={companyOptions}
            branches={branchOptions}
            mobileUnits={mobileUnitOptions}
            canManage={canManage}
            canDelete={isAdminLike(role)}
          />
          {canGenerateReport && (
            <ProjectMassiveReportButton
              projectId={project.id}
              workers={workersForModal}
            />
          )}
        </div>
      </header>

      {/* KPIs operativos del proyecto */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {operationalKpis.map((kpi) => {
          const Icon = kpi.icon
          return (
            <div
              key={kpi.label}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {kpi.label}
                </span>
                <span
                  className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${kpi.iconClass}`}
                >
                  <Icon className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-2 text-2xl font-bold text-slate-900">{kpi.value}</p>
            </div>
          )
        })}
      </section>

      {/* Lista de trabajadores */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#592c82]/12 text-[#592c82]">
              <Users className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Trabajadores ({project._count.workers})
              </h2>
              <p className="text-xs text-slate-500">
                Carga masiva o registro individual, recepción e ingreso a atención médica
              </p>
            </div>
          </div>

          <ProjectWorkersToolbar
            projectId={project.id}
            companyId={project.companyId}
            companies={companyOptions}
            branches={branchOptions}
            canManage={canManage}
          />
        </div>

        <div className="rounded-xl border border-slate-200 overflow-x-auto">
          {project.workers.length === 0 ? (
            <div className="px-6 py-10 text-center space-y-2">
              <p className="text-sm font-medium text-slate-600">
                Este proyecto aún no tiene trabajadores asignados.
              </p>
              <p className="text-xs text-slate-500">
                Usa <strong>+ Alta masiva (Excel)</strong> para subir tu padrón o{' '}
                <strong>+ Agregar trabajador</strong> en la parte superior derecha de esta sección.
              </p>
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
                    Dictamen / Estudios
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-700">
                    Operación / Expediente
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {project.workers.map((pw) => {
                  const totalTests = pw.event?.eventTests.length ?? 0
                  const readyTests =
                    pw.event?.eventTests.filter(
                      (t) =>
                        t.status === 'COMPLETED' || t.status === 'RESULT_REGISTERED',
                    ).length ?? 0
                  const hasVerdict = Boolean(pw.event?.verdict?.pdfUrl)

                  return (
                    <tr
                      key={pw.workerId}
                      className="hover:bg-slate-50/70 transition-colors"
                    >
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {pw.worker.firstName} {pw.worker.lastName}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">
                        {pw.worker.universalId}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
                            pw.receptionStatus === 'CHECKED_IN'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : pw.receptionStatus === 'ARRIVED'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-slate-50 text-slate-700 border-slate-200'
                          }`}
                        >
                          {RECEPTION_LABELS[pw.receptionStatus] ?? pw.receptionStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {hasVerdict ? (
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Dictaminado
                            </span>
                          ) : (
                            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-50 text-slate-500 border border-slate-200">
                              Sin dictamen
                            </span>
                          )}
                          <span className="text-xs text-slate-500">
                            {readyTests}/{totalTests} estudios
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <ProjectWorkerRowActions
                          projectId={project.id}
                          workerId={pw.workerId}
                          receptionStatus={pw.receptionStatus}
                          eventId={pw.event?.id ?? null}
                          eventStatus={(pw.event?.status as string | undefined) ?? null}
                          dischargedAt={
                            pw.event?.dischargedAt
                              ? pw.event.dischargedAt.toISOString()
                              : null
                          }
                          checkoutReady={
                            pw.event
                              ? (checkoutReadyByEventId.get(pw.event.id) ?? false)
                              : false
                          }
                          hasVerdict={hasVerdict}
                          canManage={canManage}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {project.notes && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 mb-2">
            Notas del proyecto
          </h2>
          <div className="text-sm text-slate-700 whitespace-pre-line">
            {project.notes}
          </div>
        </section>
      )}
    </div>
  )
}
