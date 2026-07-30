/**
 * @file Server Actions: Empresas (Ficha Cliente v2)
 * @id IMPL-20260623-02 / IMPL-20260624-03
 * @backup context/SPECs/SPEC_ARCH-20260623-03-CLIENTE-V2-VENDEDOR-HISTORIAL-LINK-PUBLICO.md
 * @backup context/SPECs/SPEC_ARCH-20260624-03-EDICION-DATOS-COMPLETOS-EMPRESA.md
 *
 * Esta capa añade:
 *   - Validación de sesión NextAuth (excepto submitCompanySelfRegistration
 *     y validateCompanySelfRegToken, que son públicas).
 *   - Validación de rol (ADMIN/VENDEDOR donde aplique).
 *   - revalidatePath() tras mutaciones.
 *   - Propagación de errores con códigos estables.
 *
 * IMPL-20260624-03 (ARCH-20260624-03): Nuevas actions:
 *   - generateCompanyDataCompletionLinkAction(companyId) — ADMIN/VENDEDOR
 *     → genera link externo para que la empresa complete sus datos.
 *   - updateCompanyAction(companyId, data) — solo ADMIN
 *     → edición interna con optimistic locking + AuditLog.
 */
'use server'

import { revalidatePath } from 'next/cache'
import * as CompanyService from '@/services/company.service'
import { Prisma } from '@prisma/client'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/auth'
import { updateCompanyAllowedBranches as _updateCompanyAllowedBranches } from './admin.actions'
import type { CompanyStatus, CompanyOrigin } from '@prisma/client'
import { updateCompanySchema } from '@/lib/schemas/company-update'

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

/** Envía el formulario completo de auto-alta (público, requiere token). */
export async function submitCompanySelfRegistrationAction(
  token: string,
  payload: unknown
) {
  // Público: cualquier prospecto con token vigente puede enviar.
  const result = await CompanyService.submitCompanySelfRegistration(token, payload)
  return result
}

/**
 * IMPL-20260624-01: Server action pública para submit desde /solicitar-alta.
 * NO valida sesión (la ruta es 100% pública, sin token, sin auth).
 * Crea Company con origen=AUTO_ALTA, estado=PENDIENTE_REVISION y
 * CompanySelfRegistration con channel='PUBLIC_DIRECT'.
 */
export async function submitPublicCompanySelfRegistrationAction(
  payload: unknown
) {
  // Público: sin auth check, sin token.
  const result = await CompanyService.submitPublicCompanySelfRegistration(payload)
  if (result.ok) {
    revalidatePath('/companies')
  }
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

// --------------------------------------------------------------------------
// ARCH-20260730-01 (IMPL-20260730-01 retry): Eliminación masiva de empresas.
// Solo SUPERADMIN. Hard delete transaccional con cascade soft sobre historia
// clínica (workers/appointments/projects quedan con companyId=NULL).
// Ref: context/SPECs/SPEC_ARCH-20260730-01-DELETE-COMPANIES-SUPERADMIN.md
// --------------------------------------------------------------------------

/**
 * Elimina (hard delete) un conjunto de empresas. RBAC: SOLO SUPERADMIN.
 *
 * Validaciones:
 *   - Sesión activa (UNAUTHENTICATED si falta).
 *   - Rol === 'SUPERADMIN' (FORBIDDEN en cualquier otro caso).
 *   - companyIds: array no vacío (mín 1).
 *   - companyIds.length <= 100.
 *
 * En éxito: `revalidatePath('/companies')` y retorna `{ ok: true, deletedCount, deletedCompanyIds }`.
 * En error: retorna `{ ok: false, code, error }` con códigos estables.
 */
export async function deleteCompaniesAction(args: {
  companyIds: string[]
  reason?: string
}): Promise<
  | { ok: true; deletedCount: number; deletedCompanyIds: string[] }
  | {
      ok: false
      code: 'UNAUTHENTICATED' | 'FORBIDDEN' | 'INVALID_INPUT' | 'NOT_FOUND' | 'INTERNAL_ERROR'
      error: string
    }
> {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return { ok: false, code: 'UNAUTHENTICATED', error: 'Sin sesión' }
  }
  const role = (session.user as { role?: string }).role
  if (role !== 'SUPERADMIN') {
    return {
      ok: false,
      code: 'FORBIDDEN',
      error: 'Se requiere rol SUPERADMIN para eliminar empresas',
    }
  }

  if (!Array.isArray(args.companyIds) || args.companyIds.length === 0) {
    return { ok: false, code: 'INVALID_INPUT', error: 'companyIds requerido (array no vacío)' }
  }
  if (args.companyIds.length > 100) {
    return { ok: false, code: 'INVALID_INPUT', error: 'Máximo 100 empresas por operación' }
  }

  const result = await CompanyService.deleteCompanies({
    companyIds: args.companyIds,
    actorUserId: (session.user as { id: string }).id,
    reason: args.reason,
  })

  if (result.ok) {
    revalidatePath('/companies')
  }
  return result
}
// datos de empresa existente.
// --------------------------------------------------------------------------

