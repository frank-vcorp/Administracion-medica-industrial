'use client'

import { useEffect, useMemo, useState } from 'react'
import { getAttendedAppointmentsForMonth } from '@/actions/appointment.actions'
import { formatAppointmentAgendaDateString } from '@/lib/appointment-scheduling'

type AttendedRow = {
  id: string
  scheduledAt: Date | string
  branchId: string
  branch: { id: string; name: string } | null
}

type BranchRef = { id: string; name: string }

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

function buildMonthCells(year: number, month: number) {
  const first = new Date(year, month - 1, 1)
  const startOffset = (first.getDay() + 6) % 7
  const daysInMonth = new Date(year, month, 0).getDate()
  const slots: Array<{ day: number | null; key: string | null }> = []
  for (let i = 0; i < startOffset; i++) slots.push({ day: null, key: null })
  for (let day = 1; day <= daysInMonth; day++) {
    const key = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    slots.push({ day, key })
  }
  return slots
}

function BranchAttendedCalendar({
  branch,
  rows,
  cells,
  selectedDay,
  onSelectDay,
}: {
  branch: BranchRef
  rows: AttendedRow[]
  cells: Array<{ day: number | null; key: string | null }>
  selectedDay: string | null
  onSelectDay: (key: string) => void
}) {
  const byDay = useMemo(() => {
    const map = new Map<string, number>()
    for (const row of rows) {
      if (row.branchId !== branch.id && row.branch?.id !== branch.id) continue
      const key = formatAppointmentAgendaDateString(row.scheduledAt)
      map.set(key, (map.get(key) ?? 0) + 1)
    }
    return map
  }, [rows, branch.id])

  const branchTotal = rows.filter(
    (row) => row.branchId === branch.id || row.branch?.id === branch.id,
  ).length

  return (
    <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white">
      <div className="bg-violet-600 px-4 py-3 text-white flex items-center justify-between gap-2">
        <p className="font-black text-sm truncate">{branch.name}</p>
        <span className="text-xs font-bold bg-white/20 rounded-lg px-2 py-0.5 shrink-0">{branchTotal}</span>
      </div>
      <div className="p-3 space-y-2">
        <div className="grid grid-cols-7 gap-0.5 text-center text-[9px] font-black uppercase text-slate-400">
          {WEEKDAYS.map((day) => (
            <div key={day}>{day}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {cells.map((cell, index) => {
            if (!cell.day || !cell.key) return <div key={`empty-${index}`} className="h-10" />
            const count = byDay.get(cell.key) ?? 0
            const active = selectedDay === cell.key
            return (
              <button
                key={cell.key}
                type="button"
                onClick={() => onSelectDay(cell.key!)}
                className={`h-10 rounded-lg border text-left px-1 py-0.5 ${
                  active
                    ? 'border-emerald-500 bg-emerald-50'
                    : count > 0
                      ? 'border-emerald-200 bg-emerald-50/60'
                      : 'border-slate-100 bg-white'
                }`}
              >
                <span className="text-[10px] font-bold text-slate-700">{cell.day}</span>
                {count > 0 && (
                  <span className="block text-[9px] font-black text-emerald-700 leading-none">{count}</span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default function AttendedAppointmentsCalendar({
  open,
  onClose,
  branches,
}: {
  open: boolean
  onClose: () => void
  branches: BranchRef[]
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

  const cells = useMemo(
    () => buildMonthCells(cursor.year, cursor.month),
    [cursor.year, cursor.month],
  )

  const displayBranches = useMemo(() => {
    if (branches.length > 0) return branches
    const seen = new Map<string, string>()
    for (const row of rows) {
      const id = row.branch?.id ?? row.branchId
      const name = row.branch?.name ?? 'Sucursal'
      if (!seen.has(id)) seen.set(id, name)
    }
    return Array.from(seen.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'))
  }, [branches, rows])

  const countsForSelectedDay = useMemo(() => {
    if (!selectedDay) return []
    return displayBranches.map((branch) => {
      const count = rows.filter((row) => {
        if (row.branchId !== branch.id && row.branch?.id !== branch.id) return false
        return formatAppointmentAgendaDateString(row.scheduledAt) === selectedDay
      }).length
      return { branch, count }
    })
  }, [displayBranches, rows, selectedDay])

  if (!open) return null

  const monthLabel = new Date(cursor.year, cursor.month - 1, 1).toLocaleDateString('es-MX', {
    month: 'long',
    year: 'numeric',
  })

  const shiftMonth = (delta: number) => {
    setSelectedDay(null)
    setCursor((prev) => {
      const date = new Date(prev.year, prev.month - 1 + delta, 1)
      return { year: date.getFullYear(), month: date.getMonth() + 1 }
    })
  }

  const columnClass =
    displayBranches.length <= 1
      ? 'grid-cols-1'
      : displayBranches.length === 2
        ? 'grid-cols-1 md:grid-cols-2'
        : 'grid-cols-1 md:grid-cols-3'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-slate-50 w-full max-w-6xl rounded-3xl shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-slate-200 bg-white sticky top-0 z-10">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Citas atendidas</p>
            <h2 className="text-xl font-black text-slate-800 capitalize">{monthLabel}</h2>
            <p className="text-xs text-slate-500 mt-0.5">Conteo por sucursal — sin datos de pacientes</p>
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
          {!loading && displayBranches.length === 0 && (
            <p className="text-sm text-slate-500">No hay sucursales activas para mostrar.</p>
          )}
          <div className={`grid ${columnClass} gap-4`}>
            {displayBranches.map((branch) => (
              <BranchAttendedCalendar
                key={branch.id}
                branch={branch}
                rows={rows}
                cells={cells}
                selectedDay={selectedDay}
                onSelectDay={setSelectedDay}
              />
            ))}
          </div>
          {selectedDay && (
            <div className="border border-slate-200 rounded-2xl bg-white divide-y">
              <p className="px-4 py-2 text-xs font-bold text-slate-500">{selectedDay}</p>
              {countsForSelectedDay.every((row) => row.count === 0) ? (
                <p className="px-4 py-3 text-sm text-slate-400">Sin citas atendidas este día.</p>
              ) : (
                countsForSelectedDay.map(({ branch, count }) => (
                  <div key={branch.id} className="px-4 py-3 flex items-center justify-between gap-3">
                    <p className="text-sm font-bold text-slate-800">{branch.name}</p>
                    <p className="text-sm font-black text-emerald-700">
                      {count} cita{count !== 1 ? 's' : ''}
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
