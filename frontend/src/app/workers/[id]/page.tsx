import { getWorkerById } from '@/services/worker.service'
import { notFound } from 'next/navigation'
import Link from 'next/link'

export default async function WorkerDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const worker = await getWorkerById(id)

    if (!worker) {
        notFound()
    }

    return (
        <div className="space-y-6">
            <header className="flex items-center justify-between border-b pb-6">
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-slate-200 flex items-center justify-center text-xl font-bold text-slate-500">
                        {worker.firstName[0]}{worker.lastName[0]}
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900">{worker.firstName} {worker.lastName}</h1>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="bg-slate-100 text-slate-700 text-xs px-2 py-1 rounded-full font-mono">
                                ID: {worker.universalId}
                            </span>
                            <span className="text-slate-500 text-sm">Empresa: {worker.company?.name}</span>
                        </div>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button className="px-4 py-2 text-slate-700 font-medium bg-white border border-slate-300 rounded-lg hover:bg-slate-50">
                        Editar Perfil
                    </button>
                    <button className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg shadow-sm">
                        Iniciar Nueva Visita
                    </button>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Info Column */}
                <div className="md:col-span-1 space-y-6">
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                        <h3 className="font-semibold text-slate-900 mb-4">Información Personal</h3>
                        <div className="space-y-3 text-sm">
                            <div className="flex justify-between border-b pb-2">
                                <span className="text-slate-500">Email</span>
                                <span className="text-slate-900">{worker.email || 'N/A'}</span>
                            </div>
                            <div className="flex justify-between border-b pb-2">
                                <span className="text-slate-500">Teléfono</span>
                                <span className="text-slate-900">{worker.phone || 'N/A'}</span>
                            </div>
                            <div className="flex justify-between border-b pb-2">
                                <span className="text-slate-500">ID Nacional</span>
                                <span className="text-slate-900">{worker.nationalId || 'N/A'}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Timeline Column */}
                <div className="md:col-span-2">
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="font-semibold text-slate-900">Historial Médico (Expedientes)</h3>
                            <span className="text-xs text-slate-500">{worker.medicalHistory.length} registros</span>
                        </div>

                        <div className="space-y-4">
                            {worker.medicalHistory.length === 0 ? (
                                <p className="text-slate-500 text-sm italic">No hay historial médico registrado.</p>
                            ) : (
                                worker.medicalHistory.map(event => (
                                    <div key={event.id} className="flex items-start gap-4 p-4 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors border border-slate-100">
                                        <div className="mt-1">
                                            <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex justify-between">
                                                <h4 className="text-sm font-medium text-slate-900">Visita General - {event.status}</h4>
                                                <span className="text-xs text-slate-500">{new Date(event.updatedAt).toLocaleDateString()}</span>
                                            </div>
                                            <p className="text-xs text-slate-600 mt-1">Sucursal: {event.branchId} (TODO: Populate)</p>
                                            <div className="mt-2">
                                                <Link href={`/events/${event.id}`} className="text-xs font-semibold text-blue-600 hover:text-blue-800">
                                                    Ver Expediente Completar &rarr;
                                                </Link>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
