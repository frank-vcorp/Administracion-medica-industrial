import { getEventById } from '@/actions/medical-event.actions'
import { notFound } from 'next/navigation'
import SmartDropzone from '@/components/SmartDropzone'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const event = await getEventById(id)

    if (!event) {
        notFound()
    }

    return (
        <div className="space-y-8">
            {/* 1. Header Green (Mockup) */}
            <div className="bg-teal-600 text-white p-4 rounded-lg shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex flex-col">
                    <span className="text-teal-200 text-xs uppercase font-semibold">Paciente</span>
                    <span className="text-lg font-bold">{event.worker.lastName}, {event.worker.firstName}</span>
                </div>
                <div className="flex flex-col">
                    <span className="text-teal-200 text-xs uppercase font-semibold">Empresa</span>
                    <span className="font-medium">{event.worker.company?.name || '---'}</span>
                </div>
                <div className="flex flex-col text-right">
                    <span className="text-teal-200 text-xs uppercase font-semibold">Folio</span>
                    <span className="font-mono bg-teal-700 px-2 py-0.5 rounded text-sm">#{event.id.slice(0, 8)}</span>
                </div>
            </div>

            {/* 2. Upload Section (Two Cards) */}
            <div>
                <p className="text-sm text-slate-500 mb-2">Arrastra y suelta los PDFs de estudios - La IA los clasificará automáticamente</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                    {/* Card Left: SIM / Clinical */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                        <h3 className="font-bold text-slate-800 mb-4">Estudios SIM (Clínicos)</h3>
                        <div className="bg-white">
                            <SmartDropzone
                                eventId={event.id}
                                type="study"
                                title="Arrastra archivos aquí"
                                subtitle="Espirometría, Audiometría, ECG, Campimetría"
                                icon="cloud"
                            />
                        </div>
                    </div>

                    {/* Card Right: NOVA / Labs */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                        <h3 className="font-bold text-slate-800 mb-4">Estudios NOVA (Laboratorio)</h3>
                        <div className="bg-white">
                            <SmartDropzone
                                eventId={event.id}
                                type="lab"
                                title="Arrastra archivos aquí"
                                subtitle="Biometría Hemática, EGO, Química Sanguínea"
                                icon="flask"
                            />
                        </div>
                    </div>

                </div>
            </div>

            {/* 3. Processed Lists */}
            <div className="pt-4">
                <h2 className="text-xl font-bold text-slate-800 mb-1">Estudios Procesados</h2>
                <p className="text-sm text-slate-500 mb-6">Expediente completo procesado y clasificado por IA</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                    {/* List Left: Studies */}
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 flex justify-between items-center">
                            <h3 className="font-bold text-slate-700">Estudios SIM (Clínicos)</h3>
                            <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">{event.studies.length} estudios</span>
                        </div>
                        <div className="divide-y divide-slate-100">
                            {event.studies.length === 0 && <p className="p-6 text-center text-slate-400 text-xs">Sin registros</p>}
                            {event.studies.map(s => (
                                <ItemRow key={s.id} name={s.serviceName} date={s.createdAt} type="study" />
                            ))}
                        </div>
                    </div>

                    {/* List Right: Labs */}
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 flex justify-between items-center">
                            <h3 className="font-bold text-slate-700">Estudios NOVA (Laboratorio)</h3>
                            <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">{event.labs.length} estudios</span>
                        </div>
                        <div className="divide-y divide-slate-100">
                            {event.labs.length === 0 && <p className="p-6 text-center text-slate-400 text-xs">Sin registros</p>}
                            {event.labs.map(l => (
                                <ItemRow key={l.id} name={l.serviceName} date={l.createdAt} type="lab" />
                            ))}
                        </div>
                    </div>

                </div>
            </div>

        </div>
    )
}

function ItemRow({ name, date, type }: { name: string, date: Date, type: 'study' | 'lab' }) {
    const isAnalying = name.includes('Analizando')
    return (
        <div className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors group">
            <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded flex items-center justify-center text-lg ${type === 'study' ? 'bg-blue-50 text-blue-500' : 'bg-purple-50 text-purple-500'}`}>
                    {type === 'study' ? '🫁' : '🧪'}
                </div>
                <div>
                    <p className="text-sm font-medium text-slate-700">{name}</p>
                    <p className="text-xs text-slate-400">Subido: {new Date(date).toLocaleTimeString()}</p>
                </div>
            </div>
            <div>
                {isAnalying ? (
                    <span className="bg-yellow-100 text-yellow-700 text-xs px-2 py-1 rounded font-medium animate-pulse">
                        Procesando
                    </span>
                ) : (
                    <div className="flex items-center gap-3">
                        <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded font-medium">Procesado</span>
                        <button className="text-slate-300 hover:text-blue-500">👁️</button>
                    </div>
                )}
            </div>
        </div>
    )
}