/**
 * Genera un link público (channel='COMPANY_UPDATE') que la empresa puede abrir
 * para completar/actualizar sus datos completos. El submit a través de ese
 * link hace UPDATE (no CREATE) sobre la Company indicada.
 *
 * RBAC: ADMIN o VENDEDOR.
 * Estado requerido: la Company NO debe estar en PENDIENTE_REVISION.
 *
 * @param companyId id de la Company a la que el link estará asociado.
 * @param ttlHours horas de vigencia del link (default 168h = 7 días).
 */
export async function generateCompanyDataCompletionLinkAction(
  companyId: string,
  ttlHours = 168
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return { ok: false as const, code: 'UNAUTHENTICATED' as const, error: 'Sin sesión' }
  const role = (session.user as { role?: string }).role
  if (role !== 'ADMIN' && role !== 'VENDEDOR') {
    return {
      ok: false as const,
      code: 'FORBIDDEN' as const,
      error: 'Solo ADMIN o VENDEDOR pueden generar links de completar datos',
    }
  }
  if (!companyId || typeof companyId !== 'string') {
    return { ok: false as const, code: 'INVALID_PAYLOAD' as const, error: 'companyId requerido' }
  }
  try {
    const result = await CompanyService.generateCompanySelfRegLink(
      (session.user as { id: string }).id,
      { ttlHours, targetCompanyId: companyId }
    )
    return { ok: true as const, ...result }
  } catch (e) {
    const err = e as Error
    if (err.message === 'TARGET_COMPANY_NOT_FOUND') {
      return { ok: false as const, code: 'NOT_FOUND' as const, error: 'Empresa no encontrada' }
    }
    if (err.message === 'TARGET_COMPANY_PENDING') {
      return {
        ok: false as const,
        code: 'TARGET_COMPANY_PENDING' as const,
        error: 'Empresa con auto-alta en curso. Espere a que el prospecto complete el alta.',
      }
    }
    throw e
  }
}

// --------------------------------------------------------------------------
// IMPL-20260624-03 (ARCH-20260624-03) Sub-B: edición interna de Company.
// Solo ADMIN. Optimistic locking + AuditLog.
// --------------------------------------------------------------------------

/**
 * Edita datos completos de una Company existente. Solo ADMIN.
 *
 * Validaciones:
 *  - Sesión ADMIN (VENDEDOR/RECEPCIONIST/DOCTOR → FORBIDDEN).
 *  - Payload validado por updateCompanySchema (RFC, CP, expectedUpdatedAt).
 *  - Optimistic locking: data.expectedUpdatedAt debe coincidir con Company.updatedAt.
 *  - Si el RFC cambió, valida unicidad contra otras Company.
 *
 * Si todo OK, retorna `{ ok: true, company }` y revalida las rutas relevantes.
 * Si hay conflicto de concurrencia, retorna `{ ok: false, code: 'CONCURRENT_UPDATE' }`.
 */
export async function updateCompanyAction(
  companyId: string,
  data: unknown
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return { ok: false as const, code: 'UNAUTHENTICATED' as const, error: 'Sin sesión' }
  const role = (session.user as { role?: string }).role
  if (role !== 'ADMIN') {
    return {
      ok: false as const,
      code: 'FORBIDDEN' as const,
      error: 'Solo ADMIN puede editar datos completos de empresa',
    }
  }
  if (!companyId || typeof companyId !== 'string') {
    return { ok: false as const, code: 'INVALID_PAYLOAD' as const, error: 'companyId requerido' }
  }

  const parsed = updateCompanySchema.safeParse(data)
  if (!parsed.success) {
    return {
      ok: false as const,
      code: 'INVALID_PAYLOAD' as const,
      error: parsed.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join('; '),
    }
  }

  const ip = await CompanyService.getClientIp().catch(() => null)
  const result = await CompanyService.updateCompanyFull(companyId, parsed.data, {
    userId: (session.user as { id: string }).id,
    ipAddress: ip,
  })

  if (result.ok) {
    revalidatePath('/companies')
    revalidatePath(`/companies/${companyId}`)
    revalidatePath(`/companies/${companyId}/edit`)
  }
  return result
}
