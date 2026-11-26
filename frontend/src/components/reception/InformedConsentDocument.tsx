'use client'

import { SME_LEGAL_NAME_FULL } from '@/lib/brand-constants'
import {
  INFORMED_CONSENT_BODY_INTRO,
  INFORMED_CONSENT_FORMAT_CODE,
  INFORMED_CONSENT_LEGAL_NOTE,
  INFORMED_CONSENT_MANIFESTATION_INTRO,
  INFORMED_CONSENT_MANIFESTATION_ITEMS,
  INFORMED_CONSENT_MANIFESTATION_TITLE,
  INFORMED_CONSENT_PRIVACY_TITLE,
  INFORMED_CONSENT_SECTIONS,
  INFORMED_CONSENT_SUBTITLE,
  INFORMED_CONSENT_TITLE,
  SME_ADDRESS_FULL,
  SME_ARCO_EMAIL,
  SME_ARCO_PHONE,
} from '@/lib/informed-consent-content'

type Props = {
  patientFullName: string
  dateLabel: string
  companyName?: string | null
  workerUniversalId?: string | null
  expedientId?: string | null
}

/**
 * Texto integral en línea del Consentimiento Informado y Aviso de Privacidad Integral
 * personalizado para Soluciones Médico Empresariales (SME).
 */
export function InformedConsentDocument({
  patientFullName,
  dateLabel,
  companyName,
  workerUniversalId,
  expedientId,
}: Props) {
  const name = patientFullName.trim() || '—'
  const cleanCompany = companyName?.trim() || null
  const cleanWorkerId = workerUniversalId?.trim() || null
  const cleanExpedient = expedientId?.trim() || null

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 text-sm text-slate-800 leading-relaxed max-h-[min(54vh,460px)] overflow-y-auto shadow-inner space-y-5">
      <header className="text-center border-b border-slate-200 pb-4 space-y-1.5">
        <p className="text-[11px] font-bold uppercase tracking-wider text-teal-700">
          {INFORMED_CONSENT_SUBTITLE}
        </p>
        <h3 className="text-base font-black tracking-tight text-slate-900 leading-snug">
          {INFORMED_CONSENT_TITLE}
        </h3>
        <div className="pt-1 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-slate-600">
          <span>
            <span className="font-semibold">Fecha: </span>
            <span className="font-bold text-violet-800">{dateLabel}</span>
          </span>
          {cleanCompany && (
            <span>
              <span className="font-semibold">Empresa: </span>
              <span className="font-medium text-slate-800">{cleanCompany}</span>
            </span>
          )}
          {cleanWorkerId && (
            <span>
              <span className="font-semibold">ID: </span>
              <span className="font-mono text-slate-800">{cleanWorkerId}</span>
            </span>
          )}
          {cleanExpedient && (
            <span>
              <span className="font-semibold">Folio: </span>
              <span className="font-mono text-slate-800">{cleanExpedient}</span>
            </span>
          )}
        </div>
        <p className="text-[11px] text-slate-400 pt-1">
          Desliza para leer el consentimiento y las secciones I a XIX del Aviso de Privacidad Integral.
        </p>
      </header>

      <p className="text-justify text-[13px] leading-relaxed text-slate-800">
        Yo{' '}
        <span className="font-bold text-violet-900 underline decoration-violet-200 underline-offset-2">
          {name}
        </span>{' '}
        {INFORMED_CONSENT_BODY_INTRO}
      </p>

      <section className="space-y-4 border-t border-slate-200 pt-4">
        <h4 className="text-xs font-black tracking-wider text-violet-900 uppercase text-center">
          {INFORMED_CONSENT_PRIVACY_TITLE}
        </h4>

        {INFORMED_CONSENT_SECTIONS.map((section) => (
          <div key={section.roman} className="space-y-1.5">
            <h5 className="text-xs font-extrabold tracking-wide text-slate-900 uppercase">
              {section.roman}. {section.title}
            </h5>
            {section.paragraphs.map((paragraph, idx) => (
              <p
                key={`${section.roman}-p-${idx}`}
                className="text-justify text-[13px] text-slate-700 leading-relaxed"
              >
                {paragraph}
              </p>
            ))}
            {section.bullets && section.bullets.length > 0 && (
              <ul className="list-disc pl-5 space-y-1 text-[13px] text-slate-700">
                {section.bullets.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
            {section.numberedItems && section.numberedItems.length > 0 && (
              <ol className="list-decimal pl-5 space-y-1 text-[13px] text-slate-700">
                {section.numberedItems.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ol>
            )}
            {section.closingParagraph && (
              <p className="text-justify text-[13px] text-slate-700 leading-relaxed">
                {section.closingParagraph}
              </p>
            )}
          </div>
        ))}
      </section>

      <section className="rounded-xl border border-teal-200/80 bg-teal-50/70 p-3.5 text-xs text-slate-700 space-y-1">
        <p className="font-bold text-slate-900">
          Responsable y atención de Derechos ARCO: {SME_LEGAL_NAME_FULL} (SME)
        </p>
        <p>Domicilio: {SME_ADDRESS_FULL}</p>
        <p>
          Correo: <span className="font-semibold text-teal-900">{SME_ARCO_EMAIL}</span>
          {' · '}
          Teléfono: <span className="font-semibold text-teal-900">{SME_ARCO_PHONE}</span>
        </p>
      </section>

      <section className="space-y-2.5 border-t border-slate-200 pt-4">
        <h4 className="text-xs font-black tracking-wide text-slate-900 uppercase">
          {INFORMED_CONSENT_MANIFESTATION_TITLE}
        </h4>
        <p className="text-justify text-[13px] text-slate-700">
          {INFORMED_CONSENT_MANIFESTATION_INTRO}
        </p>
        <ul className="list-disc pl-5 space-y-1.5 text-[13px] text-slate-700">
          {INFORMED_CONSENT_MANIFESTATION_ITEMS.map((item) => (
            <li key={item} className="text-justify">
              {item}
            </li>
          ))}
        </ul>
        <p className="text-[11px] text-slate-500 italic leading-relaxed pt-1">
          {INFORMED_CONSENT_LEGAL_NOTE}
        </p>
      </section>

      <footer className="pt-3 border-t border-dashed border-slate-200 text-[10px] text-slate-400 text-center">
        {INFORMED_CONSENT_FORMAT_CODE}
      </footer>
    </article>
  )
}
