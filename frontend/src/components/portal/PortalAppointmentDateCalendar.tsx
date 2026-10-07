'use client'

import { useEffect, useMemo, useState } from 'react'
import { getPortalBranchMonthAvailability } from '@/actions/portal-appointment.actions'
import type { BranchDayAvailabilityStatus } from '@/lib/appointment-capacity'

type DayInfo = {
  date: string
  booked: number
  capacityTotal: number
  openHourSlots: number
  status: BranchDayAvailabilityStatus
}

type Props = {
  branchId: string
  selectedDate: string
  onSelectDate: (date: string) => void
  todayStr: string
}

const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

function monthKeyFromDate(dateStr: string): string {
  return dateStr.slice(0, 7)
}

function addMonthsToMonthKey(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split('-').map(Number)
  let year = y
  let month = m + delta
  while (month < 1) {
    month += 12
    year -= 1
  }
  while (month > 12) {
    month -= 12
    year += 1
  }
  return `${year}-${String(month).padStart(2, '0')}`
}

function formatMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1, 15))
  return d.toLocaleDateString('es-MX', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

function cellClasses(status: BranchDayAvailabilityStatus, selected: boolean, inMonth: boolean): string {
  const base =
    'relative flex flex-col items-center justify-center min-h-[3.25rem] rounded-lg border text-sm transition-colors'
  if (!inMonth) return `${base} border-transparent text-slate-300`
  if (status === 'past') {
    return `${base} border-slate-100 bg-slate-50 text-slate-400 cursor-not-allowed`
  }
  if (selected) {
    return `${base} border-blue-600 bg-blue-600 text-white font-bold ring-2 ring-blue-200`
  }
  switch (status) {
    case 'full':
      return `${base} border-red-200 bg-red-50 text-red-800 hover:bg-red-100`
    case 'partial':
      return `${base} border-amber-200 bg-amber-50 text-amber-950 hover:bg-amber-100`
    default:
      return `${base} border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100`
  }
}

export default function PortalAppointmentDateCalendar({
  branchId,
  selectedDate,
  onSelectDate,
  todayStr,
}: Props) {
  const [visibleMonth, setVisibleMonth] = useState(() => monthKeyFromDate(selectedDate || todayStr))
  const [days, setDays] = useState<DayInfo[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!branchId) return
    setLoading(true)
    void getPortalBranchMonthAvailability({ branchId, month: visibleMonth }).then((res) => {
      if (res.success) setDays(res.days)
      else setDays([])
      setLoading(false)
    })
  }, [branchId, visibleMonth])

  useEffect(() => {
    setVisibleMonth(monthKeyFromDate(selectedDate))
  }, [selectedDate])

  const dayMap = useMemo(() => new Map(days.map((d) => [d.date, d])), [days])

  const shiftMonth = (delta: number) => {
    setVisibleMonth((prev) => addMonthsToMonthKey(prev, delta))
  }

  const gridDates = days.length === 42 ? days.map((d) => d.date) : []

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => shiftMonth(-1)}
          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm text-slate-700 hover:bg-slate-50"
          aria-label="Mes anterior"
        >
          ‹
        </button>
        <p className="text-sm font-bold text-slate-800 capitalize">{formatMonthLabel(visibleMonth)}</p>
        <button
          type="button"
          onClick={() => shiftMonth(1)}
          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm text-slate-700 hover:bg-slate-50"
          aria-label="Mes siguiente"
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold uppercase text-slate-500">
        {WEEKDAY_LABELS.map((l) => (
          <span key={l}>{l}</span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {gridDates.map((dateStr) => {
          const info = dayMap.get(dateStr)
          const inMonth = dateStr.startsWith(visibleMonth)
          const dayNum = Number(dateStr.slice(8, 10))
          const status = info?.status ?? (dateStr < todayStr ? 'past' : 'open')
          const selected = dateStr === selectedDate
          const selectable = inMonth && status !== 'past' && status !== 'full'

          return (
            <button
              key={dateStr}
              type="button"
              disabled={!selectable}
              title={
                info && inMonth && status !== 'past'
                  ? `${info.booked} citas agendadas · ${info.openHourSlots} horarios con cupo`
                  : undefined
              }
              onClick={() => selectable && onSelectDate(dateStr)}
              className={cellClasses(status, selected, inMonth)}
            >
              <span>{dayNum}</span>
              {inMonth && status !== 'past' && info && (
                <span
                  className={`text-[9px] leading-tight mt-0.5 ${selected ? 'text-blue-100' : 'opacity-80'}`}
                >
                  {status === 'full' ? 'Lleno' : `${info.booked}/${info.capacityTotal}`}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {loading && <p className="text-xs text-slate-500 text-center">Actualizando disponibilidad…</p>}

      <div className="flex flex-wrap gap-3 text-[10px] text-slate-600 pt-1">
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded bg-emerald-200 border border-emerald-300" /> Cupo
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded bg-amber-200 border border-amber-300" /> Parcial
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded bg-red-200 border border-red-300" /> Sin cupo
        </span>
      </div>
      <p className="text-[11px] text-slate-500">
        Los números incluyen citas ya agendadas en sucursal (confirmadas y en agenda). Elija un día
        con cupo y después la hora.
      </p>
    </div>
  )
}
