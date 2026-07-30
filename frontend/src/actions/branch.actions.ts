/**
 * @file Server Actions: Sucursales (Branch).
 * @id IMPL-20260730-05 (ARCH-20260730-01) — PR-3 (detalle + edición + asignación empresas)
 * @spec context/SPECs/SPEC_ARCH-20260730-01-MODULO-SUCURSALES-COMPLETO.md §5
 *
 * Fachada limpia de acciones para Sucursales. Suplanta a
 * `admin.actions.ts:97-125` que aún conserva los stubs legacy `getBranches` /
 * `createBranch` (FormData-based) hasta que PR-2 los refactorice para reusar
 * esta fachada.
 *
 * Acciones expuestas:
 *   - `getBranches(options?)`                          — listado tenant-wide con filtro opcional.
 *   - `getBranchById(id)`                              — detalle con `_count` + relaciones.
 *   - `createBranch(data)`                             — crea, sólo ADMIN_LIKE.
 *   - `updateBranch(id, data)`                         — actualiza parcial, sólo ADMIN_LIKE.
 *   - `toggleBranchActive(id, isActive)` (PR-3)        — soft disable/enable + auditoría.
 *   - `updateBranchAllowedCompanies(id, companyIds[])` (PR-3) — inversa M2M.
 *   - `getAvailableCompaniesForBranch()` (PR-3)        — listado simple para UI Empresas.
 *
 * Quedan PENDIENTES para PR-4 (no implementar aquí):
 *   - `deleteBranch` — hard delete bloqueado si hay dependencias (SPEC §5.6).
 *
 * Convenciones:
 *   - Server actions usan la convención `{ok: true, ...} | {ok: false, error}`.
 *   - Validación server-side con Zod (`branchCreateSchema` / `branchUpdateSchema`).
 *   - `revalidatePath` tras cualquier mutación para invalidar caché de Server Components.
 *   - Sin `console.log` de objetos completos en prod (sólo IDs / refs).
 */
'use server'

import { revalidatePath } from 'next/cache'
import { getServerSession } from 'next-auth/next'
import prisma from '@/lib/prisma'
import { authOptions } from '@/auth'
import { isAdminLike } from '@/lib/auth/roles'
import { getDefaultTenant } from '@/lib/tenant'
import { logAudit } from './audit.actions'
import {
  branchCreateSchema,
  branchUpdateSchema,
  branchToggleSchema,
  branchIdSchema,
} from '@/lib/schemas/branch'
import type { BranchCreateInput, BranchUpdateInput } from '@/lib/schemas/branch'
import { z } from 'zod'

// --------------------------------------------------------------------------
// Helpers de auth (locales, siguen convención de maintenance.actions.ts)
// --------------------------------------------------------------------------

/**
 * Devuelve la sesión si el usuario está autenticado, o `null` en caso
 * contrario. No impone rol: cualquier sesión autenticada pasa.
 */
async function requireSession() {
  const session = await getServerSession(authOptions)
  return session
}

/**
 * Devuelve la sesión sólo si el usuario autenticado tiene permisos
 * administrativos (SUPERADMIN o ADMIN). En caso contrario `null`.
 */
async function requireAdmin() {
  const session = await getServerSession(authOptions)
  if (!session) return null
  if (!isAdminLike(session.user.role)) return null
  return session
}

// --------------------------------------------------------------------------
// Read — `getBranches` (SPEC §5.1)
// --------------------------------------------------------------------------

export interface GetBranchesOptions {
  includeInactive?: boolean
  search?: string
}

/**
 * Lista sucursales del tenant actual con conteos de relaciones (appointments,
 * companies-allowed) para alimentar la UI `/branches`.
 *
 * Por defecto sólo devuelve activas. Para listar todas (pantalla admin con
 * filtro explícito) pasar `includeInactive: true`.
 */
