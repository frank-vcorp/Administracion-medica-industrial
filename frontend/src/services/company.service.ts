/**
 * @file Service: Empresas (Ficha Cliente v2)
 * @id IMPL-20260623-02 / IMPL-20260624-03
 * @backup context/SPECs/SPEC_ARCH-20260623-03-CLIENTE-V2-VENDEDOR-HISTORIAL-LINK-PUBLICO.md
 * @backup context/SPECs/SPEC_ARCH-20260624-03-EDICION-DATOS-COMPLETOS-EMPRESA.md
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
 *
 * IMPL-20260624-03 (ARCH-20260624-03): Edición de datos completos de empresa.
 *   Sub-A — Link externo: generateCompanySelfRegLink acepta targetCompanyId.
 *     submitCompanySelfRegistrationCore detecta reg.targetCompanyId y hace UPDATE
 *     en lugar de CREATE, con optimistic locking (drift por updatedAt) y AuditLog
 *     con action='UPDATE_VIA_LINK'.
 *   Sub-B — Edición interna: nueva función updateCompany(companyId, data, context)
 *     con optimistic locking + AuditLog con action='UPDATE'.
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
import type { UpdateCompanyInput } from '@/lib/schemas/company-update'

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

/**
 * Valida un token, marca como consumido (incrementa openedCount) si está vigente.
 *
 * IMPL-20260624-03 (ARCH-20260624-03): Cuando el token apunta a un link de tipo
 * COMPANY_UPDATE (channel='COMPANY_UPDATE' + targetCompanyId), retorna además
 * `targetCompanyId` y `expectedUpdatedAt` (updatedAt de la Company target al
 * momento de abrir). Estos datos son la base del optimistic locking cuando
 * la empresa envía el formulario: si la Company cambió desde entonces, se
 * rechaza el submit con CONCURRENT_UPDATE.
 */
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

  // IMPL-20260624-03: Si el token apunta a una Company existente (COMPANY_UPDATE),
  // cargar su updatedAt para que el cliente pueda hacer optimistic locking al submit.
  let expectedUpdatedAt: string | undefined
  let targetCompanyId: string | null = null
  if (reg.channel === 'COMPANY_UPDATE' && reg.targetCompanyId) {
    targetCompanyId = reg.targetCompanyId
    const target = await prisma.company.findUnique({
      where: { id: reg.targetCompanyId },
      select: { updatedAt: true },
    })
    if (target) {
      expectedUpdatedAt = target.updatedAt.toISOString()
    }
  }

  return {
    ok: true as const,
    status: reg.status,
    expiresAt: reg.expiresAt,
    openedCount: reg.openedCount + 1,
    uploadedFiles: reg.uploadedFiles,
    channel: reg.channel,
    targetCompanyId,
    expectedUpdatedAt,
  }
}

/**
 * Crea un nuevo link de auto-alta.
 *
 * IMPL-20260624-03 (ARCH-20260624-03): nueva firma con segundo argumento
 * opcional. Si se pasa `options.targetCompanyId`, el link generado es de tipo
 * "completar datos de empresa existente": persiste `targetCompanyId`,
 * `channel='COMPANY_UPDATE'`, y al enviarse hará UPDATE (no CREATE).
 *
 * Validaciones cuando targetCompanyId está presente:
 *  - La Company debe existir.
 *  - La Company NO debe estar en PENDIENTE_REVISION (no debe tener auto-alta en curso).
 *  - El emisor (RBAC) lo valida la server action; aquí solo validamos la Company.
 *
 * Backward compatible: si no se pasan options o targetCompanyId, el comportamiento
 * es idéntico a la versión previa (link para prospecto nuevo, channel='VENDOR_LINK').
 */
