'use client'

/**
 * Vista calendario mensual para proyectos de visita médica.
 * @id IMPL-20260527-01
 * @spec context/SPECs/SPEC_ARCH-20260519-16-CALENDARIO-PROYECTOS-VISITAS.md
 * @backup context/checkpoints/CHK_IMPL-20260527-01-CALENDARIO-PROYECTOS.md
 */

import { useMemo, useState } from 'react'
import { ProjectStatus } from '@prisma/client'
import ProjectFormModal, { ProjectForEdit } from '@/components/ProjectFormModal'
import ProjectsTable from '@/components/ProjectsTable'

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
  companyId: string
  branchId: string | null
  company: { id: string; name: string }
  branch: { id: string; name: string } | null
  _count: { workers: number }
}

interface ProjectsCalendarProps {
  projects: ProjectItem[]
  companies: CompanyOption[]
  branches: BranchOption[]
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
  const [viewMode, setViewMode] = useState<ViewMode>('calendar')
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(new Date()))
  const [companyFilter, setCompanyFilter] = useState<string>('ALL')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
  const [editProject, setEditProject] = useState<ProjectForEdit | null>(null)
  const [editOpen, setEditOpen] = useState(false)

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

  function openEdit(project: ProjectItem) {
    setEditProject(toProjectForEdit(project))
    setEditOpen(true)
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
            <ProjectFormModal companies={companies} branches={branches} />
          </div>
        </div>

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
                          <button
                            key={`${project.id}-${day.toISOString()}`}
                            type="button"
                            onClick={() => openEdit(project)}
                            className={`w-full rounded-2xl border px-3 py-2 text-left text-xs shadow-sm transition-transform hover:-translate-y-0.5 ${STATUS_BADGES[project.status]}`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className="line-clamp-2 font-semibold">{project.name}</p>
                              <span className="shrink-0 rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-bold">
                                {project._count.workers}
                              </span>
                            </div>
                            <p className="mt-1 truncate text-[11px] font-medium">{project.company.name}</p>
                            <p className="truncate text-[11px]">{getUnitLabel(project)}</p>
                            <div className="mt-2 flex items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-wide">
                              <span>{STATUS_LABELS[project.status]}</span>
                              <span>{formatRange(project.startDate, project.endDate)}</span>
                            </div>
                          </button>
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
      </section>

      <ProjectFormModal
        companies={companies}
        branches={branches}
        projectToEdit={editProject}
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
      />
    </>
  )
}