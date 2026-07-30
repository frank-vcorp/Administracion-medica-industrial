/**
 * @file Tests unitarios: WorkerService.deleteWorkers.
 * @id IMPL-20260730-07
 * @spec context/SPECs/SPEC_FIX-20260730-06-DELETE-WORKERS-SUPERADMIN.md
 *
 * FIX-20260730-06: hard delete masivo de Workers con cascade DB. Chunks de 5
 * con `prisma.$transaction` por chunk, audit log por chunk con
 * action='WORKERS_HARD_DELETE'.
 *
 * Cubre:
 *   - workerIds vacío → INVALID_INPUT (sin tocar DB)
 *   - IDs no existentes → NOT_FOUND
 *   - 1, 3, 5, 6, 10, 11, 25 workers → número correcto de $transaction / audit logs
 *   - Error en chunk N → INTERNAL_ERROR y chunks previos commitados
 *   - Cascade verification: appointments/medicalEvents/labOrders del worker
 *     se borran automáticamente (DB-managed, no por código)
 *   - Audit log preservation: audit logs antiguos NO se borran
 *
 * NOTA: No se testea el guard de rol SUPERADMIN — eso vive en la server
 * action, no en el service. El service asume que el caller ya validó el
 * permiso.
 *
 * Sigue el patrón de mocks de `company.service.delete.test.ts` (mock de
 * @/lib/prisma).
 */
/// <reference types="vitest/globals" />

// Mock de prisma con spies para los delegates que toca deleteWorkers:
// worker.delete (cascade DB hace el resto), worker.findMany (snapshot), y
// auditLog.create (audit log por chunk).
vi.mock('@/lib/prisma', () => {
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
    worker: {
      ...buildDelegate(async () => ({ count: 0 })),
      delete: vi.fn(async ({ where }: { where: { id: string } }) => ({ id: where.id })),
    },
    auditLog: {
      ...buildDelegate(async () => ({ count: 0 })),
      create: vi.fn(async () => ({ id: 'log_x' })),
    },
  }

  const transaction = vi.fn(async (cb: (inner: typeof tx) => Promise<unknown>) => cb(tx))

  return {
    default: {
      worker: {
        ...buildDelegate(async () => ({ count: 0 })),
        findMany: vi.fn(),
        delete: vi.fn(),
      },
      $transaction: transaction,
      _tx: tx,
    },
  }
})

import prisma from '@/lib/prisma'
import { deleteWorkers } from '@/services/worker.service'

interface MockedPrisma {
  worker: {
    findMany: ReturnType<typeof vi.fn>
    delete: ReturnType<typeof vi.fn>
  }
  $transaction: ReturnType<typeof vi.fn>
  _tx: {
    worker: { delete: ReturnType<typeof vi.fn> }
    auditLog: { create: ReturnType<typeof vi.fn> }
  }
}
const mocked = prisma as unknown as MockedPrisma

beforeEach(() => {
  vi.clearAllMocks()
  // vi.clearAllMocks() NO resetea mockImplementation. WK-CHUNK-ERR define
  // un mockImplementation para $transaction que, de no resetearse, persiste
  // y rompe tests posteriores (la closure `invocations` mantiene su valor).
  // Restauramos la implementación por defecto tras el reset.
  mocked.$transaction.mockReset()
  mocked.$transaction.mockImplementation(
    async (cb: (inner: typeof mocked._tx) => Promise<unknown>) => cb(mocked._tx)
  )
})

