'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  getConsultaSeguimientoAgenda,
  scheduleConsultaSeguimiento,
  type ConsultaSeguimientoAgendaDay,
  type ConsultaSeguimientoAgendaSlot,
} from '@/actions/consulta-medica.actions'
import {
  addAgendaDays,
  AMI_APPOINTMENT_TIMEZONE,
  parseAppointmentLocalDateTime,
} from '@/lib/appointment-scheduling'

type Scheduled = {
  appointmentId: string
  fecha: string
  hora: string
  dateInput: string
  timeInput: string
}

function dayBits(date: string): { weekday: string; number: string } {
  const at = parseAppointmentLocalDateTime(date, '12:00')
  return {
    weekday: at.toLocaleDateString('es-MX', {
      weekday: 'short',
      timeZone: AMI_APPOINTMENT_TIMEZONE,
    }),
    number: at.toLocaleDateString('es-MX', {
      day: 'numeric',
      timeZone: AMI_APPOINTMENT_TIMEZONE,
    }),
  }
}

function dayIsBookable(day: ConsultaSeguimientoAgendaDay): boolean {
  return day.status === 'open' || day.status === 'partial'
}

export default function ConsultaSeguimientoAgenda({
  eventId,
  eventTestId,
  workerId,
  readonly = false,
  scheduledLabel,
  existingAppointmentId,
  onScheduled,
}: {
  eventId: string
  eventTestId: string
  workerId: string
  readonly?: boolean
  scheduledLabel: string | null
  existingAppointmentId: string
  onScheduled: (scheduled: Scheduled) => void
}) {
  const [weekStart, setWeekStart] = useState<string | null>(null)
  const [branchName, setBranchName] = useState('')
  const [days, setDays] = useState<ConsultaSeguimientoAgendaDay[]>([])
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [slots, setSlots] = useState<ConsultaSeguimientoAgendaSlot[]>([])
  const [closed, setClosed] = useState(false)
  const [loadingWeek, setLoadingWeek] = useState(true)
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [pendingTime, setPendingTime] = useState<string | null>(null)
  const [error, setError] = useState('')

  const loadWeek = useCallback(
    async (anchor?: string, preferDate?: string | null) => {
      setLoadingWeek(true)
      setError('')
      const res = await getConsultaSeguimientoAgenda({
        eventId,
        weekStart: anchor,
        date: preferDate ?? undefined,
      })
      setLoadingWeek(false)
      if (!res.success) {
        setError(res.error)
        setDays([])
        setSlots([])
        return
      }
      setBranchName(res.branchName)
      setWeekStart(res.weekStart)
      setDays(res.days)
      const chosen =
        preferDate && res.days.some((day) => day.date === preferDate && dayIsBookable(day))
          ? preferDate
          : (res.days.find(dayIsBookable)?.date ?? null)
      setSelectedDate(chosen)
      if (res.date === chosen) {
        setClosed(res.closed)
        setSlots(res.slots)
      } else if (!chosen) {
        setClosed(false)
        setSlots([])
      }
    },
    [eventId],
  )

  const loadSlots = useCallback(
    async (date: string) => {
      setLoadingSlots(true)
      setError('')
      const res = await getConsultaSeguimientoAgenda({
        eventId,
        weekStart: weekStart ?? undefined,
        date,
      })
      setLoadingSlots(false)
      if (!res.success) {
        setError(res.error)
        setSlots([])
        return
      }
      setClosed(res.closed)
      setSlots(res.slots)
    },
    [eventId, weekStart],
  )

  useEffect(() => {
    void loadWeek()
  }, [loadWeek])

  useEffect(() => {
    if (!selectedDate) return
    void loadSlots(selectedDate)
  }, [selectedDate, loadSlots])

  async function chooseSlot(time: string) {
    if (!selectedDate || readonly) return
    setPendingTime(time)
    setError('')
    try {
      const res = await scheduleConsultaSeguimiento({
        eventId,
        eventTestId,
        workerId,
        date: selectedDate,
        time,
        existingAppointmentId,
      })
      if (!res.success) {
        setError(res.error)
        return
      }
      onScheduled(res)
      await loadSlots(selectedDate)
    } finally {
      setPendingTime(null)
    }
  }

  return (
    <section className="space-y-3 bg-white border border-slate-200 rounded-xl p-4">
      <div>
        <p className="text-[10px] font-semibold text-slate-500">Consulta de seguimiento</p>
        <p className="text-xs text-slate-500 mt-1">
          Horarios con cupo de {branchName || 'la sucursal'}, los mismos de Gestión de citas.
        </p>
      </div>

      {scheduledLabel ? (
        <p className="text-sm font-semibold text-teal-800 bg-teal-50 border border-teal-100 rounded-lg px-3 py-2">
          Agendada: {scheduledLabel}
        </p>
      ) : (
        <p className="text-xs text-slate-500">Elige un día y un horario disponible.</p>
      )}

      {error ? <p className="text-xs text-red-600">{error}</p> : null}

      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          className="text-xs font-bold text-slate-600 px-2 py-1"
          disabled={!weekStart || loadingWeek}
          onClick={() => weekStart && void loadWeek(addAgendaDays(weekStart, -7), selectedDate)}
        >
          Semana anterior
        </button>
        <button
          type="button"
          className="text-xs font-bold text-teal-700 px-2 py-1"
          disabled={loadingWeek}
          onClick={() => void loadWeek(undefined, selectedDate)}
        >
          Esta semana
        </button>
        <button
          type="button"
          className="text-xs font-bold text-slate-600 px-2 py-1"
          disabled={!weekStart || loadingWeek}
          onClick={() => weekStart && void loadWeek(addAgendaDays(weekStart, 7), selectedDate)}
        >
          Semana siguiente
        </button>
      </div>

      {loadingWeek ? (
        <p className="text-xs text-slate-500">Cargando agenda…</p>
      ) : (
        <div className="grid grid-cols-7 gap-1">
          {days.map((day) => {
            const bits = dayBits(day.date)
            const bookable = dayIsBookable(day)
            const selected = day.date === selectedDate
            return (
              <button
                key={day.date}
                type="button"
                disabled={!bookable || readonly}
                onClick={() => setSelectedDate(day.date)}
                className={`rounded-lg border px-1 py-2 text-center disabled:opacity-40 ${
                  selected
                    ? 'border-teal-400 bg-teal-50'
                    : bookable
                      ? 'border-slate-200 bg-white hover:border-teal-200'
                      : 'border-slate-100 bg-slate-50'
                }`}
              >
                <span className="block text-[10px] text-slate-500">{bits.weekday}</span>
                <span className="block text-sm font-bold text-slate-800">{bits.number}</span>
                <span className="block text-[10px] text-slate-500">
                  {day.status === 'past'
                    ? 'Pasado'
                    : bookable
                      ? `${day.openHourSlots} horario${day.openHourSlots === 1 ? '' : 's'}`
                      : 'Sin cupo'}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {selectedDate && !loadingWeek && (
        <div className="space-y-2">
          <p className="text-[10px] font-semibold text-slate-500">Horarios disponibles</p>
          {loadingSlots ? (
            <p className="text-xs text-slate-500">Cargando horarios…</p>
          ) : closed ? (
            <p className="text-xs text-slate-500">La sucursal no atiende ese día.</p>
          ) : slots.length === 0 ? (
            <p className="text-xs text-slate-500">No quedan horarios con cupo en ese día.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {slots.map((slot) => {
                const libres = slot.capacity - slot.count
                const busy = pendingTime === slot.time
                return (
                  <button
                    key={slot.time}
                    type="button"
                    disabled={readonly || pendingTime !== null}
                    onClick={() => void chooseSlot(slot.time)}
                    className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-left hover:bg-teal-100 disabled:opacity-50"
                  >
                    <span className="block text-sm font-bold text-teal-900">
                      {busy ? 'Agendando…' : slot.time}
                    </span>
                    <span className="block text-[10px] text-teal-700">
                      {libres} {libres === 1 ? 'lugar' : 'lugares'}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