export async function getBranches(options?: GetBranchesOptions) {
  const session = await requireSession()
  if (!session) return []

  const tenant = await getDefaultTenant()
  return await prisma.branch.findMany({
    where: {
      tenantId: tenant.id,
      ...(options?.includeInactive ? {} : { isActive: true }),
      ...(options?.search
        ? { name: { contains: options.search, mode: 'insensitive' as const } }
        : {}),
    },
    include: {
      _count: {
        select: {
          appointments: true,
          events: true,
          workers: true,
          projects: true,
          allowedByCompanies: true,
          companies: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })
}

// --------------------------------------------------------------------------
// Read — `getBranchById` (SPEC §5.2)
// --------------------------------------------------------------------------

/**
 * Detalle completo de una sucursal. Devuelve discriminated union para que la
 * UI pueda ramificar `if (!result.ok)` sin try/catch.
 */
export async function getBranchById(id: string) {
  const session = await requireSession()
  if (!session) return { ok: false as const, error: 'No autenticado' }

  const idParsed = branchIdSchema.safeParse(id)
  if (!idParsed.success) return { ok: false as const, error: 'ID inválido' }

  const branch = await prisma.branch.findUnique({
    where: { id: idParsed.data },
    include: {
      allowedByCompanies: {
        select: { id: true, name: true, rfc: true },
      },
      companies: {
        select: { id: true, name: true },
      },
      _count: {
        select: {
          // IMPL-20260730-06 (PR-4): Conteos adicionales para BranchDeleteGuardModal.
          events: true,
          workers: true,
          projects: true,
          appointments: true,
          allowedByCompanies: true,
          companies: true,
        },
      },
      tenant: {
        select: { id: true, name: true },
      },
    },
  })

  if (!branch) return { ok: false as const, error: 'Sucursal no encontrada' }

  return { ok: true as const, branch }
}

// --------------------------------------------------------------------------
// Mutate — `createBranch` (SPEC §5.3)
// --------------------------------------------------------------------------

/**
 * Crea una sucursal. Sólo ADMIN_LIKE. Zod validado server-side.
 *
 * Devuelve `{ok:true, branch}` o `{ok:false, error}` (sin código discriminado
 * aún — el código de error es contenido en `error` y se mantiene en español
 * para mostrar en UI; PR-4 podría refactorizar a discriminated codes si se
 * requiere por tests).
 */
export async function createBranch(data: BranchCreateInput) {
  const session = await requireAdmin()
  if (!session) return { ok: false as const, error: 'Sin permisos' }

  const parsed = branchCreateSchema.safeParse(data)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return {
      ok: false as const,
      error: first?.message ?? 'Datos inválidos',
    }
  }

  const tenant = await getDefaultTenant()
  try {
    const branch = await prisma.branch.create({
      data: { ...parsed.data, tenantId: tenant.id },
    })

    // H1 — GEMINI AUD-20260730-01: registrar en auditoría SOLO en éxito.
    await logAudit('CREATE', 'Branch', branch.id, {
      name: branch.name,
      tenantId: tenant.id,
    })

    revalidatePath('/branches')
    return { ok: true as const, branch }
  } catch (e) {
    // H4 — GEMINI AUD-20260730-01: nunca fallar silencioso; exponer UI error.
    console.error(
      '[branch.actions] createBranch failed:',
      e instanceof Error ? e.message : 'unknown',
    )
    return { ok: false as const, error: 'Error al crear sucursal' }
  }
}

// --------------------------------------------------------------------------
// Mutate — `updateBranch` (SPEC §5.4)
// --------------------------------------------------------------------------

/**
 * Actualiza una sucursal existente de forma parcial. Sólo ADMIN_LIKE. Zod
 * validado server-side. `revalidatePath` invalida tanto `/branches` como la
 * ruta detalle `/branches/${id}` (que se crea en PR-3).
 */
export async function updateBranch(id: string, data: BranchUpdateInput) {
  const session = await requireAdmin()
  if (!session) return { ok: false as const, error: 'Sin permisos' }

  const idParsed = branchIdSchema.safeParse(id)
  if (!idParsed.success) return { ok: false as const, error: 'ID inválido' }

  const dataParsed = branchUpdateSchema.safeParse(data)
  if (!dataParsed.success) {
    const first = dataParsed.error.issues[0]
    return {
      ok: false as const,
      error: first?.message ?? 'Datos inválidos',
    }
  }

  // H5 — GEMINI AUD-20260730-01: validar existencia antes de update para
  // devolver mensaje específico en vez de Prisma P2025 genérico.
  const existing = await prisma.branch.findUnique({ where: { id: idParsed.data } })
  if (!existing) return { ok: false as const, error: 'Sucursal no encontrada' }

  try {
    const branch = await prisma.branch.update({
      where: { id: idParsed.data },
      data: dataParsed.data,
    })

    // H1 — GEMINI AUD-20260730-01: registrar en auditoría SOLO en éxito.
    await logAudit('UPDATE', 'Branch', branch.id, {
      name: branch.name,
      tenantId: branch.tenantId,
    })

    revalidatePath('/branches')
    revalidatePath(`/branches/${idParsed.data}`)
    return { ok: true as const, branch }
  } catch (e) {
    // H4 — GEMINI AUD-20260730-01: simétrico con createBranch.
    console.error(
      '[branch.actions] updateBranch failed:',
      e instanceof Error ? e.message : 'unknown',
    )
    return { ok: false as const, error: 'Error al actualizar sucursal' }
  }
}

// --------------------------------------------------------------------------
// Mutate — `toggleBranchActive` (SPEC §5.5) — PR-3
// --------------------------------------------------------------------------

/**
 * Soft-disable / enable de una sucursal. Sólo ADMIN_LIKE. Registra quién la
 * desactivó (`disabledAt` + `disabledByUserId`). Si al desactivar la sucursal
 * sigue siendo `defaultBranch` de alguna empresa HABILITADA, emite un audit
 * adicional con `warning` (no bloquea — la SPEC §5.5 propone advertencia).
 */
export async function toggleBranchActive(id: string, isActive: boolean) {
  const session = await requireAdmin()
  if (!session) return { ok: false as const, error: 'Sin permisos' }

  const idParsed = branchIdSchema.safeParse(id)
  if (!idParsed.success) return { ok: false as const, error: 'ID inválido' }

  const toggleParsed = branchToggleSchema.safeParse({
    id: idParsed.data,
    isActive,
  })
  if (!toggleParsed.success) {
    return {
      ok: false as const,
      error: toggleParsed.error.issues[0]?.message ?? 'Datos inválidos',
    }
  }

  try {
    const branch = await prisma.branch.update({
      where: { id: idParsed.data },
      data: {
        isActive: toggleParsed.data.isActive,
        disabledAt: toggleParsed.data.isActive ? null : new Date(),
        disabledByUserId: toggleParsed.data.isActive ? null : session.user.id,
      },
    })

    // Advertencia: si se está desactivando y la sucursal es defaultBranch de
    // alguna empresa HABILITADA. No bloquea, sólo registra en auditoría.
    if (!toggleParsed.data.isActive) {
      const defaultingCompanies = await prisma.company.findMany({
        where: { defaultBranchId: idParsed.data, estado: 'HABILITADO' },
        select: { id: true, name: true },
      })
      if (defaultingCompanies.length > 0) {
        await logAudit('TOGGLE', 'Branch', idParsed.data, {
          isActive: false,
          warning: 'Es sucursal predeterminada de empresas habilitadas',
          companies: defaultingCompanies.map((c) => c.id),
        })
      } else {
        await logAudit('TOGGLE', 'Branch', idParsed.data, { isActive: false })
      }
    } else {
      await logAudit('TOGGLE', 'Branch', idParsed.data, { isActive: true })
    }

    revalidatePath('/branches')
    revalidatePath(`/branches/${idParsed.data}`)
    return { ok: true as const, branch }
  } catch (e) {
    console.error(
      '[branch.actions] toggleBranchActive failed:',
      e instanceof Error ? e.message : 'unknown',
    )
    return { ok: false as const, error: 'Error al cambiar estado de sucursal' }
  }
}

// --------------------------------------------------------------------------
// Mutate — `updateBranchAllowedCompanies` (SPEC §5.7) — PR-3
// --------------------------------------------------------------------------

/**
 * Inversa M2M de `updateCompanyAllowedBranches`. Reemplaza completamente la
 * lista de empresas permitidas para esta sucursal. Sólo ADMIN_LIKE.
 */
export async function updateBranchAllowedCompanies(
  branchId: string,
  companyIds: string[],
) {
  const session = await requireAdmin()
  if (!session) return { ok: false as const, error: 'Sin permisos' }

  const branchIdParsed = branchIdSchema.safeParse(branchId)
  if (!branchIdParsed.success) {
    return { ok: false as const, error: 'ID de sucursal inválido' }
  }

  // Límite 200 (paridad con SPEC §5.7 / R3).
  const companiesSchema = z.array(z.string().uuid()).max(200, 'Máximo 200 empresas permitidas')
  const companiesParsed = companiesSchema.safeParse(companyIds)
  if (!companiesParsed.success) {
    return {
      ok: false as const,
      error: companiesParsed.error.issues[0]?.message ?? 'Lista de empresas inválida',
    }
  }

  // H5 — pre-check existencia para error específico (no Prisma P2025).
  const existing = await prisma.branch.findUnique({
    where: { id: branchIdParsed.data },
  })
  if (!existing) return { ok: false as const, error: 'Sucursal no encontrada' }

  try {
    const branch = await prisma.branch.update({
      where: { id: branchIdParsed.data },
      data: {
        allowedByCompanies: {
          set: companiesParsed.data.map((id) => ({ id })),
        },
      },
    })
    await logAudit('UPDATE', 'Branch', branchIdParsed.data, {
      field: 'allowedByCompanies',
      count: companiesParsed.data.length,
    })
    revalidatePath('/branches')
    revalidatePath(`/branches/${branchId}`)
    revalidatePath('/companies')
    return { ok: true as const, branch }
  } catch (e) {
    console.error(
      '[branch.actions] updateBranchAllowedCompanies failed:',
      e instanceof Error ? e.message : 'unknown',
    )
    return { ok: false as const, error: 'Error al actualizar empresas permitidas' }
  }
}

// --------------------------------------------------------------------------
// Read — `getAvailableCompaniesForBranch` (SPEC §5.7 helper) — PR-3
// --------------------------------------------------------------------------

/**
 * Lista de empresas NO deshabilitadas para alimentar el multi-select del tab
 * "Empresas" en `/branches/[id]`. Sólo ADMIN_LIKE.
 */
export async function getAvailableCompaniesForBranch() {
  const session = await requireAdmin()
  if (!session) return { ok: false as const, error: 'Sin permisos' }

  const companies = await prisma.company.findMany({
    where: { estado: { not: 'DESHABILITADO' } },
    select: { id: true, name: true, rfc: true },
    orderBy: { name: 'asc' },
  })
  return { ok: true as const, companies }
}

// --------------------------------------------------------------------------
// Mutate — `deleteBranch` (SPEC §5.6) — IMPL-20260730-06 (PR-4)
// --------------------------------------------------------------------------

/**
 * Conteos de dependencias que bloquean el borrado de una sucursal. Mantiene
 * paridad 1:1 con los nombres de relations del modelo `Branch` en
 * `prisma/schema.prisma` (líneas 109-117):
 *   - `appointments`      → Appointment[]
 *   - `events`            → MedicalEvent[] (relation `events`, no `medicalEvents`)
 *   - `workers`           → Worker[]
 *   - `projects`          → Project[]
 *   - `allowedByCompanies`→ Company[] inverse del M2M CompanyAllowedBranches
 *   - `defaultForCompanies` → Company[] inversa de Company.defaultBranchId
 */
export interface DeleteBranchDependencies {
  appointments: number
  events: number
  workers: number
  projects: number
  allowedByCompanies: number
  defaultForCompanies: number
}

/**
 * Resultado tipado del intento de borrado. Discriminated union para que la UI
 * pueda ramificar sin try/catch.
 *
 * Codes:
 *   - MUST_DISABLE_FIRST  — branch.isActive=true (gate de orden, §3.3 propuesta A).
 *   - HAS_DEPENDENCIES    — alguna de las 6 cuentas >0 (incluye dependencias en `dependencies`).
 *   - NOT_FOUND           — id no es UUID o branch no existe.
 *   - PERMISSION_DENIED   — sesión ausente o rol no ADMIN_LIKE.
 *
 * En éxito retorna `{ ok:true, branch: { id } }`.
 */
export type DeleteBranchResult =
  | { ok: true; branch: { id: string } }
  | {
      ok: false
      code: 'MUST_DISABLE_FIRST' | 'HAS_DEPENDENCIES' | 'NOT_FOUND' | 'PERMISSION_DENIED'
      error: string
      dependencies?: DeleteBranchDependencies
    }

/**
 * Borrado hard del registro Branch. Sólo ADMIN_LIKE. Reglas de guard:
 *
 *  1. Sesión ADMIN_LIKE obligatoria.
 *  2. ID debe ser UUID válido.
 *  3. Si la sucursal está activa → MUST_DISABLE_FIRST.
 *  4. Conteos de relaciones (appointments/events/workers/projects/
 *     allowedByCompanies/defaultForCompanies) deben ser todos 0 →
 *     HAS_DEPENDENCIES en caso contrario.
 *  5. Sólo entonces `prisma.branch.delete` + `logAudit('DELETE', 'Branch')`.
 *
 * Ante excepción Prisma (p.ej. FK race condition entre el guard y el delete)
 * se retorna `NOT_FOUND` con error genérico para no exponer detalles internos.
 */
export async function deleteBranch(id: string): Promise<DeleteBranchResult> {
  const session = await requireAdmin()
  if (!session) {
    return {
      ok: false as const,
      code: 'PERMISSION_DENIED',
      error: 'Sin permisos',
    }
  }

  const idParsed = branchIdSchema.safeParse(id)
  if (!idParsed.success) {
    return { ok: false as const, code: 'NOT_FOUND', error: 'ID inválido' }
  }

  try {
    const branch = await prisma.branch.findUnique({
      where: { id: idParsed.data },
      include: {
        _count: {
          select: {
            appointments: true,
            events: true,
            workers: true,
            projects: true,
            allowedByCompanies: true,
            companies: true,
          },
        },
      },
    })

    if (!branch) {
      return {
        ok: false as const,
        code: 'NOT_FOUND',
        error: 'Sucursal no encontrada',
      }
    }

    if (branch.isActive) {
      return {
        ok: false as const,
        code: 'MUST_DISABLE_FIRST',
        error: 'Debe desactivar la sucursal antes de eliminarla',
      }
    }

    const counts = branch._count
    const dependencies: DeleteBranchDependencies = {
      appointments: counts.appointments,
      events: counts.events,
      workers: counts.workers,
      projects: counts.projects,
      allowedByCompanies: counts.allowedByCompanies,
      defaultForCompanies: counts.companies,
    }
    const total = Object.values(dependencies).reduce((sum, n) => sum + n, 0)
    if (total > 0) {
      return {
        ok: false as const,
        code: 'HAS_DEPENDENCIES',
        error: `La sucursal tiene ${total} dependencia(s) activa(s)`,
        dependencies,
      }
    }

    await prisma.branch.delete({ where: { id: idParsed.data } })
    await logAudit('DELETE', 'Branch', idParsed.data, { name: branch.name })
    revalidatePath('/branches')
    return { ok: true as const, branch: { id: idParsed.data } }
  } catch (e) {
    // H4 — GEMINI AUD-20260730-01: nunca fallar silencioso.
    console.error(
      '[branch.actions] deleteBranch failed:',
      e instanceof Error ? e.message : 'unknown',
    )
    return {
      ok: false as const,
      code: 'NOT_FOUND',
      error: 'Error al eliminar sucursal',
    }
  }
}
