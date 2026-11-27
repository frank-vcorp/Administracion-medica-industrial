'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { getAppointmentsForWeek } from '@/actions/appointment.actions'
import {
  addAgendaDays,
  AMI_APPOINTMENT_TIMEZONE,
  formatAppointmentAgendaDateString,
  formatAppointmentAgendaTime,
  getAgendaWeekStartMonday,
  parseAppointmentLocalDateTime,
  todayAgendaDateString,
} from '@/lib/appointment-scheduling'
import { ChevronLeft, ChevronRight, X, Building2, Calendar, User, Clock, CheckCircle2 } from 'lucide-react'

const AGENDA_SLOT_STATUSES = new Set(['SCHEDULED', 'CONFIRMED', 'COMPLETED', 'IN_PROGRESS'])

type WeekAppointment = {
  id: string
  scheduledAt: Date | string
  status: string
  expedientId: string | null
  worker: { firstName: string; lastName: string }
  company: { name: string } | null
  branch?: { id: string; name: string } | null
  medicalEvents?: { id: string; status: string }[]
}

function appointmentLocalDateString(scheduledAt: Date | string): string {
  return formatAppointmentAgendaDateString(scheduledAt)
}

function formatWeekRangeLabel(weekStart: string): string {
  const weekEnd = addAgendaDays(weekStart, 6)
  const start = parseAppointmentLocalDateTime(weekStart, '12:00')
  const end = parseAppointmentLocalDateTime(weekEnd, '12:00')
  const startYear = formatAppointmentAgendaDateString(start).slice(0, 4)
  const endYear = formatAppointmentAgendaDateString(end).slice(0, 4)
  const startLabel = start.toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
    timeZone: AMI_APPOINTMENT_TIMEZONE,
  })
  const endLabel = end.toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
    year: startYear === endYear ? undefined : 'numeric',
    timeZone: AMI_APPOINTMENT_TIMEZONE,
  })
  return `${startLabel} – ${endLabel}`
}

const DAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

