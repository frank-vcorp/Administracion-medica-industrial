/**
 * @file Tests para helpers de validación de unidades (project.actions.ts) — IMPL-20260711-01.
 * @id IMPL-20260711-01
 * @spec context/SPECs/SPEC_ARCH-20260711-01-MODULO-UNIDADES-MOVILES.md
 *
 * vitest globals via vitest.config.ts (globals: true).
 */
/// <reference types="vitest/globals" />

const mockProjectsFindMany = vi.fn()
const mockProjectsCount = vi.fn()
const mockMaintenanceFindMany = vi.fn()
const mockMaintenanceCount = vi.fn()

vi.mock('next-auth/next', () => ({
  getServerSession: vi.fn(),
}))
vi.mock('@/auth', () => ({
  authOptions: {},
}))
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({
  default: {
    project: {
      findMany: (...args: unknown[]) => mockProjectsFindMany(...args),
      count: (...args: unknown[]) => mockProjectsCount(...args),
    },
    maintenanceRecord: {
      findMany: (...args: unknown[]) => mockMaintenanceFindMany(...args),
      count: (...args: unknown[]) => mockMaintenanceCount(...args),
    },
  },
}))

import { getServerSession } from 'next-auth/next'
import { validateUnitAvailability, suggestMaintenanceDates } from '@/actions/project.actions'

describe('project.actions validateUnitAvailability (mobile unit)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: 'admin-1', role: 'ADMIN', email: 'a@x', name: 'A' },
      expires: '2099-12-31',
    } as unknown as Awaited<ReturnType<typeof getServerSession>>)
  })

  it('1. sin conflictos → available=true, sin suggestions', async () => {
    mockProjectsFindMany.mockResolvedValue([])
    mockMaintenanceFindMany.mockResolvedValue([])
    const res = await validateUnitAvailability(
      'unit-1',
      '2026-07-11T00:00:00Z',
      '2026-07-11T23:59:59Z'
    )
    expect(res.available).toBe(true)
    expect(res.conflicts).toEqual([])
    expect(res.suggestions).toEqual([])
  })

  it('2. con proyecto conflictivo → available=false + 1 conflict', async () => {
    mockProjectsFindMany.mockResolvedValue([{ id: 'p-1', name: 'Visita Norte' }])
    mockMaintenanceFindMany.mockResolvedValue([])
    const res = await validateUnitAvailability(
      'unit-1',
      '2026-07-11T00:00:00Z',
      '2026-07-11T23:59:59Z'
    )
    expect(res.available).toBe(false)
    expect(res.conflicts).toHaveLength(1)
    expect(res.conflicts[0]).toMatchObject({ type: 'project', name: 'Visita Norte' })
  })

  it('3. con mantenimiento conflictivo', async () => {
    mockProjectsFindMany.mockResolvedValue([])
    mockMaintenanceFindMany.mockResolvedValue([{ id: 'm-1', type: 'PREVENTIVO' }])
    const res = await validateUnitAvailability(
      'unit-1',
      '2026-07-11T00:00:00Z',
      '2026-07-11T23:59:59Z'
    )
    expect(res.available).toBe(false)
    expect(res.conflicts[0].type).toBe('maintenance')
  })

  it('4. devuelve hasta 3 suggestions (+7/+14/+21) en conflicto de proyecto', async () => {
    mockProjectsFindMany.mockResolvedValue([{ id: 'p-1', name: 'Visita 1' }])
    mockProjectsCount.mockResolvedValue(0)
    mockMaintenanceFindMany.mockResolvedValue([])
    mockMaintenanceCount.mockResolvedValue(0)
    const res = await validateUnitAvailability(
      'unit-1',
      '2026-07-11T00:00:00Z',
      '2026-07-11T23:59:59Z'
    )
    expect(res.suggestions.length).toBe(3)
    expect(res.suggestions[0].label).toContain('+7 días')
  })

  it('5. fechas inválidas → available=false', async () => {
    const res = await validateUnitAvailability('unit-1', 'INVALID', '2026-07-11')
    expect(res.available).toBe(false)
  })

  it('6. excludeProjectId omite el proyecto del caller', async () => {
    mockProjectsFindMany.mockResolvedValue([])
    mockMaintenanceFindMany.mockResolvedValue([])
    await validateUnitAvailability(
      'unit-1',
      '2026-07-11T00:00:00Z',
      '2026-07-11T23:59:59Z',
      'project-to-exclude'
    )
    expect(mockProjectsFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { not: 'project-to-exclude' },
        }),
      })
    )
  })
})

describe('project.actions suggestMaintenanceDates', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: 'admin-1', role: 'ADMIN', email: 'a@x', name: 'A' },
      expires: '2099-12-31',
    } as unknown as Awaited<ReturnType<typeof getServerSession>>)
  })

  it('7. retorna fecha siguiente cuando está libre', async () => {
    mockProjectsCount.mockResolvedValue(0)
    mockMaintenanceCount.mockResolvedValue(0)
    const res = await suggestMaintenanceDates('unit-1', '2026-07-11T00:00:00Z', 30, 3)
    expect(res.length).toBeGreaterThan(0)
    expect(res[0].iso).toBeDefined()
    expect(res[0].label).toMatch(/\+\d+ días/)
  })

  it('8. respeta maxSuggestions', async () => {
    mockProjectsCount.mockResolvedValue(0)
    mockMaintenanceCount.mockResolvedValue(0)
    const res = await suggestMaintenanceDates('unit-1', '2026-07-11T00:00:00Z', 100, 2)
    expect(res.length).toBeLessThanOrEqual(2)
  })

  it('9. startAfter inválido → []', async () => {
    const res = await suggestMaintenanceDates('unit-1', 'INVALID', 30, 3)
    expect(res).toEqual([])
  })

  it('10. salta días con conflicto', async () => {
    let callCount = 0
    mockProjectsCount.mockImplementation(() => {
      callCount++
      return callCount === 1 ? 1 : 0
    })
    mockMaintenanceCount.mockResolvedValue(0)
    const res = await suggestMaintenanceDates('unit-1', '2026-07-11T00:00:00Z', 30, 1)
    expect(res.length).toBeGreaterThanOrEqual(1)
  })
})

describe('project.actions guards de autorización', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('11. sin sesión → available=false', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    const res = await validateUnitAvailability('unit-1', '2026-07-11T00:00:00Z', '2026-07-11T23:59:59Z')
    expect(res.available).toBe(false)
  })

  it('12. role no autorizado → available=false', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: 'u-1', role: 'COMPANY_CLIENT', email: 'a@x', name: 'A' },
      expires: '2099-12-31',
    } as unknown as Awaited<ReturnType<typeof getServerSession>>)
    const res = await validateUnitAvailability('unit-1', '2026-07-11T00:00:00Z', '2026-07-11T23:59:59Z')
    expect(res.available).toBe(false)
  })
})
