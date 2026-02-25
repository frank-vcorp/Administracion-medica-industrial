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
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Error desconocido')
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

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-slate-800">Dashboard Operativo</h2>

            {/* Stats Grid - KPIs del Sistema */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatCard 
                    title="Citas de Hoy" 
                    value={kpis.appointmentsToday.toString()} 
                    icon="📅" 
                    color="blue" 
                />
                <StatCard 
                    title="Eventos en Proceso" 
                    value={kpis.activeEvents.toString()} 
                    icon="⚙️" 
                    color="green" 
                />
                <StatCard 
                    title="Eventos Completados" 
                    value={kpis.completedEvents.toString()} 
                    icon="✅" 
                    color="emerald" 
                />
                <StatCard 
                    title="Total Trabajadores" 
                    value={kpis.totalWorkers.toString()} 
                    icon="👥" 
                    color="purple" 
                />
            </div>

            {/* Quick Stats Info */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <h3 className="font-semibold text-slate-700 mb-4">Estado del Sistema</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <InfoBox label="Citas pendientes" value={`${kpis.appointmentsToday} de hoy`} />
                    <InfoBox label="Capacidad actual" value={`${kpis.activeEvents} en progreso`} />
                    <InfoBox label="Productividad" value={`${kpis.completedEvents} completados`} />
                    <InfoBox label="Base de datos" value={`${kpis.totalWorkers} trabajadores`} />
                </div>
            </div>
        </div>
    )
}

function StatCard({ title, value, icon, color }: any) {
    const colors = {
        blue: "bg-blue-50 text-blue-600",
        green: "bg-green-50 text-green-600",
        emerald: "bg-emerald-50 text-emerald-600",
        purple: "bg-purple-50 text-purple-600"
    } as any

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm text-slate-500 font-medium">{title}</p>
                    <p className="text-3xl font-bold text-slate-800 mt-1">{value}</p>
                </div>
                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl ${colors[color]}`}>
                    {icon}
                </div>
            </div>
        </div>
    )
}

function InfoBox({ label, value }: { label: string; value: string }) {
    return (
        <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
            <p className="text-xs text-slate-500 font-medium mb-1">{label}</p>
            <p className="text-lg font-semibold text-slate-800">{value}</p>
        </div>
    )
}

