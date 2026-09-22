import Link from 'next/link'
import {
  BUSINESS_STATUS_LABELS,
  formatStudyStatusLine,
  toBusinessStudyStatus,
  type EventTestPipelineStatus,
} from '@/lib/clinical/study-status-display'

export type ReceptionKanbanTest = {
  id: string
  testNameSnapshot: string
  status: string
}

type Props = {
  eventId: string
  tests: ReceptionKanbanTest[]
  /** En checkout la lista es más compacta */
  variant?: 'default' | 'checkout'
}

export default function ReceptionEventTestsList({
  eventId,
  tests,
  variant = 'default',
}: Props) {
  const papeletaHref = `/events/${eventId}?view=IN_PROGRESS`

  if (tests.length === 0) {
    return (
      <p className="text-[10px] italic text-slate-400">
        Sin estudios en la papeleta
      </p>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
          Estudios ({tests.length})
        </span>
        <Link
          href={papeletaHref}
          prefetch
          className="text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-800"
        >
          Ver papeleta →
        </Link>
      </div>
      <ul className={`space-y-1.5 ${variant === 'checkout' ? '' : ''}`}>
        {tests.map(test => {
          const pipeline = test.status as EventTestPipelineStatus
          const business = BUSINESS_STATUS_LABELS[toBusinessStudyStatus(pipeline)]
          const line = formatStudyStatusLine(pipeline)
          const badgeTone =
            business === 'Realizado'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-100'
              : business === 'No realizado'
                ? 'bg-slate-50 text-slate-600 border-slate-100'
                : 'bg-amber-50 text-amber-800 border-amber-100'

          return (
            <li key={test.id}>
              <Link
                href={papeletaHref}
                prefetch
                className={`flex items-start justify-between gap-2 rounded-xl border px-2.5 py-2 transition hover:shadow-sm ${
                  variant === 'checkout'
                    ? 'border-amber-100 bg-amber-50/40 hover:border-amber-200'
                    : 'border-slate-100 bg-slate-50/80 hover:border-indigo-200 hover:bg-indigo-50/40'
                }`}
                title={`Abrir papeleta — ${test.testNameSnapshot}`}
              >
                <span className="min-w-0">
                  <span className="block truncate text-[11px] font-semibold text-slate-800">
                    {test.testNameSnapshot}
                  </span>
                  <span className="mt-0.5 block text-[10px] leading-tight text-slate-600">
                    {line}
                  </span>
                </span>
                <span
                  className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${badgeTone}`}
                >
                  {business}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
