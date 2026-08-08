'use client'
/**
 * Vista de 3 Agendas Simultáneas — Monitoreo Operativo
 * @description Pantalla de lectura independiente con las 3 agendas del día por sucursal.
 *              Permite redistribución de personal entre sucursales.
 * @id IMPL-20260318-09
 */
import { useEffect, useState, useCallback } from 'react'
import Image from 'next/image'
import { getAppointmentsForOverview } from '@/actions/appointment.actions'
import Link from 'next/link'

interface AppointmentOverview {
    id: string
    scheduledAt: Date | string
    status: string
    expedientId: string | null
    qrCode: string | null
    qrOperativo: string | null
    worker: { firstName: string; lastName: string }
    company: { name: string } | null
    branch: { id: string; name: string; hourlyCapacity: number; openingTime: string; closingTime: string } | null
}

interface BranchColumn {
    id: string
    name: string
    appointments: AppointmentOverview[]
}

const STATUS_MAP: Record<string, { label: string; bg: string; text: string }> = {
    SCHEDULED: { label: 'Pendiente', bg: 'bg-blue-100', text: 'text-blue-700' },
    CONFIRMED: { label: 'Llegó', bg: 'bg-indigo-100', text: 'text-indigo-700' },
    IN_PROGRESS: { label: 'En Curso', bg: 'bg-amber-100', text: 'text-amber-700' },
    COMPLETED: { label: 'Completada', bg: 'bg-emerald-100', text: 'text-emerald-700' },
    CANCELLED: { label: 'Cancelada', bg: 'bg-red-100', text: 'text-red-700' },
    NO_SHOW: { label: 'Ausente', bg: 'bg-slate-100', text: 'text-slate-600' },
}

