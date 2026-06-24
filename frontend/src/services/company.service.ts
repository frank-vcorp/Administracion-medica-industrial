/**
 * @file Service: Empresas (Ficha Cliente v2)
 * @id IMPL-20260623-02
 * @backup context/SPECs/SPEC_ARCH-20260623-03-CLIENTE-V2-VENDEDOR-HISTORIAL-LINK-PUBLICO.md
 *
 * Capa de negocio: transacciones Prisma, hashing de tokens, validaciones
 * que requieren DB. Esta capa NO usa NextAuth ni cookies; la autenticación
 * se valida en src/actions/company.actions.ts antes de delegar aquí.
 *
 * IMPL-20260624-01: Refactor para soportar dos paths de auto-alta:
 *   - submitCompanySelfRegistration(token, payload) → ruta con token (/auto-alta/[token])
 *   - submitPublicCompanySelfRegistration(payload)  → ruta pública sin token (/solicitar-alta)
 * Ambos delegan a submitCompanySelfRegistrationCore(source, payload, token?) que
 * crea Company con origen=AUTO_ALTA, estado=PENDIENTE_REVISION y registra la
 * CompanySelfRegistration con el canal apropiado (VENDOR_LINK | PUBLIC_DIRECT).
 */
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { headers } from 'next/headers'
import prisma from '@/lib/prisma'
import { Prisma, CompanyStatus, CompanyOrigin, CompanySelfRegStatus } from '@prisma/client'
import {
  CompanyFullFormPayloadSchema,
  type CompanyFullFormPayload,
  assertRfcNotRegistered,
  assertUserIsActive,
} from '@/lib/schemas/company-full-form'
import { getPublicBaseUrl } from '@/lib/env/public-base-url'

// --------------------------------------------------------------------------
// Compatibilidad: CRUD básico reusado por src/actions/company.actions.ts
// (shims sobre admin.actions / prisma para que `import * as CompanyService`
//  exponga los símbolos esperados por los wrappers de compatibilidad).
// --------------------------------------------------------------------------

