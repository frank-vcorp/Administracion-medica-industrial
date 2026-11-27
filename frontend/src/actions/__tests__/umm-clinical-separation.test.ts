/**
 * @file Tests unitarios para la separación operativa Clínicas Fijas vs Campañas / UMM.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockGetServerSession = vi.fn()
const mockMedicalEventFindMany = vi.fn()
const mockMedicalEventFindUnique = vi.fn()
const mockMedicalEventUpdate = vi.fn()
const mockTimelineFindMany = vi.fn()
const mockAuditLogCreate = vi.fn()
const mockTransaction = vi.fn()
const mockRevalidatePath = vi.fn()

vi.mock('next-auth', () => ({
  getServerSession: (...args: unknown[]) => mockGetServerSession(...args),
}))
vi.mock('@/auth', () => ({ authOptions: {} }))
vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}))
vi.mock('@/lib/prisma', () => ({
  default: {
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
    $transaction: (...a: unknown[]) => mockTransaction(...a),
  },
}))

const { getEventsKanban, dischargePatientFromReception } = await import('@/actions/event.actions')

describe('Separación operativa Clínicas Fijas vs Campañas / UMM', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTimelineFindMany.mockResolvedValue([])
    mockTransaction.mockImplementation(async (ops: unknown[]) => ops)
  })

  it('getEventsKanban filtra Clínicas Fijas con projectId: null y mobileUnitId: null', async () => {
    mockMedicalEventFindMany.mockResolvedValue([])

    const res = await getEventsKanban('2026-11-27')

    expect(res).toEqual({ scheduled: [], inProgress: [], readyForCheckout: [] })
    expect(mockMedicalEventFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          dischargedAt: null,
          projectId: null,
          mobileUnitId: null,
        }),
      }),
    )
  })

  it('dischargePatientFromReception revalida /validation, /projects y /projects/[id] cuando existe projectId', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'rec-1', role: 'RECEPTIONIST' } })
    mockMedicalEventFindUnique.mockResolvedValue({
      id: 'evt-umm-1',
      dischargedAt: null,
      workerId: 'w-umm-1',
      projectId: 'proj-umm-1',
      exam: { physicalExamData: { examen_capture_closed: true } },
      eventTests: [
        { id: 'et-em', status: 'RESULT_REGISTERED', testNameSnapshot: 'Examen Médico General' },
      ],
    })
    mockMedicalEventUpdate.mockResolvedValue({ id: 'evt-umm-1' })
    mockAuditLogCreate.mockResolvedValue({ id: 'aud-1' })

    const res = await dischargePatientFromReception('evt-umm-1')

    expect(res.success).toBe(true)
    expect(mockMedicalEventFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          projectId: true,
        }),
      }),
    )
    expect(mockRevalidatePath).toHaveBeenCalledWith('/reception')
    expect(mockRevalidatePath).toHaveBeenCalledWith('/events/evt-umm-1')
    expect(mockRevalidatePath).toHaveBeenCalledWith('/validation')
    expect(mockRevalidatePath).toHaveBeenCalledWith('/projects')
    expect(mockRevalidatePath).toHaveBeenCalledWith('/projects/proj-umm-1')
  })

  it('dischargePatientFromReception omite /projects/[id] cuando projectId es null (clínica fija)', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'rec-1', role: 'RECEPTIONIST' } })
    mockMedicalEventFindUnique.mockResolvedValue({
      id: 'evt-clinic-1',
      dischargedAt: null,
      workerId: 'w-clinic-1',
      projectId: null,
      exam: { physicalExamData: { examen_capture_closed: true } },
      eventTests: [
        { id: 'et-em', status: 'RESULT_REGISTERED', testNameSnapshot: 'Examen Médico General' },
      ],
    })
    mockMedicalEventUpdate.mockResolvedValue({ id: 'evt-clinic-1' })
    mockAuditLogCreate.mockResolvedValue({ id: 'aud-2' })

    const res = await dischargePatientFromReception('evt-clinic-1')

    expect(res.success).toBe(true)
    expect(mockRevalidatePath).toHaveBeenCalledWith('/reception')
    expect(mockRevalidatePath).toHaveBeenCalledWith('/events/evt-clinic-1')
    expect(mockRevalidatePath).toHaveBeenCalledWith('/validation')
    expect(mockRevalidatePath).toHaveBeenCalledWith('/projects')
    expect(mockRevalidatePath).toHaveBeenCalledTimes(4)
  })
})
