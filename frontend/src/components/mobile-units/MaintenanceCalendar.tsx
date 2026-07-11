/**
 * @file Componente cliente de calendario de mantenimiento mensual.
 * @id IMPL-20260711-01 — SPEC §5.5
 *
 * Vista mes con eventos coloreados por tipo de mantenimiento, lista alternativa,
 * modal de programar (crear), modal de reprogramar (cuando hay conflicto) y
 * modal de completar. Llama a las server actions de mantenimiento.
 */
'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  createMaintenanceRecord,
  reprogramMaintenance,
  completeMaintenance,
  getMaintenanceRecords,
} from '@/actions/maintenance.actions'
import { validateUnitAvailability } from '@/actions/project.actions'

const TYPE_LABEL: Record<string, string> = {
  PREVENTIVO: 'Preventivo',
  CORRECTIVO: 'Correctivo',
  VERIFICACION: 'Verificación',
  LIMPIEZA: 'Limpieza',
}

const TYPE_COLOR: Record<string, string> = {
  PREVENTIVO: 'bg-emerald-100 border-emerald-400 text-emerald-900',
  CORRECTIVO: 'bg-red-100 border-red-400 text-red-900',
  VERIFICACION: 'bg-blue-100 border-blue-400 text-blue-900',
  LIMPIEZA: 'bg-violet-100 border-violet-400 text-violet-900',
}

const TYPE_OPTIONS = [
  { value: 'PREVENTIVO', label: 'Preventivo' },
  { value: 'CORRECTIVO', label: 'Correctivo' },
  { value: 'VERIFICACION', label: 'Verificación' },
  { value: 'LIMPIEZA', label: 'Limpieza' },
]

type Maintenance = Awaited<ReturnType<typeof getMaintenanceRecords>>[number]

