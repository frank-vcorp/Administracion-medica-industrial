import Link from 'next/link'
import type { ComponentType } from 'react'
import {
  Building2,
  CalendarClock,
  CalendarPlus,
  CalendarX2,
  CheckCircle2,
  ChevronRight,
  Clock,
  FolderOpen,
  UserCheck,
  Users,
} from 'lucide-react'
import { PORTAL_HOME_COPY } from '@/lib/portal-home-copy'
import type { PortalMonthlyAttendedRow } from '@/actions/portal.actions'

export type PortalHomeDashboardProps = {
  companyName: string
  workersCount: number
  totalAttended12m: number
  proximasCitadas: number | null
  canceladas12m: number | null
  completedEvents: number | null
  inProgressEvents: number | null
  months: PortalMonthlyAttendedRow[]
}

type KpiCardConfig = {
  key: string
  label: string
  value: string
  icon: ComponentType<{ className?: string }>
  iconBg: string
  iconColor: string
}

export default function PortalHomeDashboard({
  companyName,
  workersCount,
  totalAttended12m,
  proximasCitadas,
  canceladas12m,
  completedEvents,
  inProgressEvents,
  months,
}: PortalHomeDashboardProps) {
  const copy = PORTAL_HOME_COPY
  const maxMonth = Math.max(1, ...months.map((m) => m.attendedCount))

  const kpis: KpiCardConfig[] = [
    {
      key: 'colaboradores',
      label: copy.kpi.colaboradores,
      value: String(workersCount),
      icon: Users,
      iconBg: 'bg-slate-100',
      iconColor: 'text-slate-700',
    },
    {
      key: 'atendidos',
      label: copy.kpi.atendidos,
      value: String(totalAttended12m),
      icon: UserCheck,
      iconBg: 'bg-teal-50',
      iconColor: 'text-sme-primary',
    },
  ]

  if (proximasCitadas !== null) {
    kpis.push({
      key: 'citados',
      label: copy.kpi.citados,
      value: String(proximasCitadas),
      icon: CalendarClock,
      iconBg: 'bg-sky-50',
      iconColor: 'text-sky-600',
    })
  }

  if (canceladas12m !== null) {
    kpis.push({
      key: 'cancelados',
      label: copy.kpi.cancelados,
      value: String(canceladas12m),
      icon: CalendarX2,
      iconBg: 'bg-rose-50',
      iconColor: 'text-rose-600',
    })
  }

  const hasExpedientesStats = completedEvents !== null && inProgressEvents !== null
  if (hasExpedientesStats) {
    kpis.push(
      {
        key: 'completados',
        label: copy.kpi.expedientesCompletados,
        value: String(completedEvents),
        icon: CheckCircle2,
        iconBg: 'bg-emerald-50',
        iconColor: 'text-emerald-600',
      },
      {
        key: 'en-proceso',
        label: copy.kpi.enProceso,
        value: String(inProgressEvents),
        icon: Clock,
        iconBg: 'bg-amber-50',
        iconColor: 'text-amber-600',
      },
    )
  }

  const kpiGridClass =
    kpis.length >= 6
      ? 'grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3.5'
      : 'grid grid-cols-2 lg:grid-cols-4 gap-3.5'

  const totalExpedientes = hasExpedientesStats ? completedEvents + inProgressEvents : 0
  const pctCompleted =
    hasExpedientesStats && totalExpedientes > 0
      ? Math.round((completedEvents / totalExpedientes) * 100)
      : 0

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      {/* Encabezado integrado de portal */}
      <header className="rounded-2xl border border-slate-200/80 border-t-4 border-t-sme-primary bg-white px-5 py-4 shadow-sm md:px-6 md:py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-sme-secondary/10 px-2.5 py-1 text-xs font-semibold text-sme-secondary">
                <Building2 className="h-3.5 w-3.5" />
                {companyName}
              </span>
              <span className="text-xs font-medium text-slate-400">{copy.eyebrow}</span>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 md:text-2xl">
              {copy.title}
            </h1>
            <p className="max-w-3xl text-sm text-slate-500">{copy.subtitle}</p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2.5">
            <Link
              href="/portal/events"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <FolderOpen className="h-4 w-4 text-sme-secondary" />
              {copy.ctaExpedientes}
            </Link>
            <Link
              href="/portal/appointments/new"
              className="inline-flex items-center gap-2 rounded-xl bg-sme-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sme-primary-hover"
            >
              <CalendarPlus className="h-4 w-4" />
              {copy.ctaAgendar}
            </Link>
          </div>
        </div>
      </header>

      {/* Fila equilibrada de KPIs */}
      <section aria-label="Indicadores del portal" className={kpiGridClass}>
        {kpis.map((item) => (
          <PortalKpiCard key={item.key} item={item} />
        ))}
      </section>

      {/* Cuerpo principal en 2 columnas */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Izquierda: Gráfica vertical de 12 meses */}
        <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm lg:col-span-8 md:p-6">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">{copy.chartTitle}</h2>
              <p className="mt-0.5 text-xs text-slate-500">{copy.chartSubtitle}</p>
            </div>
            <span className="inline-flex items-center rounded-full border border-teal-200/70 bg-teal-50 px-3 py-1 text-xs font-semibold text-sme-primary tabular-nums">
              {totalAttended12m} en 12 meses
            </span>
          </div>

          <div className="relative pt-2">
            {/* Líneas guía horizontales */}
            <div
              className="pointer-events-none absolute inset-x-0 bottom-8 top-6 flex flex-col justify-between"
              aria-hidden
            >
              <div className="border-b border-dashed border-slate-100" />
              <div className="border-b border-dashed border-slate-100" />
              <div className="border-b border-slate-100" />
            </div>

            <div className="relative grid h-52 grid-cols-12 items-end gap-1.5 sm:gap-2.5">
              {months.map((row) => {
                const isZero = row.attendedCount === 0
                const pct = isZero
                  ? 0
                  : Math.max(8, Math.round((row.attendedCount / maxMonth) * 100))

                return (
                  <div
                    key={row.monthKey}
                    className="flex h-full min-w-0 flex-col items-center justify-end gap-1.5"
                  >
                    <span
                      className={`text-[11px] font-semibold tabular-nums ${
                        isZero ? 'text-slate-300' : 'text-slate-700'
                      }`}
                    >
                      {row.attendedCount}
                    </span>

                    <div className="flex h-36 w-full items-end justify-center px-0.5 sm:px-1">
                      {isZero ? (
                        <div className="h-[6px] w-full max-w-[32px] rounded-t-md bg-slate-100" />
                      ) : (
                        <div
                          className="w-full max-w-[32px] rounded-t-md bg-gradient-to-t from-sme-secondary to-sme-primary transition-all"
                          style={{ height: `${pct}%` }}
                          title={`${row.label}: ${row.attendedCount}`}
                        />
                      )}
                    </div>

                    <span className="w-full truncate text-center text-[10px] font-medium capitalize text-slate-500 sm:text-[11px]">
                      {row.label}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {totalAttended12m === 0 && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3 text-xs text-slate-600">
              <span>
                Aún no hay atenciones registradas en los últimos 12 meses. Agenda tu primera cita
                para ver la evolución aquí.
              </span>
              <Link
                href="/portal/appointments/new"
                className="font-semibold text-sme-primary hover:underline"
              >
                Agendar primera cita →
              </Link>
            </div>
          )}
        </section>

        {/* Derecha: Panel operativo integrado */}
        <aside className="space-y-5 lg:col-span-4">
          {hasExpedientesStats && (
            <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-bold text-slate-900">Estado de expedientes</h2>
                <span className="text-xs font-semibold text-slate-500 tabular-nums">
                  {totalExpedientes} total
                </span>
              </div>

              {totalExpedientes === 0 ? (
                <p className="mt-3 text-xs leading-relaxed text-slate-500">
                  Sin expedientes abiertos todavía. Conforme tus colaboradores acudan a cita verás
                  aquí el avance de cierre.
                </p>
              ) : (
                <div className="mt-4 space-y-3">
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl font-bold text-slate-900 tabular-nums">
                      {pctCompleted}%
                    </span>
                    <span className="text-xs text-slate-500">de expedientes cerrados</span>
                  </div>
                  <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="bg-sme-primary transition-all"
                      style={{
                        width: `${Math.round((completedEvents / totalExpedientes) * 100)}%`,
                      }}
                    />
                    <div
                      className="bg-amber-400 transition-all"
                      style={{
                        width: `${Math.round((inProgressEvents / totalExpedientes) * 100)}%`,
                      }}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
                    <div className="rounded-lg bg-emerald-50/70 px-3 py-2">
                      <span className="block text-slate-500">Completados</span>
                      <span className="font-bold text-emerald-700 tabular-nums">
                        {completedEvents}
                      </span>
                    </div>
                    <div className="rounded-lg bg-amber-50/70 px-3 py-2">
                      <span className="block text-slate-500">En proceso</span>
                      <span className="font-bold text-amber-700 tabular-nums">
                        {inProgressEvents}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </section>
          )}

          <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-bold text-slate-900">Accesos rápidos</h2>
            <div className="space-y-2.5">
              <Link
                href="/portal/appointments/new"
                className="group flex items-center justify-between gap-3 rounded-xl border border-slate-100 p-3 transition hover:border-sme-primary/40 hover:bg-slate-50/70"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-sme-primary">
                    <CalendarPlus className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Agendar nueva cita</p>
                    <p className="text-xs text-slate-500">Programar estudios para un colaborador</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 transition group-hover:text-sme-primary" />
              </Link>

              <Link
                href="/portal/events"
                className="group flex items-center justify-between gap-3 rounded-xl border border-slate-100 p-3 transition hover:border-sme-primary/40 hover:bg-slate-50/70"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-purple-50 text-sme-secondary">
                    <FolderOpen className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">
                      Expedientes y resultados
                    </p>
                    <p className="text-xs text-slate-500">Consultar estatus y dictámenes</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 transition group-hover:text-sme-primary" />
              </Link>

              <Link
                href="/portal/workers"
                className="group flex items-center justify-between gap-3 rounded-xl border border-slate-100 p-3 transition hover:border-sme-primary/40 hover:bg-slate-50/70"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                    <Users className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">
                      Directorio de colaboradores
                    </p>
                    <p className="text-xs text-slate-500">Ver padrón activo de la empresa</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 transition group-hover:text-sme-primary" />
              </Link>
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}

function PortalKpiCard({ item }: { item: KpiCardConfig }) {
  const Icon = item.icon
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition hover:border-slate-300/80">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-slate-500">{item.label}</p>
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${item.iconBg} ${item.iconColor}`}
        >
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900 tabular-nums md:text-3xl">
        {item.value}
      </p>
    </div>
  )
}
