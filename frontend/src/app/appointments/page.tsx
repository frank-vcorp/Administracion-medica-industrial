'use client'

import { useEffect, useState } from 'react'
import { getAppointments, checkInAppointment } from '@/actions/appointment.actions'
import { useRouter } from 'next/navigation'

/**
 * Vista de Agenda de Citas Premium v2.2
 * @description Implementa vista de calendario diario con expedientes EXP y QR
 */

interface AppointmentWithWorker {
    id: string;
    scheduledAt: Date;
    status: string;
    expedientId: string | null;
    qrCode: string | null;
    worker: {
        firstName: string;
        lastName: string;
        universalId: string | null;
    };
    company: { name: string } | null;
    branch: { name: string } | null;
}

export default function AppointmentsPage() {
    const [appointments, setAppointments] = useState<AppointmentWithWorker[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedApt, setSelectedApt] = useState<AppointmentWithWorker | null>(null)
    const [checkingIn, setCheckingIn] = useState<string | null>(null)
    const router = useRouter()

    const loadData = async () => {
        setLoading(true)
        const result = await getAppointments()
        if (result.success) setAppointments(result.appointments as unknown as AppointmentWithWorker[] || [])
        setLoading(false)
    }

    useEffect(() => {
        loadData()
    }, [])

    const handleCheckIn = async (id: string) => {
        setCheckingIn(id)
        const res = await checkInAppointment(id)
        if (res.success) {
            setSelectedApt(null)
            loadData()
            router.push(`/events/${res.medicalEvent?.id}`)
        }
        setCheckingIn(null)
    }

    if (loading) return (
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-slate-500 font-medium animate-pulse">Sincronizando Agenda...</p>
        </div>
    )

    return (
        <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight">Agenda de Citas</h1>
                    <p className="text-slate-500 text-sm">Panel de control de ingresos y expedientes EXP</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="bg-white border border-slate-200 px-4 py-2 rounded-xl shadow-sm text-sm font-bold text-slate-600">
                        📅 {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </div>
                </div>
            </div>

            {/* Stats Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label="Total" value={appointments.length} color="blue" />
                <StatCard label="Pendientes" value={appointments.filter(a => a.status === 'SCHEDULED').length} color="amber" />
                <StatCard label="Completadas" value={appointments.filter(a => a.status === 'COMPLETED').length} color="emerald" />
                <StatCard label="Ausentes" value={appointments.filter(a => a.status === 'NO_SHOW').length} color="slate" />
            </div>

            {/* Agenda Timeline View */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-xl shadow-slate-200/50 overflow-hidden">
                <div className="p-6 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <h2 className="font-bold text-slate-700 uppercase tracking-widest text-xs">Cronograma de Atención</h2>
                    <div className="flex gap-2">
                        <span className="w-3 h-3 rounded-full bg-blue-500 border border-white shadow-sm"></span>
                        <span className="w-3 h-3 rounded-full bg-slate-300 border border-white shadow-sm"></span>
                    </div>
                </div>

                <div className="divide-y divide-slate-100">
                    {appointments.length === 0 ? (
                        <div className="p-20 text-center space-y-4">
                            <div className="text-4xl">📭</div>
                            <p className="text-slate-400 font-medium">No hay citas programadas para hoy</p>
                        </div>
                    ) : (
                        appointments.map((apt) => (
                            <div key={apt.id} className="group hover:bg-slate-50 transition-all p-6 flex flex-col md:flex-row md:items-center gap-6">
                                {/* Time marker */}
                                <div className="md:w-32 flex-shrink-0">
                                    <div className="text-xl font-black text-slate-800">
                                        {new Date(apt.scheduledAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                    <div className="text-[10px] font-bold text-blue-500 uppercase tracking-tighter">
                                        {apt.expedientId || 'Papeleta Pendiente'}
                                    </div>
                                </div>

                                {/* Worker Info */}
                                <div className="flex-grow flex items-center gap-4">
                                    <div className="w-12 h-12 bg-gradient-to-br from-slate-100 to-slate-200 rounded-2xl flex items-center justify-center text-xl shadow-inner group-hover:scale-110 transition-transform">
                                        👤
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-slate-800 text-lg leading-tight">
                                            {apt.worker?.firstName} {apt.worker?.lastName}
                                        </h3>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-xs font-medium text-slate-400">{apt.company?.name}</span>
                                            <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md font-mono">{apt.worker?.universalId}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Status & Actions */}
                                <div className="flex items-center gap-4">
                                    <StatusBadge status={apt.status} />

                                    <button
                                        onClick={() => setSelectedApt(apt)}
                                        className="p-3 bg-white border border-slate-200 rounded-xl hover:border-blue-400 hover:text-blue-600 transition-all shadow-sm active:scale-95"
                                        title="Ver Papeleta / Ticket"
                                    >
                                        🎫
                                    </button>

                                    {apt.status === 'SCHEDULED' && (
                                        <button
                                            onClick={() => handleCheckIn(apt.id)}
                                            disabled={checkingIn === apt.id}
                                            className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50"
                                        >
                                            {checkingIn === apt.id ? '...' : 'INICIAR ATENCIÓN'}
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* TICKET / QR MODAL */}
            {selectedApt && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-sm rounded-[2.5rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
                        {/* Ticket Header */}
                        <div className="bg-blue-600 p-8 text-center text-white relative">
                            <button
                                onClick={() => setSelectedApt(null)}
                                className="absolute top-6 right-6 text-white/50 hover:text-white"
                            >
                                ✕
                            </button>
                            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
                                🏢
                            </div>
                            <h2 className="text-xl font-black uppercase tracking-widest">Pase de Entrada</h2>
                            <p className="text-blue-100 text-xs font-bold mt-1 opacity-80">{selectedApt.branch?.name || 'Clínica AMI'}</p>
                        </div>

                        {/* Ticket Body */}
                        <div className="p-8 space-y-6">
                            <div className="text-center space-y-1">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Expediente No.</p>
                                <p className="text-2xl font-black text-slate-800 tracking-tight">{selectedApt.expedientId}</p>
                            </div>

                            {/* QR CODE */}
                            <div className="flex justify-center py-4">
                                <div className="p-4 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200 group relative">
                                    <img
                                        src={selectedApt.qrCode || 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' + selectedApt.expedientId}
                                        alt="QR Code"
                                        className="w-40 h-40 opacity-90 group-hover:opacity-100 transition-opacity"
                                    />
                                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                        <span className="bg-blue-600 text-white text-[8px] font-black px-2 py-1 rounded-full uppercase">Skanami 🔒</span>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                    <div>
                                        <p className="text-[9px] font-bold text-slate-400 uppercase">Trabajador</p>
                                        <p className="text-xs font-black text-slate-700">{selectedApt.worker?.firstName} {selectedApt.worker?.lastName}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[9px] font-bold text-slate-400 uppercase">Hora</p>
                                        <p className="text-xs font-black text-slate-700">
                                            {new Date(selectedApt.scheduledAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                </div>

                                <div className="border-t-2 border-dashed border-slate-100 pt-4 text-center">
                                    <p className="text-[8px] text-slate-400 leading-relaxed max-w-[200px] mx-auto">
                                        Este pase es personal e intransferible. Favor de presentarlo en recepción al llegar.
                                    </p>
                                </div>
                            </div>

                            <button
                                onClick={() => setSelectedApt(null)}
                                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 py-3 rounded-2xl font-bold text-sm transition-all active:scale-95"
                            >
                                CERRAR PASE
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

function StatCard({ label, value, color }: { label: string, value: number, color: 'blue' | 'amber' | 'emerald' | 'slate' }) {
    const variants: Record<string, string> = {
        blue: "bg-blue-50 border-blue-100 text-blue-600",
        amber: "bg-amber-50 border-amber-100 text-amber-600",
        emerald: "bg-emerald-50 border-emerald-100 text-emerald-600",
        slate: "bg-slate-50 border-slate-100 text-slate-600"
    }
    return (
        <div className={`p-5 rounded-3xl border shadow-sm ${variants[color]}`}>
            <p className="text-[10px] font-black uppercase tracking-widest opacity-70 mb-1">{label}</p>
            <p className="text-3xl font-black">{value}</p>
        </div>
    )
}

function StatusBadge({ status }: { status: string }) {
    const variants: Record<string, { bg: string, text: string, label: string, icon: string }> = {
        SCHEDULED: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Pendiente', icon: '🕒' },
        CONFIRMED: { bg: 'bg-indigo-100', text: 'text-indigo-700', label: 'Llegó', icon: '✅' },
        IN_PROGRESS: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'En Curso', icon: '⚡' },
        COMPLETED: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Completada', icon: '✨' },
        CANCELLED: { bg: 'bg-red-100', text: 'text-red-700', label: 'Cancelada', icon: '✕' },
        NO_SHOW: { bg: 'bg-slate-100', text: 'text-slate-700', label: 'Ausente', icon: '👤' },
    }
    const current = variants[status] || variants.SCHEDULED

    return (
        <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-tighter ${current.bg} ${current.text}`}>
            <span>{current.icon}</span>
            {current.label}
        </span>
    )
}
