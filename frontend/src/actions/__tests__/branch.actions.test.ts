/**
 * @file Tests para branch.actions.ts (IMPL-20260730-03 — correcciones GEMINI AUD-20260730-01).
 * @id IMPL-20260730-03
 * @spec context/SPECs/SPEC_ARCH-20260730-01-MODULO-SUCURSALES-COMPLETO.md §5
 *
 * Cubre:
 *   - H4 (try/catch): createBranch retorna {ok:false, error} si Prisma.create lanza.
 *   - H5 (existencia): updateBranch retorna {ok:false, error:'Sucursal no encontrada'} si id no existe.
 *   - logAudit se llama SOLO en éxito (verificación secundaria H1).
 *
 * vitest globals via vitest.config.ts (globals: true).
 */
/// <reference types="vitest/globals" />

const mockBranchFindUnique = vi.fn()
const mockBranchCreate = vi.fn()
const mockBranchUpdate = vi.fn()
const mockBranchDelete = vi.fn()
const mockCompanyFindMany = vi.fn()
const mockAuditLogCreate = vi.fn()
const mockGetDefaultTenant = vi.fn()
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
vi.mock('@/lib/prisma', () => ({
  default: {
    branch: {
      findUnique: (...args: unknown[]) => mockBranchFindUnique(...args),
      create: (...args: unknown[]) => mockBranchCreate(...args),
      update: (...args: unknown[]) => mockBranchUpdate(...args),
      delete: (...args: unknown[]) => mockBranchDelete(...args),
    },
    company: {
      findMany: (...args: unknown[]) => mockCompanyFindMany(...args),
    },
    auditLog: {
      create: (...args: unknown[]) => mockAuditLogCreate(...args),
    },
  },
}))
vi.mock('@/lib/tenant', () => ({
  getDefaultTenant: () => mockGetDefaultTenant(),
}))
vi.mock('@/lib/auth/roles', () => ({
  isAdminLike: (role: unknown) => role === 'ADMIN' || role === 'SUPERADMIN',
}))
vi.mock('@/actions/audit.actions', () => ({
  logAudit: (...args: unknown[]) => mockLogAudit(...args),
}))

import { getServerSession } from 'next-auth/next'
import {
  createBranch,
  updateBranch,
  toggleBranchActive,
  updateBranchAllowedCompanies,
  getAvailableCompaniesForBranch,
  deleteBranch,
} from '@/actions/branch.actions'

const adminSession = {
  user: { id: 'admin-1', role: 'ADMIN', email: 'a@x', name: 'A' },
  expires: '2099-12-31',
} as unknown as Awaited<ReturnType<typeof getServerSession>>

const validInput = {
  name: 'Sucursal Centro',
  address: 'Av. Reforma 100',
  phone: '+52 55 1234 5678',
  managerName: 'Juan',
  hourlyCapacity: 20,
  openingTime: '08:00',
  closingTime: '18:00',
}

