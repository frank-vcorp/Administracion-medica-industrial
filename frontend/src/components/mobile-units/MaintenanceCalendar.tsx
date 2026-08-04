/**
 * @file Componente cliente de calendario de mantenimiento mensual.
 * @id IMPL-20260711-01 — SPEC §5.5
 * @id ARCH-20260804-03 — Paridad visual con ProjectsCalendar, superposición de proyectos,
 *                         conflictos visuales proyecto↔mantenimiento.
 *
 * Vista mes con eventos coloreados por tipo de mantenimiento (pills) y proyectos de la
 * unidad superpuestos (pills STATUS_BADGES), lista alternativa, modal de programar
 * (crear), modal de reprogramar (cuando hay conflicto) y modal de completar.
 *
 * Llama a las server actions de mantenimiento (create/reprogram/complete).
 */
'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  createMaintenanceRecord,
  reprogramMaintenance,
  completeMaintenance,
  getMaintenanceRecords,
} from '@/actions/maintenance.actions'
import { validateUnitAvailability } from '@/actions/project.actions'
import ProjectFormModal, { ProjectForEdit } from '@/components/ProjectFormModal'
import {
  startOfMonth,
  addDays,
  startOfGrid,
  isSameDay,
  isSameMonth,
  formatMonthLabel,
  toDate,
  isProjectActiveOnDay,
  STATUS_BADGES,
  STATUS_LABELS,
} from '@/lib/calendar-utils'
import type { UnitProjectItem, CalendarConflict } from '@/components/mobile-units/maintenance-calendar-types'

const TYPE_LABEL: Record<string, string> = {
  PREVENTIVO: 'Preventivo',
  CORRECTIVO: 'Correctivo',
  VERIFICACION: 'Verificación',
  LIMPIEZA: 'Limpieza',
}

// SPEC §5.6 — pills de leyenda modernizadas (paridad ProjectsCalendar)
const MAINTENANCE_TYPE_BADGES: Record<string, string> = {
  PREVENTIVO: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  CORRECTIVO: 'border-red-200 bg-red-50 text-red-700',
  VERIFICACION: 'border-blue-200 bg-blue-50 text-blue-700',
  LIMPIEZA: 'border-violet-200 bg-violet-50 text-violet-700',
}

const STATUS_PILL_COLORS: Record<string, string> = {
  PROGRAMADO: 'bg-amber-100 text-amber-700',
  COMPLETADO: 'bg-emerald-100 text-emerald-700',
  CANCELADO: 'bg-slate-100 text-slate-500',
  REPROGRAMADO: 'bg-violet-100 text-violet-700 border-violet-300',
}

const TYPE_OPTIONS = [
  { value: 'PREVENTIVO', label: 'Preventivo' },
  { value: 'CORRECTIVO', label: 'Correctivo' },
  { value: 'VERIFICACION', label: 'Verificación' },
  { value: 'LIMPIEZA', label: 'Limpieza' },
]

const STATUS_FILTER_OPTIONS = [
  { value: 'ALL', label: 'Todos los estados' },
  { value: 'PROGRAMADO', label: 'Programado' },
  { value: 'REPROGRAMADO', label: 'Reprogramado' },
  { value: 'COMPLETADO', label: 'Completado' },
  { value: 'CANCELADO', label: 'Cancelado' },
]

const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom']

type Maintenance = Awaited<ReturnType<typeof getMaintenanceRecords>>[number]

interface MaintenanceCalendarProps {
  unitId: string
  initialRecords: Maintenance[]
  unitProjects: UnitProjectItem[]
  unitName: string
}

