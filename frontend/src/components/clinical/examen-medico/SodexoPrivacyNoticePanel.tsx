'use client'

const PRIVACY_PDF_URL = '/legal/aviso-privacidad-salud-ocupacional-fy27.pdf'

type Props = {
  informedConsentSignedAt?: string | Date | null
  patientFullName?: string | null
}

export function SodexoPrivacyNoticePanel({
  informedConsentSignedAt,
  patientFullName,
}: Props) {
  const signedLabel = informedConsentSignedAt
    ? new Date(informedConsentSignedAt).toLocaleString('es-MX', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : null

  return (
    <section className="rounded-lg border border-slate-200 bg-white scroll-mt-4" id="sodexo-block-privacidad">
      <h2 className="text-xs font-bold text-slate-800 px-3 py-2 border-b border-slate-100 bg-slate-50">
        Aviso de privacidad y veracidad (FY27)
      </h2>
      <div className="p-3 space-y-3">
        <p className="text-xs text-slate-600 leading-relaxed">
          El aviso de privacidad integral para salud ocupacional Sodexo está publicado en el documento
          oficial. La aceptación y la firma autógrafa se capturan en recepción al check-in (consentimiento
          informado); el PDF REG-SO-01 reutiliza esa firma.
        </p>
        <div className="flex flex-wrap gap-2">
          <a
            href={PRIVACY_PDF_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold px-4 py-2"
          >
            📄 Ver aviso de privacidad (PDF)
          </a>
          <a
            href={PRIVACY_PDF_URL}
            download="aviso-privacidad-salud-ocupacional-fy27.pdf"
            className="inline-flex items-center rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold px-4 py-2"
          >
            ⬇ Descargar
          </a>
        </div>
        {signedLabel ? (
          <p className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
            ✓ Consentimiento firmado en check-in
            {patientFullName ? ` — ${patientFullName}` : ''} · {signedLabel}
          </p>
        ) : (
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
            Pendiente: el paciente debe completar check-in con firma en recepción antes del PDF Sodexo.
          </p>
        )}
        <iframe
          title="Vista previa aviso de privacidad"
          src={PRIVACY_PDF_URL}
          className="w-full h-64 rounded-lg border border-slate-200 bg-slate-50"
        />
      </div>
    </section>
  )
}
