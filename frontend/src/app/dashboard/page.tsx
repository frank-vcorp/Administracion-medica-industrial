'use client'

import { useEffect, useState } from 'react'
import { getDashboardKPIs } from '@/actions/dashboard.actions'

/**
 * Dashboard KPIs - Página principal del sistema
 * Muestra métricas clave en tiempo real
 * 
 * IMPL-20260225-06-UI: Implementación de UI Sprint 7
 */
export default function DashboardPage() {
    const [kpis, setKpis] = useState({
        appointmentsToday: 0,
        activeEvents: 0,
        completedEvents: 0,
        totalWorkers: 0,
    })
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    useEffect(() => {
        async function loadKPIs() {
            try {
                const result = await getDashboardKPIs()
                if (result.success) {
                    setKpis(result.kpis)
                } else {
                    setError(result.error || 'Error al cargar KPIs')
                }
            } catch {
                setError('Error desconocido')
            } finally {
                setLoading(false)
            }
        }

        loadKPIs()
    }, [])

    if (loading) {
        return <div className="text-center py-8">Cargando métricas...</div>
    }

    if (error) {
        return <div className="text-red-600 py-8">Error: {error}</div>
    }

    const today = new Date().toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

    return (
        <div className="space-y-10 pb-12">
            {/* Premium Welcome Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">¡Hola de nuevo! ✨</h1>
                    <p className="text-slate-500 font-medium capitalize mt-1">{today}</p>
                </div>
                <div className="flex items-center gap-3 bg-white p-2 rounded-2xl shadow-sm border border-slate-100">
                    <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center text-white font-bold">A</div>
                    <div className="pr-4">
                        <p className="text-[10px] uppercase font-bold text-slate-400 leading-none">Perfil</p>
                        <p className="text-sm font-bold text-slate-700">Administrador</p>
                    </div>
                </div>
            </div>

            {/* Stats Grid - Premium KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title="Citas de Hoy"
                    value={kpis.appointmentsToday}
                    icon="📅"
                    color="sky"
                    description="Agenda diaria"
                />
                <StatCard
                    title="En Espera / Consulta"
                    value={kpis.activeEvents}
                    icon="⚡"
                    color="amber"
                    description="Pacientes en sede"
                />
                <StatCard
                    title="Completados"
                    value={kpis.completedEvents}
                    icon="✅"
                    color="emerald"
                    description="Dictámenes firmados"
                />
                <StatCard
                    title="Total Padron"
                    value={kpis.totalWorkers}
                    icon="👥"
                    color="indigo"
                    description="Trabajadores base"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Content: Performance & Status */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
                        <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                            <span className="w-2 h-6 bg-indigo-500 rounded-full"></span>
                            Estado Operativo del Sistema
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <InfoBox label="Flujo de hoy" value={`${kpis.appointmentsToday} citas programadas`} trend="+12% vs ayer" />
                            <InfoBox label="Ocupación de Sede" value={`${kpis.activeEvents} pacientes atendiendo`} trend="Normal" />
                            <InfoBox label="Tasa de Cierre" value={`${kpis.completedEvents} expedientes listos`} trend="85% completado" />
                            <InfoBox label="Crecimiento Padrón" value={`${kpis.totalWorkers} registros en DB`} trend="+5 nuevos" />
                        </div>
                    </div>
                </div>

                {/* Sidebar: Quick Actions */}
                <div className="space-y-6">
                    <div className="bg-slate-900 text-white p-8 rounded-3xl shadow-xl shadow-slate-200 overflow-hidden relative">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/20 rounded-full -mr-16 -mt-16 blur-3xl"></div>
                        <h3 className="text-lg font-bold mb-4 relative z-10">Acciones Rápidas</h3>
                        <div className="space-y-3 relative z-10">
                            <button className="w-full bg-white/10 hover:bg-white/20 text-white text-left p-4 rounded-2xl transition-all border border-white/10 group">
                                <p className="text-sm font-bold group-hover:translate-x-1 transition-transform">➡️ Nueva Empresa</p>
                                <p className="text-xs text-white/50">Dar de alta convenio</p>
                            </button>
                            <button className="w-full bg-white/10 hover:bg-white/20 text-white text-left p-4 rounded-2xl transition-all border border-white/10 group">
                                <p className="text-sm font-bold group-hover:translate-x-1 transition-transform">➡️ Registro Trabajador</p>
                                <p className="text-xs text-white/50">Cargar padrón</p>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

function StatCard({ title, value, icon, color, description }: { title: string, value: number, icon: string, color: 'sky' | 'amber' | 'emerald' | 'indigo', description: string }) {
    const variants: Record<string, string> = {
        sky: "bg-sky-50 text-sky-600 border-sky-100 shadow-sky-100/50",
        amber: "bg-amber-50 text-amber-600 border-amber-100 shadow-amber-100/50",
        emerald: "bg-emerald-50 text-emerald-600 border-emerald-100 shadow-emerald-100/50",
        indigo: "bg-indigo-50 text-indigo-600 border-indigo-100 shadow-indigo-100/50"
    }

    return (
        <div className={`bg-white p-6 rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/40 hover:scale-[1.02] transition-all group cursor-default`}>
            <div className="flex items-start justify-between">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl transition-colors ${variants[color]}`}>
                    {icon}
                </div>
                <div className="text-right">
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{title}</p>
                    <p className="text-4xl font-black text-slate-900 mt-1">{value}</p>
                </div>
            </div>
            <div className="mt-6 flex items-center justify-between text-xs">
                <span className="text-slate-400 font-medium">{description}</span>
                <span className={`px-2 py-0.5 rounded-full font-bold ${variants[color].split(' ')[0]} ${variants[color].split(' ')[1]}`}>+0%</span>
            </div>
        </div>
    )
}

function InfoBox({ label, value, trend }: { label: string; value: string; trend: string }) {
    return (
        <div className="p-6 bg-slate-50/50 rounded-2xl border border-slate-100 hover:bg-white hover:shadow-lg hover:shadow-slate-100 transition-all group">
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2">{label}</p>
            <p className="text-lg font-extrabold text-slate-800">{value}</p>
            <p className="text-[10px] mt-2 text-indigo-500 font-bold">{trend}</p>
        </div>
    )
}

