'use client'

import {
  evaluatePatientNameMatch,
  extractPatientNameFromStructuredData,
  isPatientNameVerificationStudy,
} from '@/lib/clinical/patient-name-match'

type Props = {
  studyType: string | null | undefined
  workerFullName: string
  extractedData: Record<string, unknown> | null | undefined
}

/**
 * Muestra nombre en expediente vs documento para espirometría / audiometría.
 */
export default function ExtractedPatientIdentityBanner({
  studyType,
  workerFullName,
  extractedData,
}: Props) {
  if (!isPatientNameVerificationStudy(studyType)) return null

  const extractedName = extractPatientNameFromStructuredData(extractedData ?? null)
  const worker = workerFullName.trim()

  if (!extractedName && !worker) return null

  const evaluation =
    extractedName && worker
      ? evaluatePatientNameMatch(worker, extractedData)
      : null

  const matches = evaluation?.matches ?? null

  return (
    <div
      className={`rounded-xl border px-4 py-3 space-y-2 ${
        matches === false
          ? 'border-amber-300 bg-amber-50'
          : matches === true
            ? 'border-emerald-200 bg-emerald-50/80'
            : 'border-slate-200 bg-slate-50'
      }`}
      data-testid="extracted-patient-identity-banner"
    >
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
        Identificación en documento
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
        <div>
          <span className="text-xs text-slate-500 block">Paciente en expediente</span>
          <span className="font-semibold text-slate-900">{worker || '—'}</span>
        </div>
        <div>
          <span className="text-xs text-slate-500 block">Nombre en la prueba</span>
          <span className="font-semibold text-slate-900">{extractedName ?? '—'}</span>
        </div>
      </div>
      {matches === true && (
        <p className="text-xs text-emerald-800 font-medium">Los nombres coinciden.</p>
      )}
      {matches === false && (
        <p className="text-xs text-amber-900 font-medium">
          Los nombres no coinciden. Revise si la extracción leyó mal el PDF/XML o si el archivo
          corresponde a otro trabajador.
        </p>
      )}
      {extractedName === null && (
        <p className="text-xs text-slate-600">
          La extracción no reportó nombre de paciente en este archivo.
        </p>
      )}
    </div>
  )
}
