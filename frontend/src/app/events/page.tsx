import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

/** Expedientes activos unificados en /workers (Word R-16). */
export default function EventsIndexPage() {
  redirect('/workers')
}
