'use client'

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
        const now = new Date()
        const y = now.getFullYear()
        const m = String(now.getMonth() + 1).padStart(2, '0')
        const d = String(now.getDate()).padStart(2, '0')
        router.replace(`/reception?date=${y}-${m}-${d}`)
    }

    const isToday = selectedDate === (() => {
        const now = new Date()
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    })()

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
