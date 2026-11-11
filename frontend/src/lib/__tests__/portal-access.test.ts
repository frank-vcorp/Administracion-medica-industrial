import { describe, it, expect, vi, beforeEach } from 'vitest'
import { UserRole } from '@prisma/client'

const mockGetServerSession = vi.fn()
const mockCookiesGet = vi.fn()
const prismaUserFindUnique = vi.fn()
const prismaCompanyFindUnique = vi.fn()

vi.mock('next-auth', () => ({
  getServerSession: (...args: unknown[]) => mockGetServerSession(...args),
}))

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    get: mockCookiesGet,
  })),
}))

vi.mock('@/lib/prisma', () => ({
  default: {
    user: { findUnique: (...args: unknown[]) => prismaUserFindUnique(...args) },
    company: { findUnique: (...args: unknown[]) => prismaCompanyFindUnique(...args) },
  },
}))

vi.mock('@/auth', () => ({ authOptions: {} }))

import { resolvePortalCompanyAccess } from '@/lib/portal-access'

describe('resolvePortalCompanyAccess', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCookiesGet.mockReturnValue(undefined)
  })

  it('COMPANY_CLIENT usa companyId de BD, no sólo el JWT en sesión', async () => {
    const dbCompanyId = 'cccccccc-cccc-4ccc-accc-cccccccccccc'
    const staleJwtCompanyId = 'bbbbbbbb-bbbb-4bbb-abbb-bbbbbbbbbbbb'

    mockGetServerSession.mockResolvedValue({
      user: {
        id: 'user-portal-1',
        role: UserRole.COMPANY_CLIENT,
        companyId: staleJwtCompanyId,
      },
    })

    prismaUserFindUnique.mockResolvedValue({
      companyId: dbCompanyId,
      isActive: true,
    })

    prismaCompanyFindUnique.mockResolvedValue({
      portalEnabled: true,
      estado: 'HABILITADO',
    })

    const access = await resolvePortalCompanyAccess()

    expect(access.companyId).toBe(dbCompanyId)
    expect(access.isPreview).toBe(false)
    expect(prismaUserFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'user-portal-1' } }),
    )
  })
})
