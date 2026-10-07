'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import {
  createPortalClientAppointment,
  getPortalBranchHourAvailability,
  getPortalAppointmentBookingContext,
} from '@/actions/portal-appointment.actions'
import PortalAppointmentDateCalendar from '@/components/portal/PortalAppointmentDateCalendar'
import PortalQuickWorkerRegister from '@/components/portal/PortalQuickWorkerRegister'
import PortalSpecialRequestPanel from '@/components/portal/PortalSpecialRequestPanel'
import type { PortalWorkerListItem } from '@/actions/portal-worker.actions'
import { formatAgendaDayHeading } from '@/lib/appointment-scheduling'

type BookingContext = Extract<
  Awaited<ReturnType<typeof getPortalAppointmentBookingContext>>,
  { success: true }
>

type Props = {
  context: BookingContext
}

type WorkerOption = BookingContext['workers'][number]

function mergeWorkers(existing: WorkerOption[], incoming: PortalWorkerListItem[]): WorkerOption[] {
  const map = new Map(existing.map((w) => [w.id, w]))
  for (const w of incoming) {
    map.set(w.id, {
      id: w.id,
      firstName: w.firstName,
      lastName: w.lastName,
      phone: w.phone,
      medicalProfileId: w.medicalProfileId,
      medicalProfile: w.medicalProfile,
    })
  }
  return [...map.values()].sort((a, b) =>
    `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, 'es'),
  )
}

export default function PortalAppointmentForm({ context }: Props) {
  const [workers, setWorkers] = useState(context.workers)
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
  const [showBulkRequest, setShowBulkRequest] = useState(false)
  const [successFolio, setSuccessFolio] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const readOnly = context.isPreview
  const showSpecialRequest = showCapacityHelp || showBulkRequest

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
    if (readOnly) return
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
      {readOnly && (
        <p className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
          Vista previa del portal: puede revisar este formulario como la empresa, pero no se crearán
          citas ni solicitudes hasta que un usuario cliente real envíe desde su sesión.
        </p>
      )}
      <div className="space-y-4">
        <label className="block text-sm max-w-md">
          <span className="text-xs font-bold uppercase text-slate-500">Sucursal</span>
          <select
            required
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm"
          >
            {context.branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>

        <PortalAppointmentDateCalendar
          branchId={branchId}
          branchName={context.branches.find((b) => b.id === branchId)?.name}
          selectedDate={date}
          onSelectDate={setDate}
          todayStr={context.suggestedDate}
        />
      </div>

      <form onSubmit={onSubmit} className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <p className="text-sm text-slate-600">
          Complete la cita para <strong>{context.companyName}</strong>
          {date ? (
            <>
              {' '}
              · <strong className="text-slate-800 capitalize">{formatAgendaDayHeading(date)}</strong>
            </>
          ) : null}
          .
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
              {workers.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.lastName}, {w.firstName}
                </option>
              ))}
            </select>
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

          <div className="sm:col-span-2">
            <PortalQuickWorkerRegister
              branchId={branchId}
              date={date}
              time={time}
              slots={slots}
              readOnly={readOnly}
              defaultOpen={workers.length === 0}
              onSelectTime={setTime}
              onWorkersCreated={(created, firstId) => {
                setWorkers((prev) => mergeWorkers(prev, created))
                if (firstId) setWorkerId(firstId)
                void getPortalBranchHourAvailability({ branchId, date }).then((res) => {
                  if (res.success) setSlots(res.slots)
                })
              }}
            />
          </div>

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
          disabled={readOnly || pending || workers.length === 0}
          className="w-full sm:w-auto rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {readOnly ? 'Solo lectura (vista previa)' : pending ? 'Agendando…' : 'Confirmar cita'}
        </button>

        {workers.length === 0 && (
          <p className="text-sm text-slate-500">
            Registre trabajadores arriba (según cupo del horario) para poder confirmar la cita.
          </p>
        )}

        {!showSpecialRequest && (
          <p className="text-sm text-slate-600 pt-1">
            ¿Necesita agendar muchas citas o coordinar un horario especial?{' '}
            <button
              type="button"
              className="font-medium text-violet-700 underline hover:text-violet-900"
              onClick={() => setShowBulkRequest(true)}
            >
              Solicitar atención personalizada
            </button>
          </p>
        )}
      </form>

      {showSpecialRequest && (
        <PortalSpecialRequestPanel
          branchId={branchId}
          date={date}
          time={time}
          reason={showCapacityHelp ? 'capacity_full' : 'custom'}
          readOnly={readOnly}
          description={
            showCapacityHelp
              ? 'Este horario ya no tiene cupo. Indique cuántas citas necesita y un teléfono; nuestro equipo le contactará.'
              : 'Indique cuántas citas necesita y un teléfono de contacto. Nos comunicaremos con usted para coordinar.'
          }
        />
      )}
    </div>
  )
}
