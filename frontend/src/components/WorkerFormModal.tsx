'use client'

import { useState, useTransition } from 'react'
import { createWorker } from '@/actions/worker.actions'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

import { EVENTS, OpenAppointmentModalDetail } from '@/types/events'

interface Worker {
    id: string
    firstName: string
    lastName: string
    company?: { id: string, defaultBranchId: string | null } | null
}

export default function WorkerFormModal({ companies }: { companies: { id: string, name: string }[] }) {
    const [isOpen, setIsOpen] = useState(false)
    const [isPending, startTransition] = useTransition()
    const [successData, setSuccessData] = useState<{ success: boolean, worker?: Worker } | null>(null)
    const [error, setError] = useState<string | null>(null)
    const router = useRouter()

    async function handleSubmit(formData: FormData) {
        startTransition(async () => {
            setError(null)
            try {
                const result = await createWorker(formData) as { success: boolean, worker?: Worker, error?: string }
                if (result.success) {
                    setSuccessData(result)
                    router.refresh()
                } else {
                    setError(result.error || 'Error al guardar')
                }
            } catch {
                setError('Error de conexión')
            }
        })
    }

    if (successData) {
        return (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-in fade-in duration-300">
                <div className="bg-white p-8 rounded-[2rem] shadow-2xl max-w-sm w-full text-center space-y-6">
                    <div className="w-20 h-20 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto text-4xl animate-bounce">
                        👤
                    </div>
                    <div>
                        <h3 className="text-2xl font-black text-slate-800">¡Trabajador Listo!</h3>
                        <p className="text-slate-500 mt-2 text-sm font-medium">El registro se completó correctamente.</p>
                    </div>
                    <div className="space-y-3 pt-2">
                        <div className="flex gap-2">
                            <button
                                onClick={() => {
                                    setSuccessData(null)
                                    setIsOpen(false)
                                    // Use router navigation with query params for cross-page modal triggering
                                    const params = new URLSearchParams();
                                    params.set('action', 'new-appointment');
                                    if (successData.worker?.id) params.set('workerId', successData.worker.id);
                                    if (successData.worker?.company?.defaultBranchId) params.set('branchId', successData.worker.company.defaultBranchId);
                                    
                                    // Also dispatch local event in case we are already on the page
                                    const event = new CustomEvent<OpenAppointmentModalDetail>(EVENTS.OPEN_APPOINTMENT_MODAL, { 
                                        detail: { 
                                            workerId: successData.worker?.id,
                                            branchId: successData.worker?.company?.defaultBranchId || undefined
                                        } 
                                    })
                                    window.dispatchEvent(event)
                                    
                                    // Navigate to appointments page
                                    router.push(`/appointments?${params.toString()}`);
                                }}
                                className="block w-full bg-slate-900 hover:bg-black text-white py-3 rounded-xl font-bold transition-all hover:scale-[1.02]"
                            >
                                🗓️ Agendar Consulta Aquí
                            </button>
                        </div>
                        <button
                            onClick={() => { setSuccessData(null); setIsOpen(false); }}
                            className="block w-full bg-slate-100 hover:bg-slate-200 text-slate-600 py-3 rounded-xl font-bold transition-all"
                        >
                            Ver Padrón
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className="bg-slate-900 hover:bg-black text-white px-6 py-3 rounded-xl text-sm font-bold transition-all shadow-lg shadow-slate-200 flex items-center gap-2"
            >
                <span className="text-lg">+</span> Registrar Trabajador
            </button>

            {isOpen && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
                    <div className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-md border border-slate-100 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-2 bg-blue-500"></div>

                        <div className="flex justify-between items-center mb-8">
                            <div>
                                <h3 className="text-xl font-black text-slate-800">Nuevo Trabajador</h3>
                                <p className="text-[10px] text-slate-400 uppercase font-extrabold tracking-widest mt-1">Alta en Padron AMI</p>
                            </div>
                            <button onClick={() => setIsOpen(false)} className="text-slate-300 hover:text-red-500 transition-colors p-2 hover:bg-red-50 rounded-full">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
                            </button>
                        </div>

                        <form action={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Nombre(s)</label>
                                    <input name="firstName" placeholder="Nombre" required className="w-full bg-slate-50 border-none ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500 p-3 rounded-xl text-sm outline-none" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Apellidos (Paterno Materno)</label>
                                    <input name="lastName" placeholder="Apellidos" required className="w-full bg-slate-50 border-none ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500 p-3 rounded-xl text-sm outline-none" />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Fecha de Nacimiento</label>
                                    <input name="dob" type="date" required className="w-full bg-slate-50 border-none ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500 p-3 rounded-xl text-sm outline-none" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Género</label>
                                    <select name="gender" required className="w-full bg-slate-50 border-none ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500 p-3 rounded-xl text-sm outline-none appearance-none">
                                        <option value="M">Masculino</option>
                                        <option value="F">Femenino</option>
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Empresa</label>
                                <select name="companyId" className="w-full bg-slate-50 border-none ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500 p-3 rounded-xl text-sm outline-none appearance-none">
                                    <option value="">-- Seleccionar Empresa --</option>
                                    {companies.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Email</label>
                                    <input name="email" placeholder="email@ejemplo.com" type="email" className="w-full bg-slate-50 border-none ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500 p-3 rounded-xl text-sm outline-none" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Teléfono</label>
                                    <input name="phone" placeholder="10 digitos" className="w-full bg-slate-50 border-none ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500 p-3 rounded-xl text-sm outline-none" />
                                </div>
                            </div>

                            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs">🆔</div>
                                    <div>
                                        <p className="text-[10px] font-black text-blue-600 uppercase">Seguridad AMI</p>
                                        <p className="text-[9px] text-blue-400 font-bold uppercase tracking-tighter">ID Universal se generará automáticamente</p>
                                    </div>
                                </div>
                            </div>

                            {error && <p className="text-xs text-red-500 font-bold bg-red-50 p-3 rounded-lg border border-red-100 italic">⚠️ {error}</p>}

                            <button
                                type="submit"
                                disabled={isPending}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl font-black shadow-lg shadow-blue-100 transition-all hover:scale-[1.01] active:scale-95 disabled:opacity-50 mt-4"
                            >
                                {isPending ? 'Procesando...' : 'Guardar Trabajador'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </>
    )
}
