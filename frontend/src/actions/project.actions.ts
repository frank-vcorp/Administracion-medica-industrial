/**
 * Server Actions para la entidad Project (Proyectos de Visita Médica)
 * @id IMPL-20260519-14
 * @spec context/SPECs/SPEC_ARCH-20260519-12-ENTIDAD-PROJECT-VISITA-MEDICA.md
 * @id IMPL-20260527-01
 * @backup context/interconsultas/HANDOFF_ARCH-20260527-12_SOFIA_SLICE-B-RECEPCION-PROJECT.md
 */
'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/auth'
import prisma from '@/lib/prisma'
import { ProjectStatus, Prisma } from '@prisma/client'
import { createProjectReceptionEvent } from '@/actions/event.actions'

// ─── Schemas de validación ────────────────────────────────────────────────────

const CreateProjectSchema = z
  .object({
    name: z.string().min(1).max(200),
    companyId: z.string().uuid(),
    startDate: z.string().datetime(),
    endDate: z.string().datetime(),
    branchId: z.string().uuid().optional().or(z.literal('').transform(() => undefined)),
    unitRef: z.string().max(100).optional(),
    // IMPL-20260711-01: Unidad móvil asignada (opcional). Validada por
    // validateUnitAvailability() antes de crear/actualizar.
    mobileUnitId: z
      .string()
      .uuid()
      .optional()
      .or(z.literal('').transform(() => undefined))
      .or(z.null().transform(() => undefined)),
    notes: z.string().max(1000).optional(),
  })
  .refine((d) => new Date(d.startDate) <= new Date(d.endDate), {
    message: 'La fecha de inicio debe ser anterior o igual a la fecha de fin',
    path: ['startDate'],
  })

const UpdateProjectSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    branchId: z.string().uuid().optional().or(z.literal('').transform(() => undefined)),
    unitRef: z.string().max(100).optional(),
    // IMPL-20260711-01: idem para updates.
    mobileUnitId: z
      .string()
      .uuid()
      .optional()
      .or(z.literal('').transform(() => undefined))
      .or(z.null().transform(() => undefined)),
    notes: z.string().max(1000).optional(),
  })
  .refine(
    (d) =>
      !d.startDate || !d.endDate || new Date(d.startDate) <= new Date(d.endDate),
    {
      message: 'La fecha de inicio debe ser anterior o igual a la fecha de fin',
      path: ['startDate'],
    }
  )

// ─── Tipos de retorno ─────────────────────────────────────────────────────────

export type ProjectWithCompany = Awaited<ReturnType<typeof getProjects>>[number]

// ─── Helpers de autorización ──────────────────────────────────────────────────

async function requireAdminOrReceptionist() {
  const session = await getServerSession(authOptions)
  if (!session) return null
  const allowed = ['ADMIN', 'RECEPTIONIST']
  if (!allowed.includes(session.user.role)) return null
  return session
}

// ─── Queries ──────────────────────────────────────────────────────────────────

/**
 * Retorna todos los proyectos ordenados por startDate desc.
 * Incluye: company.name, _count de trabajadores, mobileUnit (badge).
 * @hotfix ARCH-20260519-14 — guard de autorización agregado
 * @hotfix IMPL-20260711-01 — incluye mobileUnit + count de mantenimientos.
 */
