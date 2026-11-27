/**
 * @file MobileUnitOperationsPanel — Panel operativo semanal de unidades móviles.
 * @id IMPL-20260804-01-UNIFICAR-UI-UNIDADES-MOVILES
 * @spec context/SPECs/SPEC_ARCH-20260711-01-MODULO-UNIDADES-MOVILES.md §5.6
 *
 * Rediseño visual institucional SME:
 *   - 5 KPI cards limpias (border-slate-200 + íconos circulares Lucide)
 *   - Cards de Próximos y Vencidos con deep-links a mantenimiento
 *   - Calendario semanal Lunes–Domingo `table-fixed` con columnas balanceadas,
 *     navegación por semana (?week=YYYY-MM-DD), links a /projects/[id] y mantenimientos
 *   - Alerta de conflictos operativos sin emojis crudos
 */
'use client'

import Link from 'next/link'
import {
  AlertTriangle,
  Ambulance,
  Archive,
  CalendarClock,
  CalendarRange,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FolderKanban,
  Hammer,
  PauseCircle,
  ShieldCheck,
  Wrench,
} from 'lucide-react'
import { MOBILE_UNIT_STATUS_LABEL } from './constants'

type Conflict = {
  unitId: string
  unit: string
  date: string
  projectId: string
  project: string
  maintenance: string
}

type Day = {
  iso: string
  dayShort: string
  dayNumber: number
  monthShort: string
  isToday: boolean
}

type WeekNav = {
  prevWeekIso: string
  nextWeekIso: string
  todayWeekIso: string
  isCurrentWeek: boolean
  weekRangeLabel: string
}

type Props = {
  statusCounts: Record<string, number>
  upcomingMaintenances: Array<{
    id: string
    unitId: string
    type: string
    scheduledDate: string | Date
    unitName: string
    unitPlate: string | null
  }>
  overdueMaintenances: Array<{
    id: string
    unitId: string
    type: string
    scheduledDate: string | Date
    unitName: string
    unitPlate: string | null
  }>
  weekProjects: Array<{
    id: string
    name: string
    companyName: string | null
    status: string
    startDate: string | Date
    endDate: string | Date
    mobileUnitId: string | null
  }>
  weekMaintenances: Array<{
    id: string
    type: string
    scheduledDate: string | Date
    mobileUnitId: string
  }>
  conflicts: Conflict[]
  units: Array<{ id: string; name: string; plate: string | null; status: string }>
  days: Day[]
  weekNav: WeekNav
}

const STATUS_META: Record<
  string,
  {
    icon: typeof CheckCircle2
    badgeBg: string
    accentText: string
  }
> = {
  ACTIVA: {
    icon: CheckCircle2,
    badgeBg: 'bg-emerald-50 text-emerald-600',
    accentText: 'text-emerald-700',
  },
  MANTENIMIENTO: {
    icon: Wrench,
    badgeBg: 'bg-amber-50 text-amber-600',
    accentText: 'text-amber-700',
  },
  REPARACION: {
    icon: Hammer,
    badgeBg: 'bg-red-50 text-red-600',
    accentText: 'text-red-700',
  },
  FUERA_SERVICIO: {
    icon: PauseCircle,
    badgeBg: 'bg-slate-100 text-slate-600',
    accentText: 'text-slate-700',
  },
  BAJA_PERMANENTE: {
    icon: Archive,
    badgeBg: 'bg-zinc-100 text-zinc-600',
    accentText: 'text-zinc-700',
  },
}

const MAINT_TYPE_LABEL: Record<string, string> = {
  PREVENTIVO: 'Preventivo',
  CORRECTIVO: 'Correctivo',
  VERIFICACION: 'Verificación',
  LIMPIEZA: 'Limpieza',
}

function toDate(d: string | Date): Date {
  return d instanceof Date ? d : new Date(d)
}

function formatMaintType(type: string): string {
  return MAINT_TYPE_LABEL[type] ?? type
}