export async function generateCompanySelfRegLink(
  createdByUserId?: string | null,
  options?: {
    ttlHours?: number
    targetCompanyId?: string
  } | number // retrocompat: si llega number, trátalo como ttlHours
): Promise<{
  id: string
  token: string
  url: string
  expiresAt: Date
  channel: 'VENDOR_LINK' | 'COMPANY_UPDATE'
  targetCompanyId?: string
}> {
  // Backward-compat: segundo arg puede ser un número (ttlHours legacy) o un objeto.
  let ttlHours = 168
  let targetCompanyId: string | undefined
  if (typeof options === 'number') {
    ttlHours = options
  } else if (options && typeof options === 'object') {
    if (typeof options.ttlHours === 'number') ttlHours = options.ttlHours
    if (typeof options.targetCompanyId === 'string') targetCompanyId = options.targetCompanyId
  }

  // Si hay targetCompanyId, validar la Company antes de crear el link.
  if (targetCompanyId) {
    const target = await prisma.company.findUnique({
      where: { id: targetCompanyId },
      select: { id: true, estado: true },
    })
    if (!target) {
      throw new Error('TARGET_COMPANY_NOT_FOUND')
    }
    if (target.estado === CompanyStatus.PENDIENTE_REVISION) {
      throw new Error('TARGET_COMPANY_PENDING')
    }
  }

  const { plain, hash } = generateSelfRegToken()
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000)
  const channel: 'VENDOR_LINK' | 'COMPANY_UPDATE' = targetCompanyId
    ? 'COMPANY_UPDATE'
    : 'VENDOR_LINK'

  const created = await prisma.companySelfRegistration.create({
    data: {
      tokenHash: hash,
      expiresAt,
      status: CompanySelfRegStatus.ACTIVE,
      createdByUserId: createdByUserId ?? null,
      channel,
      targetCompanyId: targetCompanyId ?? null,
      uploadedFiles: [],
    },
  })
  const baseUrl = getPublicBaseUrl()
  const refSuffix = createdByUserId ? `?ref=${encodeURIComponent(createdByUserId)}` : ''
  const url = `${baseUrl}/auto-alta/${plain}${refSuffix}`
  return {
    id: created.id,
    token: plain,
    url,
    expiresAt,
    channel,
    targetCompanyId,
  }
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
 * IMPL-20260624-03 (ARCH-20260624-03): Rama adicional cuando el token apunta
 * a una Company existente (channel='COMPANY_UPDATE' + targetCompanyId):
 *   - En vez de crear Company, hace UPDATE sobre la targetCompany.
 *   - Optimistic locking: compara before.updatedAt con expectedUpdatedAt
 *     recibido como cuarto argumento.
 *   - Genera AuditLog con action='UPDATE_VIA_LINK' y snapshot before/after.
 *   - Marca CompanySelfRegistration.status='SUBMITTED', submittedCompanyId=target.
 *
 * @param source 'TOKEN' (requiere token) o 'PUBLIC' (sin token).
 * @param payload Payload validado por CompanyFullFormPayloadSchema.
 * @param token Requerido solo si source='TOKEN'. Token plano original.
 * @param expectedUpdatedAt Requerido solo en path UPDATE (Company existente).
 *           Se compara contra Company.updatedAt antes de hacer el update.
 */
export async function submitCompanySelfRegistrationCore(
  source: 'TOKEN' | 'PUBLIC',
  payload: CompanyFullFormPayload,
  token?: string,
  expectedUpdatedAt?: string
): Promise<
  | { ok: true; companyId: string }
  | {
      ok: false
      code:
        | 'INVALID_TOKEN'
        | 'TOKEN_EXPIRED'
        | 'ALREADY_SUBMITTED'
        | 'INVALID_PAYLOAD'
        | 'RFC_DUPLICATE'
        | 'TARGET_COMPANY_GONE'
        | 'CONCURRENT_UPDATE'
      error: string
      existingCompanyId?: string
    }