export async function getProjects() {
  const session = await requireAdminOrReceptionist()
  if (!session) return []
  return prisma.project.findMany({
    include: {
      company: { select: { id: true, name: true } },
      branch: { select: { id: true, name: true } },
      _count: { select: { workers: true, reports: true } },
      workers: {
        select: {
          workerId: true,
          receptionStatus: true,
          arrivedAt: true,
          eventId: true,
          worker: {
            select: {
              id: true,
              universalId: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      },
      mobileUnit: {
        select: { id: true, name: true, plate: true, status: true },
      },
    },
    orderBy: { startDate: 'desc' },
  })
}

export async function markProjectWorkerArrived(projectId: string, workerId: string) {
  const session = await requireAdminOrReceptionist()
  if (!session) return { success: false, error: 'No autorizado' }

  try {
    const current = await prisma.projectWorker.findUnique({
      where: { projectId_workerId: { projectId, workerId } },
      select: { receptionStatus: true, arrivedAt: true, eventId: true },
    })

    if (!current) {
      return { success: false, error: 'El trabajador no está vinculado al proyecto.' }
    }

    if (current.eventId) {
      return { success: true, eventId: current.eventId }
    }

    await prisma.projectWorker.update({
      where: { projectId_workerId: { projectId, workerId } },
      data: {
        receptionStatus: 'ARRIVED',
        arrivedAt: current.arrivedAt ?? new Date(),
      },
    })

    revalidatePath('/projects')
    return { success: true }
  } catch (error) {
    console.error('[markProjectWorkerArrived]', error)
    return { success: false, error: 'No se pudo marcar llegada.' }
  }
}

export async function checkInProjectWorkerToClinical(projectId: string, workerId: string) {
  const session = await requireAdminOrReceptionist()
  if (!session) return { success: false, error: 'No autorizado' }

  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        branchId: true,
        companyId: true,
      },
    })

    if (!project) {
      return { success: false, error: 'Proyecto no encontrado.' }
    }

    if (!project.branchId) {
      return { success: false, error: 'El proyecto no tiene sucursal operativa asignada.' }
    }

    const projectWorker = await prisma.projectWorker.findUnique({
      where: { projectId_workerId: { projectId, workerId } },
      select: {
        eventId: true,
        arrivedAt: true,
      },
    })

    if (!projectWorker) {
      return { success: false, error: 'El trabajador no está vinculado al proyecto.' }
    }

    if (projectWorker.eventId) {
      return { success: true, eventId: projectWorker.eventId }
    }

    const eventId = await createProjectReceptionEvent({
      workerId,
      branchId: project.branchId,
      projectId: project.id,
      billingCompanyId: project.companyId,
      intakeCreatedByUserId: session.user.id,
    })

    await prisma.projectWorker.update({
      where: { projectId_workerId: { projectId, workerId } },
      data: {
        receptionStatus: 'CHECKED_IN',
        arrivedAt: projectWorker.arrivedAt ?? new Date(),
        eventId,
      },
    })

    revalidatePath('/projects')
    return { success: true, eventId }
  } catch (error) {
    console.error('[checkInProjectWorkerToClinical]', error)
    return { success: false, error: 'No se pudo ingresar a clínica desde proyecto.' }
  }
}

/**
 * Retorna proyectos de una empresa específica.
 * Usado en el dropdown del BulkWorkerImportModal.
 * @hotfix ARCH-20260519-14 — guard de autorización agregado
 */
export async function getProjectsByCompany(companyId: string) {
  const session = await requireAdminOrReceptionist()
  if (!session) return []
  return prisma.project.findMany({
    where: { companyId },
    include: {
      company: { select: { id: true, name: true } },
      _count: { select: { workers: true } },
    },
    orderBy: { startDate: 'desc' },
  })
}

/**
 * IMPL-20260711-01 — Detalle simple de proyecto (incluye mobileUnit).
 */
export async function getProject(projectId: string) {
  const session = await requireAdminOrReceptionist()
  if (!session) throw new Error('No autorizado')
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      company: { select: { id: true, name: true } },
      branch: { select: { id: true, name: true } },
      mobileUnit: { select: { id: true, name: true, plate: true, status: true } },
    },
  })
  if (!project) throw new Error('Proyecto no encontrado')
  return project
}

// ─── Mutaciones ───────────────────────────────────────────────────────────────

export async function createProject(data: {
  name: string
  companyId: string
  startDate: string
  endDate: string
  branchId?: string
  unitRef?: string
  notes?: string
}): Promise<{ success: boolean; project?: { id: string; name: string }; error?: string }> {
  const session = await requireAdminOrReceptionist()
  if (!session) return { success: false, error: 'No autorizado' }

  const parsed = CreateProjectSchema.safeParse(data)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  }

  const { name, companyId, startDate, endDate, branchId, unitRef, mobileUnitId, notes } = parsed.data

  // IMPL-20260711-01 — Si hay unidad asignada, validar disponibilidad.
  if (mobileUnitId) {
    const availability = await validateUnitAvailability(
      mobileUnitId,
      startDate,
      endDate
    )
    if (!availability.available) {
      return {
        success: false,
        error: `La unidad ya tiene ${availability.conflicts.length} asignación(es) en ese rango. Sugerencias: ${availability.suggestions
          .map((s) => s.label)
          .join(', ') || 'ninguna'}`,
      }
    }
  }

  try {
    const project = await prisma.project.create({
      data: {
        name,
        companyId,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        branchId: branchId ?? null,
        unitRef: unitRef ?? null,
        mobileUnitId: mobileUnitId ?? null,
        notes: notes ?? null,
      },
    })
    revalidatePath('/projects')
    return { success: true, project: { id: project.id, name: project.name } }
  } catch (e: unknown) {
    const err = e as Error
    console.error('[createProject]', err.message)
    return { success: false, error: 'Error al crear el proyecto' }
  }
}

