/**
 * Server Actions para la entidad Project (Proyectos de Visita Médica)
 * @id IMPL-20260519-14
 * @spec context/SPECs/SPEC_ARCH-20260519-12-ENTIDAD-PROJECT-VISITA-MEDICA.md
 */
'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/auth'
import prisma from '@/lib/prisma'
import { ProjectStatus } from '@prisma/client'

// ─── Schemas de validación ────────────────────────────────────────────────────

const CreateProjectSchema = z
  .object({
    name: z.string().min(1).max(200),
    companyId: z.string().uuid(),
    startDate: z.string().datetime(),
    endDate: z.string().datetime(),
    branchId: z.string().uuid().optional().or(z.literal('').transform(() => undefined)),
    unitRef: z.string().max(100).optional(),
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
 * Incluye: company.name, _count de trabajadores.
 * @hotfix ARCH-20260519-14 — guard de autorización agregado
 */
export async function getProjects() {
  const session = await requireAdminOrReceptionist()
  if (!session) return []
  return prisma.project.findMany({
    include: {
      company: { select: { id: true, name: true } },
      branch: { select: { id: true, name: true } },
      _count: { select: { workers: true } },
    },
    orderBy: { startDate: 'desc' },
  })
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

  const { name, companyId, startDate, endDate, branchId, unitRef, notes } = parsed.data

  try {
    const project = await prisma.project.create({
      data: {
        name,
        companyId,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        branchId: branchId ?? null,
        unitRef: unitRef ?? null,
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

  const { name, startDate, endDate, branchId, unitRef, notes } = parsed.data

  try {
    await prisma.project.update({
      where: { id: projectId },
      data: {
        ...(name !== undefined && { name }),
        ...(startDate !== undefined && { startDate: new Date(startDate) }),
        ...(endDate !== undefined && { endDate: new Date(endDate) }),
        ...(branchId !== undefined && { branchId: branchId ?? null }),
        ...(unitRef !== undefined && { unitRef: unitRef ?? null }),
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
