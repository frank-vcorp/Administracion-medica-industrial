/// <reference types="vitest/globals" />

const mockMedicalTestFindUnique = vi.fn()
const mockMedicalTestFindFirst = vi.fn()
const mockMedicalTestUpdate = vi.fn()
const mockProfileTestFindMany = vi.fn()
const mockMedicalProfileFindMany = vi.fn()
const mockMedicalProfileUpdate = vi.fn()
const mockTransaction = vi.fn()
const mockLogAudit = vi.fn()

vi.mock('next-auth/next', () => ({
  getServerSession: vi.fn(),
}))
vi.mock('@/auth', () => ({
  authOptions: {},
}))
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))
vi.mock('@/actions/audit.actions', () => ({
  logAudit: (...args: unknown[]) => mockLogAudit(...args),
}))
vi.mock('@/lib/prisma', () => ({
  default: {
    medicalTest: {
      findUnique: (...args: unknown[]) => mockMedicalTestFindUnique(...args),
      findFirst: (...args: unknown[]) => mockMedicalTestFindFirst(...args),
      update: (...args: unknown[]) => mockMedicalTestUpdate(...args),
    },
    profileTest: {
      findMany: (...args: unknown[]) => mockProfileTestFindMany(...args),
    },
    medicalProfile: {
      findMany: (...args: unknown[]) => mockMedicalProfileFindMany(...args),
      update: (...args: unknown[]) => mockMedicalProfileUpdate(...args),
    },
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}))

import { getServerSession } from 'next-auth/next'
import { updateMedicalTest } from '@/actions/medical-profiles'

const testId = '11111111-1111-4111-8111-111111111111'
const catId = '22222222-2222-4222-8222-222222222222'

describe('updateMedicalTest y recálculo en cascada', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTransaction.mockImplementation(async (ops: unknown[]) => ops)
    mockLogAudit.mockResolvedValue({ success: true })
  })

  it('rechaza usuarios sin permisos de administrador', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: 'u1', role: 'RECEPTIONIST' },
    } as never)

    const res = await updateMedicalTest({
      id: testId,
      name: 'Espirometría',
      code: 'GEN-013',
      categoryId: catId,
      theoreticalDurationMinutes: 20,
    })

    expect(res.success).toBe(false)
    expect(mockMedicalTestUpdate).not.toHaveBeenCalled()
  })

  it('actualiza duración teórica y recalcula perfiles afectados respetando overrides', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: 'admin-1', role: 'ADMIN' },
    } as never)

    mockMedicalTestFindUnique.mockResolvedValue({
      id: testId,
      code: 'GEN-013',
      theoreticalDurationMinutes: 15,
    })
    mockMedicalTestFindFirst.mockResolvedValue(null)
    mockMedicalTestUpdate.mockResolvedValue({ id: testId })
    mockProfileTestFindMany.mockResolvedValue([
      { profileId: 'prof-1' },
      { profileId: 'prof-2' },
    ])
    mockMedicalProfileFindMany.mockResolvedValue([
      {
        id: 'prof-1',
        controlDeskMode: 'AUTO',
        extraRxProjections: 0,
        durationOverrideMinutes: null,
        tests: [
          { test: { id: testId, code: 'GEN-013', name: 'ESPIROMETRIA', theoreticalDurationMinutes: 20 } },
        ],
      },
      {
        id: 'prof-2',
        controlDeskMode: 'AUTO',
        extraRxProjections: 0,
        durationOverrideMinutes: 45,
        tests: [
          { test: { id: testId, code: 'GEN-013', name: 'ESPIROMETRIA', theoreticalDurationMinutes: 20 } },
          { test: { id: 'other', code: 'GEN-015', name: 'EXAMEN MEDICO', theoreticalDurationMinutes: 30 } },
        ],
      },
    ])

    const res = await updateMedicalTest({
      id: testId,
      name: 'ESPIROMETRIA',
      code: 'gen-013',
      categoryId: catId,
      theoreticalDurationMinutes: 20,
    })

    expect(res.success).toBe(true)
    if (res.success) {
      expect(res.data?.recalculatedProfiles).toBe(2)
    }
    expect(mockMedicalTestUpdate).toHaveBeenCalledWith({
      where: { id: testId },
      data: {
        name: 'ESPIROMETRIA',
        code: 'GEN-013',
        categoryId: catId,
        theoreticalDurationMinutes: 20,
      },
    })
    // prof-1: 20 + 10 (control desk AUTO sin Examen Médico) = 30
    expect(mockMedicalProfileUpdate).toHaveBeenCalledWith({
      where: { id: 'prof-1' },
      data: { calculatedDurationMinutes: 30 },
    })
    // prof-2: 20 + 30 + 5 (control desk AUTO con Examen Médico) = 55 (su durationOverrideMinutes=45 no se borra)
    expect(mockMedicalProfileUpdate).toHaveBeenCalledWith({
      where: { id: 'prof-2' },
      data: { calculatedDurationMinutes: 55 },
    })
    expect(mockLogAudit).toHaveBeenCalledWith(
      'UPDATE',
      'MedicalTest',
      testId,
      expect.objectContaining({
        theoreticalDurationMinutes: 20,
        recalculatedProfiles: 2,
      }),
    )
  })
})