export function WeeklyAppointmentsModal({
  open,
  onClose,
  anchorDate,
  branchId,
  branchName,
  branches = [],
  onSelectDate,
}: {
  open: boolean
  onClose: () => void
  anchorDate: string
  branchId: string
  branchName?: string
  branches?: { id: string; name: string }[]
  onSelectDate?: (date: string) => void
}) {
  const [weekStart, setWeekStart] = useState(() => getAgendaWeekStartMonday(anchorDate))
  const [selectedBranchId, setSelectedBranchId] = useState<string>(() => branchId || 'ALL')
  const [appointments, setAppointments] = useState<WeekAppointment[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (branchId) {
      setSelectedBranchId(branchId)
    }
  }, [branchId])

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addAgendaDays(weekStart, i)),
    [weekStart],
  )

  const loadWeek = useCallback(async () => {
    setLoading(true)
    setError(null)
    const res = await getAppointmentsForWeek(weekStart, selectedBranchId)
    setLoading(false)
    if (!res.success) {
      setAppointments([])
      setError(res.error ?? 'No se pudo cargar la semana')
      return
    }
    setAppointments((res.appointments ?? []) as WeekAppointment[])
  }, [weekStart, selectedBranchId])

  useEffect(() => {
    if (!open) return
    setWeekStart(getAgendaWeekStartMonday(anchorDate))
  }, [open, anchorDate])

  useEffect(() => {
    if (!open) return
    void loadWeek()
  }, [open, selectedBranchId, loadWeek])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, onClose])

  const byDay = useMemo(() => {
    const map: Record<string, WeekAppointment[]> = Object.fromEntries(
      weekDays.map((d) => [d, []]),
    )
    for (const apt of appointments) {
      if (!AGENDA_SLOT_STATUSES.has(apt.status)) continue
      const day = appointmentLocalDateString(apt.scheduledAt)
      if (map[day]) map[day].push(apt)
    }
    return map
  }, [appointments, weekDays])

  if (!open) return null

  const todayStr = todayAgendaDateString()
  const activeBranchName =
    selectedBranchId === 'ALL'
      ? 'Todas las sucursales'
      : branches.find((b) => b.id === selectedBranchId)?.name || branchName || 'Sucursal'

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4 animate-in fade-in">
      <button
        type="button"
        aria-label="Cerrar vista semanal"
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Calendario semanal de citas"
        className="relative flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-t-3xl border border-slate-200 bg-white shadow-2xl sm:rounded-3xl"
      >
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-4 border-b border-slate-100 bg-slate-50/80 px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#592c82]/15 text-[#592c82]">
              <Calendar className="h-4 w-4" strokeWidth={2.25} />
            </span>
            <div>
              <p className="text-[10px] font-bold tracking-widest text-violet-700 uppercase">
                Vista semanal
              </p>
              <h2 className="text-xl font-black text-slate-800">Calendario de citas</h2>
              <p className="text-xs text-slate-500">
                <span className="font-semibold text-slate-700">{activeBranchName}</span> · Semana del {formatWeekRangeLabel(weekStart)}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {branches.length > 0 && (
              <div className="flex items-center gap-1.5 bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-xs">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#592c82]/10 text-[#592c82]">
                  <Building2 className="h-3.5 w-3.5" strokeWidth={2.25} />
                </span>
                <select
                  value={selectedBranchId}
                  onChange={(e) => setSelectedBranchId(e.target.value)}
                  className="bg-transparent border-none text-xs font-bold text-slate-700 outline-none cursor-pointer"
                >
                  <option value="ALL">Todas las sucursales</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex items-center gap-1 bg-white border border-slate-200 p-1 rounded-xl shadow-xs">
              <button
                type="button"
                onClick={() => setWeekStart((s) => addAgendaDays(s, -7))}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-800 transition-colors"
                aria-label="Semana anterior"
                title="Semana anterior"
              >
                <ChevronLeft className="h-4 w-4" strokeWidth={2.25} />
              </button>
              <button
                type="button"
                onClick={() => setWeekStart(getAgendaWeekStartMonday(todayAgendaDateString()))}
                className="px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Hoy
              </button>
              <button
                type="button"
                onClick={() => setWeekStart((s) => addAgendaDays(s, 7))}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-800 transition-colors"
                aria-label="Semana siguiente"
                title="Semana siguiente"
              >
                <ChevronRight className="h-4 w-4" strokeWidth={2.25} />
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700 transition-colors"
              aria-label="Cerrar"
            >
              <X className="h-4 w-4" strokeWidth={2.25} />
            </button>
          </div>
        </div>

        {loading && (
          <div className="flex flex-1 items-center justify-center gap-3 py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-600 border-t-transparent" />
            <span className="text-sm font-medium text-slate-500">Cargando semana…</span>
          </div>
        )}

        {!loading && error && (
          <div className="p-6 text-center">
            <p className="text-sm font-medium text-red-600">{error}</p>
            <button
              type="button"
              onClick={() => void loadWeek()}
              className="mt-3 text-sm font-bold text-violet-600 underline"
            >
              Reintentar
            </button>
          </div>
        )}

        {!loading && !error && (
          <div className="min-h-0 flex-1 overflow-auto p-4 sm:p-5">
            <div className="grid min-w-[56rem] grid-cols-7 gap-2 sm:gap-3">
              {weekDays.map((dayStr, index) => {
                const dayAppointments = byDay[dayStr] ?? []
                const [, , dayNum] = dayStr.split('-').map(Number)
                const isToday = dayStr === todayStr
                const isAnchor = dayStr === anchorDate

                return (
                  <div
                    key={dayStr}
                    className={`flex min-h-[18rem] flex-col rounded-2xl border transition-all ${
                      isToday
                        ? 'border-violet-300 bg-violet-50/50 shadow-xs'
                        : isAnchor
                          ? 'border-blue-200 bg-blue-50/40 shadow-xs'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        onSelectDate?.(dayStr)
                        onClose()
                      }}
                      className="border-b border-slate-100 px-3 py-3 text-left transition hover:bg-white/80 cursor-pointer"
                    >
                      <p className="text-[10px] font-bold tracking-wide text-slate-400">
                        {DAY_LABELS[index]}
                      </p>
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <span className="text-2xl font-black text-slate-800">{dayNum}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          dayAppointments.length > 0
                            ? 'bg-violet-100 text-violet-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          {dayAppointments.length}
                        </span>
                      </div>
                    </button>

                    <div className="flex-1 space-y-2 overflow-y-auto p-2">
                      {dayAppointments.length === 0 ? (
                        <p className="px-1 py-4 text-center text-xs italic text-slate-400">
                          Sin citas
                        </p>
                      ) : (
                        dayAppointments.map((apt) => {
                          const time = formatAppointmentAgendaTime(apt.scheduledAt)
                          const isCompleted = apt.status === 'COMPLETED'
                          return (
                            <button
                              key={apt.id}
                              type="button"
                              onClick={() => {
                                onSelectDate?.(dayStr)
                                onClose()
                              }}
                              className="w-full rounded-xl border border-slate-100 bg-white p-2.5 text-left shadow-xs transition hover:border-violet-200 hover:bg-violet-50/50 cursor-pointer group"
                            >
                              <div className="flex items-center justify-between gap-1 mb-1">
                                <span className="text-[10px] font-bold text-violet-700 flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {time}
                                </span>
                                {isCompleted ? (
                                  <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                                    <CheckCircle2 className="h-2.5 w-2.5" />
                                    Ingresado
                                  </span>
                                ) : (
                                  <span className="text-[9px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded-full">
                                    Pendiente
                                  </span>
                                )}
                              </div>
                              <p className="truncate text-xs font-bold text-slate-800 group-hover:text-violet-900">
                                {apt.worker.firstName} {apt.worker.lastName}
                              </p>
                              {apt.company?.name && (
                                <p className="truncate text-[10px] text-slate-500">
                                  {apt.company.name}
                                </p>
                              )}
                              {selectedBranchId === 'ALL' && apt.branch?.name && (
                                <p className="truncate text-[9px] text-slate-400 mt-0.5">
                                  {apt.branch.name}
                                </p>
                              )}
                            </button>
                          )
                        })
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
            <p className="mt-4 text-center text-[11px] text-slate-400">
              Clic en un día o cita para ver la agenda detallada · Esc para cerrar
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
