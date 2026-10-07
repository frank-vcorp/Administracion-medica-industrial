'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { getPortalBranchWeekAvailability } from '@/actions/portal-appointment.actions'
import type { BranchDayAvailabilityStatus } from '@/lib/appointment-capacity'
import {
  addAgendaDays,
  AMI_APPOINTMENT_TIMEZONE,
  formatAppointmentAgendaDateString,
  getAgendaWeekStartMonday,
  parseAppointmentLocalDateTime,
  todayAgendaDateString,
} from '@/lib/appointment-scheduling'

type DayInfo = {
  date: string
  booked: number
  capacityTotal: number
  openHourSlots: number
  status: BranchDayAvailabilityStatus
}

type Props = {
  branchId: string
  branchName?: string
  selectedDate: string
  onSelectDate: (date: string) => void
  todayStr: string
}

const DAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

function formatWeekRangeLabel(weekStart: string): string {
  const weekEnd = addAgendaDays(weekStart, 6)
  const start = parseAppointmentLocalDateTime(weekStart, '12:00')
  const end = parseAppointmentLocalDateTime(weekEnd, '12:00')
  const startYear = formatAppointmentAgendaDateString(start).slice(0, 4)
  const endYear = formatAppointmentAgendaDateString(end).slice(0, 4)
  const startLabel = start.toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
    timeZone: AMI_APPOINTMENT_TIMEZONE,
  })
  const endLabel = end.toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
    year: startYear === endYear ? undefined : 'numeric',
    timeZone: AMI_APPOINTMENT_TIMEZONE,
  })
  return `${startLabel} – ${endLabel}`
}

function statusLabel(status: BranchDayAvailabilityStatus): string {
  switch (status) {
    case 'full':
      return 'Sin cupo'
    case 'partial':
      return 'Cupo parcial'
    case 'past':
      return 'Pasado'
    default:
      return 'Con cupo'
  }
}

function columnShell(
  status: BranchDayAvailabilityStatus,
  selected: boolean,
  isToday: boolean,
): string {
  if (selected) {
    return 'border-blue-400 bg-blue-50/70 ring-2 ring-blue-200'
  }
  if (isToday) {
    return 'border-violet-300 bg-violet-50/40'
  }
  switch (status) {
    case 'past':
      return 'border-slate-200 bg-slate-50/80 opacity-70'
    case 'full':
      return 'border-red-200 bg-red-50/50'
    case 'partial':
      return 'border-amber-200 bg-amber-50/40'
    default:
      return 'border-emerald-200 bg-emerald-50/30'
  }
}

export default function PortalAppointmentDateCalendar({
  branchId,
  branchName,
  selectedDate,
  onSelectDate,
  todayStr,
}: Props) {
  const [weekStart, setWeekStart] = useState(() => getAgendaWeekStartMonday(selectedDate || todayStr))
  const [days, setDays] = useState<DayInfo[]>([])
  const [loadedBranchName, setLoadedBranchName] = useState<string | undefined>(branchName)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addAgendaDays(weekStart, i)),
    [weekStart],
  )

  const loadWeek = useCallback(async () => {
    if (!branchId) return
    setLoading(true)
    setError(null)
    const res = await getPortalBranchWeekAvailability({ branchId, weekStart })
    setLoading(false)
    if (!res.success) {
      setDays([])
      setError(res.error ?? 'No se pudo cargar la disponibilidad')
      return
    }
    setWeekStart(res.weekStart)
    setDays(res.days)
    setLoadedBranchName(res.branchName)
  }, [branchId, weekStart])

  useEffect(() => {
    setWeekStart(getAgendaWeekStartMonday(selectedDate || todayStr))
  }, [selectedDate, todayStr])

  useEffect(() => {
    if (!branchId) return
    void loadWeek()
  }, [branchId, loadWeek])

  const dayMap = useMemo(() => new Map(days.map((d) => [d.date, d])), [days])

  const displayBranch = branchName ?? loadedBranchName

  return (
    <section className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-violet-600">
            Disponibilidad en sucursal
          </p>
          <h2 className="text-lg sm:text-xl font-black text-slate-800">Elija el día de su cita</h2>
          <p className="mt-1 text-sm text-slate-500">
            {displayBranch ? `${displayBranch} · ` : ''}
            Semana del {formatWeekRangeLabel(weekStart)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setWeekStart((s) => addAgendaDays(s, -7))}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100"
            aria-label="Semana anterior"
          >
            ←
          </button>
          <button
            type="button"
            onClick={() => setWeekStart(getAgendaWeekStartMonday(todayStr))}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100"
          >
            Hoy
          </button>
          <button
            type="button"
            onClick={() => setWeekStart((s) => addAgendaDays(s, 7))}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100"
            aria-label="Semana siguiente"
          >
            →
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center gap-3 py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-600 border-t-transparent" />
          <span className="text-sm font-medium text-slate-500">Cargando disponibilidad…</span>
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
        <div className="overflow-x-auto p-4 sm:p-5">
          <div className="grid min-w-[48rem] grid-cols-7 gap-2 sm:min-w-[56rem] sm:gap-3">
            {weekDays.map((dayStr, index) => {
              const info = dayMap.get(dayStr)
              const status = info?.status ?? (dayStr < todayStr ? 'past' : 'open')
              const dayNum = Number(dayStr.slice(8, 10))
              const isToday = dayStr === todayStr
              const selected = dayStr === selectedDate
              const selectable = status !== 'past' && status !== 'full'

              return (
                <button
                  key={dayStr}
                  type="button"
                  disabled={!selectable}
                  onClick={() => selectable && onSelectDate(dayStr)}
                  className={`flex min-h-[14rem] sm:min-h-[18rem] flex-col rounded-2xl border text-left transition hover:shadow-md disabled:cursor-not-allowed disabled:hover:shadow-none ${columnShell(status, selected, isToday)}`}
                >
                  <div className="border-b border-slate-100/80 px-3 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                      {DAY_LABELS[index]}
                    </p>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <span className="text-2xl font-black text-slate-800">{dayNum}</span>
                      {info && status !== 'past' && (
                        <span className="rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold text-slate-600 border border-slate-100">
                          {info.booked}/{info.capacityTotal}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-1 flex-col justify-center px-3 py-4 text-center">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      {statusLabel(status)}
                    </p>
                    {info && status !== 'past' && status !== 'full' && (
                      <p className="mt-2 text-sm font-medium text-slate-700">
                        {info.openHourSlots} horario{info.openHourSlots !== 1 ? 's' : ''} con cupo
                      </p>
                    )}
                    {status === 'full' && (
                      <p className="mt-2 text-xs text-red-700">Día completo en agenda</p>
                    )}
                    {selected && (
                      <p className="mt-3 text-[11px] font-bold text-blue-700">Día seleccionado</p>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className="border-t border-slate-100 bg-slate-50/80 px-4 py-3 sm:px-6 space-y-2">
        <div className="flex flex-wrap gap-4 text-[11px] text-slate-600">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded border border-emerald-300 bg-emerald-100" /> Con cupo
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded border border-amber-300 bg-amber-100" /> Parcial
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded border border-red-300 bg-red-100" /> Sin cupo
          </span>
        </div>
        <p className="text-[11px] text-slate-500">
          Los totales incluyen citas ya agendadas en esta sucursal. Después elija la hora en el
          formulario.
        </p>
      </div>
    </section>
  )
}
