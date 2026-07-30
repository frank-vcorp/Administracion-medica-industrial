/**
 * @file Tests unitarios: CompanyService.deleteCompanies.
 * @id IMPL-20260730-01 (retry)
 * @spec context/SPECs/SPEC_ARCH-20260730-01-DELETE-COMPANIES-SUPERADMIN.md
 *
 * Cubre el flujo de hard-delete transaccional de Companies para SUPERADMIN:
 *   - companyIds vacío → INVALID_INPUT (sin tocar DB)
 *   - companyIds.length > 100 → INVALID_INPUT (sin tocar DB)
 *   - companyIds con 0 resultados en DB → NOT_FOUND (sin tocar DB)
 *   - happy path 2 companies → ok: true, deletedCount=2, todas las
 *     queries de la transacción ejecutadas en orden, audit log con
 *     action='COMPANIES_HARD_DELETE' y entity='Company'
 *   - failure path: la transacción lanza → INTERNAL_ERROR
 *
 * NOTA: No se testea el guard de rol SUPERADMIN — eso vive en la server
 * action, no en el service. El service asume que el caller ya validó el
 * permiso.
 *
 * Sigue el patrón de mocks de `company.service.test.ts` (mock de @/lib/prisma).
 */
/// <reference types="vitest/globals" />

// Mock de prisma con spies para todas las tablas que toca deleteCompanies.
// Usamos un prisma.$transaction que ejecuta el callback con un `tx` mockeado
// que también expone los mismos delegates (chainable mock).
vi.mock('@/lib/prisma', () => {
  // Para deleteMany/updateMany/findMany/create — necesitamos devolver Promise.
  const buildDelegate = (impl: (args: unknown) => unknown) => ({
    findMany: vi.fn(impl),
    findUnique: vi.fn(impl),
    findFirst: vi.fn(impl),
    create: vi.fn(impl),
    createMany: vi.fn(impl),
    update: vi.fn(impl),
    updateMany: vi.fn(impl),
    delete: vi.fn(impl),
    deleteMany: vi.fn(impl),
    count: vi.fn(impl),
  })

  const tx = {
    companySellerHistory: buildDelegate(async () => ({ count: 0 })),
    companySelfRegistration: buildDelegate(async () => ({ count: 0 })),
    company: {
      ...buildDelegate(async () => ({ count: 0 })),
      update: vi.fn(async () => ({ id: 'cmp_x' })),
      updateMany: vi.fn(async () => ({ count: 1 })),
      deleteMany: vi.fn(async () => ({ count: 1 })),
      findMany: vi.fn(async () => []),
    },
    user: buildDelegate(async () => ({ count: 0 })),
    jobPosition: buildDelegate(async () => ({ count: 0 })),
    medicalProfile: buildDelegate(async () => ({ count: 0 })),
    worker: buildDelegate(async () => ({ count: 0 })),
    appointment: buildDelegate(async () => ({ count: 0 })),
    medicalEvent: buildDelegate(async () => ({ count: 0 })),
    project: buildDelegate(async () => ({ count: 0 })),
    labOrder: buildDelegate(async () => ({ count: 0 })),
    auditLog: {
      ...buildDelegate(async () => ({ count: 0 })),
      create: vi.fn(async () => ({ id: 'log_x' })),
    },
  }

  // $transaction ejecuta el callback con `tx`.
  const transaction = vi.fn(async (cb: (inner: typeof tx) => Promise<unknown>) => cb(tx))

  return {
    default: {
      company: {
        ...buildDelegate(async () => ({ count: 0 })),
        findMany: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
        deleteMany: vi.fn(),
      },
      $transaction: transaction,
      _tx: tx, // exposed para inspecciones
    },
  }
})

import prisma from '@/lib/prisma'
import { deleteCompanies } from '@/services/company.service'

