/**
 * @fileoverview Detalle de expediente médico — Server Component
 * @id IMPL-20260324-06
 * @spec ARCH-20260325-05
 *
 * SPEC FIX-20260729-01-BASELINE: el `try/catch` envolvente de JSX se ha
 * extraído a `error.tsx`. La página solo prepara datos y delega el render
 * a <EventView data={data} />. Errores reales se dejan propagar para que
 * error.tsx los capture con reset().
 */

import Link from 'next/link'
import { notFound } from 'next/navigation'
import EventFlowController from '@/components/EventFlowController'
import PapeletaWorkspace from '@/components/clinical/PapeletaWorkspace'
import PapeletaCronograma from '@/components/clinical/PapeletaCronograma'
import PaymentModalTrigger from '@/components/clinical/PaymentModalTrigger'
import { LabSection } from './_components/LabSection'
import {
  fetchEventPageData,
  type EventPageData,
} from './_lib/event-page-data'

export const dynamic = 'force-dynamic'

type EventViewProps = { data: EventPageData }

function EventView({ data }: EventViewProps) {
  const {
    event,
    serializedEventTests,
    serializedExam,
    serializedVerdict,
    serializedEventId,
    serializedStatus,
    intakeSourceLabel,
    intakeCreator,
    projectRef,
    eventWithIntake,
    workerInfo,
    review: reviewerUserId,
    userRole,
    apiUrl,
    activeView,
    currentStep,
    visualStepGroups,
    currentVisualStep,
    activeViewVisualStep,
    statusNames,
    prefilledData,
    longitudinalData,
    initialTimeline,
    receivedBy,
    canRegisterPayments,
    examSummary,
    hasMedicalVerdict,
  } = data

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
            {/* IMPL-20260630-01: Trigger del modal de pago y recibo (ARCH-20260630-01) */}
            <PaymentModalTrigger
              eventId={event.id}
              workerId={event.worker.id}
              workerFirstName={event.worker.firstName}
              workerLastName={event.worker.lastName}
              universalId={event.worker.universalId}
              companyName={workerInfo.company}
              branchName={event.branch?.name ?? null}
              receivedBy={receivedBy}
              canRegisterPayments={canRegisterPayments}
            />
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

        <div className="mb-3 grid gap-2 md:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Origen de ingreso</p>
            <p className="mt-1 text-sm font-semibold text-slate-700">{intakeSourceLabel}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Proyecto</p>
            <p className="mt-1 text-sm font-semibold text-slate-700">{projectRef ? `${projectRef.name} · ${projectRef.id.slice(0, 8)}` : 'Sin proyecto'}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Cita asociada</p>
            <p className="mt-1 text-sm font-semibold text-slate-700">{eventWithIntake.appointmentId ? eventWithIntake.appointmentId.slice(0, 8) : 'Sin cita'}</p>
            {intakeCreator && (
              <p className="mt-1 text-[11px] text-slate-500">Admisión por {intakeCreator.fullName}</p>
            )}
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
              <Link key={group.primary} href={`/events/${data.event.id}?view=${group.primary}`} className="shrink-0">
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
          eventTests={serializedEventTests as Parameters<typeof PapeletaWorkspace>[0]['eventTests']}
          workerInfo={workerInfo}
          workerId={event.worker.id}
          reviewerUserId={reviewerUserId}
          readonly={currentStep > 3}
          apiUrl={apiUrl}
          examData={serializedExam as Parameters<typeof PapeletaWorkspace>[0]['examData']}
          prefilledData={prefilledData ? JSON.parse(JSON.stringify(prefilledData)) : null}
          longitudinalData={longitudinalData ? JSON.parse(JSON.stringify(longitudinalData)) : null}
          hasMedicalVerdict={hasMedicalVerdict}
        />
      )}

      {/* IMPL-20260507-08: Cronograma operativo persistente — solo ADMIN (ARCH-20260507-08) */}
      {(activeView === 'CHECKED_IN' || activeView === 'IN_PROGRESS') && userRole === 'ADMIN' && (
        <PapeletaCronograma
          eventId={serializedEventId}
          initialEntries={initialTimeline as Parameters<typeof PapeletaCronograma>[0]['initialEntries']}
        />
      )}

      {/* IMPL-20260707-16: Slice C — Sección Laboratorio (LabOrders + LabResults) */}
      {(activeView === 'CHECKED_IN' || activeView === 'IN_PROGRESS' || activeView === 'VALIDATING') && userRole === 'ADMIN' && (
        <LabSection
          medicalEventId={serializedEventId}
          workerId={event.worker.id}
        />
      )}

      {/* 4. Flow Controller Section (Fuera de Estudios, ya que Paso 3 ahora vive dentro de la papeleta) */}
      {activeView === event.status && event.status !== 'IN_PROGRESS' && (
        <EventFlowController
          eventId={serializedEventId}
          currentStatus={serializedStatus}
          verdictData={serializedVerdict as Parameters<typeof EventFlowController>[0]['verdictData']}
          examSummary={examSummary ?? undefined}
          hasMedicalVerdict={hasMedicalVerdict}
        />
      )}
    </div>
  )
}

export default async function EventPage(props: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ view?: string }>
}) {
  const { id } = await props.params
  const searchParams = await props.searchParams
  const data = await fetchEventPageData({ id, view: searchParams?.view })
  if (!data) notFound()
  return <EventView data={data} />
}

// Re-export helper para stepper de status (no usado fuera, conservado por trazabilidad)
export { getIntakeSourceLabel } from './_lib/intake-source-label'