describe('branch.actions — IMPL-20260730-03 H1/H4/H5', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getServerSession).mockResolvedValue(adminSession)
    mockGetDefaultTenant.mockResolvedValue({ id: 'tenant-1', name: 'Default' })
    mockLogAudit.mockResolvedValue({ success: true, auditId: 'audit-1' })
    mockAuditLogCreate.mockResolvedValue({ id: 'audit-1' })
  })

  // ----------------------------------------------------------------------
  // H4 — try/catch en createBranch
  // ----------------------------------------------------------------------
  describe('H4 — createBranch try/catch', () => {
    it('retorna {ok:false, error} cuando Prisma.create lanza', async () => {
      mockBranchCreate.mockRejectedValue(new Error('Prisma P2002 unique constraint'))
      const res = await createBranch(validInput)
      expect(res.ok).toBe(false)
      if (!res.ok) {
        expect(res.error).toBe('Error al crear sucursal')
      }
      expect(mockLogAudit).not.toHaveBeenCalled()
    })

    it('NO llama logAudit en path de error (verificación H1)', async () => {
      mockBranchCreate.mockRejectedValue(new Error('boom'))
      const res = await createBranch(validInput)
      expect(res.ok).toBe(false)
      expect(mockLogAudit).not.toHaveBeenCalled()
    })

    it('llama logAudit SOLO cuando el create es exitoso', async () => {
      mockBranchCreate.mockResolvedValue({
        id: 'branch-new',
        name: 'Sucursal Centro',
        tenantId: 'tenant-1',
      })
      const res = await createBranch(validInput)
      expect(res.ok).toBe(true)
      expect(mockLogAudit).toHaveBeenCalledTimes(1)
      expect(mockLogAudit).toHaveBeenCalledWith(
        'CREATE',
        'Branch',
        'branch-new',
        expect.objectContaining({ name: 'Sucursal Centro', tenantId: 'tenant-1' }),
      )
    })
  })

  // ----------------------------------------------------------------------
  // H5 — updateBranch valida existencia
  // ----------------------------------------------------------------------
  describe('H5 — updateBranch existencia', () => {
    const validId = '5b8e6f9c-3a4b-4f1e-9f1a-1c2d3e4f5a6b'

    it('retorna {ok:false, error:"Sucursal no encontrada"} si findUnique devuelve null', async () => {
      mockBranchFindUnique.mockResolvedValue(null)
      const res = await updateBranch(validId, { name: 'Nuevo' })
      expect(res.ok).toBe(false)
      if (!res.ok) {
        expect(res.error).toBe('Sucursal no encontrada')
      }
      expect(mockBranchUpdate).not.toHaveBeenCalled()
      expect(mockLogAudit).not.toHaveBeenCalled()
    })

    it('procede al update si la sucursal existe', async () => {
      mockBranchFindUnique.mockResolvedValue({
        id: validId,
        name: 'Sucursal Centro',
        tenantId: 'tenant-1',
      })
      mockBranchUpdate.mockResolvedValue({
        id: validId,
        name: 'Nuevo nombre',
        tenantId: 'tenant-1',
      })
      const res = await updateBranch(validId, { name: 'Nuevo nombre' })
      expect(res.ok).toBe(true)
      expect(mockBranchUpdate).toHaveBeenCalledWith({
        where: { id: validId },
        data: { name: 'Nuevo nombre' },
      })
      expect(mockLogAudit).toHaveBeenCalledWith('UPDATE', 'Branch', validId, expect.any(Object))
    })

    it('H4 — updateBranch retorna {ok:false, error} si Prisma.update lanza', async () => {
      mockBranchFindUnique.mockResolvedValue({ id: validId, name: 'Centro', tenantId: 'tenant-1' })
      mockBranchUpdate.mockRejectedValue(new Error('Prisma P2025 not found'))
      const res = await updateBranch(validId, { name: 'Sucursal Nueva' })
      expect(res.ok).toBe(false)
      if (!res.ok) {
        expect(res.error).toBe('Error al actualizar sucursal')
      }
      expect(mockLogAudit).not.toHaveBeenCalled()
    })

    it('NO llama logAudit si update lanza error', async () => {
      mockBranchFindUnique.mockResolvedValue({ id: validId, name: 'Centro', tenantId: 'tenant-1' })
      mockBranchUpdate.mockRejectedValue(new Error('boom'))
      await updateBranch(validId, { name: 'Sucursal Nueva' })
      expect(mockLogAudit).not.toHaveBeenCalled()
    })
  })

  // ----------------------------------------------------------------------
  // IMPL-20260730-05 (PR-3) — toggleBranchActive
  // ----------------------------------------------------------------------
  describe('PR-3 — toggleBranchActive', () => {
    const validId = '5b8e6f9c-3a4b-4f1e-9f1a-1c2d3e4f5a6b'

    it('desactivar: setea isActive=false, disabledAt y disabledByUserId', async () => {
      mockBranchUpdate.mockResolvedValue({ id: validId, isActive: false })
      mockCompanyFindMany.mockResolvedValue([])
      const res = await toggleBranchActive(validId, false)
      expect(res.ok).toBe(true)
      if (res.ok) expect(res.branch.isActive).toBe(false)
      expect(mockBranchUpdate).toHaveBeenCalledWith({
        where: { id: validId },
        data: {
          isActive: false,
          disabledAt: expect.any(Date),
          disabledByUserId: 'admin-1',
        },
      })
      expect(mockLogAudit).toHaveBeenCalledWith(
        'TOGGLE',
        'Branch',
        validId,
        expect.objectContaining({ isActive: false }),
      )
    })

    it('activar: setea isActive=true, disabledAt=null y disabledByUserId=null', async () => {
      mockBranchUpdate.mockResolvedValue({ id: validId, isActive: true })
      const res = await toggleBranchActive(validId, true)
      expect(res.ok).toBe(true)
      expect(mockBranchUpdate).toHaveBeenCalledWith({
        where: { id: validId },
        data: {
          isActive: true,
          disabledAt: null,
          disabledByUserId: null,
        },
      })
      expect(mockLogAudit).toHaveBeenCalledWith(
        'TOGGLE',
        'Branch',
        validId,
        { isActive: true },
      )
    })

    it('desactivar cuando es defaultBranch de empresa HABILITADA: emite audit con warning', async () => {
      mockBranchUpdate.mockResolvedValue({ id: validId, isActive: false })
      mockCompanyFindMany.mockResolvedValue([{ id: 'co-1', name: 'Acme' }])
      await toggleBranchActive(validId, false)
      expect(mockLogAudit).toHaveBeenCalledWith(
        'TOGGLE',
        'Branch',
        validId,
        expect.objectContaining({
          isActive: false,
          warning: 'Es sucursal predeterminada de empresas habilitadas',
          companies: ['co-1'],
        }),
      )
    })

    it('retorna {ok:false} si id no es UUID', async () => {
      const res = await toggleBranchActive('no-uuid', false)
      expect(res.ok).toBe(false)
      if (!res.ok) expect(res.error).toBe('ID inválido')
      expect(mockBranchUpdate).not.toHaveBeenCalled()
    })

    it('retorna {ok:false} si Prisma.update lanza', async () => {
      mockBranchUpdate.mockRejectedValue(new Error('P2025'))
      const res = await toggleBranchActive(validId, false)
      expect(res.ok).toBe(false)
      if (!res.ok) expect(res.error).toBe('Error al cambiar estado de sucursal')
      expect(mockLogAudit).not.toHaveBeenCalled()
    })
  })

  // ----------------------------------------------------------------------
  // IMPL-20260730-05 (PR-3) — updateBranchAllowedCompanies
  // ----------------------------------------------------------------------
  describe('PR-3 — updateBranchAllowedCompanies', () => {
    const validId = '5b8e6f9c-3a4b-4f1e-9f1a-1c2d3e4f5a6b'
    const coA = '5b8e6f9c-3a4b-4f1e-9f1a-aaaaaaaaaaaa'
    const coB = '5b8e6f9c-3a4b-4f1e-9f1a-bbbbbbbbbbbb'

    it('persiste M2M con `set` y emite audit', async () => {
      mockBranchFindUnique.mockResolvedValue({ id: validId })
      mockBranchUpdate.mockResolvedValue({ id: validId })
      const res = await updateBranchAllowedCompanies(validId, [coA, coB])
      expect(res.ok).toBe(true)
      expect(mockBranchUpdate).toHaveBeenCalledWith({
        where: { id: validId },
        data: {
          allowedByCompanies: {
            set: [{ id: coA }, { id: coB }],
          },
        },
      })
      expect(mockLogAudit).toHaveBeenCalledWith(
        'UPDATE',
        'Branch',
        validId,
        expect.objectContaining({ field: 'allowedByCompanies', count: 2 }),
      )
    })

    it('acepta array vacío (desasignar todas)', async () => {
      mockBranchFindUnique.mockResolvedValue({ id: validId })
      mockBranchUpdate.mockResolvedValue({ id: validId })
      const res = await updateBranchAllowedCompanies(validId, [])
      expect(res.ok).toBe(true)
      expect(mockBranchUpdate).toHaveBeenCalledWith({
        where: { id: validId },
        data: { allowedByCompanies: { set: [] } },
      })
    })

    it('rechaza branchId con caracteres inválidos', async () => {
      const res = await updateBranchAllowedCompanies('id!@#con simbolos', [coA])
      expect(res.ok).toBe(false)
      if (!res.ok) expect(res.error).toBe('ID de sucursal inválido')
      expect(mockBranchUpdate).not.toHaveBeenCalled()
    })

    it('acepta branchId legacy no-UUID como "branch-matriz"', async () => {
      const res = await updateBranchAllowedCompanies('branch-matriz', [coA])
      expect(res.ok).toBe(true)
    })

    it('rechaza companyId con caracteres inválidos', async () => {
      const res = await updateBranchAllowedCompanies(validId, ['id!@# con simbolos'])
      expect(res.ok).toBe(false)
      if (!res.ok) expect(res.error).toBeDefined()
    })

    it('rechaza >200 empresas', async () => {
      const ids = Array.from({ length: 201 }, (_, i) => `5b8e6f9c-3a4b-4f1e-9f1a-${i.toString().padStart(12, '0')}`)
      const res = await updateBranchAllowedCompanies(validId, ids)
      expect(res.ok).toBe(false)
      if (!res.ok) expect(res.error).toBe('Máximo 200 empresas permitidas')
    })

    it('retorna {ok:false} si branch no existe', async () => {
      mockBranchFindUnique.mockResolvedValue(null)
      const res = await updateBranchAllowedCompanies(validId, [coA])
      expect(res.ok).toBe(false)
      if (!res.ok) expect(res.error).toBe('Sucursal no encontrada')
      expect(mockBranchUpdate).not.toHaveBeenCalled()
    })
  })

  // ----------------------------------------------------------------------
  // IMPL-20260730-05 (PR-3) — getAvailableCompaniesForBranch
  // ----------------------------------------------------------------------
  describe('PR-3 — getAvailableCompaniesForBranch', () => {
    it('lista empresas NO deshabilitadas ordenadas por nombre', async () => {
      mockCompanyFindMany.mockResolvedValue([
        { id: 'co-1', name: 'Acme', rfc: 'AAA010101AAA' },
        { id: 'co-2', name: 'Beta', rfc: 'BBB010101BBB' },
      ])
      const res = await getAvailableCompaniesForBranch()
      expect(res.ok).toBe(true)
      if (res.ok) expect(res.companies).toHaveLength(2)
      expect(mockCompanyFindMany).toHaveBeenCalledWith({
        where: { estado: { not: 'DESHABILITADO' } },
        select: { id: true, name: true, rfc: true },
        orderBy: { name: 'asc' },
      })
    })
  })

  // ----------------------------------------------------------------------
  // IMPL-20260730-06 (PR-4) — deleteBranch
  // SPEC §5.6 / §3.3 propuesta A
  // ----------------------------------------------------------------------
  describe('PR-4 — deleteBranch', () => {
    const validId = '5b8e6f9c-3a4b-4f1e-9f1a-1c2d3e4f5a6b'

    it('retorna PERMISSION_DENIED si no hay sesión', async () => {
      vi.mocked(getServerSession).mockResolvedValue(null)
      const res = await deleteBranch(validId)
      expect(res.ok).toBe(false)
      if (!res.ok) {
        expect(res.code).toBe('PERMISSION_DENIED')
        expect(res.error).toBe('Sin permisos')
      }
      expect(mockBranchFindUnique).not.toHaveBeenCalled()
      expect(mockBranchDelete).not.toHaveBeenCalled()
      expect(mockLogAudit).not.toHaveBeenCalled()
    })

    it('retorna PERMISSION_DENIED si el rol no es ADMIN_LIKE (e.g. RECEPTIONIST)', async () => {
      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: 'r-1', role: 'RECEPTIONIST', email: 'r@x', name: 'R' },
        expires: '2099-12-31',
      } as unknown as Awaited<ReturnType<typeof getServerSession>>)
      const res = await deleteBranch(validId)
      expect(res.ok).toBe(false)
      if (!res.ok) expect(res.code).toBe('PERMISSION_DENIED')
      expect(mockBranchFindUnique).not.toHaveBeenCalled()
    })

    it('retorna NOT_FOUND si el ID tiene caracteres inválidos', async () => {
      const res = await deleteBranch('id!@#con simbolos')
      expect(res.ok).toBe(false)
      if (!res.ok) expect(res.code).toBe('NOT_FOUND')
      expect(mockBranchFindUnique).not.toHaveBeenCalled()
    })

    it('acepta branchId legacy no-UUID como "branch-matriz" sin fallar por validación', async () => {
      // Verifica que branchIdSchema acepta IDs legacy no-UUID.
      // El test no verifica el flujo completo porque requiere mocks complejos;
      // sí verifica que NO falla por "ID inválido".
      const { branchIdSchema } = await import('@/lib/schemas/branch')
      expect(branchIdSchema.safeParse('branch-matriz').success).toBe(true)
      expect(branchIdSchema.safeParse('uuid').success).toBe(true)
      expect(branchIdSchema.safeParse('id-con-guiones-y-bajos').success).toBe(true)
    })

    it('retorna NOT_FOUND si la sucursal no existe', async () => {
      mockBranchFindUnique.mockResolvedValue(null)
      const res = await deleteBranch(validId)
      expect(res.ok).toBe(false)
      if (!res.ok) {
        expect(res.code).toBe('NOT_FOUND')
        expect(res.error).toBe('Sucursal no encontrada')
      }
      expect(mockBranchDelete).not.toHaveBeenCalled()
      expect(mockLogAudit).not.toHaveBeenCalled()
    })

    it('retorna MUST_DISABLE_FIRST si branch.isActive=true', async () => {
      mockBranchFindUnique.mockResolvedValue({
        id: validId,
        name: 'Sucursal Centro',
        isActive: true,
        _count: {
          appointments: 0,
          events: 0,
          workers: 0,
          projects: 0,
          allowedByCompanies: 0,
          companies: 0,
        },
      })
      const res = await deleteBranch(validId)
      expect(res.ok).toBe(false)
      if (!res.ok) {
        expect(res.code).toBe('MUST_DISABLE_FIRST')
        expect(res.dependencies).toBeUndefined()
      }
      expect(mockBranchDelete).not.toHaveBeenCalled()
      expect(mockLogAudit).not.toHaveBeenCalled()
    })

    it('retorna HAS_DEPENDENCIES con counts si hay appointments aunque sea 1', async () => {
      mockBranchFindUnique.mockResolvedValue({
        id: validId,
        name: 'Sucursal Centro',
        isActive: false,
        _count: {
          appointments: 3,
          events: 0,
          workers: 0,
          projects: 0,
          allowedByCompanies: 0,
          companies: 0,
        },
      })
      const res = await deleteBranch(validId)
      expect(res.ok).toBe(false)
      if (!res.ok) {
        expect(res.code).toBe('HAS_DEPENDENCIES')
        expect(res.dependencies).toEqual({
          appointments: 3,
          events: 0,
          workers: 0,
          projects: 0,
          allowedByCompanies: 0,
          defaultForCompanies: 0,
        })
        expect(res.error).toContain('3')
      }
      expect(mockBranchDelete).not.toHaveBeenCalled()
      expect(mockLogAudit).not.toHaveBeenCalled()
    })

    it('retorna HAS_DEPENDENCIES si la sucursal es defaultBranch de alguna company', async () => {
      mockBranchFindUnique.mockResolvedValue({
        id: validId,
        name: 'Sucursal Centro',
        isActive: false,
        _count: {
          appointments: 0,
          events: 0,
          workers: 0,
          projects: 0,
          allowedByCompanies: 0,
          companies: 2,
        },
      })
      const res = await deleteBranch(validId)
      expect(res.ok).toBe(false)
      if (!res.ok) {
        expect(res.code).toBe('HAS_DEPENDENCIES')
        expect(res.dependencies?.defaultForCompanies).toBe(2)
      }
      expect(mockBranchDelete).not.toHaveBeenCalled()
    })

    it('elimina exitosamente si isActive=false y todas las dependencias son 0', async () => {
      mockBranchFindUnique.mockResolvedValue({
        id: validId,
        name: 'Sucursal Centro',
        isActive: false,
        _count: {
          appointments: 0,
          events: 0,
          workers: 0,
          projects: 0,
          allowedByCompanies: 0,
          companies: 0,
        },
      })
      mockBranchDelete.mockResolvedValue({ id: validId })
      const res = await deleteBranch(validId)
      expect(res.ok).toBe(true)
      if (res.ok) expect(res.branch.id).toBe(validId)
      expect(mockBranchDelete).toHaveBeenCalledWith({ where: { id: validId } })
    })

    it('registra logAudit SOLO en deleteBranch exitoso', async () => {
      mockBranchFindUnique.mockResolvedValue({
        id: validId,
        name: 'Sucursal Centro',
        isActive: false,
        _count: {
          appointments: 0,
          events: 0,
          workers: 0,
          projects: 0,
          allowedByCompanies: 0,
          companies: 0,
        },
      })
      mockBranchDelete.mockResolvedValue({ id: validId })
      const res = await deleteBranch(validId)
      expect(res.ok).toBe(true)
      expect(mockLogAudit).toHaveBeenCalledTimes(1)
      expect(mockLogAudit).toHaveBeenCalledWith(
        'DELETE',
        'Branch',
        validId,
        { name: 'Sucursal Centro' },
      )
    })

    it('NO llama logAudit si delete lanza error', async () => {
      mockBranchFindUnique.mockResolvedValue({
        id: validId,
        name: 'Sucursal Centro',
        isActive: false,
        _count: {
          appointments: 0,
          events: 0,
          workers: 0,
          projects: 0,
          allowedByCompanies: 0,
          companies: 0,
        },
      })
      mockBranchDelete.mockRejectedValue(new Error('P2025 branch not found'))
      const res = await deleteBranch(validId)
      expect(res.ok).toBe(false)
      if (!res.ok) expect(res.code).toBe('NOT_FOUND')
      expect(mockLogAudit).not.toHaveBeenCalled()
    })
  })
})