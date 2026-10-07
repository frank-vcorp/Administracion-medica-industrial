'use client'

import { useMemo, useState, useTransition } from 'react'
import { quickRegisterPortalWorkers } from '@/actions/portal-worker.actions'
import type { PortalWorkerListItem } from '@/actions/portal-worker.actions'

type Slot = { hour: number; count: number; capacity: number; full: boolean }

type Row = { firstName: string; lastName: string; phone: string }

type Props = {
  branchId: string
  date: string
  time: string
  slots: Slot[]
  readOnly?: boolean
  defaultOpen?: boolean
  onWorkersCreated: (workers: PortalWorkerListItem[], firstNewId?: string) => void
  onSelectTime: (time: string) => void
}

function emptyRow(): Row {
  return { firstName: '', lastName: '', phone: '' }
}

export default function PortalQuickWorkerRegister({
  branchId,
  date,
  time,
  slots,
  readOnly = false,
  defaultOpen = false,
  onWorkersCreated,
  onSelectTime,
}: Props) {
  const [open, setOpen] = useState(defaultOpen)
  const [rows, setRows] = useState<Row[]>([emptyRow()])
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const selectedSlot = useMemo(() => {
    const hour = Number(time.split(':')[0])
    return slots.find((s) => s.hour === hour)
  }, [slots, time])

  const slotsRemaining = useMemo(() => {
    if (!selectedSlot) return null
    return Math.max(0, selectedSlot.capacity - selectedSlot.count)
  }, [selectedSlot])

  const nextOpenSlot = useMemo(() => {
    if (slots.length === 0) return null
    const currentHour = Number(time.split(':')[0])
    const after = slots.find((s) => s.hour > currentHour && !s.full)
    if (after) return after
    return slots.find((s) => !s.full && s.hour !== currentHour) ?? null
  }, [slots, time])

  const maxRows = slotsRemaining ?? 0

  const addRow = () => {
    if (rows.length >= maxRows) return
    setRows((r) => [...r, emptyRow()])
  }

  const updateRow = (index: number, patch: Partial<Row>) => {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  const removeRow = (index: number) => {
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)))
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (readOnly) return
    setError(null)
    setInfo(null)

    const filled = rows.filter((r) => r.firstName.trim() || r.lastName.trim() || r.phone.trim())
    if (filled.length === 0) {
      setError('Capture al menos un trabajador.')
      return
    }

    startTransition(async () => {
      const res = await quickRegisterPortalWorkers({
        branchId,
        date,
        time,
        workers: filled.map((r) => ({
          firstName: r.firstName.trim(),
          lastName: r.lastName.trim(),
          phone: r.phone.trim() || undefined,
        })),
      })
      if (!res.success) {
        setError(res.userMessage ?? res.error ?? 'No se pudo registrar')
        return
      }
      setInfo(res.message)
      if (res.skipped.length > 0) {
        setInfo(
          `${res.message} ${res.skipped.length} coincidencia(s) con registros existentes.`,
        )
      }
      setRows([emptyRow()])
      onWorkersCreated(res.workers, res.workers[0]?.id)
    })
  }

  const hourFull = maxRows === 0

  return (
    <div className="rounded-xl border border-sky-200 bg-sky-50/60 p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-sky-900">
            Alta rápida de trabajadores
          </p>
          <p className="text-sm text-sky-950 mt-1">
            {hourFull ? (
              <>El horario <strong>{time}</strong> no tiene cupo.</>
            ) : (
              <>
                En <strong>{time}</strong> quedan{' '}
                <strong>{maxRows}</strong> cupo{maxRows !== 1 ? 's' : ''} (capacidad de sucursal). Puede
                registrar hasta {maxRows} trabajador{maxRows !== 1 ? 'es' : ''} para agendar aquí.
              </>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-sm font-bold text-sky-800 underline hover:text-sky-950"
        >
          {open ? 'Ocultar' : 'Registrar trabajadores'}
        </button>
      </div>

      {hourFull && nextOpenSlot && (
        <p className="text-sm text-slate-700 bg-white/80 rounded-lg px-3 py-2 border border-slate-200">
          Para más citas hoy, use la siguiente hora con cupo:{' '}
          <button
            type="button"
            className="font-bold text-violet-700 underline"
            onClick={() =>
              onSelectTime(`${nextOpenSlot.hour.toString().padStart(2, '0')}:00`)
            }
          >
            {nextOpenSlot.hour.toString().padStart(2, '0')}:00
          </button>{' '}
          ({nextOpenSlot.capacity - nextOpenSlot.count} disponible
          {nextOpenSlot.capacity - nextOpenSlot.count !== 1 ? 's' : ''}).
        </p>
      )}

      {!hourFull && maxRows > 0 && nextOpenSlot && maxRows < 3 && (
        <p className="text-xs text-slate-600">
          ¿Necesita más citas el mismo día? Pruebe{' '}
          <button
            type="button"
            className="font-medium text-violet-700 underline"
            onClick={() =>
              onSelectTime(`${nextOpenSlot.hour.toString().padStart(2, '0')}:00`)
            }
          >
            {nextOpenSlot.hour.toString().padStart(2, '0')}:00
          </button>
          .
        </p>
      )}

      {open && (
        <form onSubmit={onSubmit} className="space-y-3 bg-white rounded-lg border border-sky-100 p-3">
          {rows.map((row, index) => (
            <div key={index} className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto] items-end">
              <label className="block text-xs">
                <span className="font-bold uppercase text-slate-500">Nombre</span>
                <input
                  value={row.firstName}
                  onChange={(e) => updateRow(index, { firstName: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                  maxLength={120}
                />
              </label>
              <label className="block text-xs">
                <span className="font-bold uppercase text-slate-500">Apellidos</span>
                <input
                  value={row.lastName}
                  onChange={(e) => updateRow(index, { lastName: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                  maxLength={120}
                />
              </label>
              <label className="block text-xs">
                <span className="font-bold uppercase text-slate-500">Teléfono</span>
                <input
                  type="tel"
                  value={row.phone}
                  onChange={(e) => updateRow(index, { phone: e.target.value })}
                  placeholder="10 dígitos"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                />
              </label>
              {rows.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeRow(index)}
                  className="text-xs text-red-600 font-bold px-2 py-2"
                >
                  Quitar
                </button>
              )}
            </div>
          ))}

          {maxRows > 1 && rows.length < maxRows && (
            <button
              type="button"
              onClick={addRow}
              className="text-sm font-medium text-sky-800 hover:underline"
            >
              + Agregar otro (máx. {maxRows})
            </button>
          )}

          {error && <p className="text-sm text-red-700">{error}</p>}
          {info && <p className="text-sm text-emerald-800">{info}</p>}

          <button
            type="submit"
            disabled={readOnly || pending || hourFull}
            className="rounded-lg bg-sky-700 px-4 py-2 text-sm font-bold text-white hover:bg-sky-800 disabled:opacity-50"
          >
            {readOnly ? 'Solo lectura (vista previa)' : pending ? 'Guardando…' : 'Guardar trabajadores'}
          </button>
        </form>
      )}
    </div>
  )
}
