'use client'

import type { PatientNameWarning } from '@/lib/clinical/patient-name-match'

type Props = {
  open: boolean
  warning: PatientNameWarning | null
  onClose: () => void
}

/**
 * Aviso no bloqueante: la prueba ya se guardó; el usuario confirma que revisó.
 */
export default function PatientNameMismatchModal({ open, warning, onClose }: Props) {
  if (!open || !warning) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="patient-name-mismatch-title"
      data-testid="patient-name-mismatch-modal"
    >
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4 border border-amber-200">
        <div className="flex items-start gap-3">
          <span className="text-2xl shrink-0" aria-hidden>
            ⚠️
          </span>
          <div>
            <h2
              id="patient-name-mismatch-title"
              className="text-lg font-bold text-slate-900"
            >
              Revisar identificación del paciente
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              El archivo se guardó y el análisis continuó. Compare los nombres por si la
              extracción falló o el documento es de otra persona.
            </p>
          </div>
        </div>

        <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 space-y-2 text-sm">
          <div>
            <span className="text-xs text-slate-500 block">Expediente</span>
            <span className="font-semibold text-slate-900">{warning.workerFullName}</span>
          </div>
          <div>
            <span className="text-xs text-slate-500 block">Documento</span>
            <span className="font-semibold text-slate-900">{warning.extractedName}</span>
          </div>
        </div>

        <p className="text-xs text-amber-800">{warning.message}</p>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold"
          >
            Entendido, continuar
          </button>
        </div>
      </div>
    </div>
  )
}
