import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCompanyFindMany = vi.fn()
const mockWorkerCount = vi.fn()
const mockEventCount = vi.fn()
const mockTestCount = vi.fn()

vi.mock('@/lib/prisma', () => ({
  default: {
    company: { findMany: (...a: unknown[]) => mockCompanyFindMany(...a) },
    worker: { count: (...a: unknown[]) => mockWorkerCount(...a) },
    medicalEvent: { count: (...a: unknown[]) => mockEventCount(...a) },
    medicalTest: { count: (...a: unknown[]) => mockTestCount(...a) },
  },
}))

vi.mock('@/services/company.service', () => ({
  deleteCompanies: vi.fn(),
}))
vi.mock('@/services/worker.service', () => ({
  deleteWorkers: vi.fn(),
}))

const { previewOperationalCleanup } = await import(
  '@/services/operational-cleanup.service'
)

beforeEach(() => {
  mockCompanyFindMany.mockReset()
  mockWorkerCount.mockReset()
  mockEventCount.mockReset()
  mockTestCount.mockReset()
})

describe('previewOperationalCleanup', () => {
  it('preserva Público General y cuenta empresas a borrar', async () => {
    mockCompanyFindMany.mockResolvedValue([
      { id: 'pg', name: 'Público General', rfc: 'PG010101XXX' },
      { id: 'c1', name: 'ACME', rfc: null },
    ])
    mockWorkerCount.mockResolvedValue(3)
    mockEventCount.mockResolvedValue(2)
    mockTestCount.mockResolvedValue(157)

    const preview = await previewOperationalCleanup()

    expect(preview.workerCount).toBe(3)
    expect(preview.medicalEventCount).toBe(2)
    expect(preview.companyDeleteCount).toBe(1)
    expect(preview.companyTotal).toBe(2)
    expect(preview.preservedCompanyNames).toEqual(['Público General'])
    expect(preview.medicalTestCount).toBe(157)
  })
})
