import { getCompanyEventsHistory } from '@/actions/portal.actions'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import prisma from '@/lib/prisma'
import Link from 'next/link'
import { EventRowButtons } from '@/components/EventRowButtons'

/**
 * @id IMPL-20260225-03
 * Historial de eventos médicos del portal B2B - Obtiene datos seguros de la sesión
 * Integración de Firma Digital y Reportes Masivos
 */
export default async function PortalEventsPage() {
    const session = await getServerSession(authOptions)

    if (!session?.user?.companyId) {
        return <div className="p-8 text-red-600">Error: No hay sesión válida.</div>
    }

    const currentCompany = await prisma.company.findUnique({
        where: { id: session.user.companyId }
    })

    if (!currentCompany) return <div className="p-8 text-red-600">Error: Empresa no encontrada.</div>

    const result = await getCompanyEventsHistory()
    const events = result.success ? result.events : []

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Historial Clínico / Dictámenes</h1>
                    <p className="text-sm text-slate-500">Registro histórico de expedientes validados</p>
                </div>
                <Link href="/portal" className="text-sm text-blue-600 hover:underline font-medium">
                    ← Volver al Dashboard
                </Link>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-left text-sm text-slate-600">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-semibold border-b border-slate-200">
                        <tr>
                            <th className="px-6 py-4">Fecha</th>
                            <th className="px-6 py-4">Trabajador</th>
                            <th className="px-6 py-4">Folio Cita</th>
                            <th className="px-6 py-4">Resolución</th>
                            <th className="px-6 py-4 text-right">Documento</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {events?.map((event) => {
                            const isCompleted = event.status === 'COMPLETED'
                            const hasVerdict = !!event.verdict
                            const isApto = event.verdict?.finalDiagnosis?.toLowerCase().includes('no apto') === false

                            return (
                                <tr key={event.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4 font-medium text-slate-900">
                                        {new Date(event.createdAt).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-4">
                                        {event.worker.lastName}, {event.worker.firstName}
                                    </td>
                                    <td className="px-6 py-4 text-slate-400 font-mono text-xs">
                                        #{event.id.slice(0, 8)}
                                    </td>
                                    <td className="px-6 py-4">
                                        {!isCompleted ? (
                                            <span className="text-blue-600 font-medium text-xs">En tránsito...</span>
                                        ) : hasVerdict ? (
                                            <span className={`font-bold ${isApto ? 'text-emerald-600' : 'text-red-600'}`}>
                                                {isApto ? 'APTO' : 'NO APTO'}
                                            </span>
                                        ) : (
                                            <span className="text-amber-500 font-medium text-xs">Pendiente de Firma</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <EventRowButtons
                                            eventId={event.id}
                                            isCompleted={isCompleted}
                                            hasVerdict={hasVerdict}
                                        />
                                    </td>
                                </tr>
                            )
                        })}
                        {events?.length === 0 && (
                            <tr>
                                <td colSpan={5} className="px-6 py-8 text-center text-slate-400">
                                    Aún no hay expedientes registrados.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <p className="text-xs text-slate-400 text-center mt-4">
                * Por cumplimiento de privacidad y normativas de salud, los archivos puros (RX, Laboratorios) no son accesibles desde este portal corporativo. Solo se expiden dictámenes de aptitud laboral.
            </p>
        </div>
    )
}