export default function MobileUnitOperationsPanel({
  statusCounts,
  upcomingMaintenances,
  overdueMaintenances,
  weekProjects,
  weekMaintenances,
  conflicts,
  units,
  days,
  weekNav,
}: Props) {
  return (
    <div className="space-y-6">
      {/* 1. KPIs Estado Operativo */}
      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Estado operativo de la flota
        </h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {['ACTIVA', 'MANTENIMIENTO', 'REPARACION', 'FUERA_SERVICIO', 'BAJA_PERMANENTE'].map((s) => {
            const labelMeta = MOBILE_UNIT_STATUS_LABEL[s]
            const iconMeta = STATUS_META[s] ?? STATUS_META.ACTIVA
            const Icon = iconMeta.icon
            const count = statusCounts[s] ?? 0
            return (
              <div
                key={s}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {labelMeta.label}
                  </span>
                  <span
                    className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${iconMeta.badgeBg}`}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                </div>
                <p className={`mt-2 text-2xl font-bold ${count > 0 ? 'text-slate-900' : 'text-slate-400'}`}>
                  {count}
                </p>
              </div>
            )
          })}
        </div>
      </section>

      {/* 2. Mantenimientos próximos y vencidos */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#592c82]/12 text-[#592c82]">
                <CalendarClock className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Próximos mantenimientos (7 días)
                </h3>
                <p className="text-xs text-slate-500">Servicios programados en puerta</p>
              </div>
            </div>
            <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
              {upcomingMaintenances.length}
            </span>
          </div>

          {upcomingMaintenances.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-6 text-center text-sm text-slate-500">
              Sin mantenimientos próximos en los siguientes 7 días.
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {upcomingMaintenances.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <Link
                      href={`/admin/mobile-units/${m.unitId}/maintenance`}
                      className="text-sm font-semibold text-slate-800 hover:text-[#592c82] hover:underline truncate block"
                    >
                      {m.unitName}
                      {m.unitPlate ? ` · ${m.unitPlate}` : ''}
                    </Link>
                    <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                      <Wrench className="h-3 w-3 text-amber-600" />
                      {formatMaintType(m.type)}
                    </span>
                  </div>
                  <span className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                    {toDate(m.scheduledDate).toLocaleDateString('es-MX')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <span
                className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                  overdueMaintenances.length > 0
                    ? 'bg-red-50 text-red-600'
                    : 'bg-emerald-50 text-emerald-600'
                }`}
              >
                <AlertTriangle className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Mantenimientos vencidos
                </h3>
                <p className="text-xs text-slate-500">Pendientes con fecha rebasada</p>
              </div>
            </div>
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                overdueMaintenances.length > 0
                  ? 'border-red-200 bg-red-50 text-red-700'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-700'
              }`}
            >
              {overdueMaintenances.length}
            </span>
          </div>

          {overdueMaintenances.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-6 text-center text-sm text-slate-500">
              Sin mantenimientos vencidos.
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {overdueMaintenances.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <Link
                      href={`/admin/mobile-units/${m.unitId}/maintenance`}
                      className="text-sm font-semibold text-slate-800 hover:text-[#592c82] hover:underline truncate block"
                    >
                      {m.unitName}
                      {m.unitPlate ? ` · ${m.unitPlate}` : ''}
                    </Link>
                    <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">
                      {formatMaintType(m.type)}
                    </span>
                  </div>
                  <Link
                    href={`/admin/mobile-units/${m.unitId}/maintenance`}
                    className="shrink-0 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-100 transition-colors"
                  >
                    {toDate(m.scheduledDate).toLocaleDateString('es-MX')}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* 3. Calendario semanal Lunes-Domingo */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#592c82]/12 text-[#592c82]">
              <CalendarRange className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Calendario operativo semanal
              </h3>
              <p className="text-xs font-medium capitalize text-slate-500">
                {weekNav.weekRangeLabel} · Proyectos asignados y mantenimientos
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Leyenda */}
            <div className="flex items-center gap-3 text-xs text-slate-600 mr-1">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                Proyecto UMM
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                Mantenimiento
              </span>
            </div>

            {/* Navegación por semanas */}
            <div className="inline-flex items-center rounded-xl border border-slate-200 bg-slate-50 p-1">
              <Link
                href={`/operations/mobile-units?view=operations&week=${weekNav.prevWeekIso}`}
                className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-white hover:shadow-sm transition-all"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Anterior
              </Link>
              <Link
                href={`/operations/mobile-units?view=operations&week=${weekNav.todayWeekIso}`}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                  weekNav.isCurrentWeek
                    ? 'bg-[#592c82] text-white shadow-sm'
                    : 'text-slate-700 hover:bg-white hover:shadow-sm'
                }`}
              >
                Esta semana
              </Link>
              <Link
                href={`/operations/mobile-units?view=operations&week=${weekNav.nextWeekIso}`}
                className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-white hover:shadow-sm transition-all"
              >
                Siguiente
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[920px] table-fixed border-collapse text-xs">
            <colgroup>
              <col className="w-44" />
              {days.map((d) => (
                <col key={`col-${d.iso}`} />
              ))}
            </colgroup>
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-3.5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Unidad
                </th>
                {days.map((d) => (
                  <th
                    key={d.iso}
                    className={`border-l border-slate-200/80 px-2.5 py-2.5 text-left ${
                      d.isToday ? 'bg-[#592c82]/8' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span
                        className={`text-[11px] font-semibold ${
                          d.isToday ? 'text-[#592c82]' : 'text-slate-500'
                        }`}
                      >
                        {d.dayShort}
                      </span>
                      <span
                        className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-xs font-bold ${
                          d.isToday
                            ? 'bg-[#592c82] text-white'
                            : 'bg-white text-slate-700 ring-1 ring-slate-200'
                        }`}
                      >
                        {d.dayNumber}
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {units.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm text-slate-500">
                    No hay unidades móviles registradas.
                  </td>
                </tr>
              ) : (
                units.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-3.5 py-3 align-top">
                      <Link
                        href={`/admin/mobile-units/${u.id}`}
                        className="group flex items-start gap-2.5"
                      >
                        <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#592c82]/10 text-[#592c82] group-hover:bg-[#592c82]/20 transition-colors">
                          <Ambulance className="h-3.5 w-3.5" />
                        </span>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800 group-hover:text-[#592c82] group-hover:underline truncate">
                            {u.name}
                          </p>
                          <p className="text-[11px] text-slate-400 truncate">
                            {u.plate ?? 'Sin placa'}
                          </p>
                        </div>
                      </Link>
                    </td>
                    {days.map((d) => {
                      const dayStart = new Date(d.iso)
                      dayStart.setHours(0, 0, 0, 0)
                      const dayEnd = new Date(d.iso)
                      dayEnd.setHours(23, 59, 59, 999)
                      const ps = weekProjects.filter(
                        (p) =>
                          p.mobileUnitId === u.id &&
                          toDate(p.startDate) <= dayEnd &&
                          toDate(p.endDate) >= dayStart
                      )
                      const ms = weekMaintenances.filter(
                        (m) =>
                          m.mobileUnitId === u.id &&
                          toDate(m.scheduledDate) >= dayStart &&
                          toDate(m.scheduledDate) <= dayEnd
                      )
                      return (
                        <td
                          key={d.iso}
                          className={`border-l border-slate-100 px-2 py-2.5 align-top ${
                            d.isToday ? 'bg-[#592c82]/[0.03]' : ''
                          }`}
                        >
                          <div className="space-y-1.5">
                            {ps.map((p) => (
                              <Link
                                key={p.id}
                                href={`/projects/${p.id}`}
                                title={`${p.name}${p.companyName ? ` · ${p.companyName}` : ''}`}
                                className="block rounded-lg border border-emerald-200 bg-emerald-50/90 px-2 py-1.5 transition-colors hover:border-emerald-300 hover:bg-emerald-100/80"
                              >
                                <div className="flex items-start gap-1.5">
                                  <FolderKanban className="mt-0.5 h-3 w-3 shrink-0 text-emerald-700" />
                                  <div className="min-w-0">
                                    <p className="line-clamp-2 text-[11px] font-semibold leading-snug text-emerald-950">
                                      {p.name}
                                    </p>
                                    {p.companyName && (
                                      <p className="mt-0.5 truncate text-[10px] text-emerald-700">
                                        {p.companyName}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </Link>
                            ))}
                            {ms.map((m) => (
                              <Link
                                key={m.id}
                                href={`/admin/mobile-units/${u.id}/maintenance`}
                                className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] font-semibold text-amber-900 transition-colors hover:border-amber-300 hover:bg-amber-100"
                              >
                                <Wrench className="h-3 w-3 shrink-0 text-amber-700" />
                                <span className="truncate">{formatMaintType(m.type)}</span>
                              </Link>
                            ))}
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* 4. Conflictos */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            <span
              className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                conflicts.length === 0
                  ? 'bg-emerald-50 text-emerald-600'
                  : 'bg-red-50 text-red-600'
              }`}
            >
              {conflicts.length === 0 ? (
                <ShieldCheck className="h-4 w-4" />
              ) : (
                <AlertTriangle className="h-4 w-4" />
              )}
            </span>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Conflictos detectados esta semana
              </h3>
              <p className="text-xs text-slate-500">
                Cruces entre mantenimientos programados y campañas UMM activas
              </p>
            </div>
          </div>
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
              conflicts.length === 0
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-red-200 bg-red-50 text-red-700'
            }`}
          >
            {conflicts.length}
          </span>
        </div>

        {conflicts.length === 0 ? (
          <div className="rounded-xl border border-emerald-200/70 bg-emerald-50/50 px-4 py-3 text-sm text-emerald-800">
            Sin conflictos operativos detectados para el rango semanal visible.
          </div>
        ) : (
          <ul className="divide-y divide-red-100 rounded-xl border border-red-200 bg-red-50/40">
            {conflicts.map((c, i) => (
              <li
                key={`${c.unitId}-${c.projectId}-${i}`}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
              >
                <div className="text-slate-800">
                  <Link
                    href={`/admin/mobile-units/${c.unitId}/maintenance`}
                    className="font-semibold text-[#592c82] hover:underline"
                  >
                    {c.unit}
                  </Link>{' '}
                  · {c.date} · Proyecto{' '}
                  <Link
                    href={`/projects/${c.projectId}`}
                    className="font-semibold text-slate-900 underline"
                  >
                    {c.project}
                  </Link>{' '}
                  vs Mantenimiento <strong>{formatMaintType(c.maintenance)}</strong>
                </div>
                <Link
                  href={`/admin/mobile-units/${c.unitId}/maintenance`}
                  className="text-xs font-semibold text-red-700 hover:underline"
                >
                  Reprogramar →
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