// Acceso tipado al mock del tx y a los delegates relevantes del módulo.
interface MockedPrisma {
  company: {
    findMany: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
    updateMany: ReturnType<typeof vi.fn>
    deleteMany: ReturnType<typeof vi.fn>
  }
  $transaction: ReturnType<typeof vi.fn>
  _tx: {
    companySellerHistory: { deleteMany: ReturnType<typeof vi.fn> }
    companySelfRegistration: { deleteMany: ReturnType<typeof vi.fn> }
    company: {
      update: ReturnType<typeof vi.fn>
      updateMany: ReturnType<typeof vi.fn>
      deleteMany: ReturnType<typeof vi.fn>
    }
    user: { updateMany: ReturnType<typeof vi.fn> }
    jobPosition: { updateMany: ReturnType<typeof vi.fn> }
    medicalProfile: { updateMany: ReturnType<typeof vi.fn> }
    worker: { updateMany: ReturnType<typeof vi.fn> }
    appointment: { updateMany: ReturnType<typeof vi.fn> }
    medicalEvent: { updateMany: ReturnType<typeof vi.fn> }
    project: { updateMany: ReturnType<typeof vi.fn> }
    labOrder: { updateMany: ReturnType<typeof vi.fn> }
    auditLog: { create: ReturnType<typeof vi.fn> }
  }
}
const mocked = prisma as unknown as MockedPrisma

beforeEach(() => {
  vi.clearAllMocks()
})

