/**
 * @fileoverview Detalle de expediente médico
 * @id IMPL-20260324-06
 * @spec ARCH-20260325-05
 * @backup context/checkpoints/CHK_IMPL-20260324-06-PAPELETA-WORKSPACE.md
 * @intervention ARCH-20260326-07
 * @see context/checkpoints/CHK_IMPL-ARCH-20260326-06.md
 * @intervention ARCH-20260326-10
 * @see context/checkpoints/CHK_IMPL-ARCH-20260326-06.md
 */

import { getWorkerClinicalHistory } from '@/actions/clinical-history.actions'
import { getEventById } from '@/actions/medical-event.actions'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import EventFlowController from '@/components/EventFlowController'
import PapeletaWorkspace from '@/components/clinical/PapeletaWorkspace'
import { getMedicalExam } from '@/actions/medical-exam.actions'
import { getPrefilledDataForEvent } from '@/actions/prefilled-invitation.actions'

export const dynamic = 'force-dynamic'

/**
 * @intervention FIX-20260306-01
 * @see context/interconsultas/DICTAMEN_FIX-20260306-01.md
 */
export default async function EventPage(props: { params: Promise<{ id: string }>, searchParams: Promise<{ view?: string }> }) {
    const { id } = await props.params
    const searchParams = await props.searchParams

    try {
        const event = await getEventById(id)
        const examRes = await getMedicalExam(id)
        const medicalExam = examRes.success ? examRes.data : null
        const historyRes = await getWorkerClinicalHistory(event?.worker.id ?? '')
        // IMPL-20260325-08: Obtener snapshot del portal (PrefilledInvitation.module1Data)
        const prefilledRes = await getPrefilledDataForEvent(id)
        const prefilledData = prefilledRes.success && prefilledRes.data ? prefilledRes.data.module1Data : null

        if (!event) {
            notFound()
        }

        // Serialización defensiva para evitar problemas con objetos Date en componentes cliente
        const serializedExam = JSON.parse(JSON.stringify(medicalExam || {}))
        const serializedEventId = event.id
        const serializedStatus = event.status
        const serializedVerdict = event.verdict ? JSON.parse(JSON.stringify({
            finalDiagnosis: event.verdict.finalDiagnosis as string,
            recommendations: event.verdict.recommendations as string
        })) : undefined

        // IMPL-20260324-06: Preparar datos del worker para cabecera persistente del workspace
        // Type assertion para los includes de Prisma que no forman parte del tipo base generado
        type WorkerExtras = { jobPosition?: { name: string } | null }
        type AppointmentExtras = { serviceProfile?: { name: string } | null }
        const workerWithPos = event.worker as typeof event.worker & WorkerExtras
        const appointmentWithProfile = (event as typeof event & { appointment?: AppointmentExtras }).appointment

        const workerInfo = {
            name: `${event.worker.firstName} ${event.worker.lastName}`,
            position: workerWithPos.jobPosition?.name || '',
            company: event.worker.company?.name || '—',
            profile: appointmentWithProfile?.serviceProfile?.name || ''
        }

        type PrefillSection = Record<string, string | number | boolean>
        type PrefillBase = {
            datos_personales?: PrefillSection
            historia_laboral?: PrefillSection
            heredo_familiares?: PrefillSection
        }

        const histData = historyRes.success
            ? (historyRes.data?.data as Record<string, unknown> | undefined)
            : undefined
        const rootDP = histData?.datos_personales as PrefillSection | undefined
        const rootHL = histData?.historia_laboral as PrefillSection | undefined
        const rootHF = histData?.heredo_familiares as PrefillSection | undefined
        const hasRootLongitudinal = !!(rootDP || rootHL || rootHF)
        const legacyBase = !hasRootLongitudinal
            ? (histData?.prefill_base as PrefillBase | null | undefined)
            : null

        const longitudinalData = hasRootLongitudinal
            ? {
                ...(rootDP ? { datos_personales: rootDP } : {}),
                ...(rootHL ? { historia_laboral: rootHL } : {}),
                ...(rootHF ? { heredo_familiares: rootHF } : {}),
            }
            : legacyBase

        // IMPL-20260324-06: Serializar eventTests para el workspace (incluye fileUrl y status nuevos)
        type EventTestWithExtras = typeof event.eventTests[0] & { fileUrl?: string | null, resultNotes?: string | null }
        const serializedEventTests = JSON.parse(JSON.stringify(
            event.eventTests.map((et: EventTestWithExtras) => ({
                id: et.id,
                testNameSnapshot: et.testNameSnapshot,
                status: et.status,
                fileUrl: et.fileUrl ?? null,
                resultNotes: et.resultNotes ?? null,
                test: et.test ? {
                    code: et.test.code,
                    category: et.test.category
                } : null
            }))
        ))

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

        const statusNames: Record<string, string> = {
            'SCHEDULED': 'Ingreso',
            'CHECKED_IN': 'En Sala',
            'IN_PROGRESS': 'Estudios',
            'VALIDATING': 'Validación',
            'COMPLETED': 'Completado'
        }

        const steps = ['SCHEDULED', 'CHECKED_IN', 'IN_PROGRESS', 'VALIDATING', 'COMPLETED']
        const currentStep = steps.indexOf(event.status) + 1

        // Cuando el evento ya esta en Estudios y la URL aun no fija la vista, redirigimos
        // para que el shell principal entre correctamente en modo workspace.
        if (!searchParams?.view && event.status === 'IN_PROGRESS') {
            redirect(`/events/${id}?view=IN_PROGRESS`)
        }

        // Determinamos la vista activa (por defecto el estado real, o el que el usuario haya cliqueado si es previo/actual)
        const requestedView = searchParams?.view || event.status
        const requestedStepIndex = steps.indexOf(requestedView)
        // Evitamos que puedan ver pasos futuros que aún no tienen data
        const activeView = requestedStepIndex < currentStep ? requestedView : event.status
        const activeViewStep = steps.indexOf(activeView) + 1

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
                            <Link
                                href={`/workers/${event.worker.id}`}
                                className="bg-white hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-xl text-sm font-medium transition-colors border border-slate-200"
                            >
                                Ver ficha trabajador
                            </Link>
                            <Link
                                href={`/history/${event.worker.id}`}
                                className="bg-white hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-xl text-sm font-medium transition-colors border border-slate-200"
                            >
                                Ver historial clínico
                            </Link>
                            <div className={`px-4 py-2 rounded-xl text-sm font-bold border transition-colors ${event.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                                {statusNames[event.status] || event.status}
                            </div>
                            <Link href="/reception" className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-2 rounded-xl text-sm font-medium transition-colors flex items-center">
                                ← Volver
                            </Link>
                        </div>
                    </div>

                    {/* Stepper Logic (Clickable para pasos anteriores/actuales) */}
                    <div className="relative flex justify-between items-center max-w-2xl mx-auto px-4">
                        <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-100 -translate-y-1/2 z-0"></div>
                        <div className="absolute top-1/2 left-0 h-0.5 bg-teal-500 -translate-y-1/2 z-0 transition-all duration-700" style={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}></div>

                        {steps.map((s, index) => {
                            const step = index + 1
                            const isClickable = step <= currentStep
                            // Remarcamos visualmente si es la pestaña actualmente seleccionada por el usuario (activeViewStep)
                            const isSelectedView = step === activeViewStep

                            return (
                                <div key={s} className="relative z-10 flex flex-col items-center">
                                    {isClickable ? (
                                        <Link href={`/events/${id}?view=${s}`}>
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-500 border-2 cursor-pointer hover:scale-110 ${isSelectedView
                                                ? 'bg-teal-500 text-white border-teal-500 shadow-lg shadow-teal-200 scale-110'
                                                : 'bg-white text-teal-600 border-teal-400'
                                                }`}>
                                                {step < currentStep && !isSelectedView ? '✓' : step}
                                            </div>
                                        </Link>
                                    ) : (
                                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-500 border-2 bg-white text-slate-400 border-slate-200">
                                            {step}
                                        </div>
                                    )}
                                    <span className={`text-[10px] absolute -bottom-6 font-bold uppercase tracking-tighter whitespace-nowrap ${step <= currentStep ? 'text-teal-600' : 'text-slate-400'}`}>
                                        {['Ingreso', 'Sala', 'Estudios', 'Firma', 'Fin'][index]}
                                    </span>
                                </div>
                            )
                        })}
                    </div>
                </div>


                {/* PASO 2 y 3: WORKSPACE DE PAPELETA DE ESTUDIOS (ARCH-20260325-05) */}
                {/* Somatometría y Agudeza Visual son EventTests independientes dentro de la Papeleta. */}
                {/* TriageForm global eliminado: CHECKED_IN e IN_PROGRESS comparten el mismo workspace. */}
                {(activeView === 'CHECKED_IN' || activeView === 'IN_PROGRESS') && (
                    <PapeletaWorkspace
                        eventId={serializedEventId}
                        eventTests={serializedEventTests}
                        workerInfo={workerInfo}
                        workerId={event.worker.id}
                        readonly={currentStep > 3}
                        apiUrl={apiUrl}
                        examData={serializedExam}
                        prefilledData={prefilledData ? JSON.parse(JSON.stringify(prefilledData)) : null}
                        longitudinalData={longitudinalData ? JSON.parse(JSON.stringify(longitudinalData)) : null}
                    />
                )}

                {/* 4. Flow Controller Section (Fuera de Estudios, ya que Paso 3 ahora vive dentro de la papeleta) */}
                {activeView === event.status && event.status !== 'IN_PROGRESS' && (
                    <EventFlowController
                        eventId={serializedEventId}
                        currentStatus={serializedStatus}
                        verdictData={serializedVerdict}
                    />
                )}
            </div>
        )
    } catch (error) {
        if (
            typeof error === 'object' &&
            error !== null &&
            'digest' in error &&
            typeof error.digest === 'string' &&
            (
                error.digest.startsWith('NEXT_REDIRECT') ||
                error.digest.startsWith('NEXT_HTTP_ERROR_FALLBACK')
            )
        ) {
            throw error
        }

        console.error("Critical Error in EventPage:", error)
        return (
            <div className="p-8 bg-red-50 border border-red-200 rounded-2xl text-center">
                <h2 className="text-xl font-bold text-red-700 mb-2">Error al cargar el expediente</h2>
                <p className="text-red-500 text-sm">Hubo un problema de conexión con el servidor de base de datos o de serialización de datos.</p>
                <div className="mt-4">
                    <Link href="/reception" className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-bold">Volver al Piso Clínico</Link>
                </div>
            </div>
        )
    }
}

// IMPL-20260324-06: ItemRow, getEventTestStatusLabel y getEventTestBadgeClass eliminados.
// La gestión de estudios ahora vive en PapeletaWorkspace con sus propios helpers.
