'use client'
/**
 * Trigger "Pago y Recibo" + PaymentModal.
 * Componente cliente para manejar el estado de apertura del modal dentro del
 * page.tsx (server component) de events/[id].
 *
 * @id IMPL-20260630-01
 * @spec context/SPECs/SPEC_ARCH-20260630-01-MODAL-PAGO-RECIBO-PAPELETA.md
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import PaymentModal from '@/components/clinical/PaymentModal'
import { getPaymentHistory } from '@/actions/payment.actions'

interface PaymentModalTriggerProps {
  eventId: string
  workerId: string
  workerFirstName: string
  workerLastName: string
  universalId?: string | null
  companyName: string
  branchName?: string | null
  receivedBy: string
  /** Roles permitidos para ver el botón. */
  canRegisterPayments: boolean
}

export default function PaymentModalTrigger({
  eventId,
  workerId,
  workerFirstName,
  workerLastName,
  universalId,
  companyName,
  branchName,
  receivedBy,
  canRegisterPayments,
}: PaymentModalTriggerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [hasPayments, setHasPayments] = useState<boolean | null>(null)
  const router = useRouter()

  if (!canRegisterPayments) {
    return null
  }

  const fullName = `${workerFirstName} ${workerLastName}`.trim()

  // Cargar historial en background (silencioso, para badge futuro).
  // No bloquea la apertura del modal.
  void (async () => {
    if (hasPayments !== null) return
    const res = await getPaymentHistory(eventId)
    if (res.success && res.payments && res.payments.length > 0) {
      setHasPayments(true)
    } else {
      setHasPayments(false)
    }
  })()

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="bg-amber-50 hover:bg-amber-100 text-amber-700 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors border border-amber-200 flex items-center gap-1"
        title="Registrar pago y emitir recibo"
      >
        💳 Pago y Recibo
        {hasPayments === true && (
          <span className="ml-1 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-emerald-500 text-white text-[9px] font-bold">
            ✓
          </span>
        )}
      </button>

      <PaymentModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onSuccess={() => {
          setHasPayments(true)
          router.refresh()
        }}
        eventId={eventId}
        workerId={workerId}
        workerName={fullName}
        universalId={universalId}
        companyName={companyName}
        branchName={branchName}
        receivedBy={receivedBy}
      />
    </>
  )
}