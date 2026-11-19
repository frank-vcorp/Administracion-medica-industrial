import { beforeEach, describe, expect, it, vi } from 'vitest'
import { applyExploracionFisicaDefaults } from '@/schemas/clinical/exam.schema'
import { CLOSED_CAPTURE_EDIT_DENIED } from '@/lib/clinical/papeleta-readonly'
import { shouldRenderEventFlowController } from '@/app/events/[id]/_lib/event-flow-visibility'

const mockGetServerSession = vi.fn()
const mockUserFindUnique = vi.fn()
const mockMedicalExamFindUnique = vi.fn()
const mockMedicalExamUpsert = vi.fn()
const mockEventTestFindUnique = vi.fn()
const mockEventTestUpdate = vi.fn()
const mockMedicalEventFindMany = vi.fn()
const mockMedicalEventFindUnique = vi.fn()
const mockMedicalEventUpdate = vi.fn()
const mockTimelineFindMany = vi.fn()
const mockAuditLogCreate = vi.fn()
const mockPrefilledInvitationFindUnique = vi.fn()
const mockProjectFindUnique = vi.fn()
const mockTransaction = vi.fn()
const mockRevalidatePath = vi.fn()
const mockTriggerAI = vi.fn()
const mockWriteTimelineEntry = vi.fn()
const mockGetEventById = vi.fn()
const mockGetWorkerClinicalHistory = vi.fn()
const mockGetTimelineForEvent = vi.fn()
const mockFindLatestWorkerAntecedentesCaptured = vi.fn()

vi.mock('next-auth', () => ({
  getServerSession: (...args: unknown[]) => mockGetServerSession(...args),
}))
vi.mock('@/auth', () => ({ authOptions: {} }))
vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}))
vi.mock('@/lib/prisma', () => ({
  default: {
    user: { findUnique: (...a: unknown[]) => mockUserFindUnique(...a) },
    medicalExam: {
      findUnique: (...a: unknown[]) => mockMedicalExamFindUnique(...a),
      upsert: (...a: unknown[]) => mockMedicalExamUpsert(...a),
    },
    eventTest: {
      findUnique: (...a: unknown[]) => mockEventTestFindUnique(...a),
      update: (...a: unknown[]) => mockEventTestUpdate(...a),
    },
    medicalEvent: {
      findMany: (...a: unknown[]) => mockMedicalEventFindMany(...a),
      findUnique: (...a: unknown[]) => mockMedicalEventFindUnique(...a),
      update: (...a: unknown[]) => mockMedicalEventUpdate(...a),
    },
    papeletaTimelineEntry: {
      findMany: (...a: unknown[]) => mockTimelineFindMany(...a),
    },
    auditLog: {
      create: (...a: unknown[]) => mockAuditLogCreate(...a),
    },
    prefilledInvitation: {
      findUnique: (...a: unknown[]) => mockPrefilledInvitationFindUnique(...a),
    },
    project: {
      findUnique: (...a: unknown[]) => mockProjectFindUnique(...a),
    },
    $transaction: (...a: unknown[]) => mockTransaction(...a),
  },
}))
vi.mock('@/actions/ai-prediagnosis.actions', () => ({
  triggerStructuredStudyAIPrediagnosis: (...a: unknown[]) => mockTriggerAI(...a),
}))
vi.mock('@/lib/timeline.service', () => ({
  writeTimelineEntry: (...a: unknown[]) => mockWriteTimelineEntry(...a),
  getTimelineForEvent: (...a: unknown[]) => mockGetTimelineForEvent(...a),
}))
vi.mock('@/actions/medical-event.actions', () => ({
  getEventById: (...a: unknown[]) => mockGetEventById(...a),
}))
vi.mock('@/actions/clinical-history.actions', () => ({
  getWorkerClinicalHistory: (...a: unknown[]) => mockGetWorkerClinicalHistory(...a),
}))
vi.mock('@/lib/clinical/worker-antecedentes-prefill', () => ({
  buildWorkerLongitudinalAntecedentesPrefill: () => null,
  findLatestWorkerAntecedentesCaptured: (...a: unknown[]) =>
    mockFindLatestWorkerAntecedentesCaptured(...a),
}))