export async function updateProject(
  projectId: string,
  data: {
    name?: string
    startDate?: string
    endDate?: string
    branchId?: string
    unitRef?: string
    notes?: string
  }
): Promise<{ success: boolean; error?: string }> {
  const session = await requireAdminOrReceptionist()
  if (!session) return { success: false, error: 'No autorizado' }

  const parsed = UpdateProjectSchema.safeParse(data)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  }

  const { name, startDate, endDate, branchId, unitRef, mobileUnitId, notes } = parsed.data

  // IMPL-20260711-01 — Si cambia la unidad o el rango de fechas, validar.
  if (mobileUnitId || startDate || endDate) {
    const existing = await prisma.project.findUnique({
      where: { id: projectId },
      select: { mobileUnitId: true, startDate: true, endDate: true },
    })
    if (!existing) return { success: false, error: 'Proyecto no encontrado.' }

    const effectiveUnitId = mobileUnitId !== undefined ? mobileUnitId : existing.mobileUnitId
    const effectiveStart = new Date(startDate ?? existing.startDate.toISOString())
    const effectiveEnd = new Date(endDate ?? existing.endDate.toISOString())

    if (effectiveUnitId) {
      const availability = await validateUnitAvailability(
        effectiveUnitId,
        effectiveStart.toISOString(),
        effectiveEnd.toISOString(),
        projectId
      )
      if (!availability.available) {
        return {
          success: false,
          error: `La unidad ya tiene ${availability.conflicts.length} asignación(es) en ese rango. Sugerencias: ${availability.suggestions
            .map((s) => s.label)
            .join(', ') || 'ninguna'}`,
        }
      }
    }
  }

  try {
    await prisma.project.update({
      where: { id: projectId },
      data: {
        ...(name !== undefined && { name }),
        ...(startDate !== undefined && { startDate: new Date(startDate) }),
        ...(endDate !== undefined && { endDate: new Date(endDate) }),
        ...(branchId !== undefined && { branchId: branchId ?? null }),
        ...(unitRef !== undefined && { unitRef: unitRef ?? null }),
        ...(mobileUnitId !== undefined && { mobileUnitId: mobileUnitId ?? null }),
        ...(notes !== undefined && { notes: notes ?? null }),
      },
    })
    revalidatePath('/projects')
    return { success: true }
  } catch (e: unknown) {
    const err = e as Error
    console.error('[updateProject]', err.message)
    return { success: false, error: 'Error al actualizar el proyecto' }
  }
}

export async function updateProjectStatus(
  projectId: string,
  status: ProjectStatus
): Promise<{ success: boolean; error?: string }> {
  const session = await requireAdminOrReceptionist()
  if (!session) return { success: false, error: 'No autorizado' }

  try {
    await prisma.project.update({
      where: { id: projectId },
      data: { status },
    })
    revalidatePath('/projects')
    return { success: true }
  } catch (e: unknown) {
    const err = e as Error
    console.error('[updateProjectStatus]', err.message)
    return { success: false, error: 'Error al actualizar el estado del proyecto' }
  }
}

// ─── IMPL-20260711-01: Validación de disponibilidad de unidad ────────────────
//
// SPEC §3.1 / §4.3 — determina si una unidad está libre en [startDate, endDate]
// y devuelve (si hay conflicto) hasta 3 fechas alternativas (+7/+14/+21 días).

export type AvailabilityConflict = {
  type: 'project' | 'maintenance'
  id: string
  name?: string | null
}

export type AvailabilityResult = {
  available: boolean
  conflicts: AvailabilityConflict[]
  suggestions: Array<{ iso: string; label: string }>
}

/**
 * SPEC §4.3 — validateUnitAvailability()
 * Si `excludeProjectId` se pasa, ese proyecto se ignora (para updates).
 */