/** Lista empresas con sucursal predeterminada y sucursales permitidas. */
export async function getCompanies() {
  return prisma.company.findMany({
    include: {
      defaultBranch: true,
      allowedBranches: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
}

/** Obtiene una empresa por id, incluyendo sucursal default y permitidas. */
export async function getCompanyById(id: string) {
  return prisma.company.findUnique({
    where: { id },
    include: {
      defaultBranch: true,
      allowedBranches: { select: { id: true, name: true } },
    },
  })
}

/** Crea una empresa vía Prisma con input tipado. */
export async function createCompany(data: Prisma.CompanyCreateInput) {
  return prisma.company.create({ data })
}

/** Actualiza una empresa por id con input tipado. */
export async function updateCompany(id: string, data: Prisma.CompanyUpdateInput) {
  return prisma.company.update({ where: { id }, data })
}

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

/** Genera un token plano aleatorio de 32 bytes (256 bits) y devuelve SHA-256 hex. */
export function generateSelfRegToken(): { plain: string; hash: string } {
  const plain = randomBytes(32).toString('base64url')
  const hash = createHash('sha256').update(plain).digest('hex')
  return { plain, hash }
}

/** Hashea un token plano con SHA-256. */
export function hashToken(plain: string): string {
  return createHash('sha256').update(plain).digest('hex')
}

/** Valida un token, marca como consumido (incrementa openedCount) si está vigente. */
export async function validateCompanySelfRegToken(plainToken: string) {
  if (!plainToken || typeof plainToken !== 'string') {
    return { ok: false as const, reason: 'INVALID_TOKEN' as const }
  }
  const tokenHash = hashToken(plainToken)
  const reg = await prisma.companySelfRegistration.findUnique({ where: { tokenHash } })
  if (!reg) return { ok: false as const, reason: 'NOT_FOUND' as const }

  if (reg.status === CompanySelfRegStatus.SUBMITTED) {
    return { ok: false as const, reason: 'ALREADY_SUBMITTED' as const, submittedCompanyId: reg.submittedCompanyId }
  }
  if (reg.status === CompanySelfRegStatus.CANCELLED) {
    return { ok: false as const, reason: 'CANCELLED' as const }
  }
  if (reg.status === CompanySelfRegStatus.EXPIRED || reg.expiresAt.getTime() < Date.now()) {
    // Marcar como expirado si aún figura ACTIVE
    if (reg.status === CompanySelfRegStatus.ACTIVE) {
      await prisma.companySelfRegistration.update({
        where: { id: reg.id },
        data: { status: CompanySelfRegStatus.EXPIRED },
      })
    }
    return { ok: false as const, reason: 'EXPIRED' as const, expiresAt: reg.expiresAt }
  }

  // ACTIVE → incrementar openedCount atómicamente
  await prisma.companySelfRegistration.update({
    where: { id: reg.id },
    data: { openedCount: { increment: 1 } },
  })

  return {
    ok: true as const,
    status: reg.status,
    expiresAt: reg.expiresAt,
    openedCount: reg.openedCount + 1,
    uploadedFiles: reg.uploadedFiles,
  }
}

/** Crea un nuevo link de auto-alta. */
export async function generateCompanySelfRegLink(
  createdByUserId?: string | null,
  ttlHours = 168
): Promise<{
  id: string
  token: string
  url: string
  expiresAt: Date
}> {
  const { plain, hash } = generateSelfRegToken()
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000)
  const created = await prisma.companySelfRegistration.create({
    data: {
      tokenHash: hash,
      expiresAt,
      status: CompanySelfRegStatus.ACTIVE,
      createdByUserId: createdByUserId ?? null,
      uploadedFiles: [],
    },
  })
  const baseUrl = getPublicBaseUrl()
  const refSuffix = createdByUserId ? `?ref=${encodeURIComponent(createdByUserId)}` : ''
  const url = `${baseUrl}/auto-alta/${plain}${refSuffix}`
  return { id: created.id, token: plain, url, expiresAt }
}

/** Registra un archivo subido al bucket para un token vigente (solo metadata). */
export async function registerSelfRegFile(
  plainToken: string,
  metadata: { key: string; filename: string; size: number; mime: string; section: string }
) {
  const tokenHash = hashToken(plainToken)
  const reg = await prisma.companySelfRegistration.findUnique({ where: { tokenHash } })
  if (!reg) return { ok: false as const, reason: 'TOKEN_NOT_FOUND' as const }
  if (reg.status !== CompanySelfRegStatus.ACTIVE) return { ok: false as const, reason: 'TOKEN_INACTIVE' as const }
  if (reg.expiresAt.getTime() < Date.now()) return { ok: false as const, reason: 'TOKEN_EXPIRED' as const }

  const current = Array.isArray(reg.uploadedFiles) ? (reg.uploadedFiles as Prisma.JsonArray) : []
  const next = [
    ...current,
    {
      key: metadata.key,
      filename: metadata.filename,
      size: metadata.size,
      mime: metadata.mime,
      section: metadata.section,
      uploadedAt: new Date().toISOString(),
    },
  ]
  await prisma.companySelfRegistration.update({
    where: { id: reg.id },
    data: { uploadedFiles: next as unknown as Prisma.InputJsonValue },
  })
  return { ok: true as const, key: metadata.key, fileUrl: `/api/files/${metadata.key}` }
}

/**
 * IMPL-20260624-01: Helper server-side para obtener la IP del cliente
 * a partir de headers estándar de proxy. Solo se usa dentro de server actions.
 * Retorna null si no hay headers confiables (cliente directo sin proxy).
 */
export async function getClientIp(): Promise<string | null> {
  try {
    const h = await headers()
    return (
      h.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      h.get('x-real-ip') ??
      null
    )
  } catch {
    // headers() lanza si se llama fuera de un request context (tests, etc.)
    return null
  }
}

/**
 * IMPL-20260624-01: Genera un identificador aleatorio de 8 caracteres
 * base64url-safe para scopes de storage público.
 */
export function random8(): string {
  return randomBytes(6).toString('base64url').slice(0, 8)
}

/**
 * IMPL-20260624-01: Núcleo compartido de auto-alta. Soporta dos paths:
 *   - source='TOKEN'   → requiere token vigente (link de vendedor)
 *   - source='PUBLIC'  → sin token (ruta pública /solicitar-alta)
 *
 * En ambos casos crea Company con origen=AUTO_ALTA, estado=PENDIENTE_REVISION.
 * La diferencia es cómo se trackea CompanySelfRegistration y el storage scope.
 *
 * @param source 'TOKEN' (requiere token) o 'PUBLIC' (sin token).
 * @param payload Payload validado por CompanyFullFormPayloadSchema.
 * @param token Requerido solo si source='TOKEN'. Token plano original.
 */
export async function submitCompanySelfRegistrationCore(
  source: 'TOKEN' | 'PUBLIC',
  payload: CompanyFullFormPayload,
  token?: string
): Promise<
  | { ok: true; companyId: string }
  | { ok: false; code: 'INVALID_TOKEN' | 'TOKEN_EXPIRED' | 'ALREADY_SUBMITTED' | 'INVALID_PAYLOAD' | 'RFC_DUPLICATE'; error: string; existingCompanyId?: string }
> {
  let regId: string | null = null

  // -- 1. Resolución de CompanySelfRegistration según source ---------------
  if (source === 'TOKEN') {
    if (!token) {
      return { ok: false, code: 'INVALID_TOKEN', error: 'Token requerido para source=TOKEN' }
    }
    const tokenCheck = await validateCompanySelfRegToken(token)
    if (!tokenCheck.ok) {
      if (tokenCheck.reason === 'EXPIRED') return { ok: false, code: 'TOKEN_EXPIRED', error: 'Token expirado' }
      if (tokenCheck.reason === 'ALREADY_SUBMITTED') {
        return {
          ok: false,
          code: 'ALREADY_SUBMITTED',
          error: 'Este enlace ya fue utilizado',
          existingCompanyId: tokenCheck.submittedCompanyId ?? undefined,
        }
      }
      if (tokenCheck.reason === 'CANCELLED') return { ok: false, code: 'INVALID_TOKEN', error: 'Token cancelado' }
      return { ok: false, code: 'INVALID_TOKEN', error: 'Token inválido' }
    }
    const tokenHash = hashToken(token)
    const existing = await prisma.companySelfRegistration.findUnique({ where: { tokenHash } })
    if (!existing) return { ok: false, code: 'INVALID_TOKEN', error: 'Token no encontrado' }
    regId = existing.id
  }
  // source === 'PUBLIC' → no se valida ni se busca token; regId queda null.
  // Se creará un nuevo CompanySelfRegistration en la transacción con channel=PUBLIC_DIRECT.

  // -- 2. Transacción: crear Company + crear/actualizar CompanySelfRegistration ----
  try {
    const companyId = await prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          name: payload.fiscal.razonSocial,
          rfc: payload.fiscal.rfc,
          address: [
            payload.fiscal.domicilio,
            payload.fiscal.colonia,
            payload.fiscal.municipio,
            payload.fiscal.estado,
            payload.fiscal.cp,
            payload.fiscal.pais,
          ]
            .filter(Boolean)
            .join(', '),
          contactName: [payload.repLegal.nombre, payload.repLegal.apellidos].filter(Boolean).join(' '),
          email: payload.repLegal.email,
          phone: payload.repLegal.telefono,
          origen: CompanyOrigin.AUTO_ALTA,
          estado: CompanyStatus.PENDIENTE_REVISION,
          fiscalData: payload.fiscal as unknown as Prisma.InputJsonValue,
          repLegalData: payload.repLegal as unknown as Prisma.InputJsonValue,
          rhData: payload.rh as unknown as Prisma.InputJsonValue,
          cuentasPagarData: payload.cuentasPagar as unknown as Prisma.InputJsonValue,
          referenciasData: payload.referencias as unknown as Prisma.InputJsonValue,
          terminosAceptados: payload.terminosAceptados === true,
          documentosAdjuntos: payload.documentos as unknown as Prisma.InputJsonValue,
        },
      })

      if (source === 'TOKEN' && regId) {
        // Path con token: actualizar CompanySelfRegistration existente a SUBMITTED.
        await tx.companySelfRegistration.update({
          where: { id: regId },
          data: {
            status: CompanySelfRegStatus.SUBMITTED,
            submittedAt: new Date(),
            submittedCompanyId: company.id,
            // channel: VENDOR_LINK es el default de Prisma; no lo tocamos.
          },
        })
      } else {
        // Path público: crear CompanySelfRegistration nuevo con channel=PUBLIC_DIRECT.
        // expiresAt es informativo (placeholder 168h); un registro público no tiene expiración real.
        await tx.companySelfRegistration.create({
          data: {
            tokenHash: `public-${randomUUID()}`,
            channel: 'PUBLIC_DIRECT',
            status: CompanySelfRegStatus.SUBMITTED,
            expiresAt: new Date(Date.now() + 168 * 60 * 60 * 1000),
            submittedAt: new Date(),
            submittedCompanyId: company.id,
            createdByUserId: null,
            uploadedFiles: [],
          },
        })
      }

      return company.id
    })

    // -- 3. AuditLog para submits públicos (fuera de la txn para no bloquear) ----
    if (source === 'PUBLIC') {
      const ip = await getClientIp()
      await prisma.auditLog.create({
        data: {
          userId: null,
          action: 'COMPANY_PUBLIC_SELF_REG_SUBMITTED',
          entity: 'Company',
          entityId: companyId,
          ipAddress: ip,
          details: {
            source: 'PUBLIC',
            companyName: payload.fiscal.razonSocial,
            rfc: payload.fiscal.rfc,
          } as Prisma.InputJsonValue,
        },
      })
    }

    return { ok: true, companyId }
  } catch (e) {
    // Si la transacción falló por UNIQUE en RFC (carrera), mapear
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return { ok: false, code: 'RFC_DUPLICATE', error: 'RFC ya registrado' }
    }
    throw e
  }
}