> {
  let regId: string | null = null
  let regTargetCompanyId: string | null = null

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
    regTargetCompanyId = existing.targetCompanyId
  }
  // source === 'PUBLIC' → no se valida ni se busca token; regId queda null.
  // Se creará un nuevo CompanySelfRegistration en la transacción con channel=PUBLIC_DIRECT.

  // -- 1b. IMPL-20260624-03: Rama UPDATE — Company existente vía COMPANY_UPDATE --
  if (source === 'TOKEN' && regTargetCompanyId) {
    return submitCompanyUpdateBranch({
      targetCompanyId: regTargetCompanyId,
      regId: regId!,
      payload,
      expectedUpdatedAt,
    })
  }

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

/**
 * Wrapper público (ruta con token): valida token y delega al core.
 *
 * IMPL-20260624-03 (ARCH-20260624-03): acepta parámetro opcional
 * `expectedUpdatedAt` para soportar el path UPDATE (Company existente).
 * Si el token apunta a un link de tipo COMPANY_UPDATE y el cliente envía
 * `expectedUpdatedAt`, el core hace optimistic locking comparándolo contra
 * el updatedAt actual de la Company.
 */
export async function submitCompanySelfRegistration(
  plainToken: string,
  rawPayload: unknown,
  expectedUpdatedAt?: string
): Promise<
  | { ok: true; companyId: string }
  | {
      ok: false
      code:
        | 'INVALID_TOKEN'
        | 'TOKEN_EXPIRED'
        | 'ALREADY_SUBMITTED'
        | 'INVALID_PAYLOAD'
        | 'RFC_DUPLICATE'
        | 'TARGET_COMPANY_GONE'
        | 'CONCURRENT_UPDATE'
      error: string
      existingCompanyId?: string
    }
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

  // Si el payload no trae expectedUpdatedAt, lo derivamos de la Company target
  // cuando aplique. Esto evita regresión: callers existentes que no pasan
  // expectedUpdatedAt siguen funcionando para el path prospecto nuevo (que
  // ignora este campo), y para el path UPDATE, si no se pasa, NO hacemos
  // optimistic locking (modo permisivo, no rompe el flujo).
  //
  // NOTA: la server action puede llamar validateCompanySelfRegToken primero
  // y pasar el expectedUpdatedAt derivado del result (ver actions).

  return submitCompanySelfRegistrationCore('TOKEN', payload, plainToken, expectedUpdatedAt)
}

/** Wrapper público (ruta sin token /solicitar-alta): sin validación de token. */
export async function submitPublicCompanySelfRegistration(
  rawPayload: unknown
): Promise<
  | { ok: true; companyId: string }
  | {
      ok: false
      code:
        | 'INVALID_TOKEN'
        | 'ALREADY_SUBMITTED'
        | 'TOKEN_EXPIRED'
        | 'INVALID_PAYLOAD'
        | 'RFC_DUPLICATE'
        | 'TARGET_COMPANY_GONE'
        | 'CONCURRENT_UPDATE'
      error: string
      existingCompanyId?: string
    }
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
// IMPL-20260624-03 (ARCH-20260624-03): Edición de datos completos de empresa
// Sub-A: link externo (UPDATE branch en submitCompanySelfRegistrationCore).
// Sub-B: edición interna (updateCompany).
// --------------------------------------------------------------------------

/**
 * Computa el diff entre before y after. Devuelve un array `{ field, before, after }`
 * solo donde los valores difieren. Compara keys presentes en `before`.
 *
 * IMPL-20260624-03: helper reutilizado por `updateCompany` y por la rama UPDATE
 * de `submitCompanySelfRegistrationCore`. Compara con `JSON.stringify` para
 * detectar diffs en campos Json (fiscalData, repLegalData, etc.).
 *
 * No incluye campos que solo cambian en `after` (no existe en before) porque
 * esos serían inserciones, no updates. Tampoco `updatedAt` ni `createdAt`:
 * esos los actualiza Prisma automáticamente y no son cambios del usuario.
 */