export async function validateUnitAvailability(
  mobileUnitId: string,
  startDate: string,
  endDate: string,
  excludeProjectId?: string
): Promise<AvailabilityResult> {
  const session = await requireAdminOrReceptionist()
  if (!session) {
    return { available: false, conflicts: [], suggestions: [] }
  }

  const start = new Date(startDate)
  const end = new Date(endDate)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    return { available: false, conflicts: [], suggestions: [] }
  }

  // Proyectos conflictivos
  const projectWhere: Prisma.ProjectWhereInput = {
    mobileUnitId,
    NOT: { status: 'CANCELLED' },
    AND: [{ startDate: { lte: end } }, { endDate: { gte: start } }],
  }
  if (excludeProjectId) {
    projectWhere.id = { not: excludeProjectId }
  }
  const conflictingProjects = await prisma.project.findMany({
    where: projectWhere,
    select: { id: true, name: true },
  })

  // Mantenimientos conflictivos
  const conflictingMaintenances = await prisma.maintenanceRecord.findMany({
    where: {
      mobileUnitId,
      status: { in: ['PROGRAMADO', 'REPROGRAMADO'] },
      scheduledDate: { gte: start, lte: end },
    },
    select: { id: true, type: true, scheduledDate: true },
  })

  const conflicts: AvailabilityConflict[] = []
  for (const p of conflictingProjects) {
    conflicts.push({ type: 'project', id: p.id, name: p.name })
  }
  for (const m of conflictingMaintenances) {
    conflicts.push({ type: 'maintenance', id: m.id, name: m.type })
  }

  const available = conflicts.length === 0
  const suggestions: Array<{ iso: string; label: string }> = []

  if (!available) {
    for (const days of [7, 14, 21]) {
      if (suggestions.length >= 3) break
      const candidateStart = new Date(start.getTime() + days * 86400_000)
      const candidateEnd = new Date(end.getTime() + days * 86400_000)
      const pProjects = await prisma.project.count({
        where: {
          mobileUnitId,
          NOT: { status: 'CANCELLED' },
          AND: [{ startDate: { lte: candidateEnd } }, { endDate: { gte: candidateStart } }],
        },
      })
      const pMaintenances = await prisma.maintenanceRecord.count({
        where: {
          mobileUnitId,
          status: { in: ['PROGRAMADO', 'REPROGRAMADO'] },
          scheduledDate: { gte: candidateStart, lte: candidateEnd },
        },
      })
      if (pProjects === 0 && pMaintenances === 0) {
        suggestions.push({
          iso: candidateStart.toISOString(),
          label: `+${days} días (${candidateStart.toISOString().slice(0, 10)})`,
        })
      }
    }
  }

  return { available, conflicts, suggestions }
}

/**
 * SPEC §4.3 — suggestMaintenanceDates()
 * Devuelve hasta `maxSuggestions` fechas posteriores a `startAfter` que están
 * libres para la unidad (sin proyectos/mantenimientos en esa fecha).
 */
export async function suggestMaintenanceDates(
  mobileUnitId: string,
  startAfter: string,
  searchWindowDays: number,
  maxSuggestions: number
): Promise<Array<{ iso: string; label: string }>> {
  const session = await requireAdminOrReceptionist()
  if (!session) return []

  const start = new Date(startAfter)
  if (Number.isNaN(start.getTime())) return []

  const out: Array<{ iso: string; label: string }> = []
  const horizon = new Date(start.getTime() + searchWindowDays * 86400_000)
  let cursor = new Date(start.getTime() + 86400_000)

  while (cursor <= horizon && out.length < maxSuggestions) {
    const dayEnd = new Date(cursor)
    dayEnd.setHours(23, 59, 59, 999)
    const pProjects = await prisma.project.count({
      where: {
        mobileUnitId,
        NOT: { status: 'CANCELLED' },
        AND: [{ startDate: { lte: dayEnd } }, { endDate: { gte: cursor } }],
      },
    })
    const pMaintenances = await prisma.maintenanceRecord.count({
      where: {
        mobileUnitId,
        status: { in: ['PROGRAMADO', 'REPROGRAMADO'] },
        scheduledDate: { gte: cursor, lte: dayEnd },
      },
    })
    if (pProjects === 0 && pMaintenances === 0) {
      out.push({
        iso: cursor.toISOString(),
        label: `+${Math.round((cursor.getTime() - start.getTime()) / 86400_000)} días (${cursor.toISOString().slice(0, 10)})`,
      })
    }
    cursor = new Date(cursor.getTime() + 86400_000)
  }
  return out
}
