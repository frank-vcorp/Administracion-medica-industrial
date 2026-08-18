'use server'

/**
 * Data loader para /events/[id].
 * SPEC FIX-20260729-01-BASELINE: extraído del page.tsx para evitar `try/catch`
 * envolviendo JSX (regla react-hooks/error-boundaries). Los errores de Prisma
 * / serialización se propagan al error boundary del segmento (error.tsx).
 */

import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import prisma from '@/lib/prisma'
import { getEventById } from '@/actions/medical-event.actions'
import { getMedicalExam } from '@/actions/medical-exam.actions'
import { getPrefilledDataForEvent } from '@/actions/prefilled-invitation.actions'
import { getWorkerClinicalHistory } from '@/actions/clinical-history.actions'
import { getEventTimeline } from '@/actions/timeline.actions'
import { getIntakeSourceLabel } from './intake-source-label'

const STATUS_NAMES: Record<string, string> = {
  SCHEDULED: 'Ingreso',
  CHECKED_IN: 'En Sala',
  IN_PROGRESS: 'Estudios',
  VALIDATING: 'Validación',
  COMPLETED: 'Completado',
}

const VISUAL_STEP_GROUPS = [
  { primary: 'SCHEDULED', ids: ['SCHEDULED'] as string[], label: 'Ingreso' },
  { primary: 'CHECKED_IN', ids: ['CHECKED_IN', 'IN_PROGRESS'] as string[], label: 'Estudios' },
  { primary: 'VALIDATING', ids: ['VALIDATING'] as string[], label: 'Firma' },
  { primary: 'COMPLETED', ids: ['COMPLETED'] as string[], label: 'Fin' },
]

const STEPS = ['SCHEDULED', 'CHECKED_IN', 'IN_PROGRESS', 'VALIDATING', 'COMPLETED']

export type EventPageData = {
  event: NonNullable<Awaited<ReturnType<typeof getEventById>>>
  serializedExam: unknown
  serializedEventTests: unknown[]
  serializedVerdict: unknown
  /**
   * IMPL-20260817-10-C2 (ARCH-20260817-02 DA-2): snapshot del examen
   * para auto-poblar el dictamen en EventFlowController. `null` si
   * el examen no tiene `physicalExamData` (caso legacy / examen sin
   * captura).
   */
  examSummary: { physicalExamData: Record<string, unknown> } | null
  serializedEventId: string
  serializedStatus: string
  intakeSourceLabel: string
  intakeCreator: { id: string; fullName: string } | null
  projectRef: { id: string; name: string } | null
  eventWithIntake: {
    intakeSource?: string | null
    projectId?: string | null
    intakeCreatedByUserId?: string | null
    appointmentId?: string | null
  }
  workerInfo: {
    name: string
    position: string
    company: string
    profile: string
  }
  review: string
  userRole: string | null
  apiUrl: string
  activeView: string
  steps: string[]
  currentStep: number
  visualStepGroups: typeof VISUAL_STEP_GROUPS
  currentVisualStep: number
  activeViewVisualStep: number
  statusNames: typeof STATUS_NAMES
  prefilledData: unknown
  longitudinalData: unknown
  initialTimeline: unknown[]
  receivedBy: string
  canRegisterPayments: boolean
}

