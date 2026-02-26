export const dynamic = 'force-dynamic'

import prisma from "@/lib/prisma"
import Link from "next/link"

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
        <div className="space-y-8 pb-12">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight">Validación Médica</h2>
                    <p className="text-sm text-slate-500 font-medium">Revisión, diagnóstico y firma digital de expedientes.</p>
                </div>
                <div className="bg-white px-4 py-2 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-2">
                    <span className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></span>
                    <span className="text-xs font-bold text-slate-600">En cola: <strong className="text-slate-900">{queue.length}</strong></span>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
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

function ValidationCard({ id, name, company, studies, risk, phone }: { id: string, name: string, company: string, studies: string[], risk: 'Alto' | 'Medio' | 'Bajo', phone: string | null }) {
    const risks: Record<string, string> = {
        "Alto": "bg-red-50 text-red-600 border-red-100 shadow-red-100/50",
        "Medio": "bg-amber-50 text-amber-600 border-amber-100 shadow-amber-100/50",
        "Bajo": "bg-emerald-50 text-emerald-600 border-emerald-100 shadow-emerald-100/50"
    }

    const waLink = phone
        ? `https://wa.me/${phone}?text=Hola ${name}, su dictamen de ${company} está listo. Descárguelo aquí: https://ami.com/d/${id}`
        : `https://wa.me/?text=Hola ${name}, su dictamen de ${company} está listo. Descárguelo aquí: https://ami.com/d/${id}`

    return (
        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/40 overflow-hidden hover:scale-[1.02] transition-all group relative">
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-indigo-500/5 to-transparent rounded-bl-full"></div>

            <div className="p-8">
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h3 className="font-black text-slate-800 text-lg uppercase tracking-tight group-hover:text-indigo-600 transition-colors leading-tight">{name}</h3>
                        <p className="text-xs font-bold text-slate-400 mt-1">{company}</p>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black border uppercase tracking-widest ${risks[risk]}`}>{risk}</span>
                </div>

                <div className="space-y-3 mb-8">
                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">Expediente</p>
                    <div className="flex flex-wrap gap-2">
                        {studies.map((s: string, i: number) => (
                            <span key={i} className="bg-slate-50 text-slate-500 px-3 py-1 rounded-xl text-[10px] font-bold border border-slate-100 shadow-inner">
                                {s}
                            </span>
                        ))}
                    </div>
                </div>

                <div className="flex gap-3">
                    <Link href={`/events/${id}`} className="flex-1 bg-slate-900 hover:bg-black text-white py-3.5 rounded-2xl text-xs font-black transition-all shadow-lg shadow-slate-200 text-center uppercase tracking-widest">
                        Revisar
                    </Link>
                    <button className="bg-emerald-500 hover:bg-emerald-600 text-white w-12 h-12 rounded-2xl transition-all shadow-lg shadow-emerald-100 flex items-center justify-center text-xl">
                        <a href={waLink} target="_blank" rel="noopener noreferrer">
                            📱
                        </a>
                    </button>
                </div>
            </div>
        </div>
    )
}
