'use client'

import { useState, useTransition, useEffect } from 'react'
import { createCompany, getBranches } from '@/actions/admin.actions'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function CompanyFormModal() {
    const [isOpen, setIsOpen] = useState(false)
    const [isPending, startTransition] = useTransition()
    const [successData, setSuccessData] = useState<{ success: boolean, company?: { id: string, name: string } } | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [branches, setBranches] = useState<{ id: string, name: string }[]>([])
    const router = useRouter()

    useEffect(() => {
        if (isOpen) {
            getBranches().then(data => setBranches(data))
        }
    }, [isOpen])

    async function handleSubmit(formData: FormData) {
        startTransition(async () => {
            setError(null)
            try {
                const result = await createCompany(formData) as { success: boolean, company?: { id: string, name: string }, error?: string }
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
                    <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto text-4xl animate-bounce">
                        🏢
                    </div>
                    <div>
                        <h3 className="text-2xl font-black text-slate-800">¡Empresa Registrada!</h3>
                        <p className="text-slate-500 mt-2 text-sm font-medium">El convenio ha sido creado exitosamente.</p>
                    </div>
                    <div className="space-y-3 pt-2">
                        <Link
                            href="/workers"
                            className="block w-full bg-slate-900 hover:bg-black text-white py-3 rounded-xl font-bold transition-all hover:scale-[1.02]"
                        >
                            ➕ Registrar Trabajadores
                        </Link>
                        <button
                            onClick={() => { setSuccessData(null); setIsOpen(false); }}
                            className="block w-full bg-slate-100 hover:bg-slate-200 text-slate-600 py-3 rounded-xl font-bold transition-all"
                        >
                            Ver Directorio
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
                <span className="text-lg">+</span> Nueva Empresa
            </button>

            {isOpen && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
                    <div className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-md border border-slate-100 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-2 bg-indigo-500"></div>

                        <div className="flex justify-between items-center mb-8">
                            <div>
                                <h3 className="text-xl font-black text-slate-800">Registrar Convenio</h3>
                                <p className="text-[10px] text-slate-400 uppercase font-extrabold tracking-widest mt-1">Nuevo Cliente Corporativo</p>
                            </div>
                            <button onClick={() => setIsOpen(false)} className="text-slate-300 hover:text-red-500 transition-colors p-2 hover:bg-red-50 rounded-full">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
                            </button>
                        </div>

                        <form action={handleSubmit} className="space-y-5">
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Razón Social</label>
                                <input name="name" placeholder="Ej: Aceros del Norte S.A." required className="w-full bg-slate-50 border-none ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500 p-3.5 rounded-xl text-sm transition-all outline-none" />
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">RFC / Tax ID</label>
                                <input name="rfc" placeholder="ABC010101XYZ" required className="w-full bg-slate-50 border-none ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500 p-3.5 rounded-xl text-sm transition-all outline-none uppercase font-mono" />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Contacto</label>
                                    <input name="contactName" placeholder="Nombre" className="w-full bg-slate-50 border-none ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500 p-3.5 rounded-xl text-sm transition-all outline-none" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Email</label>
                                    <input name="email" placeholder="email@ejemplo.com" type="email" className="w-full bg-slate-50 border-none ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500 p-3.5 rounded-xl text-sm transition-all outline-none" />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Sucursal Predeterminada</label>
                                <select name="defaultBranchId" className="w-full bg-slate-50 border-none ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500 p-3.5 rounded-xl text-sm transition-all outline-none">
                                    <option value="">Seleccionar Sucursal...</option>
                                    {branches.map(b => (
                                        <option key={b.id} value={b.id}>{b.name}</option>
                                    ))}
                                </select>
                            </div>

                            {error && <p className="text-xs text-red-500 font-bold bg-red-50 p-3 rounded-lg border border-red-100 animate-shake">⚠️ {error}</p>}

                            <button
                                type="submit"
                                disabled={isPending}
                                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-2xl font-black shadow-lg shadow-indigo-100 transition-all hover:scale-[1.01] active:scale-95 disabled:opacity-50 mt-4"
                            >
                                {isPending ? 'Procesando...' : 'Guardar y Continuar →'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </>
    )
}
