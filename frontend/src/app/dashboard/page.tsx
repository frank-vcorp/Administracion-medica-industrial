'use client'

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { ArrowRight, Calendar, CircleCheck, Clock, FlaskConical, Smile, Users } from 'lucide-react'
import { getDashboardKPIs } from '@/actions/dashboard.actions'
import { getSatisfactionDashboardSummary } from '@/actions/satisfaction.actions'
import {
    getPendingStudyPatientsForDay,
    type PendingStudyPatientRow,
} from '@/actions/appointment.actions'
import { formatAgendaDayHeading, todayAgendaDateString } from '@/lib/appointment-scheduling'
import { PendingStudiesModal } from '@/components/appointments/PendingStudiesModal'

/**
 * Dashboard KPIs - Página principal del sistema
 * Muestra métricas clave en tiempo real
 *
 * IMPL-20260225-06-UI: Implementación de UI Sprint 7
 * Minuta #18: KPIs navegables + listado de pruebas pendientes (todas las sedes).
 */
export default function DashboardPage() {
    const [kpis, setKpis] = useState({
        appointmentsToday: 0,
        activeEvents: 0,
        completedEvents: 0,
        totalWorkers: 0,
    })
    const [monthlySummary, setMonthlySummary] = useState({
        monthLabel: '',
        appointmentsThisMonth: 0,
        appointmentsTrend: '',
        eventsThisMonth: 0,
        completedThisMonth: 0,
        closureRate: '',
        workersThisMonth: 0,
        workersTrend: '',
    })
    const [pendingStudyRows, setPendingStudyRows] = useState<PendingStudyPatientRow[]>([])
    const [pendingModalOpen, setPendingModalOpen] = useState(false)
    const [satisfactionSummary, setSatisfactionSummary] = useState<{
        periodLabel: string
        kpis: { count: number; avgOverall: number; recommendRate: number }
    } | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    const todayStr = todayAgendaDateString()

    useEffect(() => {
        async function loadKPIs() {
            try {
                const [kpiResult, pendingResult, satisfactionResult] = await Promise.all([
                    getDashboardKPIs(),
                    getPendingStudyPatientsForDay(todayStr),
                    getSatisfactionDashboardSummary(),
                ])
                if (kpiResult.success) {
                    setKpis(kpiResult.kpis)
                    if (kpiResult.monthlySummary) {
                        setMonthlySummary(kpiResult.monthlySummary)
                    }
                } else {
                    setError(kpiResult.error || 'Error al cargar KPIs')
                }
                if (pendingResult.success) {
                    setPendingStudyRows(pendingResult.rows)
                }
                if (satisfactionResult?.kpis) {
                    setSatisfactionSummary({
                        periodLabel: satisfactionResult.periodLabel,
                        kpis: {
                            count: satisfactionResult.kpis.count,
                            avgOverall: satisfactionResult.kpis.avgOverall,
                            recommendRate: satisfactionResult.kpis.recommendRate,
                        },
                    })
                }
            } catch {
                setError('Error desconocido')
            } finally {
                setLoading(false)
            }
        }

        loadKPIs()
    }, [todayStr])

    const pendingTestsCount = pendingStudyRows.reduce(
        (sum, row) => sum + row.pendingTests.length,
        0,
    )

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
                    <h1 className="text-3xl font-extrabold text-ami-gray tracking-tight">
                        Tu <span className="text-ami-secondary">agenda</span>, nuestra prioridad en{' '}
                        <span className="text-ami-secondary">Salud Ocupacional</span>
                    </h1>
                    <p className="text-ami-gray font-medium capitalize mt-1">{today}</p>
                </div>
                <div className="flex items-center gap-3 bg-white p-2 rounded-2xl shadow-sm border border-ami-secondary/10">
                    <div className="w-10 h-10 bg-ami-secondary rounded-xl flex items-center justify-center text-white font-bold">A</div>
                    <div className="pr-4">
                        <p className="text-[10px] uppercase font-bold text-slate-400 leading-none">Perfil</p>
                        <p className="text-sm font-bold text-slate-700">Administrador</p>
                    </div>
                </div>
            </div>

            {/* Stats Grid - Premium KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
                <StatCard
                    title="Citas de Hoy"
                    value={kpis.appointmentsToday}
                    icon={<Calendar className="h-5 w-5 stroke-[1.5]" />}
                    description="Agenda diaria"
                    href="/appointments"
                />
                <StatCard
                    title="Pacientes en espera"
                    value={kpis.activeEvents}
                    icon={<Clock className="h-5 w-5 stroke-[1.5]" />}
                    description="Recepción y sala"
                    href="/reception"
                />
                <StatCard
                    title="Pruebas pendientes"
                    value={pendingTestsCount}
                    icon={<FlaskConical className="h-5 w-5 stroke-[1.5]" />}
                    description="Ver listado del día"
                    onClick={() => setPendingModalOpen(true)}
                />
                <StatCard
                    title="Completados"
                    value={kpis.completedEvents}
                    icon={<CircleCheck className="h-5 w-5 stroke-[1.5]" />}
                    description="Cola de validación"
                    href="/validation"
                />
                <StatCard
                    title="Total Padron"
                    value={kpis.totalWorkers}
                    icon={<Users className="h-5 w-5 stroke-[1.5]" />}
                    description="Pacientes registrados"
                    href="/workers"
                />
            </div>

            <PendingStudiesModal
                open={pendingModalOpen}
                onClose={() => setPendingModalOpen(false)}
                rows={pendingStudyRows}
                dateLabel={formatAgendaDayHeading(todayStr)}
            />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Content: Performance & Status */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white p-8 rounded-3xl shadow-sm border border-ami-secondary/10">
                        <h3 className="text-lg font-bold text-ami-gray mb-1 flex items-center gap-2">
                            <span className="w-2 h-6 bg-ami-primary rounded-full"></span>
                            Resumen de atenciones del mes
                        </h3>
                        <p className="text-sm text-slate-500 mb-6 capitalize">{monthlySummary.monthLabel}</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <InfoBox
                                label="Flujo del mes"
                                value={`${monthlySummary.appointmentsThisMonth} citas programadas`}
                                trend={monthlySummary.appointmentsTrend}
                            />
                            <InfoBox
                                label="Atenciones del mes"
                                value={`${monthlySummary.eventsThisMonth} pacientes atendidos`}
                                trend={`${kpis.activeEvents} en curso hoy`}
                            />
                            <InfoBox
                                label="Tasa de cierre"
                                value={`${monthlySummary.completedThisMonth} expedientes cerrados`}
                                trend={monthlySummary.closureRate}
                            />
                            <InfoBox
                                label="Crecimiento padrón"
                                value={`${monthlySummary.workersThisMonth} altas del mes`}
                                trend={monthlySummary.workersTrend}
                            />
                        </div>
                    </div>
                </div>

                {/* Sidebar: Quick Actions */}
                <div className="space-y-6">
                    {satisfactionSummary && (
                        <Link
                            href="/reports/satisfaction"
                            className="block bg-white p-6 rounded-3xl shadow-sm border border-ami-secondary/10 hover:border-violet-200 transition-colors"
                        >
                            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-3">
                                <Smile className="h-4 w-4 text-violet-600" />
                                Satisfacción del paciente
                            </h3>
                            <p className="text-xs text-slate-500 capitalize mb-4">
                                {satisfactionSummary.periodLabel}
                            </p>
                            <div className="grid grid-cols-3 gap-2 text-center">
                                <div>
                                    <p className="text-lg font-black text-slate-900">
                                        {satisfactionSummary.kpis.count}
                                    </p>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase">Respuestas</p>
                                </div>
                                <div>
                                    <p className="text-lg font-black text-slate-900">
                                        {satisfactionSummary.kpis.avgOverall.toFixed(1)}
                                    </p>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase">Promedio</p>
                                </div>
                                <div>
                                    <p className="text-lg font-black text-slate-900">
                                        {Math.round(satisfactionSummary.kpis.recommendRate)}%
                                    </p>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase">Recomienda</p>
                                </div>
                            </div>
                            <p className="mt-4 text-xs font-semibold text-violet-700">Ver reporte y exportar Excel →</p>
                        </Link>
                    )}
                    <div className="bg-ami-secondary text-white p-8 rounded-3xl shadow-xl shadow-ami-secondary/20 overflow-hidden relative">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-ami-accent/20 rounded-full -mr-16 -mt-16 blur-3xl"></div>
                        <h3 className="text-lg font-bold mb-4 relative z-10">Acciones Rápidas</h3>
                        <div className="space-y-3 relative z-10">
                            <button className="w-full bg-white/10 hover:bg-white/20 text-white text-left p-4 rounded-2xl transition-all border border-white/10 group">
                                <p className="text-sm font-bold group-hover:translate-x-1 transition-transform flex items-center gap-2">
                                    <ArrowRight className="h-4 w-4 stroke-[1.5]" /> Nueva Empresa
                                </p>
                                <p className="text-xs text-white/50">Dar de alta convenio</p>
                            </button>
                            <button className="w-full bg-white/10 hover:bg-white/20 text-white text-left p-4 rounded-2xl transition-all border border-white/10 group">
                                <p className="text-sm font-bold group-hover:translate-x-1 transition-transform flex items-center gap-2">
                                    <ArrowRight className="h-4 w-4 stroke-[1.5]" /> Registro Trabajador
                                </p>
                                <p className="text-xs text-white/50">Cargar padrón</p>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

function StatCard({
    title,
    value,
    icon,
    description,
    href,
    onClick,
}: {
    title: string
    value: number
    icon: ReactNode
    description: string
    href?: string
    onClick?: () => void
}) {
    const interactive = Boolean(href || onClick)
    const className = `bg-white p-6 rounded-[2rem] border border-ami-secondary/10 shadow-sm transition-all group block w-full text-left ${
        interactive
            ? 'cursor-pointer hover:border-ami-secondary/30 hover:shadow-md active:scale-[0.99]'
            : 'cursor-default'
    }`

    const inner = (
        <>
            <div className="flex items-start justify-between">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-ami-secondary/10 text-ami-secondary">
                    {icon}
                </div>
                <div className="text-right">
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{title}</p>
                    <p className="text-4xl font-black text-slate-900 mt-1">{value}</p>
                </div>
            </div>
            <div className="mt-6 flex items-center justify-between text-xs">
                <span className="text-slate-400 font-medium">{description}</span>
                {interactive && (
                    <span className="text-ami-secondary font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                        Ir →
                    </span>
                )}
            </div>
        </>
    )

    if (href) {
        return (
            <Link href={href} className={className}>
                {inner}
            </Link>
        )
    }

    if (onClick) {
        return (
            <button type="button" onClick={onClick} className={className}>
                {inner}
            </button>
        )
    }

    return <div className={className}>{inner}</div>
}

function InfoBox({ label, value, trend }: { label: string; value: string; trend: string }) {
    return (
        <div className="p-6 bg-slate-50/50 rounded-2xl border border-slate-100 hover:bg-white hover:shadow-lg hover:shadow-slate-100 transition-all group">
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2">{label}</p>
            <p className="text-lg font-extrabold text-slate-800">{value}</p>
            <p className="text-[10px] mt-2 text-ami-primary font-bold">{trend}</p>
        </div>
    )
}
