/**
 * @file Server Actions: Empresas (Ficha Cliente v2)
 * @id IMPL-20260623-02
 * @backup context/SPECs/SPEC_ARCH-20260623-03-CLIENTE-V2-VENDEDOR-HISTORIAL-LINK-PUBLICO.md
 *
 * Esta capa añade:
 *   - Validación de sesión NextAuth (excepto submitCompanySelfRegistration
 *     y validateCompanySelfRegToken, que son públicas).
 *   - Validación de rol (ADMIN/VENDEDOR donde aplique).
 *   - revalidatePath() tras mutaciones.
 *   - Propagación de errores con códigos estables.
 */
'use server'

import { revalidatePath } from 'next/cache'
import * as CompanyService from '@/services/company.service'
import { Prisma } from '@prisma/client'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/auth'
import { updateCompanyAllowedBranches as _updateCompanyAllowedBranches } from './admin.actions'
import type { CompanyStatus, CompanyOrigin } from '@prisma/client'

// --------------------------------------------------------------------------
// Read-only: APIs existentes (compatibilidad)
// --------------------------------------------------------------------------

export const getCompanies = async () => {
    return await CompanyService.getCompanies()
}

export const getCompanyById = async (id: string) => {
    return await CompanyService.getCompanyById(id)
}

export const createCompany = async (data: Prisma.CompanyCreateInput) => {
    const company = await CompanyService.createCompany(data)
    revalidatePath('/companies')
    return company
}

export const updateCompany = async (id: string, data: Prisma.CompanyUpdateInput) => {
    const company = await CompanyService.updateCompany(id, data)
    revalidatePath('/companies')
    return company
}

export const updateCompanyAllowedBranches = _updateCompanyAllowedBranches

// --------------------------------------------------------------------------
// Ficha v2: listados con filtros
// --------------------------------------------------------------------------

export async function listCompaniesWithFilters(
  filters: { estado?: CompanyStatus; origen?: CompanyOrigin; sellerId?: string; search?: string } = {}
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return []
  return CompanyService.listCompaniesWithFilters(filters)
}

export async function getCompanySellerHistoryAction(companyId: string) {
  const session = await getServerSession(authOptions)
  if (!session?.user) throw new Error('UNAUTHENTICATED')
  return CompanyService.getCompanySellerHistory(companyId)
}

export async function listActiveSellersAction() {
  const session = await getServerSession(authOptions)
  if (!session?.user) throw new Error('UNAUTHENTICATED')
  return CompanyService.listActiveSellers()
}

// --------------------------------------------------------------------------
// Ficha v2: cambio de vendedor (transaccional, genera historial)
// --------------------------------------------------------------------------

export async function changeCompanySellerAction(args: {
  companyId: string
  newSellerId: string | null
  reason?: string
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return { ok: false as const, code: 'UNAUTHENTICATED' as const, error: 'Sin sesión' }
  const role = (session.user as { role?: string }).role
  if (role !== 'ADMIN' && role !== 'VENDEDOR') {
    return { ok: false as const, code: 'FORBIDDEN' as const, error: 'Rol insuficiente' }
  }
  const result = await CompanyService.changeCompanySeller({
    companyId: args.companyId,
    newSellerId: args.newSellerId,
    changedByUserId: (session.user as { id: string }).id,
    reason: args.reason,
  })
  if (result.ok) {
    revalidatePath('/companies')
    revalidatePath(`/companies/${args.companyId}`)
  }
  return result
}

// --------------------------------------------------------------------------
// Ficha v2: link público de auto-alta
// --------------------------------------------------------------------------

/** Crea un link de auto-alta. Solo ADMIN o VENDEDOR. */
export async function generateCompanySelfRegLinkAction(ttlHours = 168) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return { ok: false as const, code: 'UNAUTHENTICATED' as const, error: 'Sin sesión' }
  const role = (session.user as { role?: string }).role
  if (role !== 'ADMIN' && role !== 'VENDEDOR') {
    return { ok: false as const, code: 'FORBIDDEN' as const, error: 'Rol insuficiente' }
  }
  const result = await CompanyService.generateCompanySelfRegLink(
    (session.user as { id: string }).id,
    ttlHours
  )
  return { ok: true as const, ...result }
}

/** Valida un token (público). Incrementa openedCount. */
export async function validateCompanySelfRegTokenAction(token: string) {
  // Público por diseño: no validamos sesión.
  return CompanyService.validateCompanySelfRegToken(token)
}

/** Registra metadata de archivo subido (público, valida token). */
export async function registerSelfRegFileAction(
  token: string,
  metadata: { key: string; filename: string; size: number; mime: string; section: string }
) {
  // Público: la verificación del token ocurre en el service.
  return CompanyService.registerSelfRegFile(token, metadata)
}

/** Envía el formulario completo de auto-alta (público). */
export async function submitCompanySelfRegistrationAction(
  token: string,
  payload: unknown
) {
  // Público: cualquier prospecto con token vigente puede enviar.
  const result = await CompanyService.submitCompanySelfRegistration(token, payload)
  return result
}

// --------------------------------------------------------------------------
// Ficha v2: revisión y habilitación (vendedor/admin)
// --------------------------------------------------------------------------

export async function reviewAndEnableCompanyAction(args: {
  companyId: string
  sellerId: string
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return { ok: false as const, code: 'UNAUTHENTICATED' as const, error: 'Sin sesión' }
  const role = (session.user as { role?: string }).role
  if (role !== 'ADMIN' && role !== 'VENDEDOR') {
    return { ok: false as const, code: 'FORBIDDEN' as const, error: 'Rol insuficiente' }
  }
  const result = await CompanyService.reviewAndEnableCompany({
    companyId: args.companyId,
    sellerId: args.sellerId,
    reviewerUserId: (session.user as { id: string }).id,
  })
  if (result.ok) {
    revalidatePath('/companies')
    revalidatePath(`/companies/${args.companyId}`)
  }
  return result
}

// --------------------------------------------------------------------------
// Ficha v2: toggle habilitado (solo ADMIN)
// --------------------------------------------------------------------------

export async function toggleCompanyEnabledAction(args: { companyId: string; enabled: boolean }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return { ok: false as const, code: 'UNAUTHENTICATED' as const, error: 'Sin sesión' }
  const role = (session.user as { role?: string }).role
  if (role !== 'ADMIN') {
    return { ok: false as const, code: 'FORBIDDEN' as const, error: 'Solo administradores pueden cambiar habilitado' }
  }
  const result = await CompanyService.toggleCompanyEnabled({
    companyId: args.companyId,
    enabledByUserId: (session.user as { id: string }).id,
    enabled: args.enabled,
  })
  if (result.ok) {
    revalidatePath('/companies')
    revalidatePath(`/companies/${args.companyId}`)
  }
  return result
}
