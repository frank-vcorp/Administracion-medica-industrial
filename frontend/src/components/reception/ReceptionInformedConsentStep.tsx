'use client'

import { useRef, useState } from 'react'
import { InformedConsentDocument } from '@/components/reception/InformedConsentDocument'
import SignaturePad, { type SignaturePadHandle } from '@/components/reception/SignaturePad'

type Props = {
  patientFullName: string
  onBack: () => void
  onConfirm: (signatureDataUrl: string) => void
  isPending: boolean
  error: string | null
  confirmLabel?: string
}

export function ReceptionInformedConsentStep({
  patientFullName,
  onBack,
  onConfirm,
  isPending,
  error,
  confirmLabel = 'Firmar y confirmar ingreso',
}: Props) {
  const signaturePadRef = useRef<SignaturePadHandle>(null)
  const [consentGiven, setConsentGiven] = useState(false)
  const [consentDocumentRead, setConsentDocumentRead] = useState(false)
  const [consentDataCorrect, setConsentDataCorrect] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  const consentDateLabel = new Date().toLocaleDateString('es-MX', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const handleConfirm = () => {
    setLocalError(null)
    if (!consentGiven || !consentDocumentRead || !consentDataCorrect) {
      setLocalError('Marca las tres confirmaciones del consentimiento antes de continuar.')
      return
    }
    const signatureDataUrl = signaturePadRef.current?.toDataURL()
    if (!signatureDataUrl) {
      setLocalError('Debes firmar el consentimiento informado con autógrafo.')
      return
    }
    onConfirm(signatureDataUrl)
  }

  const displayError = error ?? localError

  return (
    <div className="space-y-4 max-h-[min(85vh,720px)] overflow-y-auto">
      <InformedConsentDocument patientFullName={patientFullName} dateLabel={consentDateLabel} />
      <p className="text-[10px] text-slate-500">
        Al firmar, se generará el PDF oficial (nombre, fecha y firma) y quedará en el historial del
        trabajador.
      </p>
      <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={consentGiven}
            onChange={(e) => setConsentGiven(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
          />
          <span className="text-sm font-medium text-slate-800">Doy mi consentimiento</span>
        </label>
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={consentDocumentRead}
            onChange={(e) => setConsentDocumentRead(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
          />
          <span className="text-sm font-medium text-slate-800">
            Confirmo que he leído el documento y el aviso de privacidad integral (PDF)
          </span>
        </label>
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={consentDataCorrect}
            onChange={(e) => setConsentDataCorrect(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
          />
          <span className="text-sm font-medium text-slate-800">
            Confirmo que mis datos son correctos
            <span className="block text-xs font-normal text-slate-500 mt-0.5">
              Nombre: {patientFullName.trim() || '—'}
            </span>
          </span>
        </label>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <label className="text-xs font-bold text-slate-600">
            Firma autógrafa <span className="text-red-500">*</span>
          </label>
          <button
            type="button"
            onClick={() => signaturePadRef.current?.clear()}
            className="text-[10px] font-bold text-slate-500 hover:text-slate-700 underline"
          >
            Limpiar firma
          </button>
        </div>
        <div className="rounded-xl border-2 border-dashed border-violet-200 overflow-hidden">
          <SignaturePad ref={signaturePadRef} height={140} />
        </div>
      </div>
      {displayError && (
        <p className="text-xs text-red-600 bg-red-50 p-3 rounded-xl border border-red-100">{displayError}</p>
      )}
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onBack}
          disabled={isPending}
          className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 py-2.5 rounded-xl font-bold text-sm disabled:opacity-50"
        >
          ← Volver
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={isPending || !consentGiven || !consentDocumentRead || !consentDataCorrect}
          className="flex-[2] bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl font-bold text-sm disabled:opacity-50"
        >
          {isPending ? '⏳ Procesando...' : confirmLabel}
        </button>
      </div>
    </div>
  )
}
