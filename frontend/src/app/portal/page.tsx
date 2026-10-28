import Link from 'next/link'
import {
  getCompanyDashboardStats,
  getCompanyMonthlyAttendedStats,
} from '@/actions/portal.actions'
import { getPortalPageCompany } from '@/lib/portal-access'

export default async function PortalRootPage() {
  let companyName: string
  try {
    ;({ company: { name: companyName } } = await getPortalPageCompany())
  } catch {
    return <div className="p-8 text-red-600">Error: No hay sesión válida.</div>
  }

  const [monthlyResult, statsResult] = await Promise.all([
    getCompanyMonthlyAttendedStats(),
    getCompanyDashboardStats(),
  ])

  if (!monthlyResult.success) {
    return (
      <div className="p-8 text-red-600">
        {monthlyResult.error ?? 'Error al cargar el portal.'}
      </div>
    )
  }

  const stats = statsResult.success ? statsResult.stats : null
  const maxMonth = Math.max(1, ...monthlyResult.months.map((m) => m.attendedCount))

  return (
    <div className="space-y-8 p-4 md:p-6 max-w-5xl mx-auto">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500">
            {companyName} — atendidos por mes (últimos 12 meses).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/portal/events"
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Expedientes
          </Link>
          <Link
            href="/portal/appointments/new"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700"
          >
            + Agendar cita
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Colaboradores" value={String(monthlyResult.workers)} />
        <StatCard
          label="Atendidos (12 meses)"
          value={String(monthlyResult.totalAttended)}
        />
        {stats && (
          <>
            <StatCard label="Expedientes completados" value={String(stats.completed)} />
            <StatCard label="En proceso" value={String(stats.inProgress)} />
          </>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-black uppercase tracking-wide text-slate-700 mb-4">
          Atendidos por mes
        </h2>
        <div className="space-y-3">
          {monthlyResult.months.map((row) => {
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

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-2xl font-black text-slate-900">{value}</p>
    </div>
  )
}
