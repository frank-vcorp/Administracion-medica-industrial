'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/auth'
import { isAdminLike, isSellerLike } from '@/lib/auth/roles'
import prisma from '@/lib/prisma'
import { logAudit } from '@/actions/audit.actions'
import {
  buildPortalPreviewCookieValue,
  PORTAL_PREVIEW_COOKIE,
} from '@/lib/portal-preview'
import { readPreviewCompanyIdFromCookies } from '@/lib/portal-access'

async function assertStaffPreviewActor() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return { ok: false as const, error: 'No autorizado' }
  }
  if (!isAdminLike(session.user.role) && !isSellerLike(session.user.role)) {
    return { ok: false as const, error: 'No autorizado' }
  }
  return { ok: true as const, session }
}

export async function startPortalPreview(companyId: string): Promise<void> {
  const gate = await assertStaffPreviewActor()
  if (!gate.ok) {
    throw new Error(gate.error)
  }

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, name: true },
  })
  if (!company) {
    throw new Error('Empresa no encontrada')
  }

  const jar = await cookies()
  jar.set(PORTAL_PREVIEW_COOKIE, buildPortalPreviewCookieValue(companyId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 4,
  })

  await logAudit('UPDATE', 'Company', companyId, {
    action: 'PORTAL_PREVIEW_START',
    byUserId: gate.session.user.id,
    companyName: company.name,
  })

  redirect('/portal')
}

export async function endPortalPreview(companyId?: string): Promise<void> {
  const gate = await assertStaffPreviewActor()
  if (!gate.ok) {
    throw new Error(gate.error)
  }

  const previewId = (await readPreviewCompanyIdFromCookies()) ?? companyId ?? null
  const jar = await cookies()
  jar.delete(PORTAL_PREVIEW_COOKIE)

  if (previewId) {
    await logAudit('UPDATE', 'Company', previewId, {
      action: 'PORTAL_PREVIEW_END',
      byUserId: gate.session.user.id,
    })
    redirect(`/companies/${previewId}`)
  }

  redirect('/companies')
}

export async function getPortalPreviewBannerInfo(): Promise<{
  active: boolean
  companyId: string | null
  companyName: string | null
}> {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return { active: false, companyId: null, companyName: null }
  }
  if (!isAdminLike(session.user.role) && !isSellerLike(session.user.role)) {
    return { active: false, companyId: null, companyName: null }
  }

  const companyId = await readPreviewCompanyIdFromCookies()
  if (!companyId) {
    return { active: false, companyId: null, companyName: null }
  }

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { name: true },
  })

  return {
    active: true,
    companyId,
    companyName: company?.name ?? null,
  }
}
