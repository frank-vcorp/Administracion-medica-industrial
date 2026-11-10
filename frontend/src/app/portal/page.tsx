import Link from 'next/link'
import Image from 'next/image'
import {
  getCompanyDashboardStats,
  getCompanyMonthlyAttendedStats,
  getPortalAppointmentSummary,
} from '@/actions/portal.actions'
import { getPortalPageCompany } from '@/lib/portal-access'

export default async function PortalRootPage() {
  let companyName: string
  try {
    ;({ company: { name: companyName } } = await getPortalPageCompany())
  } catch {
    return <div className="p-8 text-red-600">Error: No hay sesión válida.</div>
  }

  const [monthlyResult, statsResult, appointmentSummary] = await Promise.all([
    getCompanyMonthlyAttendedStats(),
    getCompanyDashboardStats(),
    getPortalAppointmentSummary(),
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
  const proximas =
    appointmentSummary.success ? appointmentSummary.proximasCitadas : null
  const canceladas =
    appointmentSummary.success ? appointmentSummary.canceladas12m : null

  return (
    <div className="space-y-8 p-4 md:p-6 max-w-5xl mx-auto">
      <section className="relative overflow-hidden rounded-2xl border border-teal-200/80 bg-gradient-to-br from-teal-50 via-white to-sky-50 shadow-md">
        <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-teal-200/30 blur-3xl" aria-hidden />
        <div className="absolute -bottom-20 -left-10 h-48 w-48 rounded-full bg-sky-200/25 blur-3xl" aria-hidden />
        <div className="relative grid gap-6 p-6 md:p-8 md:grid-cols-[1fr,220px] md:items-center">
          <div className="space-y-3">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-teal-700/90">
              Portal empresarial
            </p>
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 leading-tight">
              Bienvenido a tu software especializado en salud ocupacional
            </h1>
            <p className="text-sm md:text-base text-slate-600 leading-relaxed max-w-xl">
              Visualiza tu equipo con claridad: dashboard en vivo, pacientes atendidos, citados y
              cancelados — todo en un solo lugar, con la tranquilidad de trabajar con datos
              confiables para la salud de tus colaboradores.
            </p>
            <p className="text-xs font-semibold text-slate-500">{companyName}</p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Link
                href="/portal/events"
                className="rounded-xl border border-slate-200/80 bg-white/90 px-4 py-2.5 text-sm font-bold text-slate-800 shadow-sm hover:bg-white"
              >
                Expedientes
              </Link>
              <Link
                href="/portal/appointments/new"
                className="rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-bold text-white shadow-md hover:bg-teal-700"
              >
                + Agendar cita
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
        <StatCard label="Colaboradores" value={String(monthlyResult.workers)} />
        <StatCard
          label="Atendidos (12 meses)"
          value={String(monthlyResult.totalAttended)}
        />
        {proximas !== null && (
          <StatCard label="Citados (próximas)" value={String(proximas)} />
        )}
        {canceladas !== null && (
          <StatCard label="Cancelados (12 meses)" value={String(canceladas)} />
        )}
        {stats && (
          <>
            <StatCard label="Expedientes completados" value={String(stats.completed)} />
            <StatCard label="En proceso" value={String(stats.inProgress)} />
          </>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-black uppercase tracking-wide text-slate-700 mb-1">
          Atendidos por mes
        </h2>
        <p className="text-xs text-slate-500 mb-4">Últimos 12 meses · evolución del equipo atendido</p>
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
