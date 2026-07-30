'use client'

/**
 * Vista calendario mensual para proyectos de visita médica.
 * @id IMPL-20260527-01
 * @spec context/SPECs/SPEC_ARCH-20260519-16-CALENDARIO-PROYECTOS-VISITAS.md
 * @backup context/checkpoints/CHK_IMPL-20260527-01-CALENDARIO-PROYECTOS.md
 * @id IMPL-20260527-03
 * @spec context/SPECs/SPEC_ARCH-20260527-03-ALTA-MASIVA-DESDE-PROYECTO.md
 * @backup context/checkpoints/CHK_IMPL-20260527-03-ALTA-MASIVA-DESDE-PROYECTO.md
 */

import { useMemo, useState } from 'react'
import { ProjectStatus } from '@prisma/client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import BulkWorkerImportModal from '@/components/BulkWorkerImportModal'
import ProjectFormModal, { ProjectForEdit } from '@/components/ProjectFormModal'
import ProjectsTable from '@/components/ProjectsTable'
import { checkInProjectWorkerToClinical, markProjectWorkerArrived } from '@/actions/project.actions'

interface CompanyOption {
  id: string
  name: string
}

interface BranchOption {
  id: string
  name: string
}

interface ProjectItem {
  id: string
  name: string
  status: ProjectStatus
  startDate: Date | string
  endDate: Date | string
  unitRef: string | null
  notes: string | null
  companyId: string | null // ARCH-20260730-01: nullable tras eliminación de empresa
  branchId: string | null
  company: { id: string; name: string } | null
  branch: { id: string; name: string } | null
  _count: { workers: number }
  workers: {
    workerId: string
    receptionStatus: 'PENDING' | 'ARRIVED' | 'CHECKED_IN'
    arrivedAt: Date | string | null
    eventId: string | null
    worker: {
      id: string
      universalId: string
      firstName: string
      lastName: string
    }
  }[]
}

interface ProjectsCalendarProps {
  projects: ProjectItem[]
  companies: CompanyOption[]
  branches: BranchOption[]
}

interface BulkImportContext {
  projectId: string
  projectName: string
  companyId: string | null // ARCH-20260730-01: nullable tras eliminación de empresa
}

type ViewMode = 'calendar' | 'table'
type StatusFilter = ProjectStatus | 'ALL'

const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom']
const STATUS_LABELS: Record<ProjectStatus, string> = {
  DRAFT: 'Borrador',
  CONFIRMED: 'Confirmado',
  IN_PROGRESS: 'En curso',
  COMPLETED: 'Completado',
  CANCELLED: 'Cancelado',
}
const STATUS_OPTIONS: ProjectStatus[] = ['DRAFT', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']
const STATUS_BADGES: Record<ProjectStatus, string> = {
  DRAFT: 'border-slate-200 bg-slate-100 text-slate-700',
  CONFIRMED: 'border-blue-200 bg-blue-50 text-blue-700',
  IN_PROGRESS: 'border-amber-200 bg-amber-50 text-amber-700',
  COMPLETED: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  CANCELLED: 'border-red-200 bg-red-50 text-red-700',
}
const RECEPTION_STATUS_LABELS: Record<'PENDING' | 'ARRIVED' | 'CHECKED_IN', string> = {
  PENDING: 'Pendiente',
  ARRIVED: 'Llegado',
  CHECKED_IN: 'Ingresado',
}
const RECEPTION_STATUS_BADGES: Record<'PENDING' | 'ARRIVED' | 'CHECKED_IN', string> = {
  PENDING: 'border-slate-200 bg-slate-100 text-slate-700',
  ARRIVED: 'border-amber-200 bg-amber-50 text-amber-700',
  CHECKED_IN: 'border-emerald-200 bg-emerald-50 text-emerald-700',
}

function toDate(value: Date | string) {
  return value instanceof Date ? value : new Date(value)
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1)
}

function addDays(date: Date, amount: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + amount)
  return next
}

function startOfGrid(month: Date) {
  const firstDay = startOfMonth(month)
  const weekday = (firstDay.getDay() + 6) % 7
  return addDays(firstDay, -weekday)
}

function isSameDay(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate()
}

function isSameMonth(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth()
}

