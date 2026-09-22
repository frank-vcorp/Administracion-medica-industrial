'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { filterEventTestsForCheckout } from '@/lib/clinical/examen-medico-capture'
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
  /** `compact`: resumen + chips; detalle bajo «Ver estudios». `default`: lista completa. */
  variant?: 'default' | 'compact'
}

function shortStudyLabel(name: string): string {
  const n = name.trim()
  if (n.length <= 10) return n
  const first = n.split(/\s+/)[0] ?? n
  if (first.length <= 12) return first
  return `${first.slice(0, 10)}…`
}

export default function ReceptionEventTestsList({
  eventId,
  tests,
  variant = 'default',
}: Props) {
  const papeletaHref = `/events/${eventId}?view=IN_PROGRESS`
  const [detailOpen, setDetailOpen] = useState(false)

  const visibleTests = useMemo(
    () =>
      filterEventTestsForCheckout(
        tests.map(t => ({
          id: t.id,
          status: t.status,
          testNameSnapshot: t.testNameSnapshot,
        })),
      ).map(idTest => tests.find(t => t.id === idTest.id)!),
    [tests],
  )

  const stats = useMemo(() => {
    let realizados = 0
    let pendientes = 0
    let noRealizados = 0
    for (const test of visibleTests) {
      const b = toBusinessStudyStatus(test.status as EventTestPipelineStatus)
      if (b === 'REALIZADO') realizados += 1
      else if (b === 'NO_REALIZADO') noRealizados += 1
      else pendientes += 1
    }
    return { realizados, pendientes, noRealizados, total: visibleTests.length }
  }, [visibleTests])

  if (visibleTests.length === 0) {
    return (
      <p className="text-[10px] italic text-slate-400">
        Sin estudios en la papeleta
      </p>
    )
  }

  if (variant === 'compact') {
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
          <p className="text-[10px] font-medium text-slate-600">
            <span className="font-bold text-slate-800">{stats.total}</span> estudios
            {stats.realizados > 0 && (
              <>
                {' · '}
                <span className="text-emerald-700">{stats.realizados} realizados</span>
              </>
            )}
            {stats.pendientes > 0 && (
              <>
                {' · '}
                <span className="text-amber-700">{stats.pendientes} pend.</span>
              </>
            )}
          </p>
          <Link
            href={papeletaHref}
            prefetch
            className="shrink-0 text-[9px] font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-800"
          >
            Papeleta →
          </Link>
        </div>
        <div className="flex flex-wrap gap-1">
          {visibleTests.map(test => {
            const pipeline = test.status as EventTestPipelineStatus
            const business = toBusinessStudyStatus(pipeline)
            const chipTone =
              business === 'REALIZADO'
                ? 'bg-emerald-100 text-emerald-900 border-emerald-200'
                : business === 'NO_REALIZADO'
                  ? 'bg-slate-100 text-slate-600 border-slate-200'
                  : 'bg-amber-100 text-amber-900 border-amber-200'
            return (
              <Link
                key={test.id}
                href={papeletaHref}
                prefetch
                title={`${test.testNameSnapshot} — ${formatStudyStatusLine(pipeline)}`}
                className={`max-w-[8.5rem] truncate rounded-md border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-tight ${chipTone}`}
              >
                {shortStudyLabel(test.testNameSnapshot)}
              </Link>
            )
          })}
        </div>
        <button
          type="button"
          onClick={() => setDetailOpen(v => !v)}
          className="text-[9px] font-bold uppercase tracking-wider text-slate-400 hover:text-slate-600"
          aria-expanded={detailOpen}
        >
          {detailOpen ? '▲ Ocultar estudios' : '▼ Ver estudios'}
        </button>
        {detailOpen && (
          <ul className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-slate-100 bg-slate-50/80 p-1.5">
            {visibleTests.map(test => {
              const pipeline = test.status as EventTestPipelineStatus
              const business = BUSINESS_STATUS_LABELS[toBusinessStudyStatus(pipeline)]
              const line = formatStudyStatusLine(pipeline)
              return (
                <li key={test.id} className="flex items-start justify-between gap-2 px-1 py-0.5">
                  <span className="min-w-0 text-[10px] font-semibold text-slate-800">
                    {test.testNameSnapshot}
                  </span>
                  <span className="shrink-0 text-[9px] text-slate-500">{business}</span>
                  <span className="sr-only">{line}</span>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
          Estudios ({visibleTests.length})
        </span>
        <Link
          href={papeletaHref}
          prefetch
          className="text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-800"
        >
          Ver papeleta →
        </Link>
      </div>
      <ul className="space-y-1.5">
        {visibleTests.map(test => {
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
                className="flex items-start justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/80 px-2.5 py-2 transition hover:border-indigo-200 hover:bg-indigo-50/40 hover:shadow-sm"
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
