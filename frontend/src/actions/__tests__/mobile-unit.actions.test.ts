/**
 * @file Tests para MobileUnit actions (CRUD, helpers) — IMPL-20260711-01.
 * @id IMPL-20260711-01
 * @spec context/SPECs/SPEC_ARCH-20260711-01-MODULO-UNIDADES-MOVILES.md
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

const mockFindMany = vi.fn()
const mockCreate = vi.fn()
const mockUpdate = vi.fn()
const mockDelete = vi.fn()
const mockFindUnique = vi.fn()

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
    mobileUnit: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      create: (...args: unknown[]) => mockCreate(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
      delete: (...args: unknown[]) => mockDelete(...args),
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
  },
}))

import { getServerSession } from 'next-auth/next'
import { Prisma } from '@prisma/client'
import {
  createMobileUnit,
  deleteMobileUnit,
  getMobileUnits,
} from '@/actions/mobile-unit.actions'

const ADMIN_SESSION = {
  user: { id: 'admin-1', role: 'ADMIN', email: 'a@x', name: 'A' },
  expires: '2099-12-31',
}
const nonExistingSession = {
  user: { id: 'u-1', role: 'RECEPTIONIST', email: 'a@x', name: 'A' },
  expires: '2099-12-31',
}

describe('mobile-unit.actions createMobileUnit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getServerSession).mockResolvedValue(ADMIN_SESSION as unknown as Awaited<ReturnType<typeof getServerSession>>)
  })

  it('1. name vacío → error', async () => {
    const res = await createMobileUnit({ name: '' })
    expect(res.success).toBe(false)
    expect(res.error).toBeTruthy()
  })

  it('2. name solo whitespace → Zod lo acepta y delega a prisma', async () => {
    mockCreate.mockResolvedValue({ id: 'u-1', name: '   ' })
    const res = await createMobileUnit({ name: '   ' })
    expect(res.success).toBe(true)
    expect(mockCreate).toHaveBeenCalled()
  })

  it('3. session requerida (sin sesión → error)', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    const res = await createMobileUnit({ name: 'Unidad 1' })
    expect(res.success).toBe(false)
    expect(res.error).toBe('No autorizado')
  })

  it('4. rol no ADMIN → error', async () => {
    vi.mocked(getServerSession).mockResolvedValue(nonExistingSession as unknown as Awaited<ReturnType<typeof getServerSession>>)
    const res = await createMobileUnit({ name: 'Unidad 1' })
    expect(res.success).toBe(false)
  })

  it('5. P2002 unique violation → error con mensaje claro', async () => {
    mockCreate.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '5',
      })
    )
    const res = await createMobileUnit({ name: 'Unidad 1' })
    expect(res.success).toBe(false)
    expect(res.error).toContain('Ya existe una unidad')
  })

  it('6. validación correcta → delega a prisma.create', async () => {
    mockCreate.mockResolvedValue({ id: 'u-new', name: 'Unidad 1', status: 'ACTIVA' })
    const res = await createMobileUnit({ name: 'Unidad 1', plate: 'ABC-123', capacity: 50 })
    expect(res.success).toBe(true)
    expect(mockCreate).toHaveBeenCalled()
  })

  it('7. capacity > 500 → error de validación', async () => {
    const res = await createMobileUnit({ name: 'Unidad 1', capacity: 1000 })
    expect(res.success).toBe(false)
  })

  it('8. year < 1900 → error de validación', async () => {
    const res = await createMobileUnit({ name: 'Unidad 1', year: 1500 })
    expect(res.success).toBe(false)
  })

  it('9. status enum inválido → error de validación', async () => {
    const res = await createMobileUnit({ name: 'Unidad 1', status: 'INVALID' as 'ACTIVA' })
    expect(res.success).toBe(false)
  })

  it('10. equipment como objeto → se acepta', async () => {
    mockCreate.mockResolvedValue({ id: 'u', name: 'U', equipment: { audiometro: true } })
    const res = await createMobileUnit({ name: 'Unidad 1', equipment: { audiometro: true, ecg: false } })
    expect(res.success).toBe(true)
  })
})

describe('mobile-unit.actions deleteMobileUnit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getServerSession).mockResolvedValue(ADMIN_SESSION as unknown as Awaited<ReturnType<typeof getServerSession>>)
  })

  it('11. sin sesión → error', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    const res = await deleteMobileUnit('any-id')
    expect(res.success).toBe(false)
  })

  it('12. unidad no existe → error', async () => {
    mockFindUnique.mockResolvedValue(null)
    const res = await deleteMobileUnit('nonexistent')
    expect(res.success).toBe(false)
    expect(res.error).toBe('Unidad no encontrada')
  })

  it('13. unidad sin relaciones → delete OK', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'u-1',
      _count: { projects: 0, maintenances: 0, medicalEvents: 0, labOrders: 0 },
    })
    mockDelete.mockResolvedValue({ id: 'u-1' })
    const res = await deleteMobileUnit('u-1')
    expect(res.success).toBe(true)
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: 'u-1' } })
  })

  it('14. unidad con proyectos → error', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'u-1',
      _count: { projects: 2, maintenances: 0, medicalEvents: 0, labOrders: 0 },
    })
    const res = await deleteMobileUnit('u-1')
    expect(res.success).toBe(false)
    expect(res.error).toContain('projects=2')
    expect(mockDelete).not.toHaveBeenCalled()
  })

  it('15. unidad con mantenimientos → error', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'u-1',
      _count: { projects: 0, maintenances: 5, medicalEvents: 0, labOrders: 0 },
    })
    const res = await deleteMobileUnit('u-1')
    expect(res.success).toBe(false)
    expect(res.error).toContain('maintenances')
  })
})

describe('mobile-unit.actions getMobileUnits', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getServerSession).mockResolvedValue(ADMIN_SESSION as unknown as Awaited<ReturnType<typeof getServerSession>>)
  })

  it('16. sin sesión → []', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    const res = await getMobileUnits()
    expect(res).toEqual([])
  })

  it('17. retorno normal → mapea mantenimientos a nextMaintenanceDate', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'u-1',
        name: 'Unidad 1',
        plate: 'ABC',
        status: 'ACTIVA',
        capacity: 50,
        imageUrl: null,
        maintenances: [{ scheduledDate: new Date('2026-08-01'), type: 'PREVENTIVO' }],
        _count: { projects: 1, maintenances: 3 },
      },
    ])
    const res = await getMobileUnits()
    expect(res[0].nextMaintenanceDate).toEqual(new Date('2026-08-01'))
    expect(res[0].nextMaintenanceType).toBe('PREVENTIVO')
    expect(res[0]._count.projects).toBe(1)
  })

  it('18. sin mantenimientos → nextMaintenanceDate = null', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'u-1',
        name: 'U',
        plate: null,
        status: 'ACTIVA',
        capacity: null,
        imageUrl: null,
        maintenances: [],
        _count: { projects: 0, maintenances: 0 },
      },
    ])
    const res = await getMobileUnits()
    expect(res[0].nextMaintenanceDate).toBeNull()
  })

  it('19. filtro status → se pasa a prisma', async () => {
    mockFindMany.mockResolvedValue([])
    await getMobileUnits('MANTENIMIENTO')
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'MANTENIMIENTO' } })
    )
  })

  it('20. lista vacía → []', async () => {
    mockFindMany.mockResolvedValue([])
    const res = await getMobileUnits()
    expect(res).toEqual([])
  })
})