/** Wrapper público (ruta con token): valida token y delega al core. */
export async function submitCompanySelfRegistration(
  plainToken: string,
  rawPayload: unknown
): Promise<
  | { ok: true; companyId: string }
  | { ok: false; code: 'INVALID_TOKEN' | 'TOKEN_EXPIRED' | 'ALREADY_SUBMITTED' | 'INVALID_PAYLOAD' | 'RFC_DUPLICATE'; error: string; existingCompanyId?: string }
> {
  // Validar payload con Zod
  const parsed = CompanyFullFormPayloadSchema.safeParse(rawPayload)
  if (!parsed.success) {
    return {
      ok: false,
      code: 'INVALID_PAYLOAD',
      error: parsed.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join('; '),
    }
  }
  const payload: CompanyFullFormPayload = { ...parsed.data, channel: 'VENDOR_LINK' }

  // Validar RFC duplicado ANTES de la transacción (mensaje más claro)
  const dup = await assertRfcNotRegistered(
    payload.fiscal.rfc,
    (args) => prisma.company.findFirst(args) as Promise<{ id: string } | null>
  )
  if (dup.duplicate) {
    return {
      ok: false,
      code: 'RFC_DUPLICATE',
      error: 'RFC ya registrado',
      existingCompanyId: dup.existingCompanyId,
    }
  }

  return submitCompanySelfRegistrationCore('TOKEN', payload, plainToken)
}

