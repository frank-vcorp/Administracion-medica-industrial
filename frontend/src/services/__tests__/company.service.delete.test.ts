/**
 * @file Tests unitarios: CompanyService.deleteCompanies.
 * @id IMPL-20260730-01 (retry) + FIX-20260730-05-H3
 * @spec context/SPECs/SPEC_ARCH-20260730-01-DELETE-COMPANIES-SUPERADMIN.md
 * @fix  context/SPECs/SPEC_FIX-20260730-05-H3-TIMEOUT-RESILIENT-DELETION.md
 *
 * FIX-20260730-05-H3: deleteCompanies ya no aplica un guard `> 10`. Divide
 * el lote en chunks de `DELETE_CHUNK_SIZE` (5) y emite 1 `prisma.$transaction`
 * por chunk con 14 ops por empresa. El audit log se emite 1 vez por chunk.
 *
 * Cubre:
 *   - companyIds vacío → INVALID_INPUT (sin tocar DB)
 *   - companyIds.length grande (25) → ok con 5 chunks / 5 audit logs
 *   - 3, 5, 10, 11 empresas → número correcto de $transaction / audit logs
 *   - happy path 2 companies → ok: true, deletedCount=2, queries ejecutadas,
 *     audit log con action='COMPANIES_HARD_DELETE' y entity='Company'
 *   - failure path: un chunk lanza → INTERNAL_ERROR
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
      delete: ReturnType<typeof vi.fn>
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

describe('deleteCompanies — guardas de input (ARCH-20260730-01 + FIX-20260730-05-H3)', () => {
  it('CA-D1: companyIds vacío → INVALID_INPUT sin tocar DB', async () => {
    const result = await deleteCompanies({ companyIds: [], actorUserId: 'u1' })
    expect(result).toEqual({
      ok: false,
      code: 'INVALID_INPUT',
      error: expect.stringContaining('array no vacío'),
    })
    expect(mocked.$transaction).not.toHaveBeenCalled()
  })

  it('CA-D2b: NO hay guard > 10 (FIX-20260730-05-H3): 11+ ids pasan el guard inicial', async () => {
    // El guard antiguo `> 10` debe haber desaparecido. Con 11 ids, el guard
    // de array-no-vacío pasa y se entra al flujo real. Mockeamos findMany para
    // devolver las 11 empresas.
    const ids = Array.from({ length: 11 }, (_, i) => `id_${i}`)
    const companies = ids.map((id) => ({ id, name: `Co ${id}` }))
    mocked.company.findMany.mockResolvedValueOnce(companies)

    const result = await deleteCompanies({ companyIds: ids, actorUserId: 'u1' })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.deletedCount).toBe(11)
      expect(result.deletedCompanyIds).toHaveLength(11)
    }
    // 11 / 5 → 3 chunks (5+5+1) → 3 audit logs y 3 transacciones.
    expect(mocked.$transaction).toHaveBeenCalledTimes(3)
    expect(mocked._tx.auditLog.create).toHaveBeenCalledTimes(3)
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

describe('deleteCompanies — happy path chunking (FIX-20260730-05-H3)', () => {
  it('CA-D5: 2 companies → 1 chunk → 1 $transaction, 1 audit log', async () => {
    mocked.company.findMany.mockResolvedValueOnce([
      { id: 'c1', name: 'ACME SA' },
      { id: 'c2', name: 'Beta SA' },
    ])

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

    const tx = mocked._tx
    // Pasos 1, 2 ejecutados por empresa (2 cada uno)
    expect(tx.companySellerHistory.deleteMany).toHaveBeenCalledTimes(2)
    expect(tx.companySellerHistory.deleteMany).toHaveBeenNthCalledWith(1, { where: { companyId: 'c1' } })
    expect(tx.companySellerHistory.deleteMany).toHaveBeenNthCalledWith(2, { where: { companyId: 'c2' } })
    expect(tx.companySelfRegistration.deleteMany).toHaveBeenCalledTimes(2)
    expect(tx.companySelfRegistration.deleteMany).toHaveBeenNthCalledWith(1, {
      where: { OR: [{ submittedCompanyId: 'c1' }, { targetCompanyId: 'c1' }] },
    })

    // Paso 3: company.update allowedBranches set [] por empresa (loop).
    expect(tx.company.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { allowedBranches: { set: [] } },
    })

    // Pasos 4-11: nulificación de companyId/billingCompanyId por empresa.
    expect(tx.user.updateMany).toHaveBeenCalledWith({
      where: { companyId: 'c1' },
      data: { companyId: null },
    })
    expect(tx.jobPosition.updateMany).toHaveBeenCalledWith({
      where: { companyId: 'c1' },
      data: { companyId: null },
    })
    expect(tx.medicalProfile.updateMany).toHaveBeenCalledWith({
      where: { companyId: 'c1' },
      data: { companyId: null },
    })
    expect(tx.worker.updateMany).toHaveBeenCalledWith({
      where: { companyId: 'c1' },
      data: { companyId: null },
    })
    expect(tx.appointment.updateMany).toHaveBeenCalledWith({
      where: { companyId: 'c1' },
      data: { companyId: null },
    })
    expect(tx.medicalEvent.updateMany).toHaveBeenCalledWith({
      where: { billingCompanyId: 'c1' },
      data: { billingCompanyId: null },
    })
    expect(tx.project.updateMany).toHaveBeenCalledWith({
      where: { companyId: 'c1' },
      data: { companyId: null },
    })
    expect(tx.labOrder.updateMany).toHaveBeenCalledWith({
      where: { companyId: 'c1' },
      data: { companyId: null },
    })

    // Paso 12: company.update defaultBranchId=null por empresa (loop).
    expect(tx.company.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { defaultBranchId: null },
    })

    // Paso 13: company.delete por empresa (single).
    expect(tx.company.delete).toHaveBeenCalledWith({ where: { id: 'c1' } })
    expect(tx.company.delete).toHaveBeenCalledWith({ where: { id: 'c2' } })

    // Paso 14: 1 audit log por chunk (no por empresa).
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

describe('deleteCompanies — partición en chunks (FIX-20260730-05-H3)', () => {
  // Helper: monta N companies en findMany.
  const setupFindMany = (n: number) => {
    const companies = Array.from({ length: n }, (_, i) => ({
      id: `c${i + 1}`,
      name: `Co ${i + 1}`,
    }))
    mocked.company.findMany.mockResolvedValueOnce(companies)
    return companies
  }

  it('CA-CHUNK-3: 3 empresas → 1 chunk → 1 $transaction y 1 audit log', async () => {
    setupFindMany(3)
    const result = await deleteCompanies({
      companyIds: ['c1', 'c2', 'c3'],
      actorUserId: 'u',
    })
    expect(result.ok).toBe(true)
    expect(mocked.$transaction).toHaveBeenCalledTimes(1)
    expect(mocked._tx.auditLog.create).toHaveBeenCalledTimes(1)
  })

  it('CA-CHUNK-5: 5 empresas → 1 chunk → 1 $transaction y 1 audit log', async () => {
    setupFindMany(5)
    const result = await deleteCompanies({
      companyIds: Array.from({ length: 5 }, (_, i) => `c${i + 1}`),
      actorUserId: 'u',
    })
    expect(result.ok).toBe(true)
    expect(mocked.$transaction).toHaveBeenCalledTimes(1)
    expect(mocked._tx.auditLog.create).toHaveBeenCalledTimes(1)
  })

  it('CA-CHUNK-10: 10 empresas → 2 chunks (5+5) → 2 $transaction y 2 audit logs', async () => {
    setupFindMany(10)
    const ids = Array.from({ length: 10 }, (_, i) => `c${i + 1}`)
    const result = await deleteCompanies({ companyIds: ids, actorUserId: 'u' })
    expect(result.ok).toBe(true)
    expect(mocked.$transaction).toHaveBeenCalledTimes(2)
    expect(mocked._tx.auditLog.create).toHaveBeenCalledTimes(2)
    // entityId del primer y segundo chunk
    const e1 = mocked._tx.auditLog.create.mock.calls[0][0].data.entityId
    const e2 = mocked._tx.auditLog.create.mock.calls[1][0].data.entityId
    expect(e1).toBe('c1,c2,c3,c4,c5')
    expect(e2).toBe('c6,c7,c8,c9,c10')
  })

  it('CA-CHUNK-11: 11 empresas → 3 chunks (5+5+1) → 3 $transaction y 3 audit logs', async () => {
    setupFindMany(11)
    const ids = Array.from({ length: 11 }, (_, i) => `c${i + 1}`)
    const result = await deleteCompanies({ companyIds: ids, actorUserId: 'u' })
    expect(result.ok).toBe(true)
    expect(mocked.$transaction).toHaveBeenCalledTimes(3)
    expect(mocked._tx.auditLog.create).toHaveBeenCalledTimes(3)
    const e1 = mocked._tx.auditLog.create.mock.calls[0][0].data.entityId
    const e2 = mocked._tx.auditLog.create.mock.calls[1][0].data.entityId
    const e3 = mocked._tx.auditLog.create.mock.calls[2][0].data.entityId
    expect(e1).toBe('c1,c2,c3,c4,c5')
    expect(e2).toBe('c6,c7,c8,c9,c10')
    expect(e3).toBe('c11')
    expect(mocked._tx.auditLog.create.mock.calls[2][0].data.details.companyCount).toBe(1)
  })

  it('CA-CHUNK-25: 25 empresas → 5 chunks (5×5) → 5 $transaction y 5 audit logs', async () => {
    setupFindMany(25)
    const ids = Array.from({ length: 25 }, (_, i) => `c${i + 1}`)
    const result = await deleteCompanies({ companyIds: ids, actorUserId: 'u' })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.deletedCount).toBe(25)
      expect(result.deletedCompanyIds).toHaveLength(25)
    }
    expect(mocked.$transaction).toHaveBeenCalledTimes(5)
    expect(mocked._tx.auditLog.create).toHaveBeenCalledTimes(5)
  })

  it('CA-CHUNK-ERR: error en chunk 2 → INTERNAL_ERROR y chunk 1 quedó commitido', async () => {
    // 10 empresas: chunk 1 (5) y chunk 2 (5).
    setupFindMany(10)
    const ids = Array.from({ length: 10 }, (_, i) => `c${i + 1}`)

    // Configurar $transaction: 1ª invocación ejecuta el callback (chunk 1),
    // 2ª invocación lanza (chunk 2 falla por timeout simulado).
    let invocations = 0
    mocked.$transaction.mockImplementation(
      async (cb: (inner: typeof mocked._tx) => Promise<unknown>) => {
        invocations += 1
        if (invocations === 1) {
          return cb(mocked._tx)
        }
        throw new Error('transaction timeout')
      }
    )

    const consoleErrSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const result = await deleteCompanies({ companyIds: ids, actorUserId: 'u1' })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('INTERNAL_ERROR')
      expect(result.error).toBe('transaction timeout')
    }
    // La transacción se intentó 2 veces (chunk 1 OK, chunk 2 falló).
    expect(mocked.$transaction).toHaveBeenCalledTimes(2)
    // El audit log se emitió 1 sola vez (chunk 1, antes del fallo).
    expect(mocked._tx.auditLog.create).toHaveBeenCalledTimes(1)
    expect(mocked._tx.auditLog.create.mock.calls[0][0].data.entityId).toBe('c1,c2,c3,c4,c5')
    // Paso 13 del chunk 1: company.delete para c1..c5 (5 deletes).
    expect(mocked._tx.company.delete).toHaveBeenCalledTimes(5)
    consoleErrSpy.mockRestore()
  })
})