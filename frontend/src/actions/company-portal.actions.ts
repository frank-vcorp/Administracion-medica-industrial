'use server'

import bcrypt from 'bcryptjs'
import { getServerSession } from 'next-auth/next'
import { revalidatePath } from 'next/cache'
import { UserRole } from '@prisma/client'
import { authOptions } from '@/auth'
import prisma from '@/lib/prisma'
import { isAdminLike, isSellerLike } from '@/lib/auth/roles'
import { logAudit } from '@/actions/audit.actions'
import { sendPortalAccessCredentialsEmail } from '@/lib/portal-access-email'
import {
  generateTemporaryPortalPassword,
  validatePortalPassword,
} from '@/lib/portal-access-password'
import {
  isPortalLegalCurrent,
  PORTAL_LEGAL_VERSION,
  portalOnboardingRequired,
} from '@/lib/portal-legal'

function resolvePortalLoginUrl(): string {
  const base =
    process.env.NEXTAUTH_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    'http://localhost:3000'
  return `${base.replace(/\/$/, '')}/login`
}

async function assertStaffCanManageCompanyPortal(companyId: string) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return { ok: false as const, error: 'No autorizado' }
  }
  if (!isAdminLike(session.user.role) && !isSellerLike(session.user.role)) {
    return { ok: false as const, error: 'No autorizado' }
  }
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, estado: true, name: true, email: true, contactName: true },
  })
  if (!company) {
    return { ok: false as const, error: 'Empresa no encontrada' }
  }
  return { ok: true as const, session, company }
}

export type CompanyPortalAccessState = {
  portalEnabled: boolean
  canProvision: boolean
  portalUser: {
    id: string
    email: string
    fullName: string
    isActive: boolean
    mustChangePassword: boolean
    legalAccepted: boolean
    portalLegalAcceptedAt: string | null
  } | null
}

export async function getCompanyPortalAccessState(
  companyId: string,
): Promise<{ success: boolean; state?: CompanyPortalAccessState; error?: string }> {
  const gate = await assertStaffCanManageCompanyPortal(companyId)
  if (!gate.ok) return { success: false, error: gate.error }

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { portalEnabled: true, estado: true },
  })
  if (!company) return { success: false, error: 'Empresa no encontrada' }

  const portalUser = await prisma.user.findFirst({
    where: { companyId, role: UserRole.COMPANY_CLIENT },
    select: {
      id: true,
      email: true,
      fullName: true,
      isActive: true,
      mustChangePassword: true,
      portalLegalAcceptedAt: true,
      portalLegalVersion: true,
    },
  })

  return {
    success: true,
    state: {
      portalEnabled: company.portalEnabled,
      canProvision: company.estado === 'HABILITADO',
      portalUser: portalUser
        ? {
            id: portalUser.id,
            email: portalUser.email,
            fullName: portalUser.fullName,
            isActive: portalUser.isActive,
            mustChangePassword: portalUser.mustChangePassword,
            legalAccepted: isPortalLegalCurrent(
              portalUser.portalLegalAcceptedAt,
              portalUser.portalLegalVersion,
            ),
            portalLegalAcceptedAt: portalUser.portalLegalAcceptedAt?.toISOString() ?? null,
          }
        : null,
    },
  }
}

export async function setCompanyPortalEnabled(
  companyId: string,
  enabled: boolean,
): Promise<{ success: boolean; error?: string }> {
  const gate = await assertStaffCanManageCompanyPortal(companyId)
  if (!gate.ok) return { success: false, error: gate.error }

  if (enabled && gate.company.estado !== 'HABILITADO') {
    return {
      success: false,
      error: 'Solo empresas habilitadas pueden activar el portal.',
    }
  }

  await prisma.company.update({
    where: { id: companyId },
    data: { portalEnabled: enabled },
  })

  if (!enabled) {
    await prisma.user.updateMany({
      where: { companyId, role: UserRole.COMPANY_CLIENT },
      data: { isActive: false },
    })
  }

  await logAudit('UPDATE', 'Company', companyId, {
    action: 'PORTAL_ACCESS_TOGGLE',
    portalEnabled: enabled,
    byUserId: gate.session.user.id,
  })

  revalidatePath(`/companies/${companyId}`)
  return { success: true }
}