describe('deleteCompanies — guardas de input (ARCH-20260730-01)', () => {
  it('CA-D1: companyIds vacío → INVALID_INPUT sin tocar DB', async () => {
    const result = await deleteCompanies({ companyIds: [], actorUserId: 'u1' })
    expect(result).toEqual({
      ok: false,
      code: 'INVALID_INPUT',
      error: expect.stringContaining('array no vacío'),
    })
    expect(mocked.$transaction).not.toHaveBeenCalled()
  })

  it('CA-D2: 101 companyIds → INVALID_INPUT (límite max 100)', async () => {
    const ids = Array.from({ length: 101 }, (_, i) => `id_${i}`)
    const result = await deleteCompanies({ companyIds: ids, actorUserId: 'u1' })
    expect(result).toEqual({
      ok: false,
      code: 'INVALID_INPUT',
      error: expect.stringContaining('100'),
    })
    expect(mocked.$transaction).not.toHaveBeenCalled()
  })

  it('CA-D3: companyIds no es array → INVALID_INPUT', async () => {
    const result = await deleteCompanies({
      companyIds: null as unknown as string[],
      actorUserId: 'u1',
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('INVALID_INPUT')
  })
})

describe('deleteCompanies — búsqueda inicial (ARCH-20260730-01)', () => {
  it('CA-D4: 0 companies encontradas en DB → NOT_FOUND', async () => {
    mocked.company.findMany.mockResolvedValueOnce([])
    const result = await deleteCompanies({
      companyIds: ['c1', 'c2'],
      actorUserId: 'u1',
    })
    expect(result).toEqual({
      ok: false,
      code: 'NOT_FOUND',
      error: expect.stringContaining('No se encontraron'),
    })
    expect(mocked.$transaction).not.toHaveBeenCalled()
  })
})

describe('deleteCompanies — happy path (ARCH-20260730-01)', () => {
  it('CA-D5: 2 companies → ok:true, deletedCount:2, todas las queries ejecutadas en orden', async () => {
    // Pre-tx: snapshot de companies encontradas.
    mocked.company.findMany.mockResolvedValueOnce([
      { id: 'c1', name: 'ACME SA' },
      { id: 'c2', name: 'Beta SA' },
    ])
    // $transaction delega al callback → todas las llamadas son sobre `_tx`.

    const result = await deleteCompanies({
      companyIds: ['c1', 'c2'],
      actorUserId: 'user_super',
      reason: 'limpieza Q3',
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.deletedCount).toBe(2)
      expect(result.deletedCompanyIds).toEqual(['c1', 'c2'])
    }
    expect(mocked.$transaction).toHaveBeenCalledTimes(1)

    // Verifica que cada paso de la transacción se ejecutó.
    const tx = mocked._tx
    expect(tx.companySellerHistory.deleteMany).toHaveBeenCalledWith({
      where: { companyId: { in: ['c1', 'c2'] } },
    })
    expect(tx.companySelfRegistration.deleteMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { submittedCompanyId: { in: ['c1', 'c2'] } },
          { targetCompanyId: { in: ['c1', 'c2'] } },
        ],
      },
    })
    // allowedBranches set [] por cada id (loop).
    expect(tx.company.update).toHaveBeenCalledTimes(2)
    expect(tx.company.update).toHaveBeenNthCalledWith(1, {
      where: { id: 'c1' },
      data: { allowedBranches: { set: [] } },
    })
    expect(tx.company.update).toHaveBeenNthCalledWith(2, {
      where: { id: 'c2' },
      data: { allowedBranches: { set: [] } },
    })

    // Nulificación de companyId en cascada
    expect(tx.user.updateMany).toHaveBeenCalledWith({
      where: { companyId: { in: ['c1', 'c2'] } },
      data: { companyId: null },
    })
    expect(tx.jobPosition.updateMany).toHaveBeenCalledWith({
      where: { companyId: { in: ['c1', 'c2'] } },
      data: { companyId: null },
    })
    expect(tx.medicalProfile.updateMany).toHaveBeenCalledWith({
      where: { companyId: { in: ['c1', 'c2'] } },
      data: { companyId: null },
    })
    expect(tx.worker.updateMany).toHaveBeenCalledWith({
      where: { companyId: { in: ['c1', 'c2'] } },
      data: { companyId: null },
    })
    expect(tx.appointment.updateMany).toHaveBeenCalledWith({
      where: { companyId: { in: ['c1', 'c2'] } },
      data: { companyId: null },
    })
    expect(tx.medicalEvent.updateMany).toHaveBeenCalledWith({
      where: { billingCompanyId: { in: ['c1', 'c2'] } },
      data: { billingCompanyId: null },
    })
    expect(tx.project.updateMany).toHaveBeenCalledWith({
      where: { companyId: { in: ['c1', 'c2'] } },
      data: { companyId: null },
    })
    expect(tx.labOrder.updateMany).toHaveBeenCalledWith({
      where: { companyId: { in: ['c1', 'c2'] } },
      data: { companyId: null },
    })

    // defaultBranchId release
    expect(tx.company.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['c1', 'c2'] } },
      data: { defaultBranchId: null },
    })
    // hard delete
    expect(tx.company.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['c1', 'c2'] } },
    })

    // audit log con entity='Company' y action='COMPANIES_HARD_DELETE'
    expect(tx.auditLog.create).toHaveBeenCalledTimes(1)
    const auditArg = tx.auditLog.create.mock.calls[0][0]
    expect(auditArg.data.action).toBe('COMPANIES_HARD_DELETE')
    expect(auditArg.data.entity).toBe('Company')
    expect(auditArg.data.userId).toBe('user_super')
    expect(auditArg.data.entityId).toBe('c1,c2')
    expect(auditArg.data.details.deletedCompanyIds).toEqual(['c1', 'c2'])
    expect(auditArg.data.details.deletedCompanyNames).toEqual(['ACME SA', 'Beta SA'])
    expect(auditArg.data.details.companyCount).toBe(2)
    expect(auditArg.data.details.reason).toBe('limpieza Q3')
  })

  it('CA-D6: reason omitido → audit log con reason:null', async () => {
    mocked.company.findMany.mockResolvedValueOnce([{ id: 'c1', name: 'Solo SA' }])
    await deleteCompanies({ companyIds: ['c1'], actorUserId: 'u' })
    const auditArg = mocked._tx.auditLog.create.mock.calls[0][0]
    expect(auditArg.data.details.reason).toBeNull()
  })
})

describe('deleteCompanies — failure path (ARCH-20260730-01)', () => {
  it('CA-D7: si la transacción lanza → INTERNAL_ERROR con mensaje', async () => {
    mocked.company.findMany.mockResolvedValueOnce([{ id: 'c1', name: 'ACME' }])
    // Forzamos que $transaction rechace.
    mocked.$transaction.mockImplementationOnce(async () => {
      throw new Error('FK constraint violated')
    })

    // Silenciar console.error para no contaminar el output del test.
    const consoleErrSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const result = await deleteCompanies({ companyIds: ['c1'], actorUserId: 'u1' })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('INTERNAL_ERROR')
      expect(result.error).toBe('FK constraint violated')
    }
    expect(consoleErrSpy).toHaveBeenCalledWith(
      '[deleteCompanies] failed:',
      expect.any(Error)
    )
    consoleErrSpy.mockRestore()
  })
})