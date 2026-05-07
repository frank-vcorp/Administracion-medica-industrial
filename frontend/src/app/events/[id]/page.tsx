/**
 * @fileoverview Detalle de expediente médico
 * @id IMPL-20260324-06
 * @spec ARCH-20260325-05
 * @backup context/checkpoints/CHK_IMPL-20260324-06-PAPELETA-WORKSPACE.md
 * @intervention ARCH-20260326-07
 * @see context/checkpoints/CHK_IMPL-ARCH-20260326-06.md
 * @intervention ARCH-20260326-10
 * @see context/checkpoints/CHK_IMPL-ARCH-20260326-06.md
 * @intervention ARCH-20260326-04
 * @see context/checkpoints/CHK_IMPL-20260326-04.md
 * @intervention ARCH-20260327-02
 * @see context/checkpoints/CHK_ARCH-20260327-02-MICROAJUSTES-WORKSPACE.md
 * @intervention ARCH-20260327-08
 * @see context/checkpoints/CHK_ARCH-20260327-08-STEPPER-ULTRACOMPACTO.md
 * @intervention ARCH-20260327-09
 * @see context/checkpoints/CHK_ARCH-20260327-09-METADATOS-EN-CABECERA-PRINCIPAL.md
 */

import { getWorkerClinicalHistory } from '@/actions/clinical-history.actions'
import { getEventById } from '@/actions/medical-event.actions'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import EventFlowController from '@/components/EventFlowController'
import PapeletaWorkspace from '@/components/clinical/PapeletaWorkspace'
import { getMedicalExam } from '@/actions/medical-exam.actions'
import { getPrefilledDataForEvent } from '@/actions/prefilled-invitation.actions'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
// IMPL-20260507-08: Cronograma operativo persistente (ARCH-20260507-08)
import PapeletaCronograma from '@/components/clinical/PapeletaCronograma'
import { getEventTimeline } from '@/actions/timeline.actions'

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
        // IMPL-20260326-18: Obtener el usuario actual para revisión médica de paneles IA
        const session = await getServerSession(authOptions)
        const reviewerUserId = session?.user?.id ?? 'system'
        const userRole = session?.user?.role ?? null

        // IMPL-20260507-08: Obtener cronograma si el usuario es ADMIN (ARCH-20260507-08)
        let initialTimeline: unknown[] = []
        if (userRole === 'ADMIN') {
          const timelineRes = await getEventTimeline(id)
          if (timelineRes.success && timelineRes.data) {
            initialTimeline = timelineRes.data
          }
        }

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
        type EventTestWithExtras = typeof event.eventTests[0] & {
          fileUrl?: string | null
          resultNotes?: string | null
          extractionSnapshots?: Array<{
            id: string
            version: number
            structuredData: unknown
            aiPrediagnoses?: Array<{
              id: string
              version: number
              clinicalState: string
              createdAt: Date
              isSuperseded: boolean
              prediagnosisData: unknown
              doctorReviews?: Array<{
                id: string
                doctorStatus: string
                doctorDiagnosis: string | null
                doctorNotes: string | null
                createdAt: Date
              }>
            }>
          }>
        }
        const serializedEventTests = JSON.parse(JSON.stringify(
            event.eventTests.map((et: EventTestWithExtras) => {
                // IMPL-20260326-18: Serializar snapshot IA vigente (no superseded)
                const latestExtraction = et.extractionSnapshots?.[0] ?? null
                const latestPredx = latestExtraction?.aiPrediagnoses?.[0] ?? null
                const aiSnapshot = latestPredx
                    ? {
                        prediagnosisSnapshotId: latestPredx.id,
                        snapshot: {
                            id: latestPredx.id,
                            version: latestPredx.version,
                            clinicalState: latestPredx.clinicalState,
                            createdAt: latestPredx.createdAt,
                            isSuperseded: latestPredx.isSuperseded,
                            prediagnosisData: latestPredx.prediagnosisData,
                            doctorReviews: latestPredx.doctorReviews ?? [],
                        },
                        existingReview: latestPredx.doctorReviews?.[0] ?? null,
                    }
                    : null
                // ARCH-20260326-05: Serializar capa de extracción estructurada del estudio
                // ARCH-20260327-01: Agrega rawPayload (structuredData completo) para panel raw
                const rawStructured = latestExtraction?.structuredData as Record<string, unknown> | null | undefined
                const extractionSnapshot = latestExtraction
                    ? {
                        id: latestExtraction.id,
                        version: latestExtraction.version,
                        extractedData: rawStructured?.extracted_data ?? null,
                        missingFields: rawStructured?.missing_fields ?? null,
                        rawPayload: rawStructured ?? null,
                    }
                    : null
                return {
                    id: et.id,
                    testNameSnapshot: et.testNameSnapshot,
                    status: et.status,
                    fileUrl: et.fileUrl ?? null,
                    resultNotes: et.resultNotes ?? null,
                    test: et.test ? {
                        code: et.test.code,
                        category: et.test.category,
                        // ARCH-20260507-06: options para resolver sampleGroup en PapeletaWorkspace
                        options: et.test.options ?? null,
                    } : null,
                    aiSnapshot,
                    extractionSnapshot,
                }
            })
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

        // IMPL-20260326-04: 4 pasos visuales — CHECKED_IN e IN_PROGRESS fusionados en “Estudios”
        const visualStepGroups = [
            { primary: 'SCHEDULED', ids: ['SCHEDULED'] as string[], label: 'Ingreso' },
            { primary: 'CHECKED_IN', ids: ['CHECKED_IN', 'IN_PROGRESS'] as string[], label: 'Estudios' },
            { primary: 'VALIDATING', ids: ['VALIDATING'] as string[], label: 'Firma' },
            { primary: 'COMPLETED', ids: ['COMPLETED'] as string[], label: 'Fin' },
        ]
        const currentVisualStep = Math.max(1, visualStepGroups.findIndex(g => g.ids.includes(event.status)) + 1)
        const activeViewVisualStep = Math.max(1, visualStepGroups.findIndex(g => g.ids.includes(activeView)) + 1)

        return (
            <div className="space-y-3 max-w-[1500px] mx-auto pb-10 px-3 md:px-4 xl:px-5">
                {/* 1. Header Premium with Stepper */}
                {/* ARCH-20260327-08: Header ultra-compacto — prioriza el viewport del estudio activo */}
                <div className="bg-white px-4 py-2.5 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-teal-500 text-white rounded-lg flex items-center justify-center text-sm shadow shadow-teal-100 shrink-0">
                                👤
                            </div>
                            <div>
                                <h1 className="text-base font-bold text-slate-800 leading-tight">{event.worker.lastName}, {event.worker.firstName}</h1>
                                <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                                    {workerInfo.position && <span className="font-semibold text-slate-700">{workerInfo.position}</span>}
                                    {workerInfo.position && workerInfo.profile && <span>•</span>}
                                    {workerInfo.profile && (
                                        <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[10px] font-medium text-slate-600">
                                            {workerInfo.profile}
                                        </span>
                                    )}
                                    {(workerInfo.position || workerInfo.profile) && workerInfo.company && <span>•</span>}
                                    <span className="font-medium text-slate-600">{event.worker.company?.name || '---'}</span>
                                    <span>•</span>
                                    <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-[10px]">#{event.id.slice(0, 8)}</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                            <Link
                                href={`/workers/${event.worker.id}`}
                                className="bg-white hover:bg-slate-50 text-slate-700 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors border border-slate-200"
                            >
                                Ficha trabajador
                            </Link>
                            <Link
                                href={`/history/${event.worker.id}`}
                                className="bg-white hover:bg-slate-50 text-slate-700 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors border border-slate-200"
                            >
                                Historial clínico
                            </Link>
                            <div className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors ${event.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                                {statusNames[event.status] || event.status}
                            </div>
                            <Link href="/reception" className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors flex items-center">
                                ← Volver
                            </Link>
                        </div>
                    </div>

                    {/* ARCH-20260327-08: Stepper en formato pill — menos altura y lectura más rápida */}
                    <div className="flex flex-wrap items-center gap-1.5 md:gap-2">
                        {visualStepGroups.map((group, index) => {
                            const vStep = index + 1
                            const isClickable = vStep <= currentVisualStep
                            const isSelectedView = vStep === activeViewVisualStep
                            const isCompleted = vStep < currentVisualStep

                            const stepClasses = isSelectedView
                                ? 'bg-teal-500 text-white border-teal-500 shadow-sm shadow-teal-100'
                                : isCompleted
                                    ? 'bg-teal-50 text-teal-700 border-teal-200'
                                    : isClickable
                                        ? 'bg-white text-slate-700 border-slate-200 hover:border-teal-200 hover:text-teal-700'
                                        : 'bg-slate-50 text-slate-400 border-slate-200'

                            const content = (
                                <div className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${stepClasses}`}>
                                    <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold ${isSelectedView ? 'bg-white/20 text-white' : isCompleted ? 'bg-teal-100 text-teal-700' : 'bg-slate-100 text-slate-500'}`}>
                                        {isCompleted ? '✓' : vStep}
                                    </span>
                                    <span className="leading-none">{group.label}</span>
                                </div>
                            )

                            return isClickable ? (
                                <Link key={group.primary} href={`/events/${id}?view=${group.primary}`} className="shrink-0">
                                    {content}
                                </Link>
                            ) : (
                                <div key={group.primary} className="shrink-0">
                                    {content}
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
                        reviewerUserId={reviewerUserId}
                        readonly={currentStep > 3}
                        apiUrl={apiUrl}
                        examData={serializedExam}
                        prefilledData={prefilledData ? JSON.parse(JSON.stringify(prefilledData)) : null}
                        longitudinalData={longitudinalData ? JSON.parse(JSON.stringify(longitudinalData)) : null}
                    />
                )}

                {/* IMPL-20260507-08: Cronograma operativo persistente — solo ADMIN (ARCH-20260507-08) */}
                {(activeView === 'CHECKED_IN' || activeView === 'IN_PROGRESS') && userRole === 'ADMIN' && (
                    <PapeletaCronograma
                        eventId={serializedEventId}
                        initialEntries={initialTimeline as Parameters<typeof PapeletaCronograma>[0]['initialEntries']}
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