const { saveExamenMedicoPapeleta } = await import('@/actions/medical-exam.actions')
const { getEventsKanban, dischargePatientFromReception } = await import('@/actions/event.actions')
const { fetchEventPageData } = await import('@/app/events/[id]/_lib/event-page-data')

function completeExamPayload() {
  return {
    ...applyExploracionFisicaDefaults({}),
    estado_nutricional: 'NORMAL',
    salud_bucal: 'SIN DATOS',
    agudeza_visual_resumen: 'NORMAL',
    presion_arterial_resumen: 'NORMAL',
    impresion_diagnostica: 'Clínicamente sano',
    recomendaciones_clinicas: '1.- Control anual.',
    modulo1: { m1_sexo: 'Masculino' },
    antecedentes_captured: {
      datos_personales: { puesto_actual: 'Operador' },
      historia_laboral: { empresa_anterior_1: 'Ninguna' },
      heredo_familiares: { diabetes: 'NEGADO' },
      no_patologicos: { alcohol: 'NEGADO' },
      patologicos: { diabetes: 'NEGADO' },
    },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUserFindUnique.mockResolvedValue({ fullName: 'Dra. Ana', professionalLicense: '123456' })
  mockMedicalExamUpsert.mockResolvedValue({ id: 'me-1', eventId: 'evt-1' })
  mockEventTestFindUnique.mockResolvedValue({ status: 'IN_PROGRESS' })
  mockEventTestUpdate.mockResolvedValue({ id: 'et-1' })
  mockTriggerAI.mockResolvedValue({ success: true, summary: 'ok', clinicalState: 'AI_PENDING_REVIEW' })
  mockWriteTimelineEntry.mockResolvedValue(undefined)
  mockTimelineFindMany.mockResolvedValue([])
  mockTransaction.mockImplementation(async (ops: unknown[]) => ops)
})

