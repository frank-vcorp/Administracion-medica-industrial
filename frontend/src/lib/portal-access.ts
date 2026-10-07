import { getServerSession } from 'next-auth'
import { cookies } from 'next/headers'
import { UserRole } from '@prisma/client'
import { authOptions } from '@/auth'
import { isAdminLike, isSellerLike } from '@/lib/auth/roles'
import {
  PORTAL_PREVIEW_COOKIE,
  verifyPortalPreviewCookieValue,
} from '@/lib/portal-preview'
import prisma from '@/lib/prisma'

export type PortalAccessContext = {
  companyId: string
  isPreview: boolean
  actorUserId: string
  actorRole: UserRole
}

export async function readPreviewCompanyIdFromCookies(): Promise<string | null> {
  const jar = await cookies()
  const raw = jar.get(PORTAL_PREVIEW_COOKIE)?.value
  return verifyPortalPreviewCookieValue(raw)
}

/**
 * Resuelve la empresa cuyo portal se está consultando: sesión COMPANY_CLIENT
 * o vista previa firmada (admin/vendedor).
 */
export async function resolvePortalCompanyAccess(): Promise<PortalAccessContext> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    throw new Error('No autorizado: sesión no encontrada')
  }

  const role = session.user.role

  if (role === UserRole.COMPANY_CLIENT) {
    if (!session.user.companyId) {
      throw new Error('No autorizado: usuario CLIENT sin empresa asignada')
    }
    const company = await prisma.company.findUnique({
      where: { id: session.user.companyId },
      select: { portalEnabled: true, estado: true },
    })
    if (!company?.portalEnabled || company.estado !== 'HABILITADO') {
      throw new Error('El portal no está habilitado para su empresa.')
    }
    return {
      companyId: session.user.companyId,
      isPreview: false,
      actorUserId: session.user.id,
      actorRole: role,
    }
  }

  if (isAdminLike(role) || isSellerLike(role)) {
    const previewCompanyId = await readPreviewCompanyIdFromCookies()
    if (previewCompanyId) {
      const company = await prisma.company.findUnique({
        where: { id: previewCompanyId },
        select: { id: true },
      })
      if (!company) {
        throw new Error('Empresa de vista previa no encontrada')
      }
      return {
        companyId: previewCompanyId,
        isPreview: true,
        actorUserId: session.user.id,
        actorRole: role,
      }
    }
  }

  throw new Error('No autorizado: solo usuarios del portal o vista previa staff')
}

/** Datos de empresa para páginas `/portal/*` (cliente real o vista previa staff). */
export async function getPortalPageCompany(): Promise<{
  company: { id: string; name: string }
  isPreview: boolean
  viewerLabel: string
}> {
  const access = await resolvePortalCompanyAccess()
  const session = await getServerSession(authOptions)
  const company = await prisma.company.findUnique({
    where: { id: access.companyId },
    select: { id: true, name: true },
  })
  if (!company) {
    throw new Error('Empresa no encontrada')
  }
  const viewerLabel = access.isPreview
    ? `Vista previa (${session?.user?.fullName ?? 'staff'})`
    : (session?.user?.fullName ?? 'Usuario portal')
  return { company, isPreview: access.isPreview, viewerLabel }
}