export async function fetchEventPageData(input: {
  id: string
  view?: string
}): Promise<EventPageData | null> {
  const event = await getEventById(input.id)
  if (!event) return null

  // Helper para los pasos: redirect si el shell aún no está sincronizado
  if (!input.view && event.status === 'IN_PROGRESS') {
    const { redirect } = await import('next/navigation')
    redirect(`/events/${input.id}?view=IN_PROGRESS`)
  }

  const examRes = await getMedicalExam(input.id)
  const medicalExam = examRes.success ? examRes.data : null
  const historyRes = await getWorkerClinicalHistory(event.worker.id)
  const prefilledRes = await getPrefilledDataForEvent(input.id)
  const prefilledData =
    prefilledRes.success && prefilledRes.data ? prefilledRes.data.module1Data : null

  const session = await getServerSession(authOptions)
  const reviewerUserId = session?.user?.id ?? 'system'
  const userRole = session?.user?.role ?? null

  let initialTimeline: unknown[] = []
  if (userRole === 'ADMIN') {
    const timelineRes = await getEventTimeline(input.id)
    if (timelineRes.success && timelineRes.data) {
      initialTimeline = timelineRes.data
    }
  }

  const eventWithIntake = event as typeof event & {
    intakeSource?: string | null
    projectId?: string | null
    intakeCreatedByUserId?: string | null
    appointmentId?: string | null
  }

  const [projectRef, intakeCreator] = await Promise.all([
    eventWithIntake.projectId
      ? prisma.project.findUnique({
          where: { id: eventWithIntake.projectId },
          select: { id: true, name: true },
        })
      : Promise.resolve(null),
    eventWithIntake.intakeCreatedByUserId
      ? prisma.user.findUnique({
          where: { id: eventWithIntake.intakeCreatedByUserId },
          select: { id: true, fullName: true },
        })
      : Promise.resolve(null),
  ])

  const intakeSourceLabel = getIntakeSourceLabel(
    eventWithIntake.intakeSource,
    eventWithIntake.appointmentId,
  )

  const serializedExam = JSON.parse(JSON.stringify(medicalExam || {}))

  // IMPL-20260817-10-C2 (ARCH-20260817-02 Corte 3 — DA-2):
  // extraer `physicalExamData` del examen para alimentar el
  // auto-poblamiento del dictamen en `EventFlowController`. Solo
  // pasamos el sub-arbol relevante (no todo `serializedExam` — eso
  // incluye `somatometryData`, `eyeAcuityData`, etc. que no son
  // fuente de aptitud). Defensivo: `physicalExamData` puede ser
  // null si el examen no esta creado.
  const physicalExamData =
    (medicalExam?.physicalExamData as Record<string, unknown> | null | undefined) ?? null
  const examSummary = physicalExamData ? { physicalExamData } : null

  const serializedVerdict = event.verdict
    ? JSON.parse(
        JSON.stringify({
          finalDiagnosis: event.verdict.finalDiagnosis as string,
          recommendations: event.verdict.recommendations as string,
        }),
      )
    : undefined

  type WorkerExtras = { jobPosition?: { name: string } | null }
  type AppointmentExtras = { serviceProfile?: { name: string } | null }

  const workerWithPos = event.worker as typeof event.worker & WorkerExtras
  const appointmentWithProfile = (
    event as typeof event & { appointment?: AppointmentExtras }
  ).appointment

  const workerInfo = {
    name: `${event.worker.firstName} ${event.worker.lastName}`,
    position: workerWithPos.jobPosition?.name || '',
    company:
      event.worker.company?.name ||
      (eventWithIntake.intakeSource === 'EXTERNAL_WALK_IN'
        ? 'Externo sin empresa'
        : '—'),
    profile: appointmentWithProfile?.serviceProfile?.name || '',
  }

  const paymentRoles = [
    'ADMIN',
    'RECEPTIONIST',
    'DOCTOR_GENERAL',
    'DOCTOR_VALIDATOR',
    'CAPTURIST',
  ]
  const canRegisterPayments = !!userRole && paymentRoles.includes(userRole)
  const receivedBy =
    session?.user?.fullName || session?.user?.email || 'Sistema'

  type PrefillSection = Record<string, string | number | boolean>
  type PrefillBase = {
    datos_personales?: PrefillSection
    historia_laboral?: PrefillSection
    heredo_familiares?: PrefillSection
    no_patologicos?: PrefillSection
    patologicos?: PrefillSection
  }

  const histData = historyRes.success
    ? (historyRes.data?.data as Record<string, unknown> | undefined)
    : undefined
  const rootDP = histData?.datos_personales as PrefillSection | undefined
  const rootHL = histData?.historia_laboral as PrefillSection | undefined
  const rootHF = histData?.heredo_familiares as PrefillSection | undefined
  // IMPL-20260809-01 (ARCH-20260809-01): el helper loader antes solo exponía
  // 3 de las 5 secciones declarativas — faltaban `no_patologicos` y `patologicos`.
  // Ahora las 5 viajan en `longitudinalData` para que la nueva outer-tab
  // "Antecedentes" del Examen Médico pueda prefillar desde el historial maestro.
  const rootNP = histData?.no_patologicos as PrefillSection | undefined
  const rootPT = histData?.patologicos as PrefillSection | undefined
  const hasRootLongitudinal = !!(rootDP || rootHL || rootHF || rootNP || rootPT)
  const legacyBase = !hasRootLongitudinal
    ? (histData?.prefill_base as PrefillBase | null | undefined)
    : null

  const longitudinalData = hasRootLongitudinal
    ? {
        ...(rootDP ? { datos_personales: rootDP } : {}),
        ...(rootHL ? { historia_laboral: rootHL } : {}),
        ...(rootHF ? { heredo_familiares: rootHF } : {}),
        ...(rootNP ? { no_patologicos: rootNP } : {}),
        ...(rootPT ? { patologicos: rootPT } : {}),
      }
    : legacyBase

  type EventTestWithExtras = (typeof event.eventTests)[0] & {
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

  const serializedEventTests = JSON.parse(
    JSON.stringify(
      event.eventTests.map((et: EventTestWithExtras) => {
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
        const rawStructured =
          latestExtraction?.structuredData as Record<string, unknown> | null | undefined
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
          test: et.test
            ? {
                code: et.test.code,
                category: et.test.category,
                options: et.test.options ?? null,
              }
            : null,
          aiSnapshot,
          extractionSnapshot,
        }
      }),
    ),
  )

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

  const currentStep = STEPS.indexOf(event.status) + 1
  const requestedView = input.view || event.status
  const requestedStepIndex = STEPS.indexOf(requestedView)
  const activeView = requestedStepIndex < currentStep ? requestedView : event.status

  const currentVisualStep = Math.max(
    1,
    VISUAL_STEP_GROUPS.findIndex((g) => g.ids.includes(event.status)) + 1,
  )
  const activeViewVisualStep = Math.max(
    1,
    VISUAL_STEP_GROUPS.findIndex((g) => g.ids.includes(activeView)) + 1,
  )

  return {
    event,
    serializedExam,
    serializedEventTests,
    serializedVerdict,
    examSummary,
    serializedEventId: event.id,
    serializedStatus: event.status,
    intakeSourceLabel,
    intakeCreator,
    projectRef,
    eventWithIntake,
    workerInfo,
    review: reviewerUserId,
    userRole,
    apiUrl,
    activeView,
    steps: STEPS,
    currentStep,
    visualStepGroups: VISUAL_STEP_GROUPS,
    currentVisualStep,
    activeViewVisualStep,
    statusNames: STATUS_NAMES,
    prefilledData,
    longitudinalData,
    initialTimeline,
    receivedBy,
    canRegisterPayments,
  }
}
