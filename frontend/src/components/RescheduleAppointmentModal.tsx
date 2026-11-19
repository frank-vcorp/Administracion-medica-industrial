'use client'

import { useEffect, useState, useTransition } from 'react'
import {
  getBranchScheduleAvailabilityForProfile,
  rescheduleAppointment,
} from '@/actions/appointment.actions'
import type { BranchHourSlotAvailability } from '@/lib/appointment-capacity'
import {
  formatAppointmentAgendaDateString,
  formatAppointmentAgendaTime,
} from '@/lib/appointment-scheduling'
import { UserFacingErrorCallout } from '@/components/clinical/UserFacingErrorCallout'
import { mapSaveActionFailure, type UserFacingError } from '@/lib/user-facing-error'

interface AppointmentToReschedule {
  id: string
  expedientId: string | null
  scheduledAt: Date | string
  serviceProfileId?: string | null
  branch?: { id: string; name: string } | null
  worker: { id?: string; firstName: string; lastName: string }
}

interface Props {
  appointment: AppointmentToReschedule
  onClose: () => void
  onSuccess?: (newDate: string) => void
}

function toDateInputValue(scheduledAt: Date | string): string {
  return formatAppointmentAgendaDateString(scheduledAt)
}

function toTimeInputValue(scheduledAt: Date | string): string {
  return formatAppointmentAgendaTime(scheduledAt)
}

export default function RescheduleAppointmentModal({ appointment, onClose, onSuccess }: Props) {
  const [date, setDate] = useState(toDateInputValue(appointment.scheduledAt))
  const [time, setTime] = useState(toTimeInputValue(appointment.scheduledAt))
  const [slots, setSlots] = useState<BranchHourSlotAvailability[]>([])
  const [requiredMinutes, setRequiredMinutes] = useState<number | null>(null)
  const [capacityMode, setCapacityMode] = useState<'HOURLY_COUNT' | 'DURATION_MINUTES'>('HOURLY_COUNT')
  const [saveError, setSaveError] = useState<UserFacingError | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    const branchId = appointment.branch?.id
    if (!branchId || !date) return
    let cancelled = false
    void getBranchScheduleAvailabilityForProfile({
      branchId,
      date,
      serviceProfileId: appointment.serviceProfileId ?? null,
      workerId: appointment.worker.id ?? null,
      excludeAppointmentId: appointment.id,
    }).then((res) => {
      if (cancelled || !res.success) return
      setSlots(res.slots)
      setRequiredMinutes(res.requiredDurationMinutes ?? null)
      setCapacityMode(
        res.capacityMode === 'DURATION_MINUTES' ? 'DURATION_MINUTES' : 'HOURLY_COUNT',
      )
    })
    return () => {
      cancelled = true
    }
  }, [appointment.branch?.id, appointment.id, appointment.serviceProfileId, appointment.worker.id, date])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaveError(null)
    startTransition(async () => {
      const result = await rescheduleAppointment(appointment.id, { date, time })
      if (result.success) {
        onSuccess?.(date)
        onClose()
      } else {
        setSaveError(
          mapSaveActionFailure(
            {
              error: result.error || 'No se pudo reagendar',
              fieldErrors: 'fieldErrors' in result ? result.fieldErrors : undefined,
              technicalDetail: 'technicalDetail' in result ? result.technicalDetail : undefined,
            },
            { context: 'rescheduleAppointment' },
          ),
        )
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden">
        <div className="bg-blue-600 px-6 py-5 text-white">
          <h3 className="text-lg font-black">Reagendar cita</h3>
          <p className="text-blue-100 text-xs mt-1">
            {appointment.worker.firstName} {appointment.worker.lastName}
            {appointment.expedientId ? ` · ${appointment.expedientId}` : ''}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-xs text-slate-500">
            La cita actual quedará como <strong>Reagendada</strong> y se liberará el cupo. Se creará una cita nueva con nuevo expediente.
          </p>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 ml-1">Nueva fecha</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full bg-slate-50 ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500 p-3 rounded-xl text-sm outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 ml-1">Nueva hora</label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                required
                className="w-full bg-slate-50 ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500 p-3 rounded-xl text-sm outline-none"
              />
            </div>
          </div>

          {slots.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 space-y-2">
              <p className="text-[11px] font-semibold text-slate-600">
                {capacityMode === 'DURATION_MINUTES'
                  ? `Horarios disponibles (${requiredMinutes ?? 30} min requeridos)`
                  : 'Horarios disponibles'}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {slots.map((slot) => {
                  const hh = `${String(slot.hour).padStart(2, '0')}:00`
                  const selectedHour = Number(time.split(':')[0]) === slot.hour
                  return (
                    <button
                      key={slot.hour}
                      type="button"
                      disabled={slot.full}
                      onClick={() => setTime(hh)}
                      className={`rounded-lg px-2 py-1 text-[10px] font-bold border transition-colors ${
                        slot.full
                          ? 'border-slate-200 bg-slate-100 text-slate-400 line-through cursor-not-allowed'
                          : selectedHour
                            ? 'border-blue-600 bg-blue-600 text-white'
                            : 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                      }`}
                    >
                      {slot.capacityMode === 'DURATION_MINUTES'
                        ? `${hh} (${slot.remainingMinutes}m)`
                        : `${hh} (${slot.count}/${slot.capacity})`}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {saveError && (
            <UserFacingErrorCallout mapped={saveError} className="border-red-200 bg-red-50/90" />
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 py-3 rounded-xl font-bold text-sm disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold text-sm disabled:opacity-50"
            >
              {isPending ? 'Guardando...' : 'Confirmar reagendo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
