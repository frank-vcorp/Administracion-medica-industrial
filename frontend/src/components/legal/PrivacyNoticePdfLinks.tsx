'use client'

import {
  getCheckInPrivacyNoticeConfig,
  type CheckInPrivacyNoticeKey,
} from '@/lib/legal/check-in-privacy-notice'

type Props = {
  compact?: boolean
  showPreview?: boolean
  noticeKey?: CheckInPrivacyNoticeKey
}

export function PrivacyNoticePdfLinks({
  compact = false,
  showPreview = false,
  noticeKey = 'SME',
}: Props) {
  const config = getCheckInPrivacyNoticeConfig(noticeKey)
  const pdf = config.integralPdf

  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      <p className={`text-slate-600 leading-relaxed ${compact ? 'text-xs' : 'text-sm'}`}>
        {config.integralPdfBlurb}
      </p>
      {pdf ? (
        <div className="flex flex-wrap gap-2">
          <a
            href={pdf.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold px-3 py-2"
          >
            Ver aviso (PDF)
          </a>
          <a
            href={pdf.url}
            download={pdf.filename}
            className="inline-flex items-center rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold px-3 py-2"
          >
            Descargar
          </a>
        </div>
      ) : (
        <p className={`text-slate-500 ${compact ? 'text-[11px]' : 'text-xs'}`}>
          Responsable: <span className="font-semibold text-slate-700">{config.legalName}</span>
          {noticeKey === 'SME' ? (
            <>
              {' '}
              · Resumen ampliado en{' '}
              <a href="/legal/privacidad-portal" className="text-teal-700 underline font-medium">
                aviso del portal
              </a>
            </>
          ) : null}
        </p>
      )}
      {showPreview && pdf ? (
        <iframe
          title={`Vista previa aviso de privacidad — ${config.legalName}`}
          src={pdf.url}
          className="w-full h-40 rounded-lg border border-slate-200 bg-slate-50"
        />
      ) : null}
    </div>
  )
}
