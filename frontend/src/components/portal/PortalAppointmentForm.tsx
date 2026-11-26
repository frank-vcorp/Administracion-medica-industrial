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
import type { BranchHourSlotAvailability } from '@/lib/appointment-capacity'
import { formatMinutesLabel, resolveEffectiveProfileDuration } from '@/lib/profile-duration'

type BookingContext = Extract<
  Awaited<ReturnType<typeof getPortalAppointmentBookingContext>>,
  { success: true }
>

type Props = {
  context: BookingContext
}

type WorkerOption = BookingContext['workers'][number]

type PortalClientWhatsAppStatus = {
  sent: boolean
  triptychSent: boolean
  skipped: boolean
  missingPhone?: boolean
}

type PortalClientEmailStatus = {
  sent: boolean
  skipped: boolean
}

const PORTAL_CLIENT_ERROR_MESSAGES: Record<string, string> = {
  APPOINTMENT_IN_PAST: 'No puede agendar en una fecha u hora pasada.',
  OUTSIDE_HOURS: 'La hora elegida está fuera del horario de atención de la sucursal.',
  BRANCH_CLOSED: 'La sucursal no atiende en la fecha seleccionada.',
  BRANCH_INACTIVE: 'La sucursal seleccionada no está disponible.',
  EXCEEDS_CLOSING_TIME:
    'La duración de los estudios rebasa la hora de cierre. Elija un horario más temprano.',
  INSUFFICIENT_MINUTES:
    'No hay tiempo suficiente en el horario elegido. Seleccione otra hora.',
  BRANCH_HOUR_FULL:
    'Este horario ya no tiene cupo. Elija otra hora o solicite atención personalizada.',
  CLIENTE_DESHABILITADO:
    'Su empresa no tiene habilitado el agendamiento en este momento; contacte a nuestro equipo.',
}

function formatPortalClientError(raw?: string | null): string {
  const trimmed = raw?.trim()
  if (!trimmed) {
    return 'No se pudo agendar la cita. Verifique la fecha y hora e intente de nuevo.'
  }
  if (PORTAL_CLIENT_ERROR_MESSAGES[trimmed]) {
    return PORTAL_CLIENT_ERROR_MESSAGES[trimmed]
  }
  if (/^[A-Z0-9_]+$/.test(trimmed)) {
    return 'No se pudo agendar la cita. Verifique la fecha y hora e intente de nuevo.'
  }
  return trimmed
}

