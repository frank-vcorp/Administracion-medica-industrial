import Link from 'next/link'
import type { ComponentType } from 'react'
import {
  BarChart3,
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
import type {
  PortalMonthlyAttendedRow,
  PortalUpcomingAppointmentItem,
} from '@/actions/portal.actions'
import {
  AMI_APPOINTMENT_TIMEZONE,
  formatAppointmentAgendaTime,
} from '@/lib/appointment-scheduling'
import { PORTAL_HOME_COPY } from '@/lib/portal-home-copy'

export type PortalHomeDashboardProps = {
  companyName: string
  workersCount: number
  totalAttended12m: number
  proximasCitadas: number | null
  canceladas12m: number | null
  completedEvents: number | null
  inProgressEvents: number | null
  months: PortalMonthlyAttendedRow[]
  upcomingAppointments?: PortalUpcomingAppointmentItem[]
  aptos?: number | null
  noAptos?: number | null
}

type KpiCardConfig = {
  key: string
  label: string
  value: string
  sublabel: string
  href?: string
  icon: ComponentType<{ className?: string }>
  iconBg: string
  iconColor: string
  accentBorder: string
}

function formatAppointmentShortDate(isoString: string): string {
  try {
    return new Intl.DateTimeFormat('es-MX', {
      timeZone: AMI_APPOINTMENT_TIMEZONE,
      day: '2-digit',
      month: 'short',
    }).format(new Date(isoString))
  } catch {
    return ''
  }
}

function workerInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'P'
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase()
}

function upcomingStatusBadge(apt: PortalUpcomingAppointmentItem): {
  label: string
  className: string
} {
  if (apt.prefillStatus === 'SUBMITTED') {
    return {
      label: 'Prellenado listo',
      className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    }
  }
  if (apt.status === 'CONFIRMED') {
    return {
      label: 'Confirmada',
      className: 'border-sky-200 bg-sky-50 text-sky-700',
    }
  }
  return {
    label: 'Programada',
    className: 'border-purple-200/80 bg-purple-50 text-sme-secondary',
  }
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
  upcomingAppointments = [],
  aptos = null,
  noAptos = null,
}: PortalHomeDashboardProps) {
  const copy = PORTAL_HOME_COPY
  const maxMonth = Math.max(1, ...months.map((m) => m.attendedCount))
  const midTick = Math.ceil(maxMonth / 2)
  const cancelledPositive = (canceladas12m ?? 0) > 0

  const kpis: KpiCardConfig[] = [
    {
      key: 'colaboradores',
      label: copy.kpi.colaboradores,
      value: String(workersCount),
      sublabel: 'Padrón activo',
      href: '/portal/events',
      icon: Users,
      iconBg: 'bg-purple-50',
      iconColor: 'text-sme-secondary',
      accentBorder: 'border-l-sme-secondary',
    },
    {
      key: 'atendidos',
      label: copy.kpi.atendidos,
      value: String(totalAttended12m),
      sublabel: 'Últimos 12 meses',
      icon: UserCheck,
      iconBg: 'bg-teal-50',
      iconColor: 'text-sme-primary',
      accentBorder: 'border-l-sme-primary',
    },
  ]

  if (proximasCitadas !== null) {
    kpis.push({
      key: 'citados',
      label: copy.kpi.citados,
      value: String(proximasCitadas),
      sublabel: 'Citas programadas',
      href: '/portal/appointments/new',
      icon: CalendarClock,
      iconBg: 'bg-sky-50',
      iconColor: 'text-sky-600',
      accentBorder: 'border-l-sky-500',
    })
  }

  if (canceladas12m !== null) {
    kpis.push({
      key: 'cancelados',
      label: copy.kpi.cancelados,
      value: String(canceladas12m),
      sublabel: 'Últimos 12 meses',
      icon: CalendarX2,
      iconBg: cancelledPositive ? 'bg-rose-50' : 'bg-slate-100',
      iconColor: cancelledPositive ? 'text-rose-600' : 'text-slate-500',
      accentBorder: cancelledPositive ? 'border-l-rose-500' : 'border-l-slate-300',
    })
  }

  const hasExpedientesStats = completedEvents !== null && inProgressEvents !== null
  if (hasExpedientesStats) {
    kpis.push(
      {
        key: 'completados',
        label: copy.kpi.expedientesCompletados,
        value: String(completedEvents),
        sublabel: 'Dictámenes cerrados',
        href: '/portal/events',
        icon: CheckCircle2,
        iconBg: 'bg-emerald-50',
        iconColor: 'text-emerald-600',
        accentBorder: 'border-l-emerald-500',
      },
      {
        key: 'en-proceso',
        label: copy.kpi.enProceso,
        value: String(inProgressEvents),
        sublabel: 'En evaluación clínica',
        href: '/portal/events',
        icon: Clock,
        iconBg: 'bg-amber-50',
        iconColor: 'text-amber-600',
        accentBorder: 'border-l-amber-400',
      },
    )
  }

  const kpiGridClass =
    kpis.length >= 6
      ? 'grid grid-cols-2 gap-4 md:grid-cols-3 2xl:grid-cols-6'
      : 'grid grid-cols-2 gap-4 lg:grid-cols-4'

  const totalExpedientes = hasExpedientesStats ? completedEvents + inProgressEvents : 0
  const pctCompleted =
    hasExpedientesStats && totalExpedientes > 0
      ? Math.round((completedEvents / totalExpedientes) * 100)
      : 0

  const hasVerdictsResolution =
    aptos !== null && noAptos !== null && aptos + noAptos > 0

  const visibleUpcoming = upcomingAppointments.slice(0, 5)

  const onboardingSteps = [
    {
      label: 'Colaboradores registrados',
      done: workersCount > 0,
      detail: workersCount > 0 ? `${workersCount} en padrón` : 'Pendiente de registro',
    },
    {
      label: 'Citas programadas',
      done: (proximasCitadas ?? 0) > 0,
      detail:
        (proximasCitadas ?? 0) > 0
          ? `${proximasCitadas} próxima(s)`
          : 'Sin citas activas',
    },
    {
      label: 'Atención en clínica',
      done: Boolean(hasExpedientesStats && (inProgressEvents > 0 || completedEvents > 0)),
      detail:
        hasExpedientesStats && (inProgressEvents > 0 || completedEvents > 0)
          ? 'Estudios iniciados'
          : 'Al llegar a sucursal',
    },
    {
      label: 'Dictámenes disponibles',
      done: Boolean(hasExpedientesStats && completedEvents > 0),
      detail:
        hasExpedientesStats && completedEvents > 0
          ? `${completedEvents} cerrado(s)`
          : 'Listos al concluir revisión',
    },
  ]

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6">
      {/* Banda ejecutiva superior SME */}
      <header className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#341652] via-[#592c82] to-[#0b6f73] px-6 py-6 text-white shadow-lg shadow-[#592c82]/15 ring-1 ring-white/10 md:px-8 md:py-7">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#00afaa]/25 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-24 left-12 h-56 w-56 rounded-full bg-white/10 blur-3xl"
        />

        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/12 px-3 py-1 text-xs font-semibold text-white ring-1 ring-white/20 backdrop-blur-sm">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                <Building2 className="h-3.5 w-3.5 text-teal-200" />
                {companyName}
              </span>
              <span className="text-xs font-medium tracking-wide text-white/75">
                {copy.eyebrow}
              </span>
            </div>

            <h1 className="text-xl font-bold leading-snug tracking-tight text-white md:text-[1.7rem]">
              {copy.title}
            </h1>
            <p className="max-w-3xl text-sm leading-relaxed text-white/80">
              {copy.subtitle}
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2.5">
            <Link
              href="/portal/events"
              className="inline-flex items-center gap-2 rounded-xl bg-white/12 px-4 py-2.5 text-sm font-semibold text-white ring-1 ring-white/25 backdrop-blur-sm transition hover:bg-white/20"
            >
              <FolderOpen className="h-4 w-4 text-teal-200" />
              {copy.ctaExpedientes}
            </Link>
            <Link
              href="/portal/appointments/new"
              className="inline-flex items-center gap-2 rounded-xl bg-[#00afaa] px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-black/15 transition hover:bg-[#00c2bc]"
            >
              <CalendarPlus className="h-4 w-4" />
              {copy.ctaAgendar}
            </Link>
          </div>
        </div>

        <div className="relative mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/15 pt-4 text-xs text-white/80">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1 font-medium">
              <Users className="h-3.5 w-3.5 text-teal-200" />
              <strong className="tabular-nums text-white">{workersCount}</strong> colaboradores
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1 font-medium">
              <CalendarClock className="h-3.5 w-3.5 text-teal-200" />
              <strong className="tabular-nums text-white">{proximasCitadas ?? 0}</strong> citas próximas
            </span>
            {hasExpedientesStats && (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1 font-medium">
                <FolderOpen className="h-3.5 w-3.5 text-teal-200" />
                <strong className="tabular-nums text-white">{totalExpedientes}</strong> expedientes
              </span>
            )}
          </div>
          <span className="text-[11px] font-medium text-white/65">
            Soluciones Médico Empresariales · Medicina Laboral
          </span>
        </div>
      </header>

      {/* Banda de KPIs equilibrados */}
      <section aria-label="Indicadores del portal" className={kpiGridClass}>
        {kpis.map((item) => (
          <PortalKpiCard key={item.key} item={item} />
        ))}
      </section>

      {/* Cuerpo operativo principal */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* Izquierda: Gráfica de 12 meses */}
        <section className="flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm md:p-6 xl:col-span-7 2xl:col-span-8">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">{copy.chartTitle}</h2>
              <p className="mt-0.5 text-xs text-slate-500">{copy.chartSubtitle}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {totalAttended12m > 0 && (
                <span className="inline-flex items-center rounded-full border border-purple-200 bg-purple-50 px-3 py-1 text-xs font-semibold text-sme-secondary tabular-nums">
                  Pico: {maxMonth}/mes
                </span>
              )}
              <span className="inline-flex items-center rounded-full border border-teal-200/80 bg-teal-50 px-3 py-1 text-xs font-semibold text-sme-primary tabular-nums">
                {totalAttended12m} en 12 meses
              </span>
            </div>
          </div>

          {totalAttended12m > 0 ? (
            <div className="flex items-stretch gap-3">
              {/* Eje Y discreto */}
              <div
                aria-hidden="true"
                className="flex h-52 flex-col justify-between pb-6 pt-1 text-right text-[10px] font-semibold text-slate-400 tabular-nums"
              >
                <span>{maxMonth}</span>
                <span>{midTick}</span>
                <span>0</span>
              </div>

              <div className="relative flex-1">
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 bottom-7 top-1 flex flex-col justify-between"
                >
                  <div className="border-b border-dashed border-slate-100" />
                  <div className="border-b border-dashed border-slate-100" />
                  <div className="border-b border-slate-200/80" />
                </div>

                <div className="relative grid h-52 grid-cols-12 gap-1.5 sm:gap-2.5">
                  {months.map((row) => {
                    const isZero = row.attendedCount === 0
                    const pct = isZero
                      ? 0
                      : Math.max(10, Math.round((row.attendedCount / maxMonth) * 100))

                    return (
                      <div
                        key={row.monthKey}
                        className="flex h-full min-w-0 flex-col justify-end gap-1.5"
                      >
                        <div className="relative flex w-full flex-1 items-end justify-center px-0.5 pt-6 sm:px-1">
                          {isZero ? (
                            <div className="h-1.5 w-full max-w-[34px] rounded-t bg-slate-100" />
                          ) : (
                            <div
                              className="flex w-full max-w-[34px] flex-col items-center justify-end"
                              style={{ height: `${pct}%` }}
                            >
                              <span className="-mt-5 mb-1 text-[11px] font-bold text-slate-700 tabular-nums">
                                {row.attendedCount}
                              </span>
                              <div
                                className="h-full w-full rounded-t-lg bg-gradient-to-t from-[#592c82] via-[#2b7a8d] to-[#00afaa] shadow-sm"
                                title={`${row.label}: ${row.attendedCount}`}
                              />
                            </div>
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
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-6 py-8 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#592c82]/15 to-[#00afaa]/20 text-sme-secondary">
                  <BarChart3 className="h-6 w-6" />
                </div>
                <p className="text-sm font-semibold text-slate-800">
                  Aún no hay atenciones registradas en los últimos 12 meses.
                </p>
                <p className="mt-1 max-w-md text-xs text-slate-500">
                  Conforme tus colaboradores completen sus exámenes médicos verás aquí la evolución
                  mensual.
                </p>
                <Link
                  href="/portal/appointments/new"
                  className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-sme-primary px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-sme-primary-hover"
                >
                  Agendar primera cita →
                </Link>
              </div>

              <div className="grid grid-cols-12 gap-1.5 pt-1 sm:gap-2.5">
                {months.map((row) => (
                  <div
                    key={row.monthKey}
                    className="flex min-w-0 flex-col items-center gap-1.5"
                  >
                    <div className="h-1.5 w-full max-w-[34px] rounded-t bg-slate-100" />
                    <span className="w-full truncate text-center text-[10px] font-medium capitalize text-slate-400 sm:text-[11px]">
                      {row.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Derecha: Operación en vivo */}
        <aside className="space-y-6 xl:col-span-5 2xl:col-span-4">
          {/* Próximas citas */}
          <section className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm">
            <div className="mb-3.5 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-50 text-sme-secondary">
                  <CalendarClock className="h-4 w-4" />
                </span>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Próximas citas</h2>
                  <p className="text-[11px] text-slate-500">
                    {visibleUpcoming.length > 0
                      ? `${visibleUpcoming.length} programada(s) próximamente`
                      : 'Agenda de tus colaboradores'}
                  </p>
                </div>
              </div>
              <Link
                href="/portal/appointments/new"
                className="text-xs font-semibold text-sme-primary hover:underline"
              >
                + Agendar
              </Link>
            </div>

            {visibleUpcoming.length > 0 ? (
              <ul className="space-y-2.5">
                {visibleUpcoming.map((apt) => {
                  const badge = upcomingStatusBadge(apt)
                  const dateLabel = formatAppointmentShortDate(apt.scheduledAt)
                  const timeLabel = formatAppointmentAgendaTime(apt.scheduledAt)

                  return (
                    <li
                      key={apt.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2.5 transition hover:border-slate-200 hover:bg-white"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#592c82]/10 text-xs font-bold text-sme-secondary">
                          {workerInitials(apt.workerName)}
                        </div>
                        <div className="min-w-0">
                          <Link
                            href={`/portal/workers/${apt.workerId}`}
                            className="block truncate text-sm font-semibold text-slate-800 hover:text-sme-secondary hover:underline"
                          >
                            {apt.workerName}
                          </Link>
                          <p className="truncate text-[11px] text-slate-500">
                            {apt.branchName} · {apt.profileName || apt.expedientId || 'Cita programada'}
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        <p className="text-xs font-semibold text-slate-800 tabular-nums capitalize">
                          {dateLabel} · {timeLabel}
                        </p>
                        <span
                          className={`mt-1 inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                      </div>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-4 text-center">
                <p className="text-xs text-slate-500">Sin citas programadas por el momento.</p>
                <Link
                  href="/portal/appointments/new"
                  className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-sme-primary hover:underline"
                >
                  Agendar cita →
                </Link>
              </div>
            )}
          </section>

          {/* Estado de expedientes */}
          {hasExpedientesStats && (
            <section className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-bold text-slate-900">Estado de expedientes</h2>
                <span className="text-xs font-semibold text-slate-500 tabular-nums">
                  {totalExpedientes} total
                </span>
              </div>

              {totalExpedientes > 0 ? (
                <div className="mt-4 space-y-3.5">
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
                  <div className="grid grid-cols-2 gap-2.5 text-xs">
                    <div className="rounded-xl bg-emerald-50/80 px-3 py-2">
                      <span className="block text-slate-500">Completados</span>
                      <span className="font-bold text-emerald-700 tabular-nums">
                        {completedEvents}
                      </span>
                    </div>
                    <div className="rounded-xl bg-amber-50/80 px-3 py-2">
                      <span className="block text-slate-500">En proceso</span>
                      <span className="font-bold text-amber-700 tabular-nums">
                        {inProgressEvents}
                      </span>
                    </div>
                  </div>

                  {hasVerdictsResolution && (
                    <div className="border-t border-slate-100 pt-3">
                      <p className="mb-2 text-[11px] font-semibold text-slate-500">
                        Resolución de dictámenes
                      </p>
                      <div className="grid grid-cols-2 gap-2.5 text-xs">
                        <div className="rounded-xl border border-emerald-200/70 bg-emerald-50/50 px-3 py-2">
                          <span className="block text-slate-500">Aptos</span>
                          <span className="font-bold text-emerald-700 tabular-nums">{aptos}</span>
                        </div>
                        <div className="rounded-xl border border-rose-200/70 bg-rose-50/50 px-3 py-2">
                          <span className="block text-slate-500">No cumple</span>
                          <span className="font-bold text-rose-700 tabular-nums">{noAptos}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  <Link
                    href="/portal/events"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-sme-primary hover:underline"
                  >
                    Ir a expedientes <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  <ul className="space-y-2">
                    {onboardingSteps.map((step) => (
                      <li
                        key={step.label}
                        className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2 text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                              step.done
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-slate-200 text-slate-500'
                            }`}
                          >
                            {step.done ? (
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            ) : (
                              <Clock className="h-3 w-3" />
                            )}
                          </span>
                          <span
                            className={`truncate font-medium ${
                              step.done ? 'text-slate-800' : 'text-slate-500'
                            }`}
                          >
                            {step.label}
                          </span>
                        </div>
                        <span className="shrink-0 text-[11px] text-slate-500 tabular-nums">
                          {step.detail}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/portal/events"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-sme-primary hover:underline"
                  >
                    Ir a expedientes <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              )}
            </section>
          )}
        </aside>
      </div>
    </div>
  )
}

function PortalKpiCard({ item }: { item: KpiCardConfig }) {
  const Icon = item.icon
  const baseClass = `flex h-full min-h-[124px] flex-col justify-between rounded-2xl border border-slate-200/90 border-l-4 ${item.accentBorder} bg-white p-4 shadow-sm`
  const interactiveClass = item.href
    ? ' transition hover:-translate-y-0.5 hover:border-sme-primary/50 hover:shadow-md'
    : ''

  const inner = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold leading-snug text-slate-500">{item.label}</p>
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${item.iconBg} ${item.iconColor}`}
        >
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-3">
        <p className="text-3xl font-extrabold tracking-tight text-slate-900 tabular-nums">
          {item.value}
        </p>
        <p className="mt-0.5 text-[11px] font-medium text-slate-400">{item.sublabel}</p>
      </div>
    </>
  )

  if (item.href) {
    return (
      <Link href={item.href} className={`${baseClass}${interactiveClass}`}>
        {inner}
      </Link>
    )
  }

  return <div className={baseClass}>{inner}</div>
}