function overlapsMonth(project: ProjectItem, month: Date) {
  const monthStart = startOfMonth(month)
  const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0, 23, 59, 59, 999)
  const projectStart = toDate(project.startDate)
  const projectEnd = toDate(project.endDate)
  return projectStart <= monthEnd && projectEnd >= monthStart
}

function isProjectActiveOnDay(project: ProjectItem, day: Date) {
  const projectStart = toDate(project.startDate)
  const projectEnd = toDate(project.endDate)
  const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, 0, 0, 0)
  const dayEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59, 999)
  return projectStart <= dayEnd && projectEnd >= dayStart
}

function formatMonthLabel(month: Date) {
  return month.toLocaleDateString('es-MX', {
    month: 'long',
    year: 'numeric',
  })
}

function formatRange(startDate: Date | string, endDate: Date | string) {
  const start = toDate(startDate)
  const end = toDate(endDate)
  return `${start.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })} - ${end.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}`
}

function getUnitLabel(project: ProjectItem) {
  return project.unitRef ?? project.branch?.name ?? 'Planta cliente'
}

function toProjectForEdit(project: ProjectItem): ProjectForEdit {
  return {
    id: project.id,
    name: project.name,
    companyId: project.companyId,
    startDate: project.startDate,
    endDate: project.endDate,
    branchId: project.branchId,
    unitRef: project.unitRef,
    notes: project.notes,
  }
}