/** Wrapper público (ruta sin token /solicitar-alta): sin validación de token. */
export async function submitPublicCompanySelfRegistration(
  rawPayload: unknown
): Promise<
  | { ok: true; companyId: string }
  | { ok: false; code: 'INVALID_TOKEN' | 'ALREADY_SUBMITTED' | 'TOKEN_EXPIRED' | 'INVALID_PAYLOAD' | 'RFC_DUPLICATE'; error: string; existingCompanyId?: string }
> {
  // Validar payload con Zod
  const parsed = CompanyFullFormPayloadSchema.safeParse(rawPayload)
  if (!parsed.success) {
    return {
      ok: false,
      code: 'INVALID_PAYLOAD',
      error: parsed.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join('; '),
    }
  }
  const payload: CompanyFullFormPayload = { ...parsed.data, channel: 'PUBLIC_DIRECT' }

  // Validar RFC duplicado ANTES de la transacción
  const dup = await assertRfcNotRegistered(
    payload.fiscal.rfc,
    (args) => prisma.company.findFirst(args) as Promise<{ id: string } | null>
  )
  if (dup.duplicate) {
    return {
      ok: false,
      code: 'RFC_DUPLICATE',
      error: 'RFC ya registrado',
      existingCompanyId: dup.existingCompanyId,
    }
  }

  return submitCompanySelfRegistrationCore('PUBLIC', payload)
}

/** Cambia el vendedor asignado de una Company. Transaccional. */
export async function changeCompanySeller(args: {
  companyId: string
  newSellerId: string | null
  changedByUserId: string
  reason?: string
}): Promise<
  | { ok: true; companyId: string }
  | { ok: false; code: 'COMPANY_NOT_FOUND' | 'SELLER_NOT_FOUND' | 'SELLER_INACTIVE' | 'NOT_AUTHORIZED'; error: string }