export default function AppointmentsOverviewPage() {
    const [appointments, setAppointments] = useState<AppointmentOverview[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [selectedApt, setSelectedApt] = useState<AppointmentOverview | null>(null)
    const [selectedDate, setSelectedDate] = useState<string>(() => {
        const now = new Date()
        const y = now.getFullYear()
        const m = String(now.getMonth() + 1).padStart(2, '0')
        const d = String(now.getDate()).padStart(2, '0')
        return `${y}-${m}-${d}`
    })

    const loadData = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const res = await getAppointmentsForOverview(selectedDate)
            if (res.success) {
                setAppointments((res.appointments ?? []) as unknown as AppointmentOverview[])
            } else {
                setError(res.error || 'Error al cargar agendas')
            }
        } catch {
            setError('Error de conexión al cargar las agendas')
        } finally {
            setLoading(false)
        }
    }, [selectedDate])

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- loadData inicial; no tiene derivada de render alternativa sin causar renders adicionales.
        loadData()
    }, [loadData])

    /** Devuelve true si la cita pertenece al día seleccionado (comparación en hora local) */
    function isOnSelectedDate(scheduledAt: Date | string) {
        const d = new Date(scheduledAt)
        const local = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        return local === selectedDate
    }

    // Agrupar citas por sucursal
    const branchMap: Record<string, BranchColumn> = {}
    for (const apt of appointments) {
        if (!apt.branch) continue
        if (!branchMap[apt.branch.id]) {
            branchMap[apt.branch.id] = { id: apt.branch.id, name: apt.branch.name, appointments: [] }
        }
        branchMap[apt.branch.id].appointments.push(apt)
    }
    const columns = Object.values(branchMap)

    return (
        <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-slate-800 tracking-tight">Vista 3 Agendas</h1>
                    <p className="text-slate-500 text-sm">Monitoreo operativo por sucursal — solo lectura</p>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                    <Link
                        href="/appointments"
                        className="text-slate-500 hover:text-slate-800 text-sm font-bold transition-colors flex items-center gap-1"
                    >
                        ← Volver a Agenda
                    </Link>
                    <div className="bg-white border border-slate-200 px-4 py-2 rounded-xl shadow-sm flex items-center gap-2">
                        <span className="text-slate-400">📅</span>
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="bg-transparent border-none outline-none text-sm font-bold text-slate-600 cursor-pointer"
                        />
                    </div>
                    <button
                        onClick={loadData}
                        className="bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all"
                    >
                        🔄 Actualizar
                    </button>
                </div>
            </div>

            {/* Cargando */}
            {loading && (
                <div className="flex items-center justify-center min-h-[300px] gap-3">
                    <div className="w-8 h-8 border-4 border-violet-600 border-t-transparent rounded-full animate-spin" />
                    <p className="text-slate-500 font-medium animate-pulse">Cargando agendas...</p>
                </div>
            )}

            {/* Error */}
            {!loading && error && (
                <div className="bg-red-50 border border-red-200 p-6 rounded-2xl text-center">
                    <p className="text-red-600 font-bold">⚠️ {error}</p>
                    <button onClick={loadData} className="mt-3 text-sm text-red-500 underline font-medium">
                        Reintentar
                    </button>
                </div>
            )}

            {/* Sin citas */}
            {!loading && !error && columns.length === 0 && (
                <div className="bg-slate-50 border border-slate-200 p-12 rounded-2xl text-center">
                    <p className="text-4xl mb-3">🗓️</p>
                    <p className="text-slate-600 font-bold text-lg">Sin citas para este día</p>
                    <p className="text-slate-400 text-sm mt-1">
                        No hay citas registradas en ninguna sucursal para la fecha seleccionada.
                    </p>
                </div>
            )}

            {/* Columnas por sucursal */}
            {!loading && !error && columns.length > 0 && (
                <>
                    {/* Resumen de totales */}
                    <div className="grid grid-cols-3 gap-4">
                        {columns.map(col => {
                            const dayApts = col.appointments.filter(a => isOnSelectedDate(a.scheduledAt))
                            const pending = dayApts.filter(a => a.status === 'SCHEDULED').length
                            const completed = dayApts.filter(a => a.status === 'COMPLETED').length
                            return (
                                <div key={col.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex items-center gap-4">
                                    <div className="w-10 h-10 bg-violet-100 text-violet-600 rounded-xl flex items-center justify-center text-xl flex-shrink-0">
                                        🏥
                                    </div>
                                    <div>
                                        <p className="font-black text-slate-800 text-sm leading-tight">{col.name}</p>
                                        <p className="text-xs text-slate-500 mt-0.5">
                                            {dayApts.length} total · {pending} pend. · {completed} comp.
                                        </p>
                                    </div>
                                </div>
                            )
                        })}
                    </div>

            {/* Columnas detalle */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {columns.map(col => {
                    const dayApts = col.appointments
                        .filter(a => isOnSelectedDate(a.scheduledAt))
                        .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())

                    return (
                        <div key={col.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                            <div className="bg-violet-600 px-5 py-4 text-white flex items-center justify-between flex-shrink-0">
                                <div>
                                    <p className="font-black text-base">{col.name}</p>
                                    <p className="text-violet-200 text-xs font-medium">
                                        {dayApts.length} cita{dayApts.length !== 1 ? 's' : ''} del día
                                    </p>
                                </div>
                                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center font-black text-lg">
                                    {dayApts.length}
                                </div>
                            </div>
                            <div className="divide-y divide-slate-100 overflow-y-auto max-h-[55vh] flex-grow">
                                {dayApts.length === 0 ? (
                                    <div className="p-8 text-center">
                                        <p className="text-slate-300 text-3xl mb-2">📭</p>
                                        <p className="text-slate-400 text-sm font-medium">Sin citas para este día</p>
                                    </div>
                                ) : (
                                    dayApts.map(apt => {
                                        const scheduled = new Date(apt.scheduledAt)
                                        const statusInfo = STATUS_MAP[apt.status] ?? STATUS_MAP.SCHEDULED
                                        return (
                                            <div key={apt.id} className="px-4 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors">
                                                <div className="text-center w-12 flex-shrink-0">
                                                    <p className="text-xs font-black text-slate-700 font-mono">
                                                        {scheduled.getHours().toString().padStart(2, '0')}:
                                                        {scheduled.getMinutes().toString().padStart(2, '0')}
                                                    </p>
                                                </div>
                                                <div className="flex-grow min-w-0">
                                                    <p className="text-sm font-bold text-slate-800 truncate">
                                                        {apt.worker.firstName} {apt.worker.lastName}
                                                    </p>
                                                    <p className="text-xs text-slate-500 truncate">
                                                        {apt.company?.name || '—'}
                                                    </p>
                                                </div>
                                                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                                                    <span className={`text-[10px] font-black px-2 py-1 rounded-lg ${statusInfo.bg} ${statusInfo.text}`}>
                                                        {statusInfo.label}
                                                    </span>
                                                    <div className="flex gap-1">
                                                        <button
                                                            onClick={() => setSelectedApt(apt)}
                                                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                            title="Ver Pase"
                                                        >
                                                            🎫
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>
        </>
        )}

            {/* TICKET / QR MODAL */}
            {selectedApt && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-sm rounded-[2.5rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
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
                        <div className="p-8 space-y-6">
                            <div className="text-center space-y-1">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Expediente No.</p>
                                <p className="text-2xl font-black text-slate-800 tracking-tight">{selectedApt.expedientId}</p>
                            </div>
                            <div className="flex justify-center py-4">
                                <div className="p-4 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                                    <Image
                                        src={selectedApt.qrCode || 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' + selectedApt.expedientId}
                                        alt="QR Code"
                                        width={200}
                                        height={200}
                                        unoptimized
                                        className="w-40 h-40 opacity-90"
                                    />
                                </div>
                            </div>
                            {selectedApt.qrOperativo && (
                                <div className="border-t border-dashed border-slate-100 pt-4">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-center mb-2">QR Operativo · Recaptura en Estaciones</p>
                                    <div className="flex justify-center">
                                        <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
                                            <Image
                                                src={selectedApt.qrOperativo}
                                                alt="QR Operativo"
                                                width={112}
                                                height={112}
                                                unoptimized
                                                className="w-28 h-28"
                                            />
                                        </div>
                                    </div>
                                    <p className="text-[8px] text-slate-400 text-center mt-1">
                                        {selectedApt.worker.firstName} {selectedApt.worker.lastName}
                                    </p>
                                </div>
                            )}
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
