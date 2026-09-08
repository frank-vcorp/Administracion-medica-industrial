'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { getAppointmentsForWeek } from '@/actions/appointment.actions'

const AGENDA_SLOT_STATUSES = new Set(['SCHEDULED', 'CONFIRMED'])

type WeekAppointment = {
  id: string
  scheduledAt: Date | string
  status: string
  expedientId: string | null
  worker: { firstName: string; lastName: string }
  company: { name: string } | null
}

function formatLocalDateString(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function addDaysToDateString(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  date.setDate(date.getDate() + days)
  return formatLocalDateString(date)
}

/** Lunes de la semana que contiene `dateStr`. */
function getWeekStartMonday(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  const weekday = date.getDay()
  const diff = weekday === 0 ? -6 : 1 - weekday
  date.setDate(date.getDate() + diff)
  return formatLocalDateString(date)
}

function appointmentLocalDateString(scheduledAt: Date | string): string {
  return formatLocalDateString(new Date(scheduledAt))
}

function formatWeekRangeLabel(weekStart: string): string {
  const weekEnd = addDaysToDateString(weekStart, 6)
  const [sy, sm, sd] = weekStart.split('-').map(Number)
  const [ey, em, ed] = weekEnd.split('-').map(Number)
  const start = new Date(sy, sm - 1, sd)
  const end = new Date(ey, em - 1, ed)
  const startLabel = start.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
  const endLabel = end.toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
    year: start.getFullYear() === end.getFullYear() ? undefined : 'numeric',
  })
  return `${startLabel} – ${endLabel}`
}

const DAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

export function WeeklyAppointmentsModal({
  open,
  onClose,
  anchorDate,
  branchId,
  branchName,
  onSelectDate,
}: {
  open: boolean
  onClose: () => void
  anchorDate: string
  branchId: string
  branchName?: string
  onSelectDate?: (date: string) => void
}) {
  const [weekStart, setWeekStart] = useState(() => getWeekStartMonday(anchorDate))
  const [appointments, setAppointments] = useState<WeekAppointment[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDaysToDateString(weekStart, i)),
    [weekStart],
  )

  const loadWeek = useCallback(async () => {
    if (!branchId) return
    setLoading(true)
    setError(null)
    const res = await getAppointmentsForWeek(weekStart, branchId)
    setLoading(false)
    if (!res.success) {
      setAppointments([])
      setError(res.error ?? 'No se pudo cargar la semana')
      return
    }
    setAppointments((res.appointments ?? []) as WeekAppointment[])
  }, [weekStart, branchId])

  useEffect(() => {
    if (!open) return
    setWeekStart(getWeekStartMonday(anchorDate))
  }, [open, anchorDate])

  useEffect(() => {
    if (!open || !branchId) return
    void loadWeek()
  }, [open, branchId, loadWeek])

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

  const byDay = useMemo(() => {
    const map: Record<string, WeekAppointment[]> = Object.fromEntries(
      weekDays.map((d) => [d, []]),
    )
    for (const apt of appointments) {
      if (!AGENDA_SLOT_STATUSES.has(apt.status)) continue
      const day = appointmentLocalDateString(apt.scheduledAt)
      if (map[day]) map[day].push(apt)
    }
    return map
  }, [appointments, weekDays])

  if (!open) return null

  const todayStr = formatLocalDateString(new Date())

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        aria-label="Cerrar vista semanal"
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-[1px]"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Calendario semanal de citas"
        className="relative flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-t-3xl border border-slate-200 bg-white shadow-2xl sm:rounded-3xl"
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 bg-slate-50 px-5 py-4 sm:px-6">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-violet-600">
              Vista semanal
            </p>
            <h2 className="text-xl font-black text-slate-800">Calendario de citas</h2>
            <p className="mt-1 text-sm text-slate-500">
              {branchName ? `${branchName} · ` : ''}
              Semana del {formatWeekRangeLabel(weekStart)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setWeekStart((s) => addDaysToDateString(s, -7))}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100"
              aria-label="Semana anterior"
            >
              ←
            </button>
            <button
              type="button"
              onClick={() => setWeekStart(getWeekStartMonday(formatLocalDateString(new Date())))}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100"
            >
              Hoy
            </button>
            <button
              type="button"
              onClick={() => setWeekStart((s) => addDaysToDateString(s, 7))}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100"
              aria-label="Semana siguiente"
            >
              →
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-2 text-slate-500 hover:bg-slate-200 hover:text-slate-700"
              aria-label="Cerrar"
            >
              ✕
            </button>
          </div>
        </div>

        {loading && (
          <div className="flex flex-1 items-center justify-center gap-3 py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-600 border-t-transparent" />
            <span className="text-sm font-medium text-slate-500">Cargando semana…</span>
          </div>
        )}

        {!loading && error && (
          <div className="p-6 text-center">
            <p className="text-sm font-medium text-red-600">{error}</p>
            <button
              type="button"
              onClick={() => void loadWeek()}
              className="mt-3 text-sm font-bold text-violet-600 underline"
            >
              Reintentar
            </button>
          </div>
        )}

        {!loading && !error && (
          <div className="min-h-0 flex-1 overflow-auto p-4 sm:p-5">
            <div className="grid min-w-[56rem] grid-cols-7 gap-2 sm:gap-3">
              {weekDays.map((dayStr, index) => {
                const dayAppointments = byDay[dayStr] ?? []
                const [, , dayNum] = dayStr.split('-').map(Number)
                const isToday = dayStr === todayStr
                const isAnchor = dayStr === anchorDate

                return (
                  <div
                    key={dayStr}
                    className={`flex min-h-[18rem] flex-col rounded-2xl border ${
                      isToday
                        ? 'border-violet-300 bg-violet-50/50'
                        : isAnchor
                          ? 'border-blue-200 bg-blue-50/40'
                          : 'border-slate-200 bg-white'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        onSelectDate?.(dayStr)
                        onClose()
                      }}
                      className="border-b border-slate-100 px-3 py-3 text-left transition hover:bg-white/80"
                    >
                      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                        {DAY_LABELS[index]}
                      </p>
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <span className="text-2xl font-black text-slate-800">{dayNum}</span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                          {dayAppointments.length}
                        </span>
                      </div>
                    </button>

                    <div className="flex-1 space-y-2 overflow-y-auto p-2">
                      {dayAppointments.length === 0 ? (
                        <p className="px-1 py-4 text-center text-xs italic text-slate-400">
                          Sin citas
                        </p>
                      ) : (
                        dayAppointments.map((apt) => {
                          const time = new Date(apt.scheduledAt).toLocaleTimeString('es-MX', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                          return (
                            <button
                              key={apt.id}
                              type="button"
                              onClick={() => {
                                onSelectDate?.(dayStr)
                                onClose()
                              }}
                              className="w-full rounded-xl border border-slate-100 bg-white p-2 text-left shadow-sm transition hover:border-violet-200 hover:bg-violet-50/50"
                            >
                              <p className="text-[10px] font-bold text-violet-700">{time}</p>
                              <p className="truncate text-xs font-bold text-slate-800">
                                {apt.worker.firstName} {apt.worker.lastName}
                              </p>
                              {apt.company?.name && (
                                <p className="truncate text-[10px] text-slate-500">
                                  {apt.company.name}
                                </p>
                              )}
                            </button>
                          )
                        })
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
            <p className="mt-4 text-center text-[11px] text-slate-400">
              Clic en un día o cita para ver la agenda detallada · Esc para cerrar
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
