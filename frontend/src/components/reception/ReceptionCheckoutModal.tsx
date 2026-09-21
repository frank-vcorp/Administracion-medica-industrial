'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { dischargePatientFromReception } from '@/actions/event.actions'
import { buildWhatsAppRatingLink, getSatisfactionSurveyUrl } from '@/lib/patient-feedback.config'

export type ReceptionCheckoutPatient = {
  eventId: string
  patientFirstName: string
  patientPhone: string | null
  patientFullName: string
}

type Props = {
  patient: ReceptionCheckoutPatient
  onClose: () => void
}

export default function ReceptionCheckoutModal({ patient, onClose }: Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const router = useRouter()

  const surveyKioskUrl = `${getSatisfactionSurveyUrl(typeof window !== 'undefined' ? window.location.origin : undefined)}?event=${patient.eventId}&mode=kiosk&channel=TABLET`
  const surveyShareUrl = `${getSatisfactionSurveyUrl(typeof window !== 'undefined' ? window.location.origin : undefined)}?event=${patient.eventId}&channel=WHATSAPP_LINK`
  const whatsappHref = patient.patientPhone
    ? buildWhatsAppRatingLink(patient.patientPhone, patient.patientFirstName, surveyShareUrl)
    : null

  const copySurveyLink = async () => {
    try {
      await navigator.clipboard.writeText(surveyShareUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  const handleConfirmDischarge = () => {
    setError(null)
    startTransition(async () => {
      const result = await dischargePatientFromReception(patient.eventId)
      if (!result.success) {
        setError(result.error ?? 'No se pudo registrar la salida.')
        return
      }
      router.refresh()
      onClose()
    })
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reception-checkout-title"
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="border-b border-slate-100 px-6 py-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-teal-600">
            Salida del paciente
          </p>
          <h2 id="reception-checkout-title" className="mt-1 text-xl font-black text-slate-900">
            {patient.patientFullName}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Ofrece la encuesta AMI antes de confirmar la salida (no es obligatorio para cerrar).
          </p>
        </div>

        <div className="space-y-3 px-6 py-4">
          <Link
            href={surveyKioskUrl}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="reception-checkout-tablet"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-bold text-white hover:bg-violet-700"
          >
            📱 Encuesta en esta tableta
          </Link>

          {whatsappHref ? (
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="reception-checkout-whatsapp"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700"
            >
              💬 Enviar por WhatsApp
            </a>
          ) : (
            <div className="rounded-xl border border-dashed border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
              Sin teléfono del paciente — copia el enlace de encuesta y compártelo manualmente.
            </div>
          )}

          <button
            type="button"
            onClick={() => void copySurveyLink()}
            data-testid="reception-checkout-copy-link"
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            {copied ? '✓ Enlace copiado' : '📋 Copiar enlace de encuesta'}
          </button>
        </div>

        {error && (
          <p className="mx-6 mb-2 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
            {error}
          </p>
        )}

        <div className="flex flex-col gap-2 border-t border-slate-100 px-6 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirmDischarge}
            disabled={isPending}
            data-testid="reception-checkout-confirm"
            className="rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-teal-700 disabled:opacity-50"
          >
            {isPending ? 'Registrando salida…' : 'Confirmar salida del paciente'}
          </button>
        </div>
      </div>
    </div>
  )
}
