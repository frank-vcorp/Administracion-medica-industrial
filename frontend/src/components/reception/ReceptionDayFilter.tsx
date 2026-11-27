'use client'

import { todayAgendaDateString } from '@/lib/appointment-scheduling'
import { useRouter } from 'next/navigation'
import { Calendar } from 'lucide-react'

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
            <div className="bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-sm flex items-center gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#592c82]/15 text-[#592c82]" aria-hidden="true">
                    <Calendar className="h-3.5 w-3.5" strokeWidth={2.25} />
                </span>
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
