'use client'
/**
 * Modal de Corroboración de Identidad antes del Check-In.
 * Permite corregir nombre completo contra INE presentada, muestra fecha de nacimiento
 * para contraste operativo, y solo crea el MedicalEvent al confirmar.
 * Contacto (teléfono/correo) queda como bloque secundario.
 * @id IMPL-20260514-01
 * @spec context/SPECs/SPEC_ARCH-20260514-01-ALINEACION-CORROBORACION-NOMBRE-INE.md
 */

import { useState, useTransition } from 'react'
import { updateWorkerContactData, updateWorkerCorroboratedName } from '@/actions/worker.actions'
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
    const [corroboratedFirstName, setCorroboratedFirstName] = useState(appointment.worker.firstName)
    const [corroboratedLastName, setCorroboratedLastName] = useState(appointment.worker.lastName)
    const [phone, setPhone] = useState(appointment.worker.phone || '')
    const [email, setEmail] = useState(appointment.worker.email || '')
    const router = useRouter()

    const worker = appointment.worker
    const scheduled = new Date(appointment.scheduledAt)

    const nameChanged =
        corroboratedFirstName.trim() !== worker.firstName ||
        corroboratedLastName.trim() !== worker.lastName

    function handleConfirm() {
        setError(null)
        startTransition(async () => {
            // 1. Corregir nombre si hay cambio (identidad primero)
            if (nameChanged) {
                const nameResult = await updateWorkerCorroboratedName(worker.id, {
                    firstName: corroboratedFirstName,
                    lastName: corroboratedLastName,
                })
                if (!nameResult.success) {
                    setError(nameResult.error || 'Error al corregir el nombre')
                    return
                }
            }

            // 2. Actualizar datos de contacto si cambiaron (secundario)
            const phoneChanged = phone !== (worker.phone || '')
            const emailChanged = email !== (worker.email || '')

            if (phoneChanged || emailChanged) {
                const updateResult = await updateWorkerContactData(worker.id, {
                    phone: phone || undefined,
                    email: email || undefined,
                })
                if (!updateResult.success) {
                    setError(updateResult.error || 'Error al actualizar datos de contacto')
                    return
                }
            }

            // 3. Solo ahora se crea el MedicalEvent
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
                        <span className="text-3xl">🪪</span>
                        <div>
                            <h2 className="text-lg font-black">Corroboración de Identidad</h2>
                            <p className="text-amber-100 text-xs font-medium">Corrobora contra identificación presentada antes de procesar el ingreso</p>
                        </div>
                    </div>
                </div>

                <div className="p-8 space-y-6">
                    {/* Datos del evento */}
                    <section className="bg-slate-50 rounded-2xl p-5 space-y-3 border border-slate-100">
                        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Evento</p>
                        <div className="grid grid-cols-2 gap-3">
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

                    {/* Bloque principal: corroboración de identidad */}
                    <section className="space-y-4">
                        <div className="flex items-center justify-between">
                            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">
                                Identidad — corrobora contra INE presentada
                            </p>
                            {nameChanged && (
                                <span className="text-[10px] bg-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded-full">
                                    ✏️ Nombre modificado
                                </span>
                            )}
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 block mb-1">Nombre(s)</label>
                            <input
                                type="text"
                                value={corroboratedFirstName}
                                onChange={e => setCorroboratedFirstName(e.target.value)}
                                placeholder="Nombre(s) según INE"
                                className="w-full bg-slate-50 ring-1 ring-slate-200 focus:ring-2 focus:ring-amber-400 border-none p-3 rounded-xl text-sm outline-none"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 block mb-1">Apellidos</label>
                            <input
                                type="text"
                                value={corroboratedLastName}
                                onChange={e => setCorroboratedLastName(e.target.value)}
                                placeholder="Apellidos según INE"
                                className="w-full bg-slate-50 ring-1 ring-slate-200 focus:ring-2 focus:ring-amber-400 border-none p-3 rounded-xl text-sm outline-none"
                            />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Fecha de Nacimiento</p>
                            <p className="text-sm font-medium text-slate-700 bg-slate-100 p-3 rounded-xl ring-1 ring-slate-200">
                                {worker.dob
                                    ? new Date(worker.dob).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })
                                    : '— sin registro'}
                            </p>
                        </div>
                        {worker.universalId && (
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">ID Universal</p>
                                <p className="text-xs font-mono text-slate-500 bg-slate-100 p-2 rounded-lg ring-1 ring-slate-200">{worker.universalId}</p>
                            </div>
                        )}
                    </section>

                    {/* Bloque secundario: contacto */}
                    <section className="space-y-3 border-t border-slate-100 pt-4">
                        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">
                            Contacto — opcional, no es el objetivo principal
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs font-bold text-slate-500 block mb-1">Teléfono</label>
                                <input
                                    type="tel"
                                    value={phone}
                                    onChange={e => setPhone(e.target.value)}
                                    placeholder="10 dígitos"
                                    className="w-full bg-slate-50 ring-1 ring-slate-200 focus:ring-2 focus:ring-amber-400 border-none p-2.5 rounded-xl text-sm outline-none"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 block mb-1">Correo</label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    placeholder="correo@ejemplo.com"
                                    className="w-full bg-slate-50 ring-1 ring-slate-200 focus:ring-2 focus:ring-amber-400 border-none p-2.5 rounded-xl text-sm outline-none"
                                />
                            </div>
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
