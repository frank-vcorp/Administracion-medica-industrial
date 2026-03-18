'use client'

import { useEffect, useState, Suspense } from 'react'
import { getAppointments, getAppointmentForCorroboration } from '@/actions/appointment.actions'
import { getBranches } from '@/actions/admin.actions'
import { useRouter } from 'next/navigation'
import AppointmentFormModal from '@/components/AppointmentFormModal'
import CorroborationModal from '@/components/CorroborationModal'
import Link from 'next/link'

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
    branch: { name: string, hourlyCapacity: number, openingTime: string, closingTime: string } | null;
}

interface Branch {
    id: string
    name: string
    hourlyCapacity: number
    openingTime: string
    closingTime: string
}

export default function AppointmentsPage() {
    const [appointments, setAppointments] = useState<AppointmentWithWorker[]>([])
    const [branches, setBranches] = useState<Branch[]>([])
    const [selectedBranchId, setSelectedBranchId] = useState<string>('')
    const [loading, setLoading] = useState(true)
    const [selectedApt, setSelectedApt] = useState<AppointmentWithWorker | null>(null)
    const [checkingIn, setCheckingIn] = useState<string | null>(null)
    // IMPL-20260318-08: Estado del modal de corroboración
    const [corroborationData, setCorroborationData] = useState<Parameters<typeof CorroborationModal>[0]['appointment'] | null>(null)
    const [selectedDate, setSelectedDate] = useState<string>(() => {
        // Fix: Usar fecha local real para el input default, no UTC
        const now = new Date()
        const year = now.getFullYear()
        const month = String(now.getMonth() + 1).padStart(2, '0')
        const day = String(now.getDate()).padStart(2, '0')
        return `${year}-${month}-${day}`
    })
    const [error, setError] = useState<string | null>(null)
    const router = useRouter()

    useEffect(() => {
        // Cargar sucursales al inicio
        getBranches().then(data => {
            setBranches(data as unknown as Branch[])
            if (data.length > 0) {
                setSelectedBranchId(data[0].id)
            }
        })
    }, [])

    const loadData = async () => {
        if (!selectedBranchId) return // Esperar a tener sucursal seleccionada

        setLoading(true)
        setError(null)
        try {
            const result = await getAppointments(selectedDate, selectedBranchId)
            if (result.success) {
                setAppointments(result.appointments as unknown as AppointmentWithWorker[] || [])
            } else {
                setError(result.error || 'No se pudieron cargar las citas.')
            }
        } catch (err) {
            setError('Error de conexión al cargar la agenda.')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (selectedBranchId) {
            loadData()
        }
    }, [selectedDate, selectedBranchId])

    // Agrupar citas por hora (Filtrando localmente para asegurar que coincidan con el día seleccionado)
    const groupedAppointments = appointments.reduce((acc, apt) => {
        const aptDate = new Date(apt.scheduledAt);
        // Construir fecha local YYYY-MM-DD para comparar con selectedDate
        const aptDateString = `${aptDate.getFullYear()}-${String(aptDate.getMonth() + 1).padStart(2, '0')}-${String(aptDate.getDate()).padStart(2, '0')}`;
        
        // Si la cita no corresponde al día seleccionado (por diferencias de timezone traídas del server), la ignoramos visualmente
        if (aptDateString !== selectedDate) return acc;

        const hour = aptDate.getHours();
        if (!acc[hour]) acc[hour] = [];
        acc[hour].push(apt);
        return acc;
    }, {} as Record<number, AppointmentWithWorker[]>);

    // Obtener configuración de la sucursal seleccionada
    const currentBranch = branches.find(b => b.id === selectedBranchId);
    const branchConfig = currentBranch || { hourlyCapacity: 15, openingTime: '07:00', closingTime: '17:00' };
    
    const startHour = parseInt(branchConfig.openingTime.split(':')[0]);
    const endHour = parseInt(branchConfig.closingTime.split(':')[0]);
    const hours = Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i);

    const handleCheckIn = async (id: string) => {
        // IMPL-20260318-08: Abrir corroboración antes de crear el MedicalEvent
        setCheckingIn(id)
        const res = await getAppointmentForCorroboration(id)
        if (res.success && res.appointment) {
            setCorroborationData(res.appointment as Parameters<typeof CorroborationModal>[0]['appointment'])
            setSelectedApt(null) // cerrar ticket si estaba abierto
        } else {
            setError(res.error || 'No se pudo cargar datos para corroboración')
        }
        setCheckingIn(null)
    }

    if (loading) return (
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-slate-500 font-medium animate-pulse">Sincronizando Agenda...</p>
        </div>
    )

    if (error) return (
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
            <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center text-3xl">⚠️</div>
            <h3 className="text-xl font-bold text-slate-800">Error al Cargar</h3>
            <p className="text-slate-500">{error}</p>
            <button 
                onClick={loadData}
                className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-2 rounded-xl text-sm font-bold transition-all"
            >
                Reintentar
            </button>
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
                <div className="flex items-center gap-3 flex-wrap">
                    {/* IMPL-20260318-08: Link a vista de 3 agendas */}
                    <Link
                        href="/appointments/overview"
                        className="bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2"
                    >
                        <span>🗓️</span> 3 Agendas
                    </Link>
                    <div className="bg-white border border-slate-200 px-3 py-2 rounded-xl shadow-sm flex items-center gap-2">
                        <span className="text-slate-400">🏥</span>
                        <select
                            value={selectedBranchId}
                            onChange={(e) => setSelectedBranchId(e.target.value)}
                            className="bg-transparent border-none outline-none text-sm font-bold text-slate-600 cursor-pointer w-32 md:w-auto"
                            disabled={branches.length === 0}
                        >
                            {branches.map(b => (
                                <option key={b.id} value={b.id}>{b.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="bg-white border border-slate-200 px-4 py-2 rounded-xl shadow-sm flex items-center gap-2">
                        <span className="text-slate-400">📅</span>
                        <input 
                            type="date" 
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="bg-transparent border-none outline-none text-sm font-bold text-slate-600 cursor-pointer"
                        />
                    </div>
                    <Suspense fallback={null}>
                        <AppointmentFormModal onSuccess={loadData} />
                    </Suspense>
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
                    {hours.map(hour => {
                        const hourApts = groupedAppointments[hour] || [];
                        const capacity = branchConfig.hourlyCapacity;
                        const isFull = hourApts.length >= capacity;
                        const isAlmostFull = hourApts.length >= capacity * 0.8;

                        return (
                            <div key={hour} className="flex flex-col md:flex-row border-b border-slate-100 last:border-0">
                                {/* Time Block Header */}
                                <div className="md:w-48 p-6 bg-slate-50/50 border-r border-slate-100 flex flex-col justify-center">
                                    <div className="text-2xl font-black text-slate-800">
                                        {hour.toString().padStart(2, '0')}:00
                                    </div>
                                    <div className="mt-2 flex items-center gap-2">
                                        <div className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${isFull ? 'bg-red-100 text-red-700' : isAlmostFull ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                            {hourApts.length} / {capacity} Lugares
                                        </div>
                                    </div>
                                </div>

                                {/* Appointments List for this hour */}
                                <div className="flex-grow p-4">
                                    {hourApts.length === 0 ? (
                                        <div className="h-full flex items-center justify-center text-slate-400 text-sm font-medium italic py-4">
                                            Bloque disponible
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                                            {hourApts.map((apt) => (
                                                <div key={apt.id} className="group bg-white border border-slate-200 hover:border-blue-300 rounded-2xl p-4 flex items-center gap-4 transition-all shadow-sm hover:shadow-md">
                                                    <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-lg flex-shrink-0">
                                                        👤
                                                    </div>
                                                    <div className="flex-grow min-w-0">
                                                        <h3 className="font-bold text-slate-800 text-sm truncate">
                                                            {apt.worker?.firstName} {apt.worker?.lastName}
                                                        </h3>
                                                        <div className="flex items-center gap-2 mt-0.5">
                                                            <span className="text-[10px] font-medium text-slate-500 truncate">{apt.company?.name}</span>
                                                            <span className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-mono">{apt.expedientId || 'PENDIENTE'}</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                                                        <StatusBadge status={apt.status} />
                                                        <div className="flex gap-1">
                                                            <button
                                                                onClick={() => setSelectedApt(apt)}
                                                                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                                title="Ver Pase"
                                                            >
                                                                🎫
                                                            </button>
                                                            {apt.status === 'SCHEDULED' && (
                                                                <button
                                                                    onClick={() => handleCheckIn(apt.id)}
                                                                    disabled={checkingIn === apt.id}
                                                                    className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors font-bold text-xs"
                                                                    title="Check-in"
                                                                >
                                                                    {checkingIn === apt.id ? '...' : '▶'}
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* IMPL-20260318-09: Modal de Corroboración — montado y funcional antes del check-in */}
            {corroborationData && (
                <CorroborationModal
                    appointment={corroborationData}
                    onClose={() => {
                        setCorroborationData(null)
                        loadData()
                    }}
                />
            )}

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