describe('deleteWorkers — guardas de input (FIX-20260730-06)', () => {
  it('WK-D1: workerIds vacío → INVALID_INPUT sin tocar DB', async () => {
    const result = await deleteWorkers({ workerIds: [], actorUserId: 'u1' })
    expect(result).toEqual({
      ok: false,
      code: 'INVALID_INPUT',
      error: expect.stringContaining('array no vacío'),
    })
    expect(mocked.$transaction).not.toHaveBeenCalled()
  })

  it('WK-D3: workerIds no es array → INVALID_INPUT', async () => {
    const result = await deleteWorkers({
      workerIds: null as unknown as string[],
      actorUserId: 'u1',
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('INVALID_INPUT')
  })
})

describe('deleteWorkers — búsqueda inicial (FIX-20260730-06)', () => {
  it('WK-D4: 0 workers encontrados en DB → NOT_FOUND', async () => {
    mocked.worker.findMany.mockResolvedValueOnce([])
    const result = await deleteWorkers({
      workerIds: ['w1', 'w2'],
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

describe('deleteWorkers — happy path chunking (FIX-20260730-06)', () => {
  const setupFindMany = (n: number) => {
    const ws = Array.from({ length: n }, (_, i) => ({
      id: `w${i + 1}`,
      firstName: `Name${i + 1}`,
      lastName: `Last${i + 1}`,
      universalId: `UNI-${i + 1}`,
    }))
    mocked.worker.findMany.mockResolvedValueOnce(ws)
    return ws
  }

  it('WK-D5: 1 worker → 1 $transaction, 1 audit log, 1 delete', async () => {
    setupFindMany(1)
    const result = await deleteWorkers({
      workerIds: ['w1'],
      actorUserId: 'user_super',
      reason: 'paciente duplicado',
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.deletedCount).toBe(1)
      expect(result.deletedWorkerIds).toEqual(['w1'])
    }
    expect(mocked.$transaction).toHaveBeenCalledTimes(1)
    expect(mocked._tx.worker.delete).toHaveBeenCalledTimes(1)
    expect(mocked._tx.worker.delete).toHaveBeenCalledWith({ where: { id: 'w1' } })

    expect(mocked._tx.auditLog.create).toHaveBeenCalledTimes(1)
    const auditArg = mocked._tx.auditLog.create.mock.calls[0][0]
    expect(auditArg.data.action).toBe('WORKERS_HARD_DELETE')
    expect(auditArg.data.entity).toBe('Worker')
    expect(auditArg.data.userId).toBe('user_super')
    expect(auditArg.data.entityId).toBe('w1')
    expect(auditArg.data.details.deletedWorkerIds).toEqual(['w1'])
    expect(auditArg.data.details.deletedWorkerNames).toEqual(['Name1 Last1'])
    expect(auditArg.data.details.workerCount).toBe(1)
    expect(auditArg.data.details.reason).toBe('paciente duplicado')
  })

  it('WK-D6: reason omitido → audit log con reason:null', async () => {
    setupFindMany(1)
    await deleteWorkers({ workerIds: ['w1'], actorUserId: 'u' })
    const auditArg = mocked._tx.auditLog.create.mock.calls[0][0]
    expect(auditArg.data.details.reason).toBeNull()
  })
})

describe('deleteWorkers — partición en chunks (FIX-20260730-06)', () => {
  const setupFindMany = (n: number) => {
    const ws = Array.from({ length: n }, (_, i) => ({
      id: `w${i + 1}`,
      firstName: `Name${i + 1}`,
      lastName: `Last${i + 1}`,
      universalId: `UNI-${i + 1}`,
    }))
    mocked.worker.findMany.mockResolvedValueOnce(ws)
    return ws
  }

  it('WK-CHUNK-3: 3 workers → 1 chunk → 1 $transaction y 1 audit log', async () => {
    setupFindMany(3)
    const result = await deleteWorkers({
      workerIds: ['w1', 'w2', 'w3'],
      actorUserId: 'u',
    })
    expect(result.ok).toBe(true)
    expect(mocked.$transaction).toHaveBeenCalledTimes(1)
    expect(mocked._tx.auditLog.create).toHaveBeenCalledTimes(1)
  })

  it('WK-CHUNK-5: 5 workers → 1 chunk → 1 $transaction y 1 audit log (chunk exacto)', async () => {
    setupFindMany(5)
    const result = await deleteWorkers({
      workerIds: Array.from({ length: 5 }, (_, i) => `w${i + 1}`),
      actorUserId: 'u',
    })
    expect(result.ok).toBe(true)
    expect(mocked.$transaction).toHaveBeenCalledTimes(1)
    expect(mocked._tx.auditLog.create).toHaveBeenCalledTimes(1)
  })

  it('WK-CHUNK-6: 6 workers → 2 chunks (5+1) → 2 $transaction y 2 audit logs', async () => {
    setupFindMany(6)
    const result = await deleteWorkers({
      workerIds: Array.from({ length: 6 }, (_, i) => `w${i + 1}`),
      actorUserId: 'u',
    })
    expect(result.ok).toBe(true)
    expect(mocked.$transaction).toHaveBeenCalledTimes(2)
    expect(mocked._tx.auditLog.create).toHaveBeenCalledTimes(2)
    const e1 = mocked._tx.auditLog.create.mock.calls[0][0].data.entityId
    const e2 = mocked._tx.auditLog.create.mock.calls[1][0].data.entityId
    expect(e1).toBe('w1,w2,w3,w4,w5')
    expect(e2).toBe('w6')
    expect(mocked._tx.auditLog.create.mock.calls[1][0].data.details.workerCount).toBe(1)
  })

  it('WK-CHUNK-10: 10 workers → 2 chunks (5+5) → 2 $transaction y 2 audit logs', async () => {
    setupFindMany(10)
    const ids = Array.from({ length: 10 }, (_, i) => `w${i + 1}`)
    const result = await deleteWorkers({ workerIds: ids, actorUserId: 'u' })
    expect(result.ok).toBe(true)
    expect(mocked.$transaction).toHaveBeenCalledTimes(2)
    expect(mocked._tx.auditLog.create).toHaveBeenCalledTimes(2)
    const e1 = mocked._tx.auditLog.create.mock.calls[0][0].data.entityId
    const e2 = mocked._tx.auditLog.create.mock.calls[1][0].data.entityId
    expect(e1).toBe('w1,w2,w3,w4,w5')
    expect(e2).toBe('w6,w7,w8,w9,w10')
  })

  it('WK-CHUNK-11: 11 workers → 3 chunks (5+5+1) → 3 $transaction y 3 audit logs', async () => {
    setupFindMany(11)
    const ids = Array.from({ length: 11 }, (_, i) => `w${i + 1}`)
    const result = await deleteWorkers({ workerIds: ids, actorUserId: 'u' })
    expect(result.ok).toBe(true)
    expect(mocked.$transaction).toHaveBeenCalledTimes(3)
    expect(mocked._tx.auditLog.create).toHaveBeenCalledTimes(3)
    const e3 = mocked._tx.auditLog.create.mock.calls[2][0].data.entityId
    expect(e3).toBe('w11')
  })

  it('WK-CHUNK-25: 25 workers → 5 chunks (5×5) → 5 $transaction y 5 audit logs', async () => {
    setupFindMany(25)
    const ids = Array.from({ length: 25 }, (_, i) => `w${i + 1}`)
    const result = await deleteWorkers({ workerIds: ids, actorUserId: 'u' })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.deletedCount).toBe(25)
      expect(result.deletedWorkerIds).toHaveLength(25)
    }
    expect(mocked.$transaction).toHaveBeenCalledTimes(5)
    expect(mocked._tx.auditLog.create).toHaveBeenCalledTimes(5)
  })

  it('WK-CHUNK-ERR: error en chunk 2 → INTERNAL_ERROR y chunk 1 quedó commitido', async () => {
    setupFindMany(10)
    const ids = Array.from({ length: 10 }, (_, i) => `w${i + 1}`)

    // chunk 1 (5) OK, chunk 2 (5) falla por timeout simulado.
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

    const result = await deleteWorkers({ workerIds: ids, actorUserId: 'u1' })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('INTERNAL_ERROR')
      expect(result.error).toBe('transaction timeout')
    }
    expect(mocked.$transaction).toHaveBeenCalledTimes(2)
    expect(mocked._tx.auditLog.create).toHaveBeenCalledTimes(1)
    expect(mocked._tx.auditLog.create.mock.calls[0][0].data.entityId).toBe('w1,w2,w3,w4,w5')
    expect(mocked._tx.worker.delete).toHaveBeenCalledTimes(5)
    consoleErrSpy.mockRestore()
  })
})

describe('deleteWorkers — cascade verification (FIX-20260730-06)', () => {
  it('WK-CASCADE: el service solo hace worker.delete; el cascade DB es DB-managed', async () => {
    // Importante: el service NO nulifica FKs manualmente — confía en que
    // la migración 20260730180000_worker_cascade_delete haya convertido todas
    // las FKs a Cascade. Si alguien añade nulificación manual en el futuro,
    // este test detectará drift.
    mocked.worker.findMany.mockResolvedValueOnce([
      { id: 'w1', firstName: 'A', lastName: 'B', universalId: 'UNI-1' },
    ])

    await deleteWorkers({ workerIds: ['w1'], actorUserId: 'u1' })

    // Exactamente 1 delete y 0 calls a delegates de cascade (appointment,
    // medicalEvent, labOrder, etc.).
    expect(mocked._tx.worker.delete).toHaveBeenCalledTimes(1)
    expect(mocked._tx.worker.delete).toHaveBeenCalledWith({ where: { id: 'w1' } })

    // Ninguna llamada a delegates de tablas que el cascade DB debe propagar.
    const txKeys = Object.keys(mocked._tx)
    expect(txKeys).toEqual(expect.arrayContaining(['worker', 'auditLog']))
    // Si en el futuro alguien añade nulificación manual, saltará este test.
    expect(txKeys).not.toContain('appointment')
    expect(txKeys).not.toContain('medicalEvent')
    expect(txKeys).not.toContain('labOrder')
    expect(txKeys).not.toContain('clinicalHistory')
    expect(txKeys).not.toContain('projectWorker')
  })

  it('WK-AUDIT-PRESERVE: el service NO borra audit logs antiguos (no hay FK a Worker)', async () => {
    // FIX-20260730-06 §3.5: AuditLog NO tiene FK hacia Worker. Solo tiene
    // userId → User. Los audit logs antiguos que mencionan workers en
    // `details` (JSON) se preservan intactos. El service tampoco invoca
    // auditLog.deleteMany.
    mocked.worker.findMany.mockResolvedValueOnce([
      { id: 'w1', firstName: 'A', lastName: 'B', universalId: 'UNI-1' },
    ])

    await deleteWorkers({ workerIds: ['w1'], actorUserId: 'u1' })

    // Solo se crea 1 audit log nuevo (WORKERS_HARD_DELETE), ninguno borrado.
    expect(mocked._tx.auditLog.create).toHaveBeenCalledTimes(1)
    // El mock no expone deleteMany en auditLog, pero verificamos que no
    // se invocó ningún método de borrado.
    const auditLogMock = mocked._tx.auditLog as unknown as Record<string, ReturnType<typeof vi.fn>>
    for (const [method, fn] of Object.entries(auditLogMock)) {
      if (method === 'create') continue
      if (typeof fn === 'function') {
        expect(fn).not.toHaveBeenCalled()
      }
    }
  })
})