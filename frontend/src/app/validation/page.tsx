export const dynamic = 'force-dynamic'

import prisma from "@/lib/prisma"

async function getValidationQueue() {
    // For demo purposes, we show all events so the user can see the flow immediately.
    // In production: where: { status: 'VALIDATING' }
    return await prisma.medicalEvent.findMany({
        include: {
            worker: {
                include: { company: true }
            },
            studies: true, // To show study count/tags
            labs: true
        },
        orderBy: { createdAt: 'desc' }
    })
}

export default async function ValidationPage() {
    const queue = await getValidationQueue()

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-slate-800">Validación Médica Final</h2>
                <div className="flex gap-2 text-sm text-slate-500">
                    <span>Expedientes en cola: <strong>{queue.length}</strong></span>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {queue.length === 0 && (
                    <div className="col-span-3 text-center py-12 text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                        No hay expedientes pendientes de validación.
                    </div>
                )}
                {queue.map(event => {
                    const studyCount = event.studies.length + event.labs.length
                    const risk = studyCount > 2 ? 'Alto' : 'Bajo'
                    const studiesList = [...event.studies, ...event.labs].map(s => s.serviceName)

                    return (
                        <ValidationCard
                            key={event.id}
                            id={event.id}
                            name={`${event.worker.firstName} ${event.worker.lastName}`}
                            company={event.worker.company?.name || '---'}
                            studies={studiesList.length > 0 ? studiesList : ['Sin Estudios']}
                            risk={risk}
                            phone={event.worker.phone} // Passing real phone
                        />
                    )
                })}
            </div>
        </div>
    )
}

function ValidationCard({ id, name, company, studies, risk, phone }: any) {
    const risks = {
        "Alto": "bg-red-50 text-red-600 border-red-100",
        "Medio": "bg-orange-50 text-orange-600 border-orange-100",
        "Bajo": "bg-green-50 text-green-600 border-green-100"
    } as any

    // Use specific number if available, otherwise generic share
    const waLink = phone
        ? `https://wa.me/${phone}?text=Hola ${name}, su dictamen de ${company} está listo. Descárguelo aquí: https://ami.com/d/${id}`
        : `https://wa.me/?text=Hola ${name}, su dictamen de ${company} está listo. Descárguelo aquí: https://ami.com/d/${id}`

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow group">
            <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h3 className="font-bold text-slate-800 text-lg">{name}</h3>
                        <p className="text-sm text-slate-500">{company}</p>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-bold border ${risks[risk]}`}>Riesgo {risk}</span>
                </div>

                <div className="space-y-2 mb-6 h-20 overflow-hidden">
                    <p className="text-xs font-semibold text-slate-400 uppercase">Estudios Adjuntos</p>
                    <div className="flex flex-wrap gap-2">
                        {studies.map((s: string, i: number) => (
                            <span key={i} className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs">{s}</span>
                        ))}
                    </div>
                </div>

                <div className="flex gap-2">
                    <button className="flex-1 bg-slate-900 text-white py-2 rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors">
                        Revisar y Firmar
                    </button>
                    <button className="bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-2 rounded-lg text-xl transition-colors relative group/tooltip">
                        <a href={waLink} target="_blank" rel="noopener noreferrer">
                            📱
                        </a>
                        {/* Tooltip purely for visual confirmation in screenshot if hovered (hard for agent) */}
                    </button>
                </div>
            </div>
        </div>
    )
}