export default function MaintenanceCalendar({
  unitId,
  initialRecords,
}: {
  unitId: string
  initialRecords: Maintenance[]
}) {
  const router = useRouter()
  const [records, setRecords] = useState<Maintenance[]>(initialRecords)
  const [month, setMonth] = useState<Date>(() => new Date())
  const [view, setView] = useState<'calendar' | 'list'>('calendar')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const monthStart = useMemo(() => {
    const d = new Date(month)
    d.setDate(1)
    d.setHours(0, 0, 0, 0)
    return d
  }, [month])

  const monthEnd = useMemo(() => {
    const d = new Date(monthStart)
    d.setMonth(d.getMonth() + 1)
    return d
  }, [monthStart])

  const recordsInMonth = useMemo(() => {
    return records.filter((r) => {
      const d = new Date(r.scheduledDate)
      return d >= monthStart && d < monthEnd
    })
  }, [records, monthStart, monthEnd])

  // Build grid: 6 weeks x 7 days starting on Sunday
  const grid = useMemo(() => {
    const firstDayOfWeek = new Date(monthStart)
    firstDayOfWeek.setDate(firstDayOfWeek.getDate() - firstDayOfWeek.getDay()) // back to Sunday
    const cells: Date[] = []
    for (let i = 0; i < 42; i++) {
      const d = new Date(firstDayOfWeek)
      d.setDate(firstDayOfWeek.getDate() + i)
      cells.push(d)
    }
    return cells
  }, [monthStart])

  const byDay = useMemo(() => {
    const map = new Map<string, Maintenance[]>()
    for (const r of recordsInMonth) {
      const day = new Date(r.scheduledDate).toDateString()
      const arr = map.get(day) ?? []
      arr.push(r)
      map.set(day, arr)
    }
    return map
  }, [recordsInMonth])

  // ─── Modal de crear ────────────────────────────────────────────────────────
  const [showCreate, setShowCreate] = useState(false)
  const [createDate, setCreateDate] = useState<string>('')
  const [createType, setCreateType] = useState<string>('PREVENTIVO')
  const [createDescription, setCreateDescription] = useState<string>('')
  const [createTechnician, setCreateTechnician] = useState<string>('')
  const [createSuggestions, setCreateSuggestions] = useState<Array<{ iso: string; label: string }>>([])

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const res = await createMaintenanceRecord({
      mobileUnitId: unitId,
      type: createType as 'PREVENTIVO' | 'CORRECTIVO' | 'VERIFICACION' | 'LIMPIEZA',
      scheduledDate: new Date(createDate).toISOString(),
      description: createDescription,
      technician: createTechnician || undefined,
    })
    if (!res.success) {
      setError(res.error ?? 'Error al crear')
      return
    }
    setRecords((prev) => [res.record as Maintenance, ...prev])
    setShowCreate(false)
    setCreateDescription(''); setCreateTechnician(''); setCreateSuggestions([])
    router.refresh()
  }

  const onCheckAvailability = async () => {
    if (!createDate) return
    const start = new Date(createDate)
    const end = new Date(createDate)
    end.setHours(23, 59, 59, 999)
    const result = await validateUnitAvailability(unitId, start.toISOString(), end.toISOString())
    setCreateSuggestions(result.suggestions)
    if (!result.available) {
      setError(`Conflicto en esta fecha (${result.conflicts.length} asignaciones). Usa las sugerencias.`)
    } else {
      setError(null)
    }
  }

  // ─── Modal de reprogramar ──────────────────────────────────────────────────
  const [showReprogram, setShowReprogram] = useState<Maintenance | null>(null)
  const onReprogram = async (newDate: string) => {
    if (!showReprogram) return
    setError(null)
    const res = await reprogramMaintenance(showReprogram.id, newDate, 'Reprogramación manual desde calendario')
    if (!res.success) {
      setError(res.error ?? 'Error al reprogramar')
      return
    }
    setShowReprogram(null)
    router.refresh()
    location.reload()
  }

  // ─── Modal de completar ────────────────────────────────────────────────────
  const [showComplete, setShowComplete] = useState<Maintenance | null>(null)
  const onComplete = async (cost: number, notes: string) => {
    if (!showComplete) return
    setError(null)
    const res = await completeMaintenance(showComplete.id, {
      completedDate: new Date().toISOString(),
      cost,
      notes: notes || undefined,
    })
    if (!res.success) {
      setError(res.error ?? 'Error al completar')
      return
    }
    setShowComplete(null)
    router.refresh()
    location.reload()
  }

  const monthLabel = monthStart.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })

  return (
    <div className="p-6 space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Calendario de mantenimiento</h1>
          <p className="text-sm text-slate-600 capitalize">{monthLabel}</p>
        </div>
        <div className="flex gap-2 items-center">
          <button
            onClick={() => setMonth(new Date(monthStart.setMonth(monthStart.getMonth() - 1)))}
            className="px-3 py-1.5 text-sm border rounded-md bg-white"
          >
            ← Mes anterior
          </button>
          <button
            onClick={() => setMonth(new Date())}
            className="px-3 py-1.5 text-sm border rounded-md bg-white"
          >
            Hoy
          </button>
          <button
            onClick={() => {
              const m = new Date(month); m.setMonth(m.getMonth() + 1); setMonth(m)
            }}
            className="px-3 py-1.5 text-sm border rounded-md bg-white"
          >
            Mes siguiente →
          </button>
          <button
            onClick={() => setView(view === 'calendar' ? 'list' : 'calendar')}
            className="px-3 py-1.5 text-sm border rounded-md bg-white"
          >
            {view === 'calendar' ? 'Vista lista' : 'Vista calendario'}
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="px-3 py-1.5 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700"
            data-testid="schedule-button"
          >
            + Programar mantenimiento
          </button>
        </div>
      </header>

      <div className="flex gap-3 text-xs">
        {Object.entries(TYPE_LABEL).map(([k, label]) => (
          <span key={k} className={`inline-flex items-center gap-1 px-2 py-1 rounded border ${TYPE_COLOR[k]}`}>
            <span className="w-2 h-2 rounded-full bg-current" /> {label}
          </span>
        ))}
      </div>

      {error && (
        <div className="border border-red-300 bg-red-50 text-red-800 rounded-md px-3 py-2 text-sm" role="alert">{error}</div>
      )}

      {view === 'calendar' ? (
        <div className="grid grid-cols-7 gap-1 border rounded-lg overflow-hidden bg-white">
          {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map((d) => (
            <div key={d} className="bg-slate-100 text-center text-xs font-medium text-slate-600 py-2">{d}</div>
          ))}
          {grid.map((d) => {
            const inMonth = d.getMonth() === monthStart.getMonth()
            const dayRecords = byDay.get(d.toDateString()) ?? []
            return (
              <div key={d.toISOString()} className={`min-h-[100px] p-1 border-t text-xs ${inMonth ? 'bg-white' : 'bg-slate-50 text-slate-400'}`}>
                <p className="font-medium">{d.getDate()}</p>
                <div className="space-y-1 mt-1">
                  {dayRecords.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => {
                        if (r.status === 'COMPLETADO') return
                        if (r.status === 'REPROGRAMADO') {
                          setShowReprogram(r)
                        } else if (r.status === 'PROGRAMADO' || r.status === 'CANCELADO') {
                          setShowReprogram(r)
                        } else {
                          setShowComplete(r)
                        }
                      }}
                      className={`block w-full text-left p-1 rounded border-l-2 ${TYPE_COLOR[r.type] ?? 'bg-slate-100 border-slate-300'}`}
                      data-testid={`event-${r.id}`}
                    >
                      <span className="font-medium">{TYPE_LABEL[r.type] ?? r.type}</span>
                      <span className="ml-1 text-[10px] uppercase">{r.status}</span>
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="overflow-x-auto border rounded-lg bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-600">
              <tr>
                <th className="px-3 py-2 text-left">Fecha</th>
                <th className="px-3 py-2 text-left">Tipo</th>
                <th className="px-3 py-2 text-left">Estado</th>
                <th className="px-3 py-2 text-left">Descripción</th>
                <th className="px-3 py-2 text-left">Técnico</th>
                <th className="px-3 py-2 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {records.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                    Sin mantenimientos registrados.
                  </td>
                </tr>
              ) : (
                records.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="px-3 py-2">{new Date(r.scheduledDate).toLocaleDateString('es-MX')}</td>
                    <td className="px-3 py-2">{TYPE_LABEL[r.type]}</td>
                    <td className="px-3 py-2 text-xs">{r.status}</td>
                    <td className="px-3 py-2 max-w-sm truncate" title={r.description}>{r.description}</td>
                    <td className="px-3 py-2">{r.technician ?? '—'}</td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex gap-2 justify-end">
                        {r.status !== 'COMPLETADO' && (
                          <>
                            <button onClick={() => setShowReprogram(r)} className="text-amber-600 hover:underline text-xs">Reprogramar</button>
                            <button onClick={() => setShowComplete(r)} className="text-emerald-600 hover:underline text-xs">Completar</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal: crear */}
      {showCreate && (
        <Modal title="Programar mantenimiento" onClose={() => setShowCreate(false)}>
          <form onSubmit={onCreate} className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="type">Tipo</label>
              <select
                id="type"
                value={createType}
                onChange={(e) => setCreateType(e.target.value)}
                className="w-full border rounded-md px-3 py-2"
              >
                {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="date">Fecha programada</label>
              <div className="flex gap-2">
                <input
                  id="date"
                  type="date"
                  required
                  value={createDate}
                  onChange={(e) => setCreateDate(e.target.value)}
                  className="flex-1 border rounded-md px-3 py-2"
                  data-testid="schedule-date"
                />
                <button
                  type="button"
                  onClick={onCheckAvailability}
                  className="px-3 py-2 text-sm rounded-md border bg-white hover:bg-slate-50"
                  disabled={!createDate || isPending}
                >
                  Verificar disponibilidad
                </button>
              </div>
              {createSuggestions.length > 0 && (
                <div className="mt-2 text-xs">
                  <p className="text-amber-700 font-medium mb-1">Sugerencias libres:</p>
                  <ul className="flex gap-2 flex-wrap">
                    {createSuggestions.map((s) => (
                      <li key={s.iso}>
                        <button
                          type="button"
                          className="px-2 py-1 border rounded bg-amber-50 hover:bg-amber-100"
                          onClick={() => setCreateDate(s.iso.slice(0, 10))}
                        >
                          {s.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="desc">Descripción</label>
              <textarea
                id="desc"
                required
                value={createDescription}
                onChange={(e) => setCreateDescription(e.target.value)}
                rows={3}
                className="w-full border rounded-md px-3 py-2"
                data-testid="schedule-description"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="tech">Técnico</label>
              <input
                id="tech"
                value={createTechnician}
                onChange={(e) => setCreateTechnician(e.target.value)}
                className="w-full border rounded-md px-3 py-2"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowCreate(false)} className="px-3 py-2 text-sm border rounded-md bg-white">Cancelar</button>
              <button type="submit" disabled={isPending} className="px-3 py-2 text-sm rounded-md bg-blue-600 text-white disabled:opacity-50">
                Programar
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal: reprogramar */}
      {showReprogram && (
        <ReprogramModal
          record={showReprogram}
          unitId={unitId}
          onClose={() => setShowReprogram(null)}
          onConfirm={onReprogram}
        />
      )}

      {/* Modal: completar */}
      {showComplete && (
        <CompleteModal
          record={showComplete}
          onClose={() => setShowComplete(null)}
          onConfirm={onComplete}
        />
      )}
    </div>
  )
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-4 space-y-3">
        <header className="flex justify-between items-center">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="text-slate-500 text-sm">✕</button>
        </header>
        {children}
      </div>
    </div>
  )
}

function ReprogramModal({
  record,
  unitId,
  onClose,
  onConfirm,
}: {
  record: Maintenance
  unitId: string
  onClose: () => void
  onConfirm: (iso: string) => void
}) {
  const [newDate, setNewDate] = useState<string>(
    new Date(record.scheduledDate).toISOString().slice(0, 10)
  )
  const [suggestions, setSuggestions] = useState<Array<{ iso: string; label: string }>>([])
  const [busy, setBusy] = useState(false)
  const [info, setInfo] = useState<string | null>(null)

  const checkAlternatives = async () => {
    setBusy(true)
    const start = new Date(newDate)
    const end = new Date(start); end.setHours(23, 59, 59, 999)
    const res = await validateUnitAvailability(unitId, start.toISOString(), end.toISOString())
    setSuggestions(res.suggestions)
    if (!res.available) {
      setInfo(`La fecha ${newDate} tiene conflicto (${res.conflicts.length} asignaciones). Usa una sugerencia.`)
    } else {
      setInfo('La fecha está libre.')
    }
    setBusy(false)
  }

  return (
    <Modal title={`Reprogramar ${TYPE_LABEL[record.type] ?? record.type}`} onClose={onClose}>
      <div className="space-y-3">
        <p className="text-sm text-slate-600">Fecha actual: <strong>{new Date(record.scheduledDate).toLocaleDateString('es-MX')}</strong></p>
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="newdate">Nueva fecha</label>
          <div className="flex gap-2">
            <input
              id="newdate"
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="flex-1 border rounded-md px-3 py-2"
            />
            <button onClick={checkAlternatives} disabled={busy} className="px-3 py-2 text-sm border rounded-md bg-white hover:bg-slate-50">
              {busy ? 'Buscando…' : 'Buscar alternativas'}
            </button>
          </div>
          {info && <p className="text-xs mt-2 text-slate-700">{info}</p>}
          {suggestions.length > 0 && (
            <div className="mt-2 text-xs">
              <p className="font-medium mb-1">Sugerencias libres:</p>
              <ul className="flex gap-2 flex-wrap">
                {suggestions.map((s) => (
                  <li key={s.iso}>
                    <button
                      type="button"
                      className="px-2 py-1 border rounded bg-emerald-50 hover:bg-emerald-100"
                      onClick={() => setNewDate(s.iso.slice(0, 10))}
                    >
                      {s.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-3 py-2 text-sm border rounded-md bg-white">Cancelar</button>
          <button
            onClick={() => onConfirm(new Date(newDate).toISOString())}
            disabled={busy}
            className="px-3 py-2 text-sm rounded-md bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
            data-testid="confirm-reprogram"
          >
            Reprogramar
          </button>
        </div>
      </div>
    </Modal>
  )
}

function CompleteModal({
  record,
  onClose,
  onConfirm,
}: {
  record: Maintenance
  onClose: () => void
  onConfirm: (cost: number, notes: string) => void
}) {
  const [cost, setCost] = useState<string>('0')
  const [notes, setNotes] = useState<string>('')

  return (
    <Modal title={`Completar ${TYPE_LABEL[record.type] ?? record.type}`} onClose={onClose}>
      <div className="space-y-3">
        <p className="text-sm text-slate-600">
          {record.scheduledDate && (
            <>Programado: <strong>{new Date(record.scheduledDate).toLocaleDateString('es-MX')}</strong></>
          )}
        </p>
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="cost">Costo</label>
          <input
            id="cost"
            type="number"
            min="0"
            step="0.01"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            className="w-full border rounded-md px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="cnotes">Notas</label>
          <textarea
            id="cnotes"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full border rounded-md px-3 py-2"
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-3 py-2 text-sm border rounded-md bg-white">Cancelar</button>
          <button
            onClick={() => onConfirm(Number(cost), notes)}
            className="px-3 py-2 text-sm rounded-md bg-emerald-600 text-white hover:bg-emerald-700"
            data-testid="confirm-complete"
          >
            Marcar como completado
          </button>
        </div>
      </div>
    </Modal>
  )
}
