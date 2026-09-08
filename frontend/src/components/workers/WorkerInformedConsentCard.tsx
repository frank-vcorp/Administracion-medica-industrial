'use client'

import { backendFileUrl } from '@/lib/backend-file-url'

export interface InformedConsentHistoryItem {
  appointmentId: string
  expedientId: string | null
  pdfUrl: string
  signedAt: string
  scheduledAt: string
  branchName: string | null
}

interface Props {
  firstName: string
  lastName: string
  consents: InformedConsentHistoryItem[]
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleDateString('es-MX', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function WorkerInformedConsentCard({
  firstName,
  lastName,
  consents,
}: Props) {
  const fullName = `${firstName} ${lastName}`
  const hasConsents = consents.length > 0

  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-slate-900">Consentimiento informado</h3>
        {hasConsents && (
          <span className="text-[10px] bg-violet-50 text-violet-700 border border-violet-200 px-2 py-1 rounded-full font-bold uppercase tracking-widest">
            {consents.length} {consents.length === 1 ? 'firma' : 'firmas'}
          </span>
        )}
      </div>

      {hasConsents ? (
        <div className="space-y-3">
          <p className="text-xs text-slate-500">
            Historial de consentimientos de {fullName}, uno por cada check-in.
          </p>
          <ul className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {consents.map((item, index) => (
              <li
                key={item.appointmentId}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900 truncate">
                    {index === 0 ? 'Más reciente · ' : ''}
                    {formatDateTime(item.signedAt)}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                    {item.branchName ? `${item.branchName} · ` : ''}
                    Cita {formatDateTime(item.scheduledAt)}
                    {item.expedientId ? ` · Exp. ${item.expedientId}` : ''}
                  </p>
                </div>
                <a
                  href={backendFileUrl(item.pdfUrl)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-shrink-0 px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold rounded-lg transition-colors"
                >
                  PDF
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
          <p className="text-2xl mb-2">📄</p>
          <p className="text-sm font-semibold text-slate-600">
            Sin consentimientos firmados
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Se captura y firma en el check-in de recepción.
          </p>
        </div>
      )}
    </div>
  )
}
