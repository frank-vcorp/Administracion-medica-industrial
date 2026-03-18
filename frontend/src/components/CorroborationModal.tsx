'use client'
/**
 * Modal de Corroboración de Datos antes del Check-In.
 * Muestra datos del trabajador, permite actualizar contacto seguro,
 * y solo crea el MedicalEvent al confirmar.
 * @id IMPL-20260318-08
 */

import { useState, useTransition } from 'react'
import { updateWorkerContactData } from '@/actions/worker.actions'
import { checkInAppointment } from '@/actions/appointment.actions'
import { useRouter } from 'next/navigation'

interface WorkerData {
    id: string
    firstName: string
    lastName: string
    universalId: string | null
    phone: string | null
    email: string | null
    dob: Date | null
    company: { id: string; name: string } | null
    jobPosition: { id: string; name: string } | null
}

interface AppointmentData {
    id: string
    expedientId: string | null
    scheduledAt: Date | string
    worker: WorkerData
    company: { id: string; name: string } | null
    branch: { id: string; name: string } | null
}

interface Props {
    appointment: AppointmentData
    onClose: () => void
}

export default function CorroborationModal({ appointment, onClose }: Props) {
    const [isPending, startTransition] = useTransition()
    const [error, setError] = useState<string | null>(null)
    const [phone, setPhone] = useState(appointment.worker.phone || '')
    const [email, setEmail] = useState(appointment.worker.email || '')
    const router = useRouter()

    const worker = appointment.worker
    const scheduled = new Date(appointment.scheduledAt)

    function handleConfirm() {
        setError(null)
        startTransition(async () => {
            // 1. Actualizar datos de contacto si cambiaron
            const phoneChanged = phone !== (worker.phone || '')
            const emailChanged = email !== (worker.email || '')

            if (phoneChanged || emailChanged) {
                const updateResult = await updateWorkerContactData(worker.id, {
                    phone: phone || undefined,
                    email: email || undefined,
                })
                if (!updateResult.success) {
                    setError(updateResult.error || 'Error al actualizar datos')
                    return
                }
            }

            // 2. Solo ahora se crea el MedicalEvent
            const checkInResult = await checkInAppointment(appointment.id)
            if (checkInResult.success) {
                onClose()
                router.push(`/events/${checkInResult.medicalEvent?.id}`)
            } else {
                setError(checkInResult.error || 'Error en el check-in')
            }
        })
    }

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden">
                {/* Header */}
                <div className="bg-amber-500 px-8 py-6 text-white">
                    <div className="flex items-center gap-3">
                        <span className="text-3xl">📋</span>
                        <div>
                            <h2 className="text-lg font-black">Corroboración de Datos</h2>
                            <p className="text-amber-100 text-xs font-medium">Confirma antes de procesar el ingreso</p>
                        </div>
                    </div>
                </div>

                <div className="p-8 space-y-6">
                    {/* Identificación del trabajador */}
                    <section className="bg-slate-50 rounded-2xl p-5 space-y-3 border border-slate-100">
                        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Trabajador</p>
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">
                                👤
                            </div>
                            <div>
                                <p className="font-black text-slate-800 text-lg leading-tight">
                                    {worker.firstName} {worker.lastName}
                                </p>
                                {worker.universalId && (
                                    <p className="text-xs font-mono text-slate-500 mt-0.5">ID: {worker.universalId}</p>
                                )}
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200">
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase">Empresa</p>
                                <p className="text-sm font-medium text-slate-700">{worker.company?.name || '—'}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase">Puesto</p>
                                <p className="text-sm font-medium text-slate-700">{worker.jobPosition?.name || '—'}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase">Expediente</p>
                                <p className="text-sm font-mono font-bold text-slate-700">{appointment.expedientId || '—'}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase">Hora Cita</p>
                                <p className="text-sm font-medium text-slate-700">
                                    {scheduled.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* Datos actualizables */}
                    <section className="space-y-4">
                        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">
                            Contacto — puedes actualizar ahora
                        </p>
                        <div>
                            <label className="text-xs font-bold text-slate-500 block mb-1">Teléfono Celular</label>
                            <input
                                type="tel"
                                value={phone}
                                onChange={e => setPhone(e.target.value)}
                                placeholder="10 dígitos"
                                className="w-full bg-slate-50 ring-1 ring-slate-200 focus:ring-2 focus:ring-amber-400 border-none p-3 rounded-xl text-sm outline-none"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 block mb-1">Correo Electrónico</label>
                            <input
                                type="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                placeholder="correo@ejemplo.com"
                                className="w-full bg-slate-50 ring-1 ring-slate-200 focus:ring-2 focus:ring-amber-400 border-none p-3 rounded-xl text-sm outline-none"
                            />
                        </div>
                    </section>

                    {error && (
                        <p className="text-xs text-red-600 bg-red-50 p-3 rounded-xl border border-red-100 font-medium">
                            ⚠️ {error}
                        </p>
                    )}

                    {/* Acciones */}
                    <div className="flex gap-3 pt-2">
                        <button
                            onClick={onClose}
                            disabled={isPending}
                            className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 py-3 rounded-2xl font-bold text-sm transition-all disabled:opacity-50"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleConfirm}
                            disabled={isPending}
                            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-2xl font-black text-sm transition-all shadow-lg shadow-emerald-100 disabled:opacity-50"
                        >
                            {isPending ? '⏳ Procesando...' : '✅ Confirmar y Hacer Check-In'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
