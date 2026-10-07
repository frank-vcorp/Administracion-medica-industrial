import { getPortalAppointmentBookingContext } from '@/actions/portal-appointment.actions'
import PortalAppointmentForm from '@/components/portal/PortalAppointmentForm'
import Link from 'next/link'

export default async function PortalNewAppointmentPage() {
  const ctx = await getPortalAppointmentBookingContext()

  if (!ctx.success) {
    return (
      <div className="p-8 max-w-lg mx-auto text-center space-y-3">
        <p className="text-red-700">{ctx.error}</p>
        <Link href="/portal/events" className="text-blue-600 text-sm font-medium">
          ← Volver a expedientes
        </Link>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-4">
      <Link href="/portal/events" className="text-sm text-blue-600 font-medium hover:underline">
        ← Expedientes
      </Link>
      <h1 className="text-2xl font-bold text-slate-900">Agendar cita</h1>
      <PortalAppointmentForm context={ctx} />
    </div>
  )
}
