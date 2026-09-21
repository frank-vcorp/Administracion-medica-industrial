'use client'

import { useState } from 'react'
import ReceptionCheckoutModal, {
  type ReceptionCheckoutPatient,
} from '@/components/reception/ReceptionCheckoutModal'

type Props = {
  event: {
    id: string
    checkInDate?: Date | string | null
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
      <div className="relative overflow-hidden rounded-2xl border border-amber-100 bg-white p-5 shadow-sm transition-all duration-300 hover:border-amber-200 hover:shadow-lg">
        <div className="mb-2 flex items-start justify-between">
          <span className="text-sm font-bold uppercase tracking-tight text-slate-800">
            {workerName}
          </span>
          <span className="font-mono text-[10px] font-black text-slate-300">
            #{event.id.slice(0, 4)}
          </span>
        </div>
        <p className="mb-1 text-[11px] font-bold text-slate-400">{companyName}</p>
        {checkInTime && (
          <p className="mb-3 text-[10px] text-slate-400">Ingreso {checkInTime}</p>
        )}
        <div className="mb-4">
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${intakeBadge.tone}`}
          >
            {intakeBadge.label}
          </span>
        </div>

        <div className="mt-2 flex items-center justify-between border-t border-slate-50 pt-4">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600">
            Pruebas realizadas
          </span>
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
            className="rounded-md bg-amber-500 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-white transition-all hover:bg-amber-600"
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
