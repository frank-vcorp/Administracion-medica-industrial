'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { buildServiceRatingMessage, getSatisfactionSurveyUrl } from '@/lib/patient-feedback.config'
import WhatsAppAutoSendButton from '@/components/shared/WhatsAppAutoSendButton'

export function ServiceRatingPrompt({
  patientFirstName,
  patientPhone,
  eventId,
}: {
  patientFirstName: string
  patientPhone?: string | null
  eventId: string
}) {
  const [copied, setCopied] = useState(false)
  const message = useMemo(
    () => buildServiceRatingMessage(patientFirstName),
    [patientFirstName],
  )
  const surveyUrl = useMemo(() => {
    if (typeof window === 'undefined') return getSatisfactionSurveyUrl()
    return getSatisfactionSurveyUrl(window.location.origin)
  }, [])
  const surveyShareUrl = useMemo(() => {
    const base = surveyUrl
    const q = base.includes('?') ? '&' : '?'
    return `${base}${q}event=${eventId}&channel=WHATSAPP_LINK`
  }, [surveyUrl, eventId])
  const whatsappText = useMemo(
    () => buildServiceRatingMessage(patientFirstName, surveyShareUrl),
    [patientFirstName, surveyShareUrl],
  )

  const copyMessage = async () => {
    try {
      await navigator.clipboard.writeText(message)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="mx-auto max-w-xl rounded-2xl border border-amber-200 bg-amber-50/80 p-5 text-left shadow-sm">
      <p className="text-[10px] font-bold uppercase tracking-widest text-amber-700">
        Calificación del servicio
      </p>
      <h4 className="mt-1 text-lg font-bold text-slate-800">
        Invita al paciente a calificar su atención
      </h4>
      <p className="mt-2 text-sm text-slate-600">{message}</p>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <button
          type="button"
          onClick={() => void copyMessage()}
          className="rounded-xl border border-amber-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-amber-100"
        >
          {copied ? '✓ Copiado' : '📋 Copiar mensaje'}
        </button>

        {patientPhone ? (
          <WhatsAppAutoSendButton
            phone={patientPhone}
            text={whatsappText}
            auditContext="satisfaction_survey"
            entityId={eventId}
            className="rounded-xl bg-emerald-600 px-4 py-2.5 text-center text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-70"
          >
            💬 Enviar por WhatsApp
          </WhatsAppAutoSendButton>
        ) : (
          <span className="rounded-xl border border-dashed border-amber-200 px-4 py-2.5 text-xs text-amber-800">
            Sin teléfono del paciente — usa copiar mensaje
          </span>
        )}

        <Link
          href={`${surveyUrl}${surveyUrl.includes('?') ? '&' : '?'}event=${eventId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-xl bg-violet-600 px-4 py-2.5 text-center text-sm font-bold text-white hover:bg-violet-700"
        >
          📝 Encuesta de satisfacción
        </Link>
      </div>
    </div>
  )
}