export async function provisionCompanyPortalUser(input: {
  companyId: string
  email: string
  fullName?: string
}): Promise<{ success: boolean; error?: string; emailSkipped?: boolean }> {
  const gate = await assertStaffCanManageCompanyPortal(input.companyId)
  if (!gate.ok) return { success: false, error: gate.error }

  if (gate.company.estado !== 'HABILITADO') {
    return { success: false, error: 'La empresa debe estar habilitada.' }
  }

  const email = input.email.trim().toLowerCase()
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { success: false, error: 'Correo inválido.' }
  }

  const fullName =
    input.fullName?.trim() ||
    gate.company.contactName?.trim() ||
    `Portal ${gate.company.name}`

  const tempPassword = generateTemporaryPortalPassword()
  const hashedPassword = await bcrypt.hash(tempPassword, 10)

  const existingByEmail = await prisma.user.findUnique({
    where: { email },
    select: { id: true, companyId: true, role: true },
  })
  if (
    existingByEmail &&
    (existingByEmail.role !== UserRole.COMPANY_CLIENT ||
      existingByEmail.companyId !== input.companyId)
  ) {
    return {
      success: false,
      error: 'Ese correo ya está registrado para otro usuario del sistema.',
    }
  }

  const otherPortalUsers = await prisma.user.findMany({
    where: {
      companyId: input.companyId,
      role: UserRole.COMPANY_CLIENT,
      ...(existingByEmail ? { NOT: { id: existingByEmail.id } } : {}),
    },
    select: { id: true },
  })
  if (otherPortalUsers.length > 0) {
    await prisma.user.updateMany({
      where: { id: { in: otherPortalUsers.map((u) => u.id) } },
      data: { isActive: false },
    })
  }

  await prisma.user.upsert({
    where: { email },
    create: {
      email,
      fullName,
      hashedPassword,
      role: UserRole.COMPANY_CLIENT,
      companyId: input.companyId,
      isActive: true,
      mustChangePassword: true,
      portalLegalAcceptedAt: null,
      portalLegalVersion: null,
    },
    update: {
      fullName,
      hashedPassword,
      role: UserRole.COMPANY_CLIENT,
      companyId: input.companyId,
      isActive: true,
      mustChangePassword: true,
      portalLegalAcceptedAt: null,
      portalLegalVersion: null,
    },
  })

  await prisma.company.update({
    where: { id: input.companyId },
    data: { portalEnabled: true },
  })

  const mail = await sendPortalAccessCredentialsEmail({
    to: email,
    companyName: gate.company.name,
    loginEmail: email,
    temporaryPassword: tempPassword,
    loginUrl: resolvePortalLoginUrl(),
  })

  if (!mail.success) {
    return { success: false, error: mail.error ?? 'No se pudo enviar el correo.' }
  }

  await logAudit('UPDATE', 'Company', input.companyId, {
    action: 'PORTAL_ACCESS_PROVISIONED',
    portalUserEmail: email,
    byUserId: gate.session.user.id,
  })

  revalidatePath(`/companies/${input.companyId}`)
  return { success: true, emailSkipped: mail.skipped }
}

export async function revokeCompanyPortalAccess(
  companyId: string,
): Promise<{ success: boolean; error?: string }> {
  const gate = await assertStaffCanManageCompanyPortal(companyId)
  if (!gate.ok) return { success: false, error: gate.error }

  await prisma.company.update({
    where: { id: companyId },
    data: { portalEnabled: false },
  })
  await prisma.user.updateMany({
    where: { companyId, role: UserRole.COMPANY_CLIENT },
    data: { isActive: false },
  })

  await logAudit('UPDATE', 'Company', companyId, {
    action: 'PORTAL_ACCESS_REVOKED',
    byUserId: gate.session.user.id,
  })

  revalidatePath(`/companies/${companyId}`)
  return { success: true }
}

export async function completePortalOnboarding(input: {
  acceptTerms: boolean
  acceptPrivacy: boolean
  newPassword: string
  confirmPassword: string
}): Promise<{ success: boolean; error?: string }> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.role !== UserRole.COMPANY_CLIENT) {
    return { success: false, error: 'No autorizado' }
  }

  if (!input.acceptTerms || !input.acceptPrivacy) {
    return { success: false, error: 'Debe aceptar términos y aviso de privacidad.' }
  }

  const pwdError = validatePortalPassword(input.newPassword)
  if (pwdError) return { success: false, error: pwdError }

  if (input.newPassword !== input.confirmPassword) {
    return { success: false, error: 'Las contraseñas no coinciden.' }
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      mustChangePassword: true,
      portalLegalAcceptedAt: true,
      portalLegalVersion: true,
      companyId: true,
    },
  })
  if (!user?.companyId) {
    return { success: false, error: 'Usuario portal sin empresa asignada.' }
  }

  const company = await prisma.company.findUnique({
    where: { id: user.companyId },
    select: { portalEnabled: true, estado: true },
  })
  if (!company?.portalEnabled || company.estado !== 'HABILITADO') {
    return { success: false, error: 'El portal no está habilitado para su empresa.' }
  }

  if (
    !portalOnboardingRequired({
      mustChangePassword: user.mustChangePassword,
      portalLegalAcceptedAt: user.portalLegalAcceptedAt,
      portalLegalVersion: user.portalLegalVersion,
    )
  ) {
    return { success: true }
  }

  const hashedPassword = await bcrypt.hash(input.newPassword, 10)
  await prisma.user.update({
    where: { id: user.id },
    data: {
      hashedPassword,
      mustChangePassword: false,
      portalLegalAcceptedAt: new Date(),
      portalLegalVersion: PORTAL_LEGAL_VERSION,
    },
  })

  await logAudit('UPDATE', 'User', user.id, {
    action: 'PORTAL_LEGAL_ACCEPTED',
    version: PORTAL_LEGAL_VERSION,
  })

  return { success: true }
}

/** Estado de onboarding para layout/middleware vía sesión server. */
export async function getPortalOnboardingStatusForSessionUser(): Promise<{
  required: boolean
  portalBlocked: boolean
}> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.role !== UserRole.COMPANY_CLIENT) {
    return { required: false, portalBlocked: true }
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      mustChangePassword: true,
      portalLegalAcceptedAt: true,
      portalLegalVersion: true,
      isActive: true,
      companyId: true,
    },
  })
  if (!user?.isActive || !user.companyId) {
    return { required: false, portalBlocked: true }
  }

  const company = await prisma.company.findUnique({
    where: { id: user.companyId },
    select: { portalEnabled: true, estado: true },
  })
  if (!company?.portalEnabled || company.estado !== 'HABILITADO') {
    return { required: false, portalBlocked: true }
  }

  return {
    required: portalOnboardingRequired(user),
    portalBlocked: false,
  }
}
