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
import { ProjectStatus } from '@prisma/client'
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
