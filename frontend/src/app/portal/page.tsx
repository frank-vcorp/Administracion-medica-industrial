import { getCompanyDashboardStats } from '@/actions/portal.actions'
import prisma from '@/lib/prisma'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function PortalDashboardPage() {
    // 1. MIP (Mínima Intervención): Simular que estamos logueados como la primera empresa disponible
    const currentCompany = await prisma.company.findFirst()

    if (!currentCompany) {
        return (
            <div className="p-8 text-center text-slate-500">
                <p>No hay empresas registradas en el sistema para simular el portal B2B.</p>
            </div>
        )
    }

    // 2. Obtener métricas de la empresa simulada
    const { stats } = await getCompanyDashboardStats(currentCompany.id)

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Portal Cliente B2B</h1>
                    <p className="text-sm text-slate-500">Bienvenido, administrador de <span className="font-semibold text-blue-600">{currentCompany.name}</span></p>
                </div>
                <div className="flex gap-3 text-sm">
                    <Link href="/portal/workers" className="bg-white border text-slate-700 px-4 py-2 rounded-lg shadow-sm hover:bg-slate-50 font-medium">
                        👥 Ver Trabajadores
                    </Link>
                    <Link href="/portal/events" className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow hover:bg-blue-700 font-medium">
                        📄 Historial Clínico
                    </Link>
                </div>
            </div>

            {/* Tarjetas de Métricas */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <StatCard
                    title="Plantilla Activa"
                    value={stats?.workers || 0}
                    subtitle="Trabajadores registrados"
                    icon="👥"
                    color="text-blue-600"
                    bg="bg-blue-50"
                />
                <StatCard
                    title="Chequeos Totales"
                    value={stats?.totalEvents || 0}
                    subtitle="Expedientes en sistema"
                    icon="🏥"
                    color="text-slate-600"
                    bg="bg-white"
                />
                <StatCard
                    title="Aptitudes Emitidas"
                    value={stats?.aptos || 0}
                    subtitle="Trabajadores Aptos"
                    icon="✅"
                    color="text-emerald-600"
                    bg="bg-emerald-50"
                />
                <StatCard
                    title="No Aptos / Restricción"
                    value={stats?.noAptos || 0}
                    subtitle="Requieren seguimiento"
                    icon="⚠️"
                    color="text-amber-600"
                    bg="bg-amber-50"
                />
            </div>

            {/* Sección Informativa B2B */}
            <div className="mt-8 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="text-lg font-bold text-slate-800 mb-2">Estado del Servicio Médico</h3>
                <p className="text-slate-600 text-sm mb-4">
                    Desde este portal corporativo usted puede monitorear el progreso médico de sus trabajadores en tiempo real, descargar los dictámenes de aptitud validados y gestionar la salud ocupacional de su plantilla respetando la privacidad clínica.
                </p>

                <div className="flex items-center gap-4 text-sm mt-6 pt-6 border-t border-slate-100">
                    <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                        <span className="text-slate-600">{stats?.inProgress || 0} Empleados actualmente en clínica</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                        <span className="text-slate-600">{stats?.completed || 0} Expedientes cerrados y listos</span>
                    </div>
                </div>
            </div>
        </div>
    )
}

function StatCard({ title, value, subtitle, icon, color, bg }: any) {
    return (
        <div className={`p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col ${bg}`}>
            <div className="flex justify-between items-start mb-4">
                <h3 className="text-slate-600 font-medium text-sm">{title}</h3>
                <span className="text-2xl">{icon}</span>
            </div>
            <p className={`text-3xl font-bold mb-1 ${color}`}>{value}</p>
            <p className="text-xs text-slate-500">{subtitle}</p>
        </div>
    )
}
