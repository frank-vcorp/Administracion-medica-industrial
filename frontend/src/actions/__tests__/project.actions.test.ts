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
const mockProjectsCreate = vi.fn()
const mockProjectsUpdate = vi.fn()
const mockProjectsFindUnique = vi.fn()
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
      create: (...args: unknown[]) => mockProjectsCreate(...args),
      update: (...args: unknown[]) => mockProjectsUpdate(...args),
      findUnique: (...args: unknown[]) => mockProjectsFindUnique(...args),
    },
    maintenanceRecord: {
      findMany: (...args: unknown[]) => mockMaintenanceFindMany(...args),
      count: (...args: unknown[]) => mockMaintenanceCount(...args),
    },
  },
}))

import { getServerSession } from 'next-auth/next'
import { validateUnitAvailability, suggestMaintenanceDates, createProject, updateProject } from '@/actions/project.actions'
import { summarizeConflicts } from '@/lib/calendar-utils'

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
    // ARCH-20260804-04 §4.2: scheduledDate ahora se propaga al AvailabilityConflict.
    mockMaintenanceFindMany.mockResolvedValue([
      { id: 'm-1', type: 'PREVENTIVO', scheduledDate: new Date('2026-07-11T10:00:00Z') },
    ])
    const res = await validateUnitAvailability(
      'unit-1',
      '2026-07-11T00:00:00Z',
      '2026-07-11T23:59:59Z'
    )
    expect(res.available).toBe(false)
    expect(res.conflicts[0].type).toBe('maintenance')
    expect(res.conflicts[0]).toMatchObject({
      type: 'maintenance',
      maintenanceType: 'PREVENTIVO',
      dateISO: '2026-07-11',
    })
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

// ─── ARCH-20260804-04 §4.1: tests del path nuevo (createProject / updateProject)
// Validan clasificación errorCode + propagación de conflicts + precedencia mantenimiento > proyecto.

describe('project.actions createProject — clasificación de conflictos (ARCH-20260804-04)', () => {
  const basePayload = {
    name: 'Proyecto Test',
    companyId: '11111111-1111-4111-8111-111111111111',
    startDate: '2026-08-15T00:00:00.000Z',
    endDate: '2026-08-15T23:59:59.000Z',
    mobileUnitId: '22222222-2222-4222-8222-222222222222',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: 'admin-1', role: 'ADMIN', email: 'a@x', name: 'A' },
      expires: '2099-12-31',
    } as unknown as Awaited<ReturnType<typeof getServerSession>>)
    // sin suggestions para mantener el mensaje estable
    mockProjectsCount.mockResolvedValue(0)
    mockMaintenanceCount.mockResolvedValue(0)
  })

  it('13. conflicto tipo maintenance → errorCode PROJECT_BLOCKED_BY_MAINTENANCE + mensaje contiene "mantenimiento"', async () => {
    mockProjectsFindMany.mockResolvedValue([])
    mockMaintenanceFindMany.mockResolvedValue([
      { id: 'm-1', type: 'PREVENTIVO', scheduledDate: new Date('2026-08-15T10:00:00Z') },
    ])
    const res = await createProject(basePayload)
    expect(res.success).toBe(false)
    expect(res.errorCode).toBe('PROJECT_BLOCKED_BY_MAINTENANCE')
    expect(res.error).toMatch(/mantenimiento/i)
    expect(res.conflicts?.[0].type).toBe('maintenance')
    // No debe llamar a project.create (cortocircuito por bloqueo)
    expect(mockProjectsCreate).not.toHaveBeenCalled()
  })

  it('14. conflicto tipo project → errorCode PROJECT_BLOCKED_BY_PROJECT', async () => {
    mockProjectsFindMany.mockResolvedValue([{ id: 'p-1', name: 'Visita Norte' }])
    mockMaintenanceFindMany.mockResolvedValue([])
    const res = await createProject(basePayload)
    expect(res.success).toBe(false)
    expect(res.errorCode).toBe('PROJECT_BLOCKED_BY_PROJECT')
    expect(res.conflicts?.[0].type).toBe('project')
    expect(mockProjectsCreate).not.toHaveBeenCalled()
  })

  it('15. conflictos mixtos (mantenimiento + proyecto) → precedencia: PROJECT_BLOCKED_BY_MAINTENANCE', async () => {
    mockProjectsFindMany.mockResolvedValue([{ id: 'p-1', name: 'Otro proyecto' }])
    mockMaintenanceFindMany.mockResolvedValue([
      { id: 'm-1', type: 'CORRECTIVO', scheduledDate: new Date('2026-08-15T08:00:00Z') },
    ])
    const res = await createProject(basePayload)
    expect(res.success).toBe(false)
    expect(res.errorCode).toBe('PROJECT_BLOCKED_BY_MAINTENANCE')
    expect(res.conflicts).toHaveLength(2)
    // ARCH-20260804-04 §3: el mensaje debe listar AMBOS conflictos (mantenimiento Y proyecto).
    expect(res.error).toMatch(/Mantenimiento CORRECTIVO el 2026-08-15/)
    expect(res.error).toMatch(/Proyecto «Otro proyecto»/)
    expect(mockProjectsCreate).not.toHaveBeenCalled()
  })

  it('16. sin conflictos → success=true + project.create invocado', async () => {
    mockProjectsFindMany.mockResolvedValue([])
    mockMaintenanceFindMany.mockResolvedValue([])
    mockProjectsCreate.mockResolvedValue({ id: 'new-proj', name: 'Proyecto Test' })
    const res = await createProject(basePayload)
    expect(res.success).toBe(true)
    expect(res.project?.id).toBe('new-proj')
    expect(mockProjectsCreate).toHaveBeenCalledTimes(1)
  })
})

describe('project.actions updateProject — clasificación con excludeProjectId (ARCH-20260804-04)', () => {
  const projectId = '33333333-3333-3333-3333-333333333333'
  const existingUnitId = '44444444-4444-4444-4444-444444444444'

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: 'admin-1', role: 'ADMIN', email: 'a@x', name: 'A' },
      expires: '2099-12-31',
    } as unknown as Awaited<ReturnType<typeof getServerSession>>)
    mockProjectsCount.mockResolvedValue(0)
    mockMaintenanceCount.mockResolvedValue(0)
  })

  it('17. updateProject con conflicto de mantenimiento → errorCode PROJECT_BLOCKED_BY_MAINTENANCE', async () => {
    // El proyecto existente usa existingUnitId y el payload NO cambia mobileUnitId,
    // así que effectiveUnitId = existingUnitId.
    mockProjectsFindUnique.mockResolvedValue({
      mobileUnitId: existingUnitId,
      startDate: new Date('2026-08-15T00:00:00Z'),
      endDate: new Date('2026-08-15T23:59:59Z'),
    })
    // validateUnitAvailability(existingUnitId, ..., projectId) consulta prisma.
    // Como projectWhere.id = { not: projectId }, findMany devuelve [].
    mockProjectsFindMany.mockResolvedValue([])
    mockMaintenanceFindMany.mockResolvedValue([
      { id: 'm-1', type: 'PREVENTIVO', scheduledDate: new Date('2026-08-15T10:00:00Z') },
    ])

    const res = await updateProject(projectId, {
      name: 'Update Test',
      startDate: '2026-08-15T00:00:00.000Z',
      endDate: '2026-08-15T23:59:59.000Z',
    })
    expect(res.success).toBe(false)
    expect(res.errorCode).toBe('PROJECT_BLOCKED_BY_MAINTENANCE')
    expect(mockProjectsUpdate).not.toHaveBeenCalled()

    // El excludeProjectId debe haberse propagado a prisma.project.findMany
    expect(mockProjectsFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { not: projectId },
        }),
      })
    )
  })

  it('18. updateProject con conflicto de proyecto → errorCode PROJECT_BLOCKED_BY_PROJECT', async () => {
    mockProjectsFindUnique.mockResolvedValue({
      mobileUnitId: existingUnitId,
      startDate: new Date('2026-08-15T00:00:00Z'),
      endDate: new Date('2026-08-15T23:59:59Z'),
    })
    mockProjectsFindMany.mockResolvedValue([{ id: 'other-proj', name: 'Otro' }])
    mockMaintenanceFindMany.mockResolvedValue([])

    const res = await updateProject(projectId, {
      name: 'Update Test',
      startDate: '2026-08-16T00:00:00.000Z',
      endDate: '2026-08-16T23:59:59.000Z',
    })
    expect(res.success).toBe(false)
    expect(res.errorCode).toBe('PROJECT_BLOCKED_BY_PROJECT')
    expect(mockProjectsUpdate).not.toHaveBeenCalled()
  })

  it('19. updateProject sin conflictos → success=true + project.update invocado', async () => {
    mockProjectsFindUnique
      .mockResolvedValueOnce({
        mobileUnitId: existingUnitId,
        startDate: new Date('2026-08-15T00:00:00Z'),
        endDate: new Date('2026-08-15T23:59:59Z'),
      })
      .mockResolvedValueOnce({ mobileUnitId: existingUnitId }) // revalidatePath lookup
    mockProjectsFindMany.mockResolvedValue([])
    mockMaintenanceFindMany.mockResolvedValue([])
    mockProjectsUpdate.mockResolvedValue({ id: projectId })

    const res = await updateProject(projectId, {
      name: 'Update OK',
    })
    expect(res.success).toBe(true)
    expect(mockProjectsUpdate).toHaveBeenCalledTimes(1)
  })
})

// ─── ARCH-20260804-04 §4.3: summarizeConflicts — helper puro, no requiere mocks.

describe('calendar-utils summarizeConflicts (ARCH-20260804-04 §4.3)', () => {
  it('20. un mantenimiento → "Mantenimiento {type} el {YYYY-MM-DD}"', () => {
    const s = summarizeConflicts([
      { type: 'maintenance', id: 'm-1', maintenanceType: 'PREVENTIVO', dateISO: '2026-08-15' },
    ])
    expect(s).toBe('Mantenimiento PREVENTIVO el 2026-08-15')
  })

  it('21. un proyecto → "Proyecto «{name}»"', () => {
    const s = summarizeConflicts([
      { type: 'project', id: 'p-1', name: 'Visita Norte' },
    ])
    expect(s).toBe('Proyecto «Visita Norte»')
  })

  it('22. cuatro conflictos → trunca a 3 + "(+1 más)"', () => {
    const s = summarizeConflicts([
      { type: 'project', id: 'p-1', name: 'A' },
      { type: 'project', id: 'p-2', name: 'B' },
      { type: 'maintenance', id: 'm-1', maintenanceType: 'PREVENTIVO', dateISO: '2026-08-15' },
      { type: 'maintenance', id: 'm-2', maintenanceType: 'CORRECTIVO', dateISO: '2026-08-16' },
    ])
    expect(s).toContain('(+1 más)')
    // Cuenta las partes separadas por '; ' antes del sufijo
    const before = s.split(' (+1 más)')[0]
    expect(before?.split('; ')).toHaveLength(3)
  })

  it('23. cero conflictos → string vacío', () => {
    expect(summarizeConflicts([])).toBe('')
  })
})