describe('Desbloqueo cierre de examen + edición posterior + checkout + CHECKED_IN → VALIDATING', () => {
  it('saveExamenMedicoPapeleta(markComplete=true) persiste examen_capture_closed=true', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'doc-1', role: 'DOCTOR_GENERAL' } })
    mockMedicalExamFindUnique.mockResolvedValue({
      physicalExamData: {},
      somatometryData: { peso_kg: '70', talla_m: '1.75', ta_sistolica: '120', fc_min: '72' },
      eyeAcuityData: { vision_lejana_od: '20/20', vision_lejana_oi: '20/20' },
    })

    const res = await saveExamenMedicoPapeleta('evt-1', 'et-1', completeExamPayload(), true)

    expect(res.success).toBe(true)
    const upsertArg = mockMedicalExamUpsert.mock.calls[0][0]
    expect(upsertArg.update.physicalExamData.examen_capture_closed).toBe(true)
    expect(mockEventTestUpdate).toHaveBeenCalledWith({
      where: { id: 'et-1' },
      data: { status: 'RESULT_REGISTERED' },
    })
  })

  it.each(['SUPERADMIN', 'ADMIN', 'DOCTOR_GENERAL', 'DOCTOR_VALIDATOR'])(
    'permite edición posterior en borrador a rol autorizado (%s) conservando examen_capture_closed=true',
    async (role) => {
      mockGetServerSession.mockResolvedValue({ user: { id: 'u-1', role } })
      mockMedicalExamFindUnique.mockResolvedValue({
        physicalExamData: { examen_capture_closed: true },
        somatometryData: null,
        eyeAcuityData: null,
      })

      const res = await saveExamenMedicoPapeleta(
        'evt-1',
        'et-1',
        { ...completeExamPayload(), impresion_diagnostica: 'Corrección posterior' },
        false,
      )

      expect(res.success).toBe(true)
      const upsertArg = mockMedicalExamUpsert.mock.calls[0][0]
      expect(upsertArg.update.physicalExamData.examen_capture_closed).toBe(true)
      expect(upsertArg.update.physicalExamData.impresion_diagnostica).toBe('Corrección posterior')
      expect(mockTriggerAI).not.toHaveBeenCalled()
    },
  )

  it.each(['RECEPTIONIST', 'CAPTURIST'])(
    'rechaza edición posterior de examen cerrado para rol no clínico (%s)',
    async (role) => {
      mockGetServerSession.mockResolvedValue({ user: { id: 'u-2', role } })
      mockMedicalExamFindUnique.mockResolvedValue({
        physicalExamData: { examen_capture_closed: true },
        somatometryData: null,
        eyeAcuityData: null,
      })

      const res = await saveExamenMedicoPapeleta('evt-1', 'et-1', completeExamPayload(), false)

      expect(res.success).toBe(false)
      expect(res.error).toBe(CLOSED_CAPTURE_EDIT_DENIED)
      expect(mockMedicalExamUpsert).not.toHaveBeenCalled()
    },
  )

  it('getEventsKanban y dischargePatientFromReception aceptan Examen Médico en RESULT_REGISTERED sin examen_capture_closed', async () => {
    const legacyEvent = {
      id: 'evt-legacy',
      status: 'CHECKED_IN',
      intakeSource: 'APPOINTMENT',
      appointmentId: 'apt-1',
      checkInDate: new Date('2026-11-19T10:00:00.000Z'),
      createdAt: new Date('2026-11-19T10:00:00.000Z'),
      dischargedAt: null,
      workerId: 'w-1',
      branch: { id: 'b-1', name: 'Centro' },
      worker: { firstName: 'Luis', lastName: 'Gómez', phone: '5511223344', company: { name: 'ACME' } },
      exam: { physicalExamData: {} },
      eventTests: [
        { id: 'et-em', status: 'RESULT_REGISTERED', testNameSnapshot: 'Examen Médico General' },
        { id: 'et-soma', status: 'PENDING', testNameSnapshot: 'Somatometría' },
      ],
    }

    mockMedicalEventFindMany.mockResolvedValue([legacyEvent])
    const kanban = await getEventsKanban('2026-11-19')
    expect(kanban.readyForCheckout).toHaveLength(1)
    expect(kanban.readyForCheckout[0].id).toBe('evt-legacy')

    mockGetServerSession.mockResolvedValue({ user: { id: 'rec-1', role: 'RECEPTIONIST' } })
    mockMedicalEventFindUnique.mockResolvedValue(legacyEvent)
    mockMedicalEventUpdate.mockResolvedValue({ id: 'evt-legacy' })
    mockAuditLogCreate.mockResolvedValue({ id: 'aud-1' })

    const discharge = await dischargePatientFromReception('evt-legacy')
    expect(discharge.success).toBe(true)
    expect(mockMedicalEventUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'evt-legacy' } }),
    )
  })

  it('fetchEventPageData promueve CHECKED_IN → VALIDATING cuando view=VALIDATING', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'doc-1', role: 'DOCTOR_VALIDATOR', fullName: 'Dr. Validador' },
    })
    mockGetEventById.mockResolvedValue({
      id: 'evt-1',
      status: 'CHECKED_IN',
      checkInDate: new Date('2026-11-19T10:00:00.000Z'),
      createdAt: new Date('2026-11-19T10:00:00.000Z'),
      appointmentId: null,
      projectId: null,
      intakeSource: 'DIRECT_RECEPTION',
      intakeCreatedByUserId: null,
      worker: {
        id: 'w-1',
        firstName: 'Luis',
        lastName: 'Gómez',
        dob: null,
        nationalId: null,
        company: { name: 'ACME' },
      },
      exam: { physicalExamData: { examen_capture_closed: true, aptitud: 'APTO' } },
      verdict: null,
      eventTests: [],
    })
    mockMedicalEventUpdate.mockResolvedValue({ id: 'evt-1', status: 'VALIDATING' })
    mockGetWorkerClinicalHistory.mockResolvedValue({ success: false })
    mockGetTimelineForEvent.mockResolvedValue([])
    mockFindLatestWorkerAntecedentesCaptured.mockResolvedValue(null)

    const data = await fetchEventPageData({ id: 'evt-1', view: 'VALIDATING' })

    expect(mockMedicalEventUpdate).toHaveBeenCalledWith({
      where: { id: 'evt-1' },
      data: { status: 'VALIDATING' },
    })
    expect(data).not.toBeNull()
    expect(data?.serializedStatus).toBe('VALIDATING')
    expect(data?.activeView).toBe('VALIDATING')
    expect(shouldRenderEventFlowController(data?.activeView, data!.serializedStatus)).toBe(true)
  })
})