export function computeChanges(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  options?: { ignoreKeys?: readonly string[] }
): Array<{ field: string; before: unknown; after: unknown }> {
  const ignore = new Set<string>(['updatedAt', 'createdAt', ...(options?.ignoreKeys ?? [])])
  const changes: Array<{ field: string; before: unknown; after: unknown }> = []
  for (const key of Object.keys(before)) {
    if (ignore.has(key)) continue
    const b = before[key]
    const a = after[key]
    // JSON.stringify es seguro aquí: las fechas Prisma se serializan a ISO al
    // entrar al AuditLog (details es Json). Para equality check usamos Date.toISO()
    // si alguno es Date.
    const eq =
      b === a ||
      (b instanceof Date && a instanceof Date && b.getTime() === a.getTime()) ||
      JSON.stringify(b) === JSON.stringify(a)
    if (!eq) {
      changes.push({ field: key, before: b, after: a })
    }
  }
  return changes
}

/**
 * IMPL-20260624-03 (ARCH-20260624-03) Sub-A: rama UPDATE de
 * submitCompanySelfRegistrationCore. Se invoca cuando el token apunta a
 * una Company existente (channel='COMPANY_UPDATE', targetCompanyId).
 *
 * Comportamiento:
 *  - Lee la Company target (snapshot before).
 *  - Si no existe → TARGET_COMPANY_GONE.
 *  - Si expectedUpdatedAt no coincide con before.updatedAt → CONCURRENT_UPDATE.
 *  - Si el RFC cambió, valida unicidad contra otras Company.
 *  - UPDATE: aplica datos del payload (igual que el path CREATE, pero sobre
 *    Company existente; NO cambia origen, estado, sellerId).
 *  - Marca CompanySelfRegistration como SUBMITTED, submittedCompanyId=target.
 *  - Genera AuditLog con action='UPDATE_VIA_LINK' y snapshot before/after.
 */
async function submitCompanyUpdateBranch(args: {
  targetCompanyId: string
  regId: string
  payload: CompanyFullFormPayload
  expectedUpdatedAt?: string
}): Promise<
  | { ok: true; companyId: string }
  | {
      ok: false
      code: 'CONCURRENT_UPDATE' | 'TARGET_COMPANY_GONE' | 'RFC_DUPLICATE'
      error: string
      existingCompanyId?: string
    }