> {
  const company = await prisma.company.findUnique({ where: { id: args.companyId } })
  if (!company) return { ok: false, code: 'COMPANY_NOT_FOUND', error: 'Empresa no encontrada' }

  if (args.newSellerId) {
    const sellerCheck = await assertUserIsActive(
      args.newSellerId,
      (a) => prisma.user.findUnique({ where: a.where, select: { isActive: true, role: true } }) as Promise<{ isActive: boolean; role: string } | null>
    )
    if (!sellerCheck.ok) {
      if (sellerCheck.reason === 'NOT_FOUND') return { ok: false, code: 'SELLER_NOT_FOUND', error: 'Vendedor no encontrado' }
      if (sellerCheck.reason === 'INACTIVE') return { ok: false, code: 'SELLER_INACTIVE', error: 'Vendedor inactivo no puede ser asignado' }
      if (sellerCheck.reason === 'NOT_SELLER') return { ok: false, code: 'NOT_AUTHORIZED', error: 'El usuario no tiene rol de vendedor' }
    }
  }

  await prisma.$transaction([
    prisma.company.update({
      where: { id: args.companyId },
      data: {
        sellerId: args.newSellerId,
        sellerAssignedAt: args.newSellerId ? new Date() : null,
      },
    }),
    prisma.companySellerHistory.create({
      data: {
        companyId: args.companyId,
        previousSellerId: company.sellerId,
        newSellerId: args.newSellerId,
        changedByUserId: args.changedByUserId,
        reason: args.reason ?? null,
      },
    }),
  ])

  return { ok: true, companyId: args.companyId }
}

/** Revisa y habilita una Company creada por auto-alta. */
export async function reviewAndEnableCompany(args: {
  companyId: string
  reviewerUserId: string
  sellerId: string
}): Promise<
  | { ok: true; companyId: string }
  | { ok: false; code: 'COMPANY_NOT_FOUND' | 'SELLER_INACTIVE' | 'NOT_PENDIENTE'; error: string }
> {
  const company = await prisma.company.findUnique({ where: { id: args.companyId } })
  if (!company) return { ok: false, code: 'COMPANY_NOT_FOUND', error: 'Empresa no encontrada' }
  if (company.estado !== CompanyStatus.PENDIENTE_REVISION) {
    return { ok: false, code: 'NOT_PENDIENTE', error: 'La empresa no está en PENDIENTE_REVISION' }
  }

  const sellerCheck = await assertUserIsActive(
    args.sellerId,
    (a) => prisma.user.findUnique({ where: a.where, select: { isActive: true, role: true } }) as Promise<{ isActive: boolean; role: string } | null>
  )
  if (!sellerCheck.ok) {
    return { ok: false, code: 'SELLER_INACTIVE', error: 'Vendedor inválido o inactivo' }
  }

  const now = new Date()
  await prisma.$transaction([
    prisma.company.update({
      where: { id: args.companyId },
      data: {
        estado: CompanyStatus.HABILITADO,
        enabledAt: now,
        enabledByUserId: args.reviewerUserId,
        sellerId: args.sellerId,
        sellerAssignedAt: now,
      },
    }),
    prisma.companySellerHistory.create({
      data: {
        companyId: args.companyId,
        previousSellerId: null,
        newSellerId: args.sellerId,
        changedByUserId: args.reviewerUserId,
        reason: 'Habilitación inicial desde auto-alta',
      },
    }),
  ])

  return { ok: true, companyId: args.companyId }
}

/** Activa o desactiva una Company (solo admin). */
export async function toggleCompanyEnabled(args: {
  companyId: string
  enabledByUserId: string
  enabled: boolean
}): Promise<
  | { ok: true; companyId: string; estado: CompanyStatus }
  | { ok: false; code: 'COMPANY_NOT_FOUND'; error: string }
