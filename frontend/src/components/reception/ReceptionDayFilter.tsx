'use client'

import { todayAgendaDateString } from '@/lib/appointment-scheduling'
import { useRouter } from 'next/navigation'

interface Props {
    selectedDate: string
}

export default function ReceptionDayFilter({ selectedDate }: Props) {
    const router = useRouter()

    function handleDateChange(value: string) {
        if (!value) return
        router.replace(`/reception?date=${value}`)
    }

    function goToToday() {
        router.replace(`/reception?date=${todayAgendaDateString()}`)
    }

    const isToday = selectedDate === todayAgendaDateString()

    return (
        <div className="flex items-center gap-2 flex-wrap">
            <div className="bg-white border border-slate-200 px-4 py-2 rounded-xl shadow-sm flex items-center gap-2">
                <span className="text-slate-400" aria-hidden="true">📅</span>
                <label htmlFor="reception-day-filter" className="sr-only">Día del flujo clínico</label>
                <input
                    id="reception-day-filter"
                    type="date"
                    value={selectedDate}
                    onChange={(e) => handleDateChange(e.target.value)}
                    className="bg-transparent border-none outline-none text-sm font-bold text-slate-600 cursor-pointer"
                />
            </div>
            {!isToday && (
                <button
                    type="button"
                    onClick={goToToday}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-2 rounded-xl text-xs font-bold transition-colors"
                >
                    Hoy
                </button>
            )}
        </div>
    )
}
