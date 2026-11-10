'use client'

import {
  OCCUPATIONAL_PRIVACY_PDF_FILENAME,
  OCCUPATIONAL_PRIVACY_PDF_URL,
} from '@/lib/legal/occupational-privacy-notice'

type Props = {
  compact?: boolean
  showPreview?: boolean
}

export function PrivacyNoticePdfLinks({ compact = false, showPreview = false }: Props) {
  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      <p className={`text-slate-600 leading-relaxed ${compact ? 'text-xs' : 'text-sm'}`}>
        Aviso de privacidad integral (salud ocupacional FY27). La veracidad de los datos clínicos
        se declara en el consentimiento informado.
      </p>
      <div className="flex flex-wrap gap-2">
        <a
          href={OCCUPATIONAL_PRIVACY_PDF_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold px-3 py-2"
        >
          Ver aviso (PDF)
        </a>
        <a
          href={OCCUPATIONAL_PRIVACY_PDF_URL}
          download={OCCUPATIONAL_PRIVACY_PDF_FILENAME}
          className="inline-flex items-center rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold px-3 py-2"
        >
          Descargar
        </a>
      </div>
      {showPreview && (
        <iframe
          title="Vista previa aviso de privacidad FY27"
          src={OCCUPATIONAL_PRIVACY_PDF_URL}
          className="w-full h-40 rounded-lg border border-slate-200 bg-slate-50"
        />
      )}
    </div>
  )
}
