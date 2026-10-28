'use client'

import { useEffect, useMemo, useState } from 'react'
import { getAttendedAppointmentsForMonth } from '@/actions/appointment.actions'
import { formatAppointmentAgendaDateString, formatAppointmentAgendaTime } from '@/lib/appointment-scheduling'

type AttendedRow = {
  id: string
  scheduledAt: Date | string
  expedientId: string | null
  worker: { firstName: string; lastName: string }
  company: { name: string } | null
  branch: { name: string } | null
}

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

export default function AttendedAppointmentsCalendar({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const today = new Date()
  const [cursor, setCursor] = useState({ year: today.getFullYear(), month: today.getMonth() + 1 })
  const [rows, setRows] = useState<AttendedRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const fetchKey = `${cursor.year}-${cursor.month}`
  const [loadState, setLoadState] = useState<{ key: string; phase: 'idle' | 'loading' | 'ready' }>({
    key: '',
    phase: 'idle',
  })

  if (open && loadState.key !== fetchKey) {
    setRows([])
    setError(null)
    setLoadState({ key: fetchKey, phase: 'loading' })
  } else if (!open && loadState.phase !== 'idle') {
    setLoadState({ key: '', phase: 'idle' })
  }

  useEffect(() => {
    if (!open || loadState.phase !== 'loading') return
    let cancelled = false
    const [yearText, monthText] = loadState.key.split('-')
    const year = Number(yearText)
    const month = Number(monthText)
    void getAttendedAppointmentsForMonth(year, month).then((res) => {
      if (cancelled) return
      if (!res.success) {
        setError(res.error || 'No se pudieron cargar las citas atendidas')
        setRows([])
      } else {
        setError(null)
        setRows(res.appointments as AttendedRow[])
      }
      setLoadState((prev) =>
        prev.key === `${year}-${month}` ? { key: prev.key, phase: 'ready' } : prev,
      )
    })
    return () => {
      cancelled = true
    }
  }, [open, loadState.phase, loadState.key])

  const loading = open && loadState.phase === 'loading'

  const byDay = useMemo(() => {
    const map = new Map<string, AttendedRow[]>()
    for (const row of rows) {
      const key = formatAppointmentAgendaDateString(row.scheduledAt)
      const list = map.get(key) ?? []
      list.push(row)
      map.set(key, list)
    }
    return map
  }, [rows])

  const cells = useMemo(() => {
    const first = new Date(cursor.year, cursor.month - 1, 1)
    const startOffset = (first.getDay() + 6) % 7
    const daysInMonth = new Date(cursor.year, cursor.month, 0).getDate()
    const slots: Array<{ day: number | null; key: string | null }> = []
    for (let i = 0; i < startOffset; i++) slots.push({ day: null, key: null })
    for (let day = 1; day <= daysInMonth; day++) {
      const key = `${cursor.year}-${String(cursor.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      slots.push({ day, key })
    }
    return slots
  }, [cursor])

  if (!open) return null

  const monthLabel = new Date(cursor.year, cursor.month - 1, 1).toLocaleDateString('es-MX', {
    month: 'long',
    year: 'numeric',
  })
  const selectedRows = selectedDay ? byDay.get(selectedDay) ?? [] : []

  const shiftMonth = (delta: number) => {
    setSelectedDay(null)
    setCursor((prev) => {
      const date = new Date(prev.year, prev.month - 1 + delta, 1)
      return { year: date.getFullYear(), month: date.getMonth() + 1 }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-slate-100">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Citas atendidas</p>
            <h2 className="text-xl font-black text-slate-800 capitalize">{monthLabel}</h2>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => shiftMonth(-1)} className="px-3 py-1 rounded-lg bg-slate-100 font-bold">←</button>
            <button type="button" onClick={() => shiftMonth(1)} className="px-3 py-1 rounded-lg bg-slate-100 font-bold">→</button>
            <button type="button" onClick={onClose} className="px-3 py-1 rounded-lg text-slate-500 font-bold">Cerrar</button>
          </div>
        </div>
        <div className="p-6 space-y-4">
          {loading && <p className="text-sm text-slate-500">Cargando calendario…</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-black uppercase text-slate-400">
            {WEEKDAYS.map((day) => (
              <div key={day}>{day}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((cell, index) => {
              if (!cell.day || !cell.key) return <div key={`empty-${index}`} className="h-14" />
              const count = byDay.get(cell.key)?.length ?? 0
              const active = selectedDay === cell.key
              return (
                <button
                  key={cell.key}
                  type="button"
                  onClick={() => setSelectedDay(cell.key)}
                  className={`h-14 rounded-xl border text-left px-2 py-1 ${
                    active
                      ? 'border-emerald-500 bg-emerald-50'
                      : count > 0
                        ? 'border-emerald-200 bg-emerald-50/60'
                        : 'border-slate-100 bg-white'
                  }`}
                >
                  <span className="text-xs font-bold text-slate-700">{cell.day}</span>
                  {count > 0 && (
                    <span className="block text-[10px] font-black text-emerald-700">{count}</span>
                  )}
                </button>
              )
            })}
          </div>
          {selectedDay && (
            <div className="border border-slate-200 rounded-2xl divide-y">
              <p className="px-4 py-2 text-xs font-bold text-slate-500">{selectedDay}</p>
              {selectedRows.length === 0 ? (
                <p className="px-4 py-3 text-sm text-slate-400">Sin citas atendidas este día.</p>
              ) : (
                selectedRows.map((row) => (
                  <div key={row.id} className="px-4 py-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-slate-800">
                        {row.worker.firstName} {row.worker.lastName}
                      </p>
                      <p className="text-xs text-slate-500">
                        {row.branch?.name || '—'} · {row.company?.name || '—'}
                        {row.expedientId ? ` · ${row.expedientId}` : ''}
                      </p>
                    </div>
                    <p className="text-xs font-mono font-bold text-slate-600">
                      {formatAppointmentAgendaTime(row.scheduledAt)}
                    </p>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
