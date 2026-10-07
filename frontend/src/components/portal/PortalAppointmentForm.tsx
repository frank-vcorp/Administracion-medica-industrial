'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import {
  createPortalClientAppointment,
  getPortalBranchHourAvailability,
  getPortalAppointmentBookingContext,
} from '@/actions/portal-appointment.actions'
import PortalSpecialRequestPanel from '@/components/portal/PortalSpecialRequestPanel'

type BookingContext = Extract<
  Awaited<ReturnType<typeof getPortalAppointmentBookingContext>>,
  { success: true }
>

type Props = {
  context: BookingContext
}

export default function PortalAppointmentForm({ context }: Props) {
  const [workerId, setWorkerId] = useState(context.workers[0]?.id ?? '')
  const [branchId, setBranchId] = useState(
    context.defaultBranchId ?? context.branches[0]?.id ?? '',
  )
  const [date, setDate] = useState(context.suggestedDate)
  const [time, setTime] = useState('09:00')
  const [serviceProfileId, setServiceProfileId] = useState('')
  const [notes, setNotes] = useState('')
  const [slots, setSlots] = useState<
    Array<{ hour: number; count: number; capacity: number; full: boolean }>
  >([])
  const [error, setError] = useState<string | null>(null)
  const [showCapacityHelp, setShowCapacityHelp] = useState(false)
  const [successFolio, setSuccessFolio] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    if (!branchId || !date) return
    void getPortalBranchHourAvailability({ branchId, date }).then((res) => {
      if (res.success) setSlots(res.slots)
    })
  }, [branchId, date])

  const timeOptions = useMemo(() => {
    const fromSlots = slots.map((s) => ({
      value: `${s.hour.toString().padStart(2, '0')}:00`,
      label: `${s.hour.toString().padStart(2, '0')}:00 (${s.count}/${s.capacity})`,
      full: s.full,
    }))
    if (fromSlots.length > 0) return fromSlots
    return Array.from({ length: 9 }, (_, i) => {
      const h = 8 + i
      return {
        value: `${h.toString().padStart(2, '0')}:00`,
        label: `${h.toString().padStart(2, '0')}:00`,
        full: false,
      }
    })
  }, [slots])

  useEffect(() => {
    const current = timeOptions.find((t) => t.value === time)
    if (current?.full) {
      const firstOpen = timeOptions.find((t) => !t.full)
      if (firstOpen) setTime(firstOpen.value)
    }
  }, [timeOptions, time])

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setShowCapacityHelp(false)
    startTransition(async () => {
      const res = await createPortalClientAppointment({
        workerId,
        branchId,
        date,
        time,
        serviceProfileId: serviceProfileId || null,
        notes,
      })
      if (res.success) {
        setSuccessFolio(res.appointment?.expedientId ?? '—')
        return
      }
      if (res.error === 'BRANCH_HOUR_FULL') {
        setShowCapacityHelp(true)
        setError(
          res.userMessage ??
            'Horario sin cupo. Use la solicitud personalizada e indique cuántas citas necesita.',
        )
        return
      }
      setError(res.error ?? 'No se pudo agendar')
    })
  }

  if (successFolio) {
    return (
      <div className="bg-white rounded-xl border border-emerald-200 p-6 space-y-4">
        <p className="text-emerald-800 font-bold">Cita confirmada</p>
        <p className="text-sm text-slate-700">
          Folio de papeleta: <span className="font-mono font-bold">{successFolio}</span>
        </p>
        <button
          type="button"
          className="text-sm text-blue-600 font-medium"
          onClick={() => setSuccessFolio(null)}
        >
          Agendar otra cita
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <form onSubmit={onSubmit} className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <p className="text-sm text-slate-600">
          Agende citas puntuales para trabajadores de <strong>{context.companyName}</strong>. Para
          varias citas o horarios especiales use la solicitud personalizada abajo.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-xs font-bold uppercase text-slate-500">Trabajador</span>
            <select
              required
              value={workerId}
              onChange={(e) => setWorkerId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            >
              {context.workers.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.lastName}, {w.firstName}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm">
            <span className="text-xs font-bold uppercase text-slate-500">Sucursal</span>
            <select
              required
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            >
              {context.branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm">
            <span className="text-xs font-bold uppercase text-slate-500">Fecha</span>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>

          <label className="block text-sm">
            <span className="text-xs font-bold uppercase text-slate-500">Hora</span>
            <select
              required
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            >
              {timeOptions.map((t) => (
                <option key={t.value} value={t.value} disabled={t.full}>
                  {t.label}
                  {t.full ? ' — lleno' : ''}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm sm:col-span-2">
            <span className="text-xs font-bold uppercase text-slate-500">Perfil de exámenes (opcional)</span>
            <select
              value={serviceProfileId}
              onChange={(e) => setServiceProfileId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            >
              <option value="">Usar perfil del trabajador</option>
              {context.profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm sm:col-span-2">
            <span className="text-xs font-bold uppercase text-slate-500">Notas internas AMI (opcional)</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              placeholder="Solo para la cita en sistema; no se envía por WhatsApp"
            />
          </label>
        </div>

        {error && <p className="text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

        <button
          type="submit"
          disabled={pending || context.workers.length === 0}
          className="w-full sm:w-auto rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {pending ? 'Agendando…' : 'Confirmar cita'}
        </button>

        {context.workers.length === 0 && (
          <p className="text-sm text-slate-500">No hay trabajadores registrados para agendar.</p>
        )}
      </form>

      <PortalSpecialRequestPanel
        branchId={branchId}
        date={date}
        time={time}
        reason={showCapacityHelp ? 'capacity_full' : 'custom'}
        description={
          showCapacityHelp
            ? 'Este horario no tiene cupo. Envíe una solicitud personalizada con la cantidad de citas que necesita.'
            : 'Para paquetes de citas o atención fuera de agenda, envíe una solicitud de contacto.'
        }
      />
    </div>
  )
}
