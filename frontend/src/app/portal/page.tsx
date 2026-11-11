import {
  getCompanyDashboardStats,
  getCompanyMonthlyAttendedStats,
  getPortalAppointmentSummary,
} from '@/actions/portal.actions'
import { getPortalPageCompany } from '@/lib/portal-access'
import PortalHomeDashboard from '@/components/portal/PortalHomeDashboard'

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
  const proximas = appointmentSummary.success ? appointmentSummary.proximasCitadas : null
  const canceladas = appointmentSummary.success ? appointmentSummary.canceladas12m : null

  return (
    <PortalHomeDashboard
      companyName={companyName}
      workersCount={monthlyResult.workers}
      totalAttended12m={monthlyResult.totalAttended}
      proximasCitadas={proximas}
      canceladas12m={canceladas}
      completedEvents={stats?.completed ?? null}
      inProgressEvents={stats?.inProgress ?? null}
      months={monthlyResult.months}
    />
  )
}
