'use client'

import { useState, useTransition } from 'react'
import { rescheduleAppointment } from '@/actions/appointment.actions'

interface AppointmentToReschedule {
  id: string
  expedientId: string | null
  scheduledAt: Date | string
  worker: { firstName: string; lastName: string }
}

interface Props {
  appointment: AppointmentToReschedule
  onClose: () => void
  onSuccess: () => void
}

function toDateInputValue(scheduledAt: Date | string): string {
  const d = new Date(scheduledAt)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function toTimeInputValue(scheduledAt: Date | string): string {
  const d = new Date(scheduledAt)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default function RescheduleAppointmentModal({ appointment, onClose, onSuccess }: Props) {
  const [date, setDate] = useState(toDateInputValue(appointment.scheduledAt))
  const [time, setTime] = useState(toTimeInputValue(appointment.scheduledAt))
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await rescheduleAppointment(appointment.id, { date, time })
      if (result.success) {
        onSuccess()
        onClose()
      } else {
        setError(result.error || 'No se pudo reagendar')
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
              <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Nueva fecha</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full bg-slate-50 ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500 p-3 rounded-xl text-sm outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Nueva hora</label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                required
                className="w-full bg-slate-50 ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500 p-3 rounded-xl text-sm outline-none"
              />
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              ⚠️ {error}
            </p>
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
