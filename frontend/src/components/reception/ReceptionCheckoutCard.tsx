'use client'

import { useState } from 'react'
import ReceptionCheckoutModal, {
  type ReceptionCheckoutPatient,
} from '@/components/reception/ReceptionCheckoutModal'
import ReceptionEventTestsList, {
  type ReceptionKanbanTest,
} from '@/components/reception/ReceptionEventTestsList'

type Props = {
  event: {
    id: string
    checkInDate?: Date | string | null
    eventTests?: ReceptionKanbanTest[]
    worker: {
      firstName: string
      lastName: string
      phone?: string | null
      company: { name: string } | null
    }
  }
  intakeBadge: { label: string; tone: string }
}

export default function ReceptionCheckoutCard({ event, intakeBadge }: Props) {
  const [checkoutPatient, setCheckoutPatient] = useState<ReceptionCheckoutPatient | null>(null)

  const workerName = `${event.worker.firstName} ${event.worker.lastName}`.trim()
  const companyName = event.worker.company?.name ?? 'Empresa vinculada'
  const checkInTime = event.checkInDate
    ? new Date(event.checkInDate).toLocaleTimeString('es-MX', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : null

  return (
    <>
      <div className="relative overflow-hidden rounded-xl border border-amber-100 bg-white p-3 shadow-sm transition-all duration-200 hover:border-amber-200 hover:shadow-md">
        <div className="mb-2 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-xs font-bold uppercase tracking-tight text-slate-800">
              {workerName}
            </p>
            <p className="truncate text-[10px] font-medium text-slate-500">
              {companyName}
              {checkInTime ? ` · ${checkInTime}` : ''}
            </p>
          </div>
          <span
            className={`shrink-0 rounded-full border px-2 py-0.5 text-[8px] font-black uppercase tracking-wide ${intakeBadge.tone}`}
          >
            {intakeBadge.label}
          </span>
        </div>

        <ReceptionEventTestsList
          eventId={event.id}
          tests={event.eventTests ?? []}
          variant="compact"
        />

        <div className="mt-2 flex items-center justify-end gap-2 border-t border-slate-50 pt-2">
          <button
            type="button"
            onClick={() =>
              setCheckoutPatient({
                eventId: event.id,
                patientFirstName: event.worker.firstName,
                patientPhone: event.worker.phone ?? null,
                patientFullName: workerName,
              })
            }
            data-testid={`reception-checkout-open-${event.id.slice(0, 8)}`}
            className="rounded-md bg-amber-500 px-3 py-1 text-[9px] font-black uppercase tracking-widest text-white transition-all hover:bg-amber-600"
          >
            Dar salida →
          </button>
        </div>
      </div>

      {checkoutPatient && (
        <ReceptionCheckoutModal
          patient={checkoutPatient}
          onClose={() => setCheckoutPatient(null)}
        />
      )}
    </>
  )
}