> {
  try {
    return await prisma.$transaction(async (tx) => {
      const before = await tx.company.findUnique({ where: { id: args.targetCompanyId } })
      if (!before) {
        return {
          ok: false,
          code: 'TARGET_COMPANY_GONE' as const,
          error: 'La empresa objetivo ya no existe',
        }
      }

      // Optimistic locking
      if (
        args.expectedUpdatedAt &&
        before.updatedAt.toISOString() !== args.expectedUpdatedAt
      ) {
        return {
          ok: false,
          code: 'CONCURRENT_UPDATE' as const,
          error:
            'Los datos de la empresa fueron actualizados por otro usuario. Recarga el enlace y vuelve a intentar.',
        }
      }

      // Validar RFC duplicado si cambió
      if (args.payload.fiscal.rfc !== before.rfc) {
        const dup = await tx.company.findFirst({
          where: { rfc: args.payload.fiscal.rfc, NOT: { id: args.targetCompanyId } },
          select: { id: true },
        })
        if (dup) {
          return {
            ok: false,
            code: 'RFC_DUPLICATE' as const,
            error: 'RFC ya registrado',
            existingCompanyId: dup.id,
          }
        }
      }

      const updated = await tx.company.update({
        where: { id: args.targetCompanyId },
        data: {
          name: args.payload.fiscal.razonSocial,
          rfc: args.payload.fiscal.rfc,
          address: [
            args.payload.fiscal.domicilio,
            args.payload.fiscal.colonia,
            args.payload.fiscal.municipio,
            args.payload.fiscal.estado,
            args.payload.fiscal.cp,
            args.payload.fiscal.pais,
          ]
            .filter(Boolean)
            .join(', '),
          contactName: [args.payload.repLegal.nombre, args.payload.repLegal.apellidos]
            .filter(Boolean)
            .join(' '),
          email: args.payload.repLegal.email,
          phone: args.payload.repLegal.telefono,
          fiscalData: args.payload.fiscal as unknown as Prisma.InputJsonValue,
          repLegalData: args.payload.repLegal as unknown as Prisma.InputJsonValue,
          rhData: args.payload.rh as unknown as Prisma.InputJsonValue,
          cuentasPagarData: args.payload.cuentasPagar as unknown as Prisma.InputJsonValue,
          referenciasData: args.payload.referencias as unknown as Prisma.InputJsonValue,
          terminosAceptados: args.payload.terminosAceptados === true,
          documentosAdjuntos: args.payload.documentos as unknown as Prisma.InputJsonValue,
          // NO tocamos: origen, estado, sellerId, enabledAt, defaultBranchId.
        },
      })

      // Marcar CompanySelfRegistration como SUBMITTED.
      await tx.companySelfRegistration.update({
        where: { id: args.regId },
        data: {
          status: CompanySelfRegStatus.SUBMITTED,
          submittedAt: new Date(),
          submittedCompanyId: args.targetCompanyId,
        },
      })

      // AuditLog con snapshot before/after.
      await tx.auditLog.create({
        data: {
          userId: null, // submit público por la empresa
          action: 'UPDATE_VIA_LINK',
          entity: 'Company',
          entityId: args.targetCompanyId,
          details: {
            source: 'COMPANY_UPDATE_LINK',
            selfRegistrationId: args.regId,
            before: before as unknown as Prisma.InputJsonValue,
            after: updated as unknown as Prisma.InputJsonValue,
            changes: computeChanges(
              before as unknown as Record<string, unknown>,
              updated as unknown as Record<string, unknown>
            ),
          } as Prisma.InputJsonValue,
        },
      })

      return { ok: true, companyId: args.targetCompanyId }
    })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return { ok: false, code: 'RFC_DUPLICATE', error: 'RFC ya registrado' }
    }
    throw e
  }
}

/**
 * IMPL-20260624-03 (ARCH-20260624-03) Sub-B: edición interna de Company.
 * Solo ADMIN (validado en server action antes de delegar aquí).
 *
 * Comportamiento:
 *  - Lee la Company target (snapshot before).
 *  - Si no existe → NOT_FOUND.
 *  - Optimistic locking: compara before.updatedAt con data.expectedUpdatedAt.
 *  - Si el RFC cambió, valida unicidad contra otras Company.
 *  - UPDATE parcial: solo aplica secciones presentes en data.
 *  - Genera AuditLog con action='UPDATE' y snapshot before/after + changes.
 *
 * NOTA: Se llama `updateCompanyFull` (no `updateCompany`) para no colisionar
 * con el shim legacy `updateCompany(id, Prisma.CompanyUpdateInput)` arriba
 * que reusa compatibilidad con el wrapper action.
 *
 * @param companyId id de la Company a actualizar.
 * @param data payload validado por updateCompanySchema (incluye expectedUpdatedAt).
 * @param context { userId, ipAddress? } contexto de auditoría.
 */
export async function updateCompanyFull(
  companyId: string,
  data: UpdateCompanyInput,
  context: { userId: string; ipAddress?: string | null }
): Promise<
  | { ok: true; company: unknown }
  | {
      ok: false
      code: 'NOT_FOUND' | 'CONCURRENT_UPDATE' | 'RFC_DUPLICATE'
      error: string
      existingCompanyId?: string
    }
