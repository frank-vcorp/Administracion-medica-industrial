'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { PendingStudyPatientRow } from '@/actions/appointment.actions'
import { formatStudyStatusLine, type EventTestPipelineStatus } from '@/lib/clinical/study-status-display'

export function PendingStudiesModal({
  open,
  onClose,
  rows,
  dateLabel,
}: {
  open: boolean
  onClose: () => void
  rows: PendingStudyPatientRow[]
  dateLabel: string
}) {
  const router = useRouter()

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, onClose])

  if (!open) return null

  const totalTests = rows.reduce((sum, row) => sum + row.pendingTests.length, 0)

  const goToStudy = (eventId: string) => {
    onClose()
    router.push(`/events/${eventId}?view=IN_PROGRESS`)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        aria-label="Cerrar listado de pendientes"
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-[1px]"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Pacientes con pruebas pendientes"
        className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border border-slate-200 bg-white shadow-2xl sm:rounded-3xl"
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-amber-100 bg-amber-50 px-5 py-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-amber-700">
              Pruebas pendientes
            </p>
            <h2 className="text-xl font-black text-slate-800">
              Pacientes con pruebas pendientes
            </h2>
            <p className="mt-1 text-sm text-slate-600 capitalize">
              {dateLabel} · {rows.length} pacientes · {totalTests} pruebas
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-500 hover:bg-amber-100 hover:text-slate-700"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
          {rows.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-4xl">✅</p>
              <p className="mt-3 text-sm font-semibold text-slate-700">
                No hay pruebas pendientes para este día
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Solo pacientes con check-in y estudios en curso
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {rows.map((row) => (
                <li
                  key={row.eventId}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-bold text-slate-800">{row.patientName}</p>
                      {row.companyName && (
                        <p className="truncate text-xs text-slate-500">{row.companyName}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => goToStudy(row.eventId)}
                      className="shrink-0 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-teal-700"
                    >
                      Ver expediente
                    </button>
                  </div>

                  <ul className="mt-3 space-y-2">
                    {row.pendingTests.map((test) => (
                      <li key={test.id}>
                        <button
                          type="button"
                          onClick={() => goToStudy(row.eventId)}
                          className="flex w-full items-center justify-between gap-3 rounded-xl border border-amber-100 bg-amber-50/60 px-3 py-2.5 text-left transition hover:border-amber-200 hover:bg-amber-50"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold text-slate-800">
                              {test.name}
                            </span>
                            <span className="block text-[10px] text-amber-800">
                              {formatStudyStatusLine(test.status as EventTestPipelineStatus)}
                            </span>
                          </span>
                          <span className="shrink-0 text-xs font-bold text-teal-700">Ir →</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="border-t border-slate-100 px-5 py-3 text-center text-[11px] text-slate-400">
          Clic en una prueba o expediente para abrir estudios · Esc para cerrar
        </p>
      </div>
    </div>
  )
}
