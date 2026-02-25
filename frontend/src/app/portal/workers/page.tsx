import { getCompanyWorkersWithStatus } from '@/actions/portal.actions'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import prisma from '@/lib/prisma'
import Link from 'next/link'

/**
 * @id IMPL-20260225-01
 * Listado de trabajadores del portal B2B - Obtiene datos seguros de la sesión
 */
export default async function PortalWorkersPage() {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.companyId) {
        return <div className="p-8 text-red-600">Error: No hay sesión válida.</div>
    }

    const currentCompany = await prisma.company.findUnique({
        where: { id: session.user.companyId }
    })
    
    if (!currentCompany) return <div className="p-8 text-red-600">Error: Empresa no encontrada.</div>

    const result = await getCompanyWorkersWithStatus()
    const workers = result.success ? result.workers : []

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Plantilla de Trabajadores</h1>
                    <p className="text-sm text-slate-500">Personal registrado bajo {currentCompany?.name || "Empresa"}</p>
                </div>
                <Link href="/portal" className="text-sm text-blue-600 hover:underline font-medium">
                    ← Volver al Dashboard
                </Link>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-left text-sm text-slate-600">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-semibold border-b border-slate-200">
                        <tr>
                            <th className="px-6 py-4">Nombre Completo</th>
                            <th className="px-6 py-4">ID/CURP</th>
                            <th className="px-6 py-4">Último Chequeo</th>
                            <th className="px-6 py-4">Estado / Aptitud</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {workers?.map((worker) => {
                            const lastEvent = worker.medicalHistory[0]
                            const isApto = lastEvent?.verdict?.finalDiagnosis?.toLowerCase().includes('no apto') === false

                            return (
                                <tr key={worker.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4 font-medium text-slate-900">
                                        {worker.lastName}, {worker.firstName}
                                    </td>
                                    <td className="px-6 py-4 text-slate-500 font-mono">
                                        {worker.universalId.slice(0, 8)}
                                    </td>
                                    <td className="px-6 py-4">
                                        {lastEvent ? new Date(lastEvent.createdAt).toLocaleDateString() : <span className="text-slate-400 italic">Sin registros</span>}
                                    </td>
                                    <td className="px-6 py-4">
                                        {!lastEvent ? (
                                            <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-semibold">Pendiente Cita</span>
                                        ) : lastEvent.status !== 'COMPLETED' ? (
                                            <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-semibold">En Proceso Clínico</span>
                                        ) : lastEvent.verdict ? (
                                            <span className={`${isApto ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'} px-2 py-1 rounded text-xs font-semibold uppercase`}>
                                                {isApto ? '✓ Apto' : '✕ No Apto'}
                                            </span>
                                        ) : (
                                            <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded text-xs font-semibold">Validando Resultados</span>
                                        )}
                                    </td>
                                </tr>
                            )
                        })}
                        {workers?.length === 0 && (
                            <tr>
                                <td colSpan={4} className="px-6 py-8 text-center text-slate-400">
                                    No hay trabajadores registrados para esta empresa.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Plantilla de Trabajadores</h1>
                    <p className="text-sm text-slate-500">Personal registrado bajo {currentCompany?.name || "Empresa"}</p>
                </div>
                <Link href="/portal" className="text-sm text-blue-600 hover:underline font-medium">
                    ← Volver al Dashboard
                </Link>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-left text-sm text-slate-600">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-semibold border-b border-slate-200">
                        <tr>
                            <th className="px-6 py-4">Nombre Completo</th>
                            <th className="px-6 py-4">ID/CURP</th>
                            <th className="px-6 py-4">Último Chequeo</th>
                            <th className="px-6 py-4">Estado / Aptitud</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {workers?.map((worker) => {
                            const lastEvent = worker.medicalHistory[0]
                            const isApto = lastEvent?.verdict?.finalDiagnosis?.toLowerCase().includes('no apto') === false

                            return (
                                <tr key={worker.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4 font-medium text-slate-900">
                                        {worker.lastName}, {worker.firstName}
                                    </td>
                                    <td className="px-6 py-4 text-slate-500 font-mono">
                                        {worker.nationalId || worker.universalId.slice(0, 8)}
                                    </td>
                                    <td className="px-6 py-4">
                                        {lastEvent ? new Date(lastEvent.createdAt).toLocaleDateString() : <span className="text-slate-400 italic">Sin registros</span>}
                                    </td>
                                    <td className="px-6 py-4">
                                        {!lastEvent ? (
                                            <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-semibold">Pendiente Cita</span>
                                        ) : lastEvent.status !== 'COMPLETED' ? (
                                            <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-semibold">En Proceso Clínico</span>
                                        ) : lastEvent.verdict ? (
                                            <span className={`${isApto ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'} px-2 py-1 rounded text-xs font-semibold uppercase`}>
                                                {isApto ? '✓ Apto' : '✕ No Apto'}
                                            </span>
                                        ) : (
                                            <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded text-xs font-semibold">Validando Resultados</span>
                                        )}
                                    </td>
                                </tr>
                            )
                        })}
                        {workers?.length === 0 && (
                            <tr>
                                <td colSpan={4} className="px-6 py-8 text-center text-slate-400">
                                    No hay trabajadores registrados para esta empresa.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