> {
  try {
    return await prisma.$transaction(async (tx) => {
      const before = await tx.company.findUnique({ where: { id: companyId } })
      if (!before) {
        return {
          ok: false,
          code: 'NOT_FOUND' as const,
          error: 'Empresa no encontrada',
        }
      }

      // Optimistic locking
      if (before.updatedAt.toISOString() !== data.expectedUpdatedAt) {
        return {
          ok: false,
          code: 'CONCURRENT_UPDATE' as const,
          error:
            'Los datos fueron actualizados por otro usuario. Recarga la página y vuelve a intentar.',
        }
      }

      // Validar RFC duplicado si cambió en basic
      if (data.basic?.rfc && data.basic.rfc !== before.rfc) {
        const dup = await tx.company.findFirst({
          where: { rfc: data.basic.rfc, NOT: { id: companyId } },
          select: { id: true },
        })
        if (dup) {
          return {
            ok: false,
            code: 'RFC_DUPLICATE' as const,
            error: 'RFC ya registrado en otra empresa',
            existingCompanyId: dup.id,
          }
        }
      }

      // Construir data de update: solo incluir secciones presentes.
      const updateData: Prisma.CompanyUpdateInput = {}
      if (data.basic) {
        if (data.basic.name !== undefined) updateData.name = data.basic.name
        if (data.basic.rfc !== undefined) updateData.rfc = data.basic.rfc
        if (data.basic.address !== undefined) updateData.address = data.basic.address
        if (data.basic.contactName !== undefined) updateData.contactName = data.basic.contactName
        if (data.basic.email !== undefined) updateData.email = data.basic.email
        if (data.basic.phone !== undefined) updateData.phone = data.basic.phone
      }
      if (data.fiscalData !== undefined) {
        updateData.fiscalData = data.fiscalData as unknown as Prisma.InputJsonValue
      }
      if (data.repLegalData !== undefined) {
        updateData.repLegalData = data.repLegalData as unknown as Prisma.InputJsonValue
      }
      if (data.rhData !== undefined) {
        updateData.rhData = data.rhData as unknown as Prisma.InputJsonValue
      }
      if (data.cuentasPagarData !== undefined) {
        updateData.cuentasPagarData = data.cuentasPagarData as unknown as Prisma.InputJsonValue
      }
      if (data.facturacionData !== undefined) {
        // facturacionData se guarda dentro de fiscalData (no es columna propia).
        // Se conserva estructura: se mergea al fiscalData existente si está.
        // Decisión SPEC: si se envía facturacionData, lo embebemos en fiscalData.facturacion.
        const currentFiscal =
          (before.fiscalData as Record<string, unknown> | null) ?? {}
        updateData.fiscalData = {
          ...currentFiscal,
          facturacion: data.facturacionData,
        } as unknown as Prisma.InputJsonValue
      }
      if (data.entregaFisicaData !== undefined) {
        const currentFiscal =
          (before.fiscalData as Record<string, unknown> | null) ?? {}
        updateData.fiscalData = {
          ...(updateData.fiscalData as Record<string, unknown> | undefined ?? currentFiscal),
          entregaFisica: data.entregaFisicaData,
        } as unknown as Prisma.InputJsonValue
      }
      if (data.referenciasData !== undefined) {
        updateData.referenciasData =
          data.referenciasData as unknown as Prisma.InputJsonValue
      }
      if (data.documentos !== undefined) {
        updateData.documentosAdjuntos =
          data.documentos as unknown as Prisma.InputJsonValue
      }

      const after = await tx.company.update({
        where: { id: companyId },
        data: updateData,
      })

      // AuditLog con snapshot before/after y diff.
      await tx.auditLog.create({
        data: {
          userId: context.userId,
          action: 'UPDATE',
          entity: 'Company',
          entityId: companyId,
          ipAddress: context.ipAddress ?? null,
          details: {
            source: 'INTERNAL_EDIT',
            before: before as unknown as Prisma.InputJsonValue,
            after: after as unknown as Prisma.InputJsonValue,
            changes: computeChanges(
              before as unknown as Record<string, unknown>,
              after as unknown as Record<string, unknown>
            ),
          } as Prisma.InputJsonValue,
        },
      })

      return { ok: true, company: after }
    })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return {
        ok: false,
        code: 'RFC_DUPLICATE',
        error: 'RFC ya registrado en otra empresa',
      }
    }
    throw e
  }
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
