import { isEventTestDeliverableReady } from '@/lib/portal-event-access'

type EventTestRow = {
  id: string
  testNameSnapshot: string
  status: string
  fileUrl: string | null
}

type Props = {
  eventId: string
  eventTests: EventTestRow[]
  hasVerdict: boolean
  dictamenReady: boolean
}

function shortStudyLabel(name: string): string {
  const n = name.trim()
  if (n.length <= 14) return n
  return `${n.slice(0, 12)}…`
}

export default function PortalEventDownloads({
  eventId,
  eventTests,
  hasVerdict,
  dictamenReady,
}: Props) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5 max-w-md ml-auto">
      {eventTests.map((test) => {
        const ready = isEventTestDeliverableReady(test.status)
        const href = `/api/portal/deliverables/event-test/${test.id}`
        if (ready) {
          return (
            <a
              key={test.id}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              title={`Descargar: ${test.testNameSnapshot}`}
              className="inline-flex h-8 min-w-[2rem] items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 px-2 text-[10px] font-bold text-emerald-800 hover:bg-emerald-100"
            >
              📥 {shortStudyLabel(test.testNameSnapshot)}
            </a>
          )
        }
        return (
          <span
            key={test.id}
            title={`${test.testNameSnapshot} — pendiente`}
            className="inline-flex h-8 min-w-[2rem] items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 px-2 text-[10px] font-medium text-slate-400"
          >
            ○ {shortStudyLabel(test.testNameSnapshot)}
          </span>
        )
      })}
      {hasVerdict ? (
        dictamenReady ? (
          <a
            href={`/api/pdf/${eventId}`}
            target="_blank"
            rel="noopener noreferrer"
            title="Dictamen de aptitud"
            className="inline-flex h-8 items-center justify-center rounded-lg border border-violet-300 bg-violet-50 px-2 text-[10px] font-bold text-violet-900 hover:bg-violet-100"
          >
            📄 Dictamen
          </a>
        ) : (
          <span
            title="Dictamen pendiente de firma"
            className="inline-flex h-8 items-center justify-center rounded-lg border border-dashed border-amber-200 bg-amber-50 px-2 text-[10px] font-medium text-amber-800"
          >
            📄 Dictamen…
          </span>
        )
      ) : null}
      {eventTests.length === 0 && !hasVerdict && (
        <span className="text-xs text-slate-400 italic">Sin entregables</span>
      )}
    </div>
  )
}
