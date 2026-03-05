import { getEventById } from '@/actions/medical-event.actions'
import { notFound } from 'next/navigation'
import SmartDropzone from '@/components/SmartDropzone'
import Link from 'next/link'
import EventFlowController from '@/components/EventFlowController'
import TriageForm from '@/components/clinical/TriageForm'
import DoctorExamForm from '@/components/clinical/DoctorExamForm'
import { getMedicalExam } from '@/actions/medical-exam.actions'

export const dynamic = 'force-dynamic'

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const event = await getEventById(id)
    const examRes = await getMedicalExam(id)
    const medicalExam = examRes.success ? examRes.data : null

    if (!event) {
        notFound()
    }

    const statusNames: Record<string, string> = {
        'SCHEDULED': 'Ingreso',
        'CHECKED_IN': 'En Sala',
        'IN_PROGRESS': 'Estudios',
        'VALIDATING': 'Validación',
        'COMPLETED': 'Completado'
    }

    const steps = ['SCHEDULED', 'CHECKED_IN', 'IN_PROGRESS', 'VALIDATING', 'COMPLETED']
    const currentStep = steps.indexOf(event.status) + 1

    return (
        <div className="space-y-8 max-w-6xl mx-auto pb-20">
            {/* 1. Header Premium with Stepper */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-teal-500 text-white rounded-2xl flex items-center justify-center text-2xl shadow-lg shadow-teal-100">
                            👤
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-800">{event.worker.lastName}, {event.worker.firstName}</h1>
                            <div className="flex items-center gap-2 text-sm text-slate-500">
                                <span className="font-semibold text-slate-700">{event.worker.company?.name || '---'}</span>
                                <span>•</span>
                                <span className="font-mono bg-slate-100 px-2 py-0.5 rounded text-xs">#{event.id.slice(0, 8)}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <div className={`px-4 py-2 rounded-xl text-sm font-bold border transition-colors ${event.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                            {statusNames[event.status] || event.status}
                        </div>
                        <Link href="/reception" className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-2 rounded-xl text-sm font-medium transition-colors flex items-center">
                            ← Volver
                        </Link>
                    </div>
                </div>

                {/* Stepper Logic */}
                <div className="relative flex justify-between items-center max-w-2xl mx-auto px-4">
                    <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-100 -translate-y-1/2 z-0"></div>
                    <div className="absolute top-1/2 left-0 h-0.5 bg-teal-500 -translate-y-1/2 z-0 transition-all duration-700" style={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}></div>

                    {steps.map((s, index) => {
                        const step = index + 1
                        return (
                            <div key={s} className="relative z-10 flex flex-col items-center">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-500 border-2 ${step <= currentStep
                                    ? 'bg-teal-500 text-white border-teal-500 scale-110 shadow-lg shadow-teal-100'
                                    : 'bg-white text-slate-400 border-slate-200'
                                    }`}>
                                    {step < currentStep ? '✓' : step}
                                </div>
                                <span className={`text-[10px] absolute -bottom-6 font-bold uppercase tracking-tighter whitespace-nowrap ${step <= currentStep ? 'text-teal-600' : 'text-slate-400'}`}>
                                    {['Ingreso', 'Sala', 'Estudios', 'Firma', 'Fin'][index]}
                                </span>
                            </div>
                        )
                    })}
                </div>
            </div>

            
            {/* TRIAJE / ENFERMERIA */}
            {event.status === 'CHECKED_IN' && (
                <TriageForm eventId={event.id} initialData={medicalExam?.somatometryData || {}} />
            )}

            {/* DOCTOR / EXPLORACION Y AGUDEZA */}
            {event.status === 'IN_PROGRESS' && (
                <DoctorExamForm eventId={event.id} initialData={medicalExam || {}} />
            )}

            {/* 2. Upload Section (Two Cards) - Visual Cleanup */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Card Left: SIM / Clinical */}
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center text-xl">☁️</div>
                        <h3 className="font-bold text-slate-800 text-lg">Estudios SIM (Clínicos)</h3>
                    </div>
                    <SmartDropzone
                        eventId={event.id}
                        type="study"
                        title="Selecciona archivos para SIM"
                        subtitle="Espirometría, Audiometría, ECG, Campimetría"
                        icon="cloud"
                    />
                </div>

                {/* Card Right: NOVA / Labs */}
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center text-xl">🧪</div>
                        <h3 className="font-bold text-slate-800 text-lg">Estudios NOVA (Laboratorio)</h3>
                    </div>
                    <SmartDropzone
                        eventId={event.id}
                        type="lab"
                        title="Selecciona archivos para NOVA"
                        subtitle="Biometría Hemática, EGO, Química Sanguínea"
                        icon="flask"
                    />
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

            {/* 4. Flow Controller Section */}
            <EventFlowController
                eventId={event.id}
                currentStatus={event.status}
                verdictData={event.verdict ? {
                    finalDiagnosis: event.verdict.finalDiagnosis as string,
                    recommendations: event.verdict.recommendations as string
                } : undefined}
            />
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
