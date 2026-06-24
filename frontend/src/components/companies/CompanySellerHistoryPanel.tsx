/**
 * @file Panel: Historial de vendedor (timeline).
 * @id IMPL-20260623-02
 *
 * Server component: hace fetch via service. Renderiza cronología
 * con vendedor anterior → nuevo, changedBy, fecha relativa.
 */
import { getCompanySellerHistory } from '@/services/company.service'

interface PanelProps {
  companyId: string
}

const dateFormatter = new Intl.DateTimeFormat('es-MX', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime()
  const now = Date.now()
  const diffSec = Math.floor((then - now) / 1000)
  const rtf = new Intl.RelativeTimeFormat('es-MX', { numeric: 'auto' })
  if (Math.abs(diffSec) < 60) return rtf.format(diffSec, 'second')
  const diffMin = Math.floor(diffSec / 60)
  if (Math.abs(diffMin) < 60) return rtf.format(diffMin, 'minute')
  const diffH = Math.floor(diffMin / 60)
  if (Math.abs(diffH) < 24) return rtf.format(diffH, 'hour')
  const diffD = Math.floor(diffH / 24)
  if (Math.abs(diffD) < 30) return rtf.format(diffD, 'day')
  const diffMo = Math.floor(diffD / 30)
  if (Math.abs(diffMo) < 12) return rtf.format(diffMo, 'month')
  const diffY = Math.floor(diffMo / 12)
  return rtf.format(diffY, 'year')
}

export default async function CompanySellerHistoryPanel({ companyId }: PanelProps) {
  const history = await getCompanySellerHistory(companyId)

  if (history.length === 0) {
    return (
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-3">
          Historial de vendedor
        </h2>
        <p className="text-sm text-slate-500">
          Aún no hay cambios de vendedor registrados para esta empresa.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
      <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-4">
        Historial de vendedor
      </h2>
      <ol className="relative border-l-2 border-slate-100 ml-3 space-y-5">
        {history.map((entry) => {
          const prev = entry.previousSeller?.fullName ?? 'Sin asignar'
          const next = entry.newSeller?.fullName ?? 'Sin asignar'
          return (
            <li key={entry.id} className="ml-6">
              <span
                className="absolute -left-[9px] flex h-4 w-4 items-center justify-center rounded-full bg-slate-200 ring-4 ring-white"
                aria-hidden
              />
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-sm font-bold text-slate-700">
                  {entry.newSellerId === null ? 'Vendedor removido' : 'Vendedor asignado'}
                </span>
                <time className="text-xs text-slate-500" dateTime={entry.changedAt.toISOString()}>
                  {dateFormatter.format(entry.changedAt)} · {formatRelative(entry.changedAt.toISOString())}
                </time>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-700">
                <span className="px-2 py-0.5 rounded bg-slate-100">{prev}</span>
                <span aria-hidden>→</span>
                <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">
                  {next}
                </span>
              </div>
              <div className="mt-1 text-xs text-slate-500">
                Por <span className="font-bold text-slate-700">{entry.changedBy?.fullName ?? '—'}</span>
                {entry.reason ? <span> · &ldquo;{entry.reason}&rdquo;</span> : null}
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