> {
  const company = await prisma.company.findUnique({ where: { id: args.companyId } })
  if (!company) return { ok: false, code: 'COMPANY_NOT_FOUND', error: 'Empresa no encontrada' }

  const newEstado = args.enabled ? CompanyStatus.HABILITADO : CompanyStatus.DESHABILITADO
  await prisma.$transaction([
    prisma.company.update({
      where: { id: args.companyId },
      data: {
        estado: newEstado,
        enabledAt: args.enabled ? new Date() : company.enabledAt,
        enabledByUserId: args.enabled ? args.enabledByUserId : company.enabledByUserId,
      },
    }),
    prisma.auditLog.create({
      data: {
        userId: args.enabledByUserId,
        action: args.enabled ? 'COMPANY_ENABLED' : 'COMPANY_DISABLED',
        entity: 'Company',
        entityId: args.companyId,
        details: { previousEstado: company.estado, newEstado } as Prisma.InputJsonValue,
      },
    }),
  ])

  return { ok: true, companyId: args.companyId, estado: newEstado }
}

// --------------------------------------------------------------------------
// Listado de empresas con filtros (Ficha v2)
// --------------------------------------------------------------------------

export interface ListCompaniesFilters {
  estado?: CompanyStatus
  origen?: CompanyOrigin
  sellerId?: string
  search?: string
}

export async function listCompaniesWithFilters(filters: ListCompaniesFilters = {}) {
  const where: Prisma.CompanyWhereInput = {}
  if (filters.estado) where.estado = filters.estado
  if (filters.origen) where.origen = filters.origen
  if (filters.sellerId) where.sellerId = filters.sellerId
  if (filters.search) {
    const s = filters.search.trim()
    if (s.length > 0) {
      where.OR = [
        { name: { contains: s, mode: 'insensitive' } },
        { rfc: { contains: s, mode: 'insensitive' } },
      ]
    }
  }
  return prisma.company.findMany({
    where,
    include: {
      seller: { select: { id: true, fullName: true, email: true } },
      defaultBranch: { select: { id: true, name: true } },
    },
    orderBy: { updatedAt: 'desc' },
  })
}

/** Historial append-only de vendedores de una Company. */
export async function getCompanySellerHistory(companyId: string) {
  return prisma.companySellerHistory.findMany({
    where: { companyId },
    include: {
      previousSeller: { select: { id: true, fullName: true, email: true } },
      newSeller: { select: { id: true, fullName: true, email: true } },
      changedBy: { select: { id: true, fullName: true, email: true } },
    },
    orderBy: { changedAt: 'desc' },
  })
}

/** Lista de usuarios vendedores activos (para dropdowns). */
export async function listActiveSellers() {
  return prisma.user.findMany({
    where: {
      role: 'VENDEDOR',
      isActive: true,
    },
    select: { id: true, fullName: true, email: true },
    orderBy: { fullName: 'asc' },
  })
}

/** Catálogo de estados de México (cacheable). */
export async function listEstadosMexico() {
  return prisma.estadoMexico.findMany({ orderBy: { nombre: 'asc' } })
}

// --------------------------------------------------------------------------
// Validación previa: cliente habilitado para citas/proyectos
// --------------------------------------------------------------------------

/** Verifica si una Company está habilitada para operaciones (citas/proyectos). */
export async function isCompanyOperativa(companyId: string): Promise<boolean> {
  const c = await prisma.company.findUnique({
    where: { id: companyId },
    select: { estado: true },
  })
  return c?.estado === CompanyStatus.HABILITADO
}

/**
 * IMPL-20260624-01: Obtiene el canal de origen de auto-alta de una Company.
 * Retorna:
 *   - 'VENDOR_LINK'   → si la última CompanySelfRegistration es de link de vendedor
 *   - 'PUBLIC_DIRECT' → si la última CompanySelfRegistration es pública directa
 *   - null            → si la Company es MANUAL o no tiene selfRegistrations
 *
 * Se usa en la ficha del cliente para discriminar el sub-canal dentro de AUTO_ALTA.
 */
export async function getCompanyOriginChannel(
  companyId: string
): Promise<'VENDOR_LINK' | 'PUBLIC_DIRECT' | null> {
  const latest = await prisma.companySelfRegistration.findFirst({
    where: { submittedCompanyId: companyId },
    orderBy: { submittedAt: 'desc' },
    select: { channel: true },
  })
  if (!latest) return null
  if (latest.channel === 'PUBLIC_DIRECT') return 'PUBLIC_DIRECT'
  // Default retrocompatible: cualquier valor no-PUBLIC_DIRECT se trata como VENDOR_LINK.
  return 'VENDOR_LINK'
}
