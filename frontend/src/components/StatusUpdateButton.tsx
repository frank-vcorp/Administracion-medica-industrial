'use client'

import { useState, useTransition } from 'react'
import { updateEventStatus } from '@/actions/event.actions'
import { useRouter } from 'next/navigation'

export default function StatusUpdateButton({ eventId, nextStatus }: { eventId: string, nextStatus: 'IN_PROGRESS' | 'VALIDATING' }) {
    const [isPending, startTransition] = useTransition()
    const [error, setError] = useState<boolean>(false)
    const router = useRouter()

    const handleClick = (e: React.FormEvent) => {
        e.preventDefault()
        setError(false)
        
        startTransition(async () => {
            try {
                const result = await updateEventStatus(eventId, nextStatus)
                if (!result.success) {
                    setError(true)
                    // Auto-hide error after 3 seconds
                    setTimeout(() => setError(false), 3000)
                } else {
                    router.refresh()
                }
            } catch (err) {
                setError(true)
                setTimeout(() => setError(false), 3000)
            }
        })
    }

    return (
        <div className="relative">
            <button 
                onClick={handleClick}
                disabled={isPending}
                className={`text-[10px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-1 hover:gap-2 transition-all bg-emerald-50 px-2 py-1 rounded-md hover:bg-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed`}
            >
                {isPending ? 'Moviendo...' : (nextStatus === 'IN_PROGRESS' ? 'A Consultorio' : 'A Validar')} <span className="text-xs">→</span>
            </button>
            
            {error && (
                <div className="absolute top-full right-0 mt-1 bg-red-100 text-red-600 text-[9px] font-bold px-2 py-1 rounded shadow-lg whitespace-nowrap z-50 animate-in fade-in slide-in-from-top-1">
                    ⚠️ Error al mover
                </div>
            )}
        </div>
    )
}
