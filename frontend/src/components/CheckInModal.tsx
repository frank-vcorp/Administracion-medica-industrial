'use client'

import { useState, useTransition } from 'react'
import { createEvent } from '@/actions/event.actions'

interface Worker {
    id: string
    firstName: string
    lastName: string
    company?: { name: string } | null
}

export default function CheckInModal({ workers }: { workers: Worker[] }) {
    const [open, setOpen] = useState(false)
    const [isPending, startTransition] = useTransition()
    const [error, setError] = useState<string | null>(null)

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setError(null)
        const formData = new FormData(e.currentTarget)
        const workerId = formData.get('workerId') as string

        if (!workerId) {
            setError('Selecciona un trabajador')
            return
        }

        startTransition(async () => {
            const result = await createEvent(formData)
            if (result.success) {
                setOpen(false)
            } else {
                setError(result.error || 'Error al crear el expediente')
            }
        })
    }

    return (
        <>
            <button
                onClick={() => setOpen(true)}
                className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors shadow flex items-center gap-2"
            >
                <span>➕</span> Nueva Cita / Ingreso
            </button>

            {open && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
                    <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-md">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold">Ingreso de Paciente</h3>
                            <button
                                onClick={() => setOpen(false)}
                                className="text-slate-400 hover:text-red-500 font-bold"
                            >
                                ✕
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500 block mb-1">
                                    Seleccionar Trabajador
                                </label>
                                <select
                                    name="workerId"
                                    required
                                    className="w-full border p-2 rounded bg-white"
                                >
                                    <option value="">Buscar por nombre...</option>
                                    {workers.map(w => (
                                        <option key={w.id} value={w.id}>
                                            {w.firstName} {w.lastName} ({w.company?.name || 'Sin Empresa'})
                                        </option>
                                    ))}
                                </select>
                                <p className="text-[10px] text-slate-400 mt-1">
                                    * Si no aparece, regístralo primero en módulo de Trabajadores.
                                </p>
                            </div>

                            <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                                <h4 className="text-sm font-bold text-blue-800 mb-1">Detalles de Visita</h4>
                                <p className="text-xs text-blue-600">
                                    Se registrará el Check-In en la sucursal actual automáticamente.
                                </p>
                            </div>

                            {error && (
                                <div className="bg-red-50 text-red-700 p-2 rounded text-sm border border-red-200">
                                    ⚠️ {error}
                                </div>
                            )}

                            <div className="flex justify-end pt-4">
                                <button
                                    type="submit"
                                    disabled={isPending}
                                    className="bg-slate-900 text-white px-4 py-2 rounded shadow hover:bg-slate-800 font-medium w-full disabled:opacity-50 disabled:cursor-wait"
                                >
                                    {isPending ? '⏳ Registrando...' : 'Confirmar Check-In 🏥'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    )
}