export default function ProjectsCalendar({ projects, companies, branches }: ProjectsCalendarProps) {
  const router = useRouter()
  const [viewMode, setViewMode] = useState<ViewMode>('calendar')
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(new Date()))
  const [companyFilter, setCompanyFilter] = useState<string>('ALL')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
  const [editProject, setEditProject] = useState<ProjectForEdit | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [bulkImportContext, setBulkImportContext] = useState<BulkImportContext | null>(null)
  const [showBulkImportBanner, setShowBulkImportBanner] = useState(false)
  const [bulkImportOpen, setBulkImportOpen] = useState(false)
  const [bulkImportMode, setBulkImportMode] = useState<'excel' | 'quick'>('excel')
  const [receptionProjectId, setReceptionProjectId] = useState<string | null>(null)
  const [workerActionKey, setWorkerActionKey] = useState<string | null>(null)
  const [receptionError, setReceptionError] = useState<string | null>(null)

  const filteredProjects = useMemo(() => {
    return [...projects]
      .filter((project) => companyFilter === 'ALL' || project.companyId === companyFilter)
      .filter((project) => statusFilter === 'ALL' || project.status === statusFilter)
      .sort((left, right) => toDate(left.startDate).getTime() - toDate(right.startDate).getTime())
  }, [companyFilter, projects, statusFilter])

  const visibleProjects = useMemo(() => {
    return filteredProjects.filter((project) => overlapsMonth(project, visibleMonth))
  }, [filteredProjects, visibleMonth])

  const tableProjects = useMemo(() => {
    return filteredProjects.map((project) => ({
      ...project,
      startDate: toDate(project.startDate),
      endDate: toDate(project.endDate),
    }))
  }, [filteredProjects])

  const gridDays = useMemo(() => {
    const firstGridDay = startOfGrid(visibleMonth)
    return Array.from({ length: 42 }, (_, index) => addDays(firstGridDay, index))
  }, [visibleMonth])

  const selectedReceptionProject = useMemo(() => {
    if (!receptionProjectId) return null
    return projects.find((project) => project.id === receptionProjectId) ?? null
  }, [projects, receptionProjectId])

  const receptionWorkers = useMemo(() => {
    if (!selectedReceptionProject) return []
    return [...selectedReceptionProject.workers].sort((left, right) => {
      const leftName = `${left.worker.lastName} ${left.worker.firstName}`
      const rightName = `${right.worker.lastName} ${right.worker.firstName}`
      return leftName.localeCompare(rightName, 'es-MX')
    })
  }, [selectedReceptionProject])

  const receptionMetrics = useMemo(() => {
    return receptionWorkers.reduce(
      (acc, row) => {
        if (row.receptionStatus === 'PENDING') acc.pending += 1
        if (row.receptionStatus === 'ARRIVED') acc.arrived += 1
        if (row.receptionStatus === 'CHECKED_IN') acc.checkedIn += 1
        return acc
      },
      { pending: 0, arrived: 0, checkedIn: 0 }
    )
  }, [receptionWorkers])

  function formatArrivedAt(value: Date | string | null) {
    if (!value) return '—'
    const date = toDate(value)
    return date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
  }

  async function handleMarkArrival(projectId: string, workerId: string) {
    setReceptionError(null)
    const actionKey = `${projectId}:${workerId}:ARRIVED`
    setWorkerActionKey(actionKey)
    const result = await markProjectWorkerArrived(projectId, workerId)
    setWorkerActionKey(null)
    if (!result.success) {
      setReceptionError(result.error ?? 'No se pudo marcar llegada.')
      return
    }
    router.refresh()
  }

  async function handleCheckIn(projectId: string, workerId: string) {
    setReceptionError(null)
    const actionKey = `${projectId}:${workerId}:CHECKED_IN`
    setWorkerActionKey(actionKey)
    const result = await checkInProjectWorkerToClinical(projectId, workerId)
    setWorkerActionKey(null)
    if (!result.success) {
      setReceptionError(result.error ?? 'No se pudo ingresar a clínica.')
      return
    }
    if (result.eventId) {
      router.push(`/events/${result.eventId}`)
      return
    }
    router.refresh()
  }

  function openEdit(project: ProjectItem) {
    setEditProject(toProjectForEdit(project))
    setEditOpen(true)
  }

  function handleProjectCreated(projectId: string, projectName: string, companyId?: string) {
    if (!companyId) return
    setBulkImportContext({ projectId, projectName, companyId })
    setShowBulkImportBanner(true)
  }

  function handleStartBulkImport() {
    setShowBulkImportBanner(false)
    setBulkImportMode('excel')
    setBulkImportOpen(true)
  }

  function handleStartQuickIntake() {
    setBulkImportContext(null)
    setShowBulkImportBanner(false)
    setBulkImportMode('quick')
    setBulkImportOpen(true)
  }

  return (
    <>
      <section className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div>
              <h2 className="text-3xl font-black tracking-tight text-slate-900">Calendario de Proyectos</h2>
              <p className="text-sm font-medium text-slate-500">
                Vista mensual operativa para campañas y visitas médicas por empresa.
              </p>
            </div>

            <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
              <button
                type="button"
                onClick={() => setViewMode('calendar')}
                className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${viewMode === 'calendar' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                Calendario
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${viewMode === 'table' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                Tabla
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <ProjectFormModal
              companies={companies}
              branches={branches}
              onSuccess={handleProjectCreated}
            />
            <button
              type="button"
              onClick={handleStartQuickIntake}
              className="inline-flex items-center gap-2 rounded-lg border border-blue-300 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-100"
            >
              Alta rápida hoy
            </button>
          </div>
        </div>

        {bulkImportContext && showBulkImportBanner && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-bold text-emerald-800">Proyecto creado: {bulkImportContext.projectName}</p>
                <p className="text-xs font-medium text-emerald-700">Puedes iniciar la alta masiva inmediata con empresa y proyecto preseleccionados.</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowBulkImportBanner(false)
                    setBulkImportContext(null)
                  }}
                  className="rounded-lg border border-emerald-300 px-3 py-2 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100"
                >
                  Omitir
                </button>
                <button
                  type="button"
                  onClick={handleStartBulkImport}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-700"
                >
                  Iniciar alta masiva
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setVisibleMonth((current) => addMonths(current, -1))}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
              >
                Mes anterior
              </button>
              <button
                type="button"
                onClick={() => setVisibleMonth(() => startOfMonth(new Date()))}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
              >
                Hoy
              </button>
              <button
                type="button"
                onClick={() => setVisibleMonth((current) => addMonths(current, 1))}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
              >
                Mes siguiente
              </button>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Mes visible</p>
                <p className="text-lg font-bold capitalize text-slate-900">{formatMonthLabel(visibleMonth)}</p>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <label className="space-y-1 text-sm text-slate-600">
                <span className="block text-xs font-semibold uppercase tracking-wide text-slate-400">Empresa</span>
                <select
                  value={companyFilter}
                  onChange={(event) => setCompanyFilter(event.target.value)}
                  className="min-w-[180px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none"
                >
                  <option value="ALL">Todas las empresas</option>
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>{company.name}</option>
                  ))}
                </select>
              </label>

              <label className="space-y-1 text-sm text-slate-600">
                <span className="block text-xs font-semibold uppercase tracking-wide text-slate-400">Estado</span>
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
                  className="min-w-[180px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none"
                >
                  <option value="ALL">Todos los estados</option>
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>{STATUS_LABELS[status]}</option>
                  ))}
                </select>
              </label>

              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Resumen</p>
                <p className="text-sm font-semibold text-slate-700">{visibleProjects.length} proyectos en el mes</p>
                <p className="text-xs text-slate-500">{filteredProjects.length} proyectos coinciden con los filtros activos</p>
              </div>
            </div>
          </div>

          {visibleProjects.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Recepción por proyecto</p>
              {visibleProjects.slice(0, 8).map((project) => (
                <button
                  key={`queue-${project.id}`}
                  type="button"
                  onClick={() => setReceptionProjectId(project.id)}
                  className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors ${receptionProjectId === project.id ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
                >
                  {project.name}
                </button>
              ))}
            </div>
          )}

          {viewMode === 'calendar' ? (
            <div className="mt-6 space-y-3">
              <div className="grid grid-cols-7 gap-2">
                {WEEKDAY_LABELS.map((label) => (
                  <div key={label} className="rounded-xl bg-slate-100 px-3 py-2 text-center text-xs font-bold uppercase tracking-wide text-slate-500">
                    {label}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-2 md:grid-cols-7">
                {gridDays.map((day) => {
                  const projectsOnDay = visibleProjects.filter((project) => isProjectActiveOnDay(project, day))
                  const visibleItems = projectsOnDay.slice(0, 3)
                  const hiddenCount = Math.max(projectsOnDay.length - visibleItems.length, 0)
                  const isCurrentMonth = isSameMonth(day, visibleMonth)
                  const isToday = isSameDay(day, new Date())

                  return (
                    <div
                      key={day.toISOString()}
                      className={`min-h-44 rounded-2xl border p-3 ${isCurrentMonth ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50/80'} ${isToday ? 'ring-2 ring-blue-200' : ''}`}
                    >
                      <div className="mb-3 flex items-center justify-between">
                        <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${isToday ? 'bg-blue-600 text-white' : isCurrentMonth ? 'bg-slate-100 text-slate-700' : 'bg-slate-100 text-slate-400'}`}>
                          {day.getDate()}
                        </span>
                        {projectsOnDay.length > 0 && (
                          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                            {projectsOnDay.length} activos
                          </span>
                        )}
                      </div>

                      <div className="space-y-2">
                        {visibleItems.map((project) => (
                          <div
                            key={`${project.id}-${day.toISOString()}`}
                            className={`w-full rounded-2xl border px-3 py-2 text-left text-xs shadow-sm transition-transform hover:-translate-y-0.5 ${STATUS_BADGES[project.status]}`}
                          >
                            <button type="button" onClick={() => openEdit(project)} className="w-full text-left">
                              <div className="flex items-start justify-between gap-2">
                                <p className="line-clamp-2 font-semibold">{project.name}</p>
                                <span className="shrink-0 rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-bold">
                                  {project._count.workers}
                                </span>
                              </div>
                              <p className="mt-1 truncate text-[11px] font-medium">{project.company?.name ?? '— sin empresa —'}</p>
                              <p className="truncate text-[11px]">{getUnitLabel(project)}</p>
                              <div className="mt-2 flex items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-wide">
                                <span>{STATUS_LABELS[project.status]}</span>
                                <span>{formatRange(project.startDate, project.endDate)}</span>
                              </div>
                            </button>
                            <div className="mt-2 border-t border-white/70 pt-2">
                              <button
                                type="button"
                                onClick={() => setReceptionProjectId(project.id)}
                                className="w-full rounded-lg border border-white/80 bg-white/80 px-2 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-700 hover:bg-white"
                              >
                                Recepción
                              </button>
                            </div>
                          </div>
                        ))}

                        {hiddenCount > 0 && (
                          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500">
                            +{hiddenCount} mas
                          </div>
                        )}

                        {projectsOnDay.length === 0 && isCurrentMonth && (
                          <div className="rounded-xl border border-dashed border-slate-200 px-3 py-4 text-center text-[11px] text-slate-400">
                            Sin proyectos
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="mt-6">
              <ProjectsTable projects={tableProjects} companies={companies} branches={branches} />
            </div>
          )}
        </div>

        {selectedReceptionProject && (
          <div className="mt-6 rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-500">Panel de recepción</p>
                <h3 className="text-xl font-black text-slate-900">{selectedReceptionProject.name}</h3>
                <p className="text-xs font-medium text-slate-500">
                  {selectedReceptionProject.company?.name ?? '— sin empresa —'} · {getUnitLabel(selectedReceptionProject)}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-center">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Pendientes</p>
                  <p className="text-lg font-black text-slate-700">{receptionMetrics.pending}</p>
                </div>
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-center">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-amber-500">Llegados</p>
                  <p className="text-lg font-black text-amber-700">{receptionMetrics.arrived}</p>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-center">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-500">Ingresados</p>
                  <p className="text-lg font-black text-emerald-700">{receptionMetrics.checkedIn}</p>
                </div>
              </div>
            </div>

            {receptionError && (
              <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                {receptionError}
              </div>
            )}

            <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
              <table className="min-w-full divide-y divide-slate-100">
                <thead className="bg-slate-50">
                  <tr className="text-left text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">
                    <th className="px-3 py-2">Trabajador</th>
                    <th className="px-3 py-2">Estado</th>
                    <th className="px-3 py-2">Llegada</th>
                    <th className="px-3 py-2">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {receptionWorkers.map((row) => {
                    const arrivalKey = `${selectedReceptionProject.id}:${row.workerId}:ARRIVED`
                    const checkInKey = `${selectedReceptionProject.id}:${row.workerId}:CHECKED_IN`
                    const isBusyArrival = workerActionKey === arrivalKey
                    const isBusyCheckIn = workerActionKey === checkInKey
                    const fullName = `${row.worker.lastName}, ${row.worker.firstName}`

                    return (
                      <tr key={`${selectedReceptionProject.id}:${row.workerId}`}>
                        <td className="px-3 py-2">
                          <p className="font-semibold text-slate-800">{fullName}</p>
                          <p className="text-xs text-slate-500">#{row.worker.universalId}</p>
                        </td>
                        <td className="px-3 py-2">
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${RECEPTION_STATUS_BADGES[row.receptionStatus]}`}>
                            {RECEPTION_STATUS_LABELS[row.receptionStatus]}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-xs font-medium text-slate-600">{formatArrivedAt(row.arrivedAt)}</td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap items-center gap-2">
                            {row.receptionStatus === 'PENDING' && (
                              <button
                                type="button"
                                disabled={isBusyArrival || Boolean(workerActionKey)}
                                onClick={() => handleMarkArrival(selectedReceptionProject.id, row.workerId)}
                                className="rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {isBusyArrival ? 'Marcando...' : 'Marcar llegada'}
                              </button>
                            )}
                            {row.receptionStatus !== 'CHECKED_IN' && (
                              <button
                                type="button"
                                disabled={isBusyCheckIn || Boolean(workerActionKey)}
                                onClick={() => handleCheckIn(selectedReceptionProject.id, row.workerId)}
                                className="rounded-lg border border-blue-300 bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {isBusyCheckIn ? 'Ingresando...' : 'Ingresar a clínica'}
                              </button>
                            )}
                            {row.eventId && (
                              <Link
                                href={`/events/${row.eventId}`}
                                className="rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100"
                              >
                                Abrir evento
                              </Link>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      <ProjectFormModal
        companies={companies}
        branches={branches}
        projectToEdit={editProject}
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
      />

      <BulkWorkerImportModal
        companies={companies}
        branches={branches}
        isOpen={bulkImportOpen}
        onOpenChange={setBulkImportOpen}
        initialCompanyId={bulkImportContext?.companyId ?? undefined}
        initialProjectId={bulkImportContext?.projectId}
        lockProjectContext={Boolean(bulkImportContext)}
        initialMode={bulkImportMode}
        hideTrigger
      />
    </>
  )
}