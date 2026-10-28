import { redirect } from 'next/navigation'

/** La vista de 3 agendas vive en /appointments. */
export default function AppointmentsOverviewRedirectPage() {
  redirect('/appointments')
}
