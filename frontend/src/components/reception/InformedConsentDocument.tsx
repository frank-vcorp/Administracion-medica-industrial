'use client'

import {
  INFORMED_CONSENT_BODY_INTRO,
  INFORMED_CONSENT_FORMAT_CODE,
  INFORMED_CONSENT_PRIVACY_DATA_ITEMS,
  INFORMED_CONSENT_PRIVACY_FOOTER,
  INFORMED_CONSENT_PRIVACY_PARAGRAPHS,
  INFORMED_CONSENT_PRIVACY_TITLE,
  INFORMED_CONSENT_TITLE,
} from '@/lib/informed-consent-content'

type Props = {
  patientFullName: string
  dateLabel: string
}

/**
 * Texto del consentimiento informado listo para leer, con nombre y fecha personalizados.
 * El PDF firmado se genera al confirmar el check-in (plantilla oficial + firma).
 */
export function InformedConsentDocument({ patientFullName, dateLabel }: Props) {
  const name = patientFullName.trim() || '—'

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 text-sm text-slate-800 leading-relaxed max-h-[min(52vh,420px)] overflow-y-auto shadow-inner">
      <header className="text-center border-b border-slate-100 pb-4 mb-4">
        <h3 className="text-base font-black uppercase tracking-wide text-slate-900">
          {INFORMED_CONSENT_TITLE}
        </h3>
        <p className="mt-2 text-sm">
          <span className="font-semibold text-slate-600">Fecha: </span>
          <span className="font-bold text-violet-800">{dateLabel}</span>
        </p>
      </header>

      <p className="mb-4 text-justify">
        Yo{' '}
        <span className="font-bold text-violet-900 underline decoration-violet-200 underline-offset-2">
          {name}
        </span>{' '}
        {INFORMED_CONSENT_BODY_INTRO}
      </p>

      <section className="space-y-3 border-t border-slate-100 pt-4">
        <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">
          {INFORMED_CONSENT_PRIVACY_TITLE}
        </h4>
        {INFORMED_CONSENT_PRIVACY_PARAGRAPHS.map((paragraph) => (
          <p key={paragraph.slice(0, 40)} className="text-justify text-[13px] text-slate-700">
            {paragraph}
          </p>
        ))}
        <ol className="list-decimal list-inside space-y-1 text-[13px] text-slate-700 pl-1">
          {INFORMED_CONSENT_PRIVACY_DATA_ITEMS.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
        <p className="text-justify text-[13px] text-slate-700">{INFORMED_CONSENT_PRIVACY_FOOTER}</p>
      </section>

      <footer className="mt-5 pt-3 border-t border-dashed border-slate-200 text-[10px] text-slate-400 text-center">
        {INFORMED_CONSENT_FORMAT_CODE}
      </footer>
    </article>
  )
}
