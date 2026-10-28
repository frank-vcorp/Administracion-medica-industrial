'use client'

import { useState, useTransition } from 'react'
import { sendEmployerFinalReportWhatsApp } from '@/actions/final-report-send.actions'

type Props = {
  eventId: string
  phone: string
  className?: string
}

export default function SendFinalReportWhatsAppButton({ eventId, phone, className }: Props) {
  const [pending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<string | null>(null)

  return (
    <span className="inline-flex flex-col items-end gap-0.5">
      <button
        type="button"
        disabled={pending}
        className={
          className ??
          'text-violet-700 hover:text-violet-900 text-xs font-semibold hover:underline disabled:opacity-50'
        }
        title="Enviar reporte final de aptitud laboral (PDF) por WhatsApp"
        onClick={() => {
          setFeedback(null)
          startTransition(async () => {
            const res = await sendEmployerFinalReportWhatsApp({ eventId, phone })
            if (res.sent) setFeedback('Enviado')
            else if (res.skipped) setFeedback('WA manual')
            else setFeedback(res.error ?? 'Error')
          })
        }}
      >
        {pending ? 'Enviando…' : 'WA reporte final'}
      </button>
      {feedback ? (
        <span className="text-[9px] text-slate-400 max-w-[8rem] text-right">{feedback}</span>
      ) : null}
    </span>
  )
}
