import Link from 'next/link'
import Image from 'next/image'
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

  return (
    <div className="space-y-8 p-4 md:p-6 max-w-5xl mx-auto">
      <section className="relative overflow-hidden rounded-2xl border border-teal-200/80 bg-gradient-to-br from-teal-50 via-white to-sky-50 shadow-md">
        <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-teal-200/30 blur-3xl" aria-hidden />
        <div className="absolute -bottom-20 -left-10 h-48 w-48 rounded-full bg-sky-200/25 blur-3xl" aria-hidden />
        <div className="relative grid gap-6 p-6 md:p-8 md:grid-cols-[1fr,220px] md:items-center">
          <div className="space-y-3">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-teal-700/90">
              {copy.eyebrow}
            </p>
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 leading-tight">
              {copy.title}
            </h1>
            <p className="text-sm md:text-base text-slate-600 leading-relaxed max-w-xl">
              {copy.subtitle}
            </p>
            <p className="text-xs font-semibold text-slate-500">{companyName}</p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Link
                href="/portal/events"
                className="rounded-xl border border-slate-200/80 bg-white/90 px-4 py-2.5 text-sm font-bold text-slate-800 shadow-sm hover:bg-white"
              >
                {copy.ctaExpedientes}
              </Link>
              <Link
                href="/portal/appointments/new"
                className="rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-bold text-white shadow-md hover:bg-teal-700"
              >
                {copy.ctaAgendar}
              </Link>
            </div>
          </div>
          <div className="flex justify-center md:justify-end">
            <div className="relative h-40 w-40 shrink-0 md:h-44 md:w-44">
              <Image
                src="/branding/SOLUCIONES MEDICO EMPRESRIALES-06.png"
                alt="Soluciones Médico Empresariales"
                fill
                className="object-contain drop-shadow-md"
                priority
              />
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <PortalKpiCard label={copy.kpi.colaboradores} value={String(workersCount)} />
        <PortalKpiCard label={copy.kpi.atendidos} value={String(totalAttended12m)} />
        {proximasCitadas !== null && (
          <PortalKpiCard label={copy.kpi.citados} value={String(proximasCitadas)} />
        )}
        {canceladas12m !== null && (
          <PortalKpiCard label={copy.kpi.cancelados} value={String(canceladas12m)} />
        )}
        {completedEvents !== null && inProgressEvents !== null && (
          <>
            <PortalKpiCard
              label={copy.kpi.expedientesCompletados}
              value={String(completedEvents)}
            />
            <PortalKpiCard label={copy.kpi.enProceso} value={String(inProgressEvents)} />
          </>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-black uppercase tracking-wide text-slate-700 mb-1">
          {copy.chartTitle}
        </h2>
        <p className="text-xs text-slate-500 mb-4">{copy.chartSubtitle}</p>
        <div className="space-y-3">
          {months.map((row) => {
            const pct = Math.round((row.attendedCount / maxMonth) * 100)
            return (
              <div key={row.monthKey} className="flex items-center gap-3">
                <span className="w-24 shrink-0 text-xs font-semibold text-slate-600 capitalize">
                  {row.label}
                </span>
                <div className="flex-1 h-3 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-blue-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="w-10 text-right text-sm font-bold text-slate-800">
                  {row.attendedCount}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function PortalKpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-black text-slate-900">{value}</p>
    </div>
  )
}