function mergeWorkers(existing: WorkerOption[], incoming: PortalWorkerListItem[]): WorkerOption[] {
  const map = new Map(existing.map((w) => [w.id, w]))
  for (const w of incoming) {
    map.set(w.id, {
      id: w.id,
      firstName: w.firstName,
      lastName: w.lastName,
      phone: w.phone,
      medicalProfileId: w.medicalProfileId,
      medicalProfile: w.medicalProfile
        ? {
            id: w.medicalProfile.id,
            name: w.medicalProfile.name,
            calculatedDurationMinutes: w.medicalProfile.calculatedDurationMinutes ?? null,
            durationOverrideMinutes: w.medicalProfile.durationOverrideMinutes ?? null,
          }
        : null,
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
  const [slots, setSlots] = useState<BranchHourSlotAvailability[]>([])
  const [slotsLoading, setSlotsLoading] = useState(true)
  const [capacityMode, setCapacityMode] = useState<'HOURLY_COUNT' | 'DURATION_MINUTES'>('HOURLY_COUNT')
  const [requiredDurationMinutes, setRequiredDurationMinutes] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showCapacityHelp, setShowCapacityHelp] = useState(false)
  const [showBulkRequest, setShowBulkRequest] = useState(false)
  const [successFolio, setSuccessFolio] = useState<string | null>(null)
  const [successWhatsApp, setSuccessWhatsApp] = useState<PortalClientWhatsAppStatus | null>(null)
  const [successEmail, setSuccessEmail] = useState<PortalClientEmailStatus | null>(null)
  const [pending, startTransition] = useTransition()
  const readOnly = context.isPreview
  const showSpecialRequest = showCapacityHelp || showBulkRequest

  const selectedWorker = useMemo(
    () => workers.find((w) => w.id === workerId) ?? null,
    [workers, workerId],
  )
  const effectiveProfileId = serviceProfileId || selectedWorker?.medicalProfileId || null
  const effectiveProfileDuration = useMemo(() => {
    if (serviceProfileId) {
      const p = context.profiles.find((pr) => pr.id === serviceProfileId)
      return resolveEffectiveProfileDuration(p)
    }
    if (selectedWorker?.medicalProfile) {
      return resolveEffectiveProfileDuration(selectedWorker.medicalProfile)
    }
    return null
  }, [serviceProfileId, context.profiles, selectedWorker])

  useEffect(() => {
    if (!branchId || !date) return
    let cancelled = false
    void Promise.resolve().then(async () => {
      if (cancelled) return
      setSlotsLoading(true)
      try {
        const res = await getPortalBranchHourAvailability({
          branchId,
          date,
          serviceProfileId: effectiveProfileId,
          workerId: workerId || null,
        })
        if (cancelled) return
        if (res.success) {
          setSlots(res.slots)
          setCapacityMode(
            res.capacityMode === 'DURATION_MINUTES' ? 'DURATION_MINUTES' : 'HOURLY_COUNT',
          )
          setRequiredDurationMinutes(res.requiredDurationMinutes ?? null)
          setTime((prevTime) => {
            const current = res.slots.find(
              (s) => `${s.hour.toString().padStart(2, '0')}:00` === prevTime,
            )
            if (!current || current.full) {
              const firstOpen = res.slots.find((s) => !s.full)
              if (firstOpen) {
                return `${firstOpen.hour.toString().padStart(2, '0')}:00`
              }
            }
            return prevTime
          })
        }
      } finally {
        if (!cancelled) setSlotsLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [branchId, date, effectiveProfileId, workerId])

  const timeOptions = useMemo(() => {
    const fromSlots = slots.map((s) => {
      const hh = `${s.hour.toString().padStart(2, '0')}:00`
      if (s.capacityMode === 'DURATION_MINUTES') {
        const label = s.exceedsClosing
          ? `${hh} — excede cierre (${s.requiredMinutes} min)`
          : s.full
            ? `${hh} — sin tiempo (${s.remainingMinutes} min libres)`
            : `${hh} (${s.remainingMinutes} min libres · caben ${s.availableForProfile})`
        return { value: hh, label, full: s.full }
      }
      return {
        value: hh,
        label: `${hh} (${s.count}/${s.capacity})`,
        full: s.full,
      }
    })
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
      })
      if (res.success) {
        setSuccessFolio(res.appointment?.expedientId ?? '—')
        setSuccessWhatsApp(res.whatsApp ?? null)
        setSuccessEmail(res.email ?? null)
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
      const rawError = 'userMessage' in res && res.userMessage ? res.userMessage : res.error
      setError(formatPortalClientError(rawError))
    })
  }

  if (successFolio) {
    return (
      <div className="bg-white rounded-xl border border-emerald-200 p-6 space-y-4">
        <p className="text-emerald-800 font-bold">Cita confirmada</p>
        <p className="text-sm text-slate-700">
          Folio de papeleta: <span className="font-mono font-bold">{successFolio}</span>
        </p>
        {successWhatsApp?.sent ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            ✓ Se envió por WhatsApp al colaborador la confirmación de cita, el enlace de prellenado
            {successWhatsApp.triptychSent ? ' y el tríptico de preparación.' : '.'}
          </div>
        ) : successWhatsApp ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
            {successWhatsApp.missingPhone
              ? 'El colaborador no tiene celular registrado; puede compartirle los datos de su cita o actualizar su teléfono.'
              : 'Tu cita quedó registrada correctamente. Si el colaborador no recibe el mensaje de WhatsApp en unos minutos, compártele el folio de papeleta o comunícate con nuestro equipo.'}
          </div>
        ) : null}
        {successEmail?.sent ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            ✉️ Se envió también por correo la confirmación de cita, el enlace de prellenado y el tríptico.
          </div>
        ) : null}
        <button
          type="button"
          className="text-sm text-blue-600 font-medium"
          onClick={() => {
            setSuccessFolio(null)
            setSuccessWhatsApp(null)
            setSuccessEmail(null)
          }}
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
        <div className="grid gap-4 sm:grid-cols-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <label className="block text-sm">
            <span className="text-xs font-bold text-slate-500">1. Sucursal</span>
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

          <label className="block text-sm">
            <span className="text-xs font-bold text-slate-500">
              2. Perfil de exámenes (define duración en clínica)
            </span>
            <select
              value={serviceProfileId}
              onChange={(e) => setServiceProfileId(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm"
            >
              <option value="">Usar perfil del trabajador</option>
              {context.profiles.map((p) => {
                const dur = resolveEffectiveProfileDuration(p)
                return (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {dur != null ? ` (${dur} min)` : ''}
                  </option>
                )
              })}
            </select>
            {(effectiveProfileDuration != null || (capacityMode === 'DURATION_MINUTES' && requiredDurationMinutes != null)) && (
              <p className="mt-1 text-xs font-medium text-teal-800">
                ⏱ Duración proyectada:{' '}
                <strong>
                  {formatMinutesLabel(effectiveProfileDuration ?? requiredDurationMinutes)}
                </strong>
              </p>
            )}
            {context.profiles.length === 0 && (
              <p className="mt-1 text-xs text-slate-500">
                Su empresa aún no tiene perfiles propios configurados; contacte a SME si requiere uno.
              </p>
            )}
          </label>
        </div>

        <PortalAppointmentDateCalendar
          branchId={branchId}
          branchName={context.branches.find((b) => b.id === branchId)?.name}
          serviceProfileId={effectiveProfileId}
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
            <span className="text-xs font-bold text-slate-500">Trabajador</span>
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
            <span className="text-xs font-bold text-slate-500">Hora</span>
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
              serviceProfileId={effectiveProfileId}
              slots={slots}
              slotsLoading={slotsLoading}
              readOnly={readOnly}
              defaultOpen={workers.length === 0}
              onSelectTime={setTime}
              onWorkersCreated={(created, firstId) => {
                setWorkers((prev) => mergeWorkers(prev, created))
                if (firstId) setWorkerId(firstId)
                void getPortalBranchHourAvailability({
                  branchId,
                  date,
                  serviceProfileId: effectiveProfileId,
                  workerId: firstId ?? (workerId || null),
                }).then((res) => {
                  if (res.success) setSlots(res.slots)
                })
              }}
            />
          </div>

          <div className="sm:col-span-2 text-xs text-slate-500">
            Perfil aplicado:{' '}
            <strong className="text-slate-700">
              {serviceProfileId
                ? (context.profiles.find((p) => p.id === serviceProfileId)?.name ?? 'Seleccionado')
                : (selectedWorker?.medicalProfile?.name ?? 'Sin perfil asignado')}
            </strong>
            {effectiveProfileDuration != null && (
              <span className="ml-2 rounded-full bg-teal-50 border border-teal-200 px-2 py-0.5 text-[11px] font-bold text-teal-800">
                {formatMinutesLabel(effectiveProfileDuration)}
              </span>
            )}
          </div>

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