export default function MaintenanceCalendar({
  unitId,
  initialRecords,
  unitProjects,
  unitName: _unitName,
}: MaintenanceCalendarProps) {
  void _unitName
  const router = useRouter()
  const [records, setRecords] = useState<Maintenance[]>(initialRecords)
  const [month, setMonth] = useState<Date>(() => new Date())
  const [view, setView] = useState<'calendar' | 'list'>('calendar')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  void startTransition
  void isPending

  // SPEC §6.4 — toggle "Mostrar proyectos superpuestos" (default ON)
  const [showProjects, setShowProjects] = useState(true)

  const [typeFilter, setTypeFilter] = useState<string>('ALL')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')

  const monthStart = useMemo(() => startOfMonth(month), [month])
  const monthEnd = useMemo(
    () => new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1),
    [monthStart]
  )

  const recordsInMonth = useMemo(() => {
    return records.filter((r) => {
      const d = toDate(r.scheduledDate)
      return d >= monthStart && d < monthEnd
    })
  }, [records, monthStart, monthEnd])

  // SPEC §5.7 — Grid 6×7 empezando en lunes
  const gridDays = useMemo(() => {
    const firstGridDay = startOfGrid(monthStart)
    return Array.from({ length: 42 }, (_, index) => addDays(firstGridDay, index))
  }, [monthStart])

  const byDay = useMemo(() => {
    const map = new Map<string, Maintenance[]>()
    for (const r of recordsInMonth) {
      const d = toDate(r.scheduledDate)
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
      const arr = map.get(key) ?? []
      arr.push(r)
      map.set(key, arr)
    }
    return map
  }, [recordsInMonth])

  // SPEC §7.1 — Detección de conflictos client-side (presentación, no negocio)
  const conflictsByDay = useMemo(() => {
    const map = new Map<string, CalendarConflict[]>()
    if (!showProjects) return map
    for (const day of gridDays) {
      const key = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`
      const dayRecords = byDay.get(key) ?? []
      const hasActiveMaintenance = dayRecords.some(
        (r) => r.status === 'PROGRAMADO' || r.status === 'REPROGRAMADO'
      )
      const projectsOnDay = unitProjects.filter((p) => isProjectActiveOnDay(p, day))
      if (hasActiveMaintenance && projectsOnDay.length > 0) {
        const conflicts: CalendarConflict[] = []
        for (const r of dayRecords) {
          if (r.status !== 'PROGRAMADO' && r.status !== 'REPROGRAMADO') continue
          for (const p of projectsOnDay) {
            conflicts.push({
              dateISO: `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`,
              unitId,
              projectId: p.id,
              projectName: p.name,
              maintenanceId: r.id,
              maintenanceType: r.type,
            })
          }
        }
        if (conflicts.length > 0) map.set(key, conflicts)
      }
    }
    return map
  }, [byDay, gridDays, unitProjects, unitId, showProjects])

  const conflictDaysCount = useMemo(() => conflictsByDay.size, [conflictsByDay])

  // SPEC §6.3 — Mezcla de mantenimientos + proyectos por día (orden: mantenimiento primero)
  const dayItems = useMemo(() => {
    const map = new Map<
      string,
      Array<{ kind: 'maintenance'; record: Maintenance } | { kind: 'project'; project: UnitProjectItem }>
    >()
    for (const day of gridDays) {
      const key = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`
      const dayRecords = byDay.get(key) ?? []
      const projectsOnDay = showProjects
        ? unitProjects.filter((p) => isProjectActiveOnDay(p, day))
        : []
      const items: Array<
        { kind: 'maintenance'; record: Maintenance } | { kind: 'project'; project: UnitProjectItem }
      > = []
      for (const r of dayRecords) items.push({ kind: 'maintenance', record: r })
      for (const p of projectsOnDay) items.push({ kind: 'project', project: p })
      map.set(key, items)
    }
    return map
  }, [gridDays, byDay, unitProjects, showProjects])

  // ─── Modal de crear ────────────────────────────────────────────────────────
  const [showCreate, setShowCreate] = useState(false)
  const [createDate, setCreateDate] = useState<string>('')
  const [createType, setCreateType] = useState<string>('PREVENTIVO')
  const [createDescription, setCreateDescription] = useState<string>('')
  const [createTechnician, setCreateTechnician] = useState<string>('')
  const [createSuggestions, setCreateSuggestions] = useState<Array<{ iso: string; label: string }>>([])

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const res = await createMaintenanceRecord({
      mobileUnitId: unitId,
      type: createType as 'PREVENTIVO' | 'CORRECTIVO' | 'VERIFICACION' | 'LIMPIEZA',
      scheduledDate: new Date(createDate).toISOString(),
      description: createDescription,
      technician: createTechnician || undefined,
    })
    if (!res.success) {
      setError(res.error ?? 'Error al crear')
      return
    }
    setRecords((prev) => [res.record as Maintenance, ...prev])
    setShowCreate(false)
    setCreateDescription(''); setCreateTechnician(''); setCreateSuggestions([])
    router.refresh()
  }

  const onCheckAvailability = async () => {
    if (!createDate) return
    const start = new Date(createDate)
    const end = new Date(createDate)
    end.setHours(23, 59, 59, 999)
    const result = await validateUnitAvailability(unitId, start.toISOString(), end.toISOString())
    setCreateSuggestions(result.suggestions)
    if (!result.available) {
      setError(`Conflicto en esta fecha (${result.conflicts.length} asignaciones). Usa las sugerencias.`)
    } else {
      setError(null)
    }
  }

  // ─── Modal de reprogramar ──────────────────────────────────────────────────
  const [showReprogram, setShowReprogram] = useState<Maintenance | null>(null)
  const onReprogram = async (newDate: string) => {
    if (!showReprogram) return
    setError(null)
    const res = await reprogramMaintenance(showReprogram.id, newDate, 'Reprogramación manual desde calendario')
    if (!res.success) {
      setError(res.error ?? 'Error al reprogramar')
      return
    }
    setShowReprogram(null)
    router.refresh()
    location.reload()
  }

  // ─── Modal de completar ────────────────────────────────────────────────────
  const [showComplete, setShowComplete] = useState<Maintenance | null>(null)
  const onComplete = async (cost: number, notes: string) => {
    if (!showComplete) return
    setError(null)
    const res = await completeMaintenance(showComplete.id, {
      completedDate: new Date().toISOString(),
      cost,
      notes: notes || undefined,
    })
    if (!res.success) {
      setError(res.error ?? 'Error al completar')
      return
    }
    setShowComplete(null)
    router.refresh()
    location.reload()
  }

  // SPEC §5.9 / §7.3 — Click en pill de proyecto abre ProjectFormModal en edición
  const [editProject, setEditProject] = useState<ProjectForEdit | null>(null)
  const [editOpen, setEditOpen] = useState(false)

  const openProjectEdit = (project: UnitProjectItem) => {
    setEditProject({
      id: project.id,
      name: project.name,
      companyId: project.companyId,
      startDate: project.startDate,
      endDate: project.endDate,
      branchId: project.branchId ?? null,
      unitRef: project.unitRef,
      notes: null,
    })
    setEditOpen(true)
  }

  return (
    <>
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-5">
        <header className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            {/* SPEC §5.4 — navegación de mes */}
            <button
              type="button"
              onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            >
              Mes anterior
            </button>
            <button
              type="button"
              onClick={() => setMonth(new Date())}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            >
              Hoy
            </button>
            <button
              type="button"
              onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            >
              Mes siguiente
            </button>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Mes visible</p>
              <p className="text-lg font-bold capitalize text-slate-900">{formatMonthLabel(monthStart)}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* SPEC §5.2 — Toggle Calendario/Lista */}
            <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
              <button
                type="button"
                onClick={() => setView('calendar')}
                className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${view === 'calendar' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                Calendario
              </button>
              <button
                type="button"
                onClick={() => setView('list')}
                className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${view === 'list' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                Lista
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow transition-colors hover:bg-slate-800"
              data-testid="schedule-button"
            >
              + Programar mantenimiento
            </button>
          </div>
        </header>

        {/* SPEC §5.6 — Leyenda de colores modernizada */}
        <div className="flex flex-wrap items-center gap-2">
          {Object.entries(TYPE_LABEL).map(([k, label]) => (
            <span
              key={k}
              className={`inline-flex items-center gap-1 rounded-xl border px-3 py-1.5 text-xs font-semibold ${MAINTENANCE_TYPE_BADGES[k]}`}
            >
              <span className="w-2 h-2 rounded-full bg-current" /> {label}
            </span>
          ))}
        </div>

        {error && (
          <div className="border border-red-300 bg-red-50 text-red-800 rounded-md px-3 py-2 text-sm" role="alert">{error}</div>
        )}

        {/* SPEC §5.5 — Filtros + resumen */}
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="space-y-1 text-sm text-slate-600">
            <span className="block text-xs font-semibold uppercase tracking-wide text-slate-400">Tipo</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="min-w-[180px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none"
            >
              <option value="ALL">Todos los tipos</option>
              {TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm text-slate-600">
            <span className="block text-xs font-semibold uppercase tracking-wide text-slate-400">Estado</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="min-w-[180px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none"
            >
              {STATUS_FILTER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
          {/* SPEC §6.4 — Toggle proyectos superpuestos */}
          <label className="space-y-1 text-sm text-slate-600">
            <span className="block text-xs font-semibold uppercase tracking-wide text-slate-400">Proyectos</span>
            <span className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600">
              <input
                type="checkbox"
                checked={showProjects}
                onChange={(e) => setShowProjects(e.target.checked)}
                className="rounded border-slate-300"
                data-testid="unit-projects-toggle"
              />
              Mostrar proyectos superpuestos
            </span>
          </label>
          {/* SPEC §5.5 — Card resumen */}
          <div className="rounded-2xl bg-slate-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Resumen</p>
            <p className="text-sm font-semibold text-slate-700">
              {recordsInMonth.length} mantenimientos en el mes
              {showProjects && ` · ${unitProjects.length} proyectos superpuestos`}
              {conflictDaysCount > 0 && ` · ${conflictDaysCount} ${conflictDaysCount === 1 ? 'día' : 'días'} con conflicto`}
            </p>
          </div>
        </div>

        {view === 'calendar' ? (
          <div className="space-y-3">
            {/* SPEC §5.7 — Headers weekday */}
            <div className="grid grid-cols-7 gap-2">
              {WEEKDAY_LABELS.map((label) => (
                <div
                  key={label}
                  className="rounded-xl bg-slate-100 px-3 py-2 text-center text-xs font-bold uppercase tracking-wide text-slate-500"
                >
                  {label}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-2 md:grid-cols-7">
              {gridDays.map((day) => {
                const key = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`
                const items = dayItems.get(key) ?? []
                const dayConflicts = conflictsByDay.get(key) ?? []
                const isCurrentMonth = isSameMonth(day, monthStart)
                const isToday = isSameDay(day, new Date())
                const hasConflict = dayConflicts.length > 0

                // Aplicar filtros de tipo y estado: sólo se filtran mantenimientos, NO proyectos
                const filteredItems = items.filter((item) => {
                  if (item.kind !== 'maintenance') return true
                  const passesType = typeFilter === 'ALL' || item.record.type === typeFilter
                  const passesStatus = statusFilter === 'ALL' || item.record.status === statusFilter
                  return passesType && passesStatus
                })

                const visibleItems = filteredItems.slice(0, 3)
                const hiddenCount = Math.max(filteredItems.length - visibleItems.length, 0)

                // SPEC §7.2 — Anillo rojo predomina sobre azul de "hoy"
                const cellRingClass = hasConflict
                  ? 'ring-2 ring-red-400'
                  : isToday
                  ? 'ring-2 ring-blue-200'
                  : ''

                return (
                  <div
                    key={day.toISOString()}
                    className={`min-h-44 rounded-2xl border p-3 ${isCurrentMonth ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50/80'} ${cellRingClass}`}
                  >
                    <div className="mb-3 flex items-center justify-between gap-1">
                      <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${isToday ? 'bg-blue-600 text-white' : isCurrentMonth ? 'bg-slate-100 text-slate-700' : 'bg-slate-100 text-slate-400'}`}>
                        {day.getDate()}
                      </span>
                      <div className="flex flex-col items-end gap-1">
                        {filteredItems.length > 0 && (
                          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                            {filteredItems.length} activos
                          </span>
                        )}
                        {/* SPEC §7.2 — Pill ⚠️ Conflicto */}
                        {hasConflict && (
                          <span
                            data-testid="conflict-badge"
                            className="inline-flex items-center gap-1 rounded-full border border-red-300 bg-red-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-700"
                          >
                            ⚠️ Conflicto
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      {visibleItems.map((item, idx) => {
                        if (item.kind === 'maintenance') {
                          const r = item.record
                          const inConflict = dayConflicts.some((c) => c.maintenanceId === r.id)
                          const ringClass = inConflict ? 'ring-2 ring-red-400 ring-offset-1' : ''
                          return (
                            <button
                              key={`m-${r.id}-${idx}`}
                              type="button"
                              onClick={() => {
                                if (r.status === 'COMPLETADO') return
                                setShowReprogram(r)
                              }}
                              className={`w-full rounded-2xl border px-3 py-2 text-left text-xs shadow-sm transition-transform hover:-translate-y-0.5 ${MAINTENANCE_TYPE_BADGES[r.type] ?? ''} ${ringClass}`}
                              data-testid={`event-${r.id}`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <p className="line-clamp-2 font-semibold">{TYPE_LABEL[r.type] ?? r.type}</p>
                                <span
                                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_PILL_COLORS[r.status] ?? 'bg-slate-100 text-slate-600'}`}
                                >
                                  {r.status}
                                </span>
                              </div>
                              <p className="mt-1 truncate text-[11px]">{r.description}</p>
                            </button>
                          )
                        }
                        // Proyecto superpuesto
                        const p = item.project
                        const inConflict = dayConflicts.some((c) => c.projectId === p.id)
                        const ringClass = inConflict ? 'ring-2 ring-red-400 ring-offset-1' : ''
                        return (
                          <button
                            key={`p-${p.id}-${idx}`}
                            type="button"
                            onClick={() => openProjectEdit(p)}
                            className={`w-full rounded-2xl border px-3 py-2 text-left text-xs shadow-sm transition-transform hover:-translate-y-0.5 ${STATUS_BADGES[p.status]} ${ringClass}`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className="line-clamp-2 font-semibold">{p.name}</p>
                              <span
                                className={`shrink-0 rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-bold ${inConflict ? 'text-red-700' : ''}`}
                              >
                                {p._count.workers}
                              </span>
                            </div>
                            <p className="mt-1 truncate text-[11px] font-medium">{p.company?.name ?? '— sin empresa —'}</p>
                            <div className="mt-1 flex items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-wide">
                              <span>{STATUS_LABELS[p.status]}</span>
                              <span>
                                {toDate(p.startDate).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })} -{' '}
                                {toDate(p.endDate).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
                              </span>
                            </div>
                          </button>
                        )
                      })}

                      {hiddenCount > 0 && (
                        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500">
                          +{hiddenCount} más
                        </div>
                      )}

                      {filteredItems.length === 0 && isCurrentMonth && (
                        <div className="rounded-xl border border-dashed border-slate-200 px-3 py-4 text-center text-[11px] text-slate-400">
                          Sin actividad
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-600">
                <tr>
                  <th className="px-3 py-2 text-left">Fecha</th>
                  <th className="px-3 py-2 text-left">Tipo</th>
                  <th className="px-3 py-2 text-left">Estado</th>
                  <th className="px-3 py-2 text-left">Descripción</th>
                  <th className="px-3 py-2 text-left">Técnico</th>
                  <th className="px-3 py-2 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {records.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                      Sin mantenimientos registrados.
                    </td>
                  </tr>
                ) : (
                  records.map((r) => (
                    <tr key={r.id} className="border-t">
                      <td className="px-3 py-2">{toDate(r.scheduledDate).toLocaleDateString('es-MX')}</td>
                      <td className="px-3 py-2">{TYPE_LABEL[r.type]}</td>
                      <td className="px-3 py-2 text-xs">{r.status}</td>
                      <td className="px-3 py-2 max-w-sm truncate" title={r.description}>{r.description}</td>
                      <td className="px-3 py-2">{r.technician ?? '—'}</td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex gap-2 justify-end">
                          {r.status !== 'COMPLETADO' && (
                            <>
                              <button onClick={() => setShowReprogram(r)} className="text-amber-600 hover:underline text-xs">Reprogramar</button>
                              <button onClick={() => setShowComplete(r)} className="text-emerald-600 hover:underline text-xs">Completar</button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: crear */}
      {showCreate && (
        <Modal title="Programar mantenimiento" onClose={() => setShowCreate(false)}>
          <form onSubmit={onCreate} className="space-y-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1" htmlFor="type">Tipo</label>
              <select
                id="type"
                value={createType}
                onChange={(e) => setCreateType(e.target.value)}
                className="w-full border border-slate-300 p-2 rounded text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1" htmlFor="date">Fecha programada</label>
              <div className="flex gap-2">
                <input
                  id="date"
                  type="date"
                  required
                  value={createDate}
                  onChange={(e) => setCreateDate(e.target.value)}
                  className="flex-1 border border-slate-300 p-2 rounded text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  data-testid="schedule-date"
                />
                <button
                  type="button"
                  onClick={onCheckAvailability}
                  className="border border-slate-200 rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  disabled={!createDate || isPending}
                >
                  Verificar disponibilidad
                </button>
              </div>
              {createSuggestions.length > 0 && (
                <div className="mt-2 text-xs">
                  <p className="text-amber-700 font-medium mb-1">Sugerencias libres:</p>
                  <ul className="flex gap-2 flex-wrap">
                    {createSuggestions.map((s) => (
                      <li key={s.iso}>
                        <button
                          type="button"
                          className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                          onClick={() => setCreateDate(s.iso.slice(0, 10))}
                        >
                          {s.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1" htmlFor="desc">Descripción</label>
              <textarea
                id="desc"
                required
                value={createDescription}
                onChange={(e) => setCreateDescription(e.target.value)}
                rows={3}
                className="w-full border border-slate-300 p-2 rounded text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                data-testid="schedule-description"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1" htmlFor="tech">Técnico</label>
              <input
                id="tech"
                value={createTechnician}
                onChange={(e) => setCreateTechnician(e.target.value)}
                className="w-full border border-slate-300 p-2 rounded text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowCreate(false)} className="border border-slate-200 rounded text-slate-600 hover:bg-slate-50 text-sm font-medium px-3 py-2">
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="bg-purple-600 hover:bg-purple-700 text-white rounded shadow font-medium px-3 py-2 text-sm disabled:opacity-50"
              >
                Programar
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal: reprogramar */}
      {showReprogram && (
        <ReprogramModal
          record={showReprogram}
          unitId={unitId}
          onClose={() => setShowReprogram(null)}
          onConfirm={onReprogram}
          conflicts={conflictsByDay.get(`${toDate(showReprogram.scheduledDate).getFullYear()}-${toDate(showReprogram.scheduledDate).getMonth()}-${toDate(showReprogram.scheduledDate).getDate()}`) ?? []}
        />
      )}

      {/* Modal: completar */}
      {showComplete && (
        <CompleteModal
          record={showComplete}
          onClose={() => setShowComplete(null)}
          onConfirm={onComplete}
        />
      )}

      {/* SPEC §5.9 / §7.3 — ProjectFormModal edición al hacer click en pill de proyecto */}
      <ProjectFormModal
        companies={[]}
        branches={[]}
        projectToEdit={editProject}
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
      />
    </>
  )
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-lg space-y-3">
        <header className="flex justify-between items-center">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-sm">✕</button>
        </header>
        {children}
      </div>
    </div>
  )
}

function ReprogramModal({
  record,
  unitId,
  onClose,
  onConfirm,
  conflicts,
}: {
  record: Maintenance
  unitId: string
  onClose: () => void
  onConfirm: (iso: string) => void
  conflicts: CalendarConflict[]
}) {
  const [newDate, setNewDate] = useState<string>(
    toDate(record.scheduledDate).toISOString().slice(0, 10)
  )
  const [suggestions, setSuggestions] = useState<Array<{ iso: string; label: string }>>([])
  const [busy, setBusy] = useState(false)
  const [info, setInfo] = useState<string | null>(null)

  const checkAlternatives = async () => {
    setBusy(true)
    const start = new Date(newDate)
    const end = new Date(start); end.setHours(23, 59, 59, 999)
    const res = await validateUnitAvailability(unitId, start.toISOString(), end.toISOString())
    setSuggestions(res.suggestions)
    if (!res.available) {
      setInfo(`La fecha ${newDate} tiene conflicto (${res.conflicts.length} asignaciones). Usa una sugerencia.`)
    } else {
      setInfo('La fecha está libre.')
    }
    setBusy(false)
  }

  return (
    <Modal title={`Reprogramar ${TYPE_LABEL[record.type] ?? record.type}`} onClose={onClose}>
      <div className="space-y-3">
        <p className="text-sm text-slate-600">Fecha actual: <strong>{toDate(record.scheduledDate).toLocaleDateString('es-MX')}</strong></p>

        {/* SPEC §7.3 — Banner ámbar de conflicto si este día tiene proyecto superpuesto */}
        {conflicts.length > 0 && (
          <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
            ⚠️ Conflicto con proyecto{conflicts.length > 1 ? 's' : ''}{' '}
            <strong>{conflicts.map((c) => c.projectName).join(', ')}</strong> en esta fecha.
          </div>
        )}

        <div>
          <label className="block text-xs text-slate-500 mb-1" htmlFor="newdate">Nueva fecha</label>
          <div className="flex gap-2">
            <input
              id="newdate"
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="flex-1 border border-slate-300 p-2 rounded text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <button
              onClick={checkAlternatives}
              disabled={busy}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              {busy ? 'Buscando…' : 'Buscar alternativas'}
            </button>
          </div>
          {info && <p className="text-xs mt-2 text-slate-700">{info}</p>}
          {suggestions.length > 0 && (
            <div className="mt-2 text-xs">
              <p className="font-medium mb-1">Sugerencias libres:</p>
              <ul className="flex gap-2 flex-wrap">
                {suggestions.map((s) => (
                  <li key={s.iso}>
                    <button
                      type="button"
                      className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                      onClick={() => setNewDate(s.iso.slice(0, 10))}
                    >
                      {s.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="border border-slate-200 rounded text-slate-600 hover:bg-slate-50 text-sm font-medium px-3 py-2">
            Cancelar
          </button>
          <button
            onClick={() => onConfirm(new Date(newDate).toISOString())}
            disabled={busy}
            className="bg-purple-600 hover:bg-purple-700 text-white rounded shadow font-medium px-3 py-2 text-sm disabled:opacity-50"
            data-testid="confirm-reprogram"
          >
            Reprogramar
          </button>
        </div>
      </div>
    </Modal>
  )
}

function CompleteModal({
  record,
  onClose,
  onConfirm,
}: {
  record: Maintenance
  onClose: () => void
  onConfirm: (cost: number, notes: string) => void
}) {
  const [cost, setCost] = useState<string>('0')
  const [notes, setNotes] = useState<string>('')

  return (
    <Modal title={`Completar ${TYPE_LABEL[record.type] ?? record.type}`} onClose={onClose}>
      <div className="space-y-3">
        <p className="text-sm text-slate-600">
          {record.scheduledDate && (
            <>Programado: <strong>{toDate(record.scheduledDate).toLocaleDateString('es-MX')}</strong></>
          )}
        </p>
        <div>
          <label className="block text-xs text-slate-500 mb-1" htmlFor="cost">Costo</label>
          <input
            id="cost"
            type="number"
            min="0"
            step="0.01"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            className="w-full border border-slate-300 p-2 rounded text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1" htmlFor="cnotes">Notas</label>
          <textarea
            id="cnotes"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full border border-slate-300 p-2 rounded text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="border border-slate-200 rounded text-slate-600 hover:bg-slate-50 text-sm font-medium px-3 py-2">
            Cancelar
          </button>
          <button
            onClick={() => onConfirm(Number(cost), notes)}
            className="bg-purple-600 hover:bg-purple-700 text-white rounded shadow font-medium px-3 py-2 text-sm"
            data-testid="confirm-complete"
          >
            Marcar como completado
          </button>
        </div>
      </div>
    </Modal>
  )
}