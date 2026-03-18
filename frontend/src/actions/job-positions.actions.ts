/**
 * @file Server Actions: Puestos de Trabajo (JobPosition)
 * @description CRUD con validación Zod para la gestión de puestos de trabajo B2B.
 * @see context/SPECs/ARCH-20260225-06-FASE2-MODULOS.md
 * @id IMPL-20260313-05
 */
'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import prisma from '@/lib/prisma'

// ─────────────────────────────────────────────────────────────────────────────
// SCHEMAS ZOD
// ─────────────────────────────────────────────────────────────────────────────

const CreateJobPositionSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio').max(150),
  description: z.string().max(500).optional(),
  companyId: z.string().uuid('ID de empresa inválido'),
  defaultProfileId: z.string().uuid('ID de perfil inválido').optional().nullable(),
})

const UpdateJobPositionSchema = CreateJobPositionSchema.partial().extend({
  id: z.string().uuid('ID inválido'),
})

// ─────────────────────────────────────────────────────────────────────────────
// TIPO RESULTADO UNIFICADO
// ─────────────────────────────────────────────────────────────────────────────

type ActionResult<T = undefined> =
  | { success: true; data?: T }
  | { success: false; error: string }

// ─────────────────────────────────────────────────────────────────────────────
// QUERIES
// ─────────────────────────────────────────────────────────────────────────────

export async function getJobPositionsByCompany(companyId: string) {
  return await prisma.jobPosition.findMany({
    where: { companyId },
    include: {
      defaultProfile: { select: { id: true, name: true } },
      _count: { select: { workers: true } },
    },
    orderBy: { name: 'asc' },
  })
}

export async function getJobPositionById(id: string) {
  return await prisma.jobPosition.findUnique({
    where: { id },
    include: {
      defaultProfile: true,
      workers: { select: { id: true, firstName: true, lastName: true, universalId: true } },
    },
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// MUTATIONS
// ─────────────────────────────────────────────────────────────────────────────

export async function createJobPosition(
  formData: FormData
): Promise<ActionResult> {
  const rawData = {
    name: formData.get('name'),
    description: formData.get('description') || undefined,
    companyId: formData.get('companyId'),
    defaultProfileId: formData.get('defaultProfileId') || null,
  }

  const parsed = CreateJobPositionSchema.safeParse(rawData)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  try {
    await prisma.jobPosition.create({ data: parsed.data })
    revalidatePath('/companies')
    revalidatePath(`/companies/${parsed.data.companyId}`)
    return { success: true }
  } catch (e: unknown) {
    console.error('[JobPosition] Error creando puesto:', e)
    return { success: false, error: 'Error al crear el puesto de trabajo' }
  }
}

export async function updateJobPosition(
  formData: FormData
): Promise<ActionResult> {
  const rawData = {
    id: formData.get('id'),
    name: formData.get('name') || undefined,
    description: formData.get('description') || undefined,
    companyId: formData.get('companyId') || undefined,
    defaultProfileId: formData.get('defaultProfileId') || null,
  }

  const parsed = UpdateJobPositionSchema.safeParse(rawData)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  const { id, ...data } = parsed.data
  try {
    await prisma.jobPosition.update({ where: { id }, data })
    if (data.companyId) {
      revalidatePath(`/companies/${data.companyId}`)
    }
    revalidatePath('/companies')
    return { success: true }
  } catch (e: unknown) {
    console.error('[JobPosition] Error actualizando puesto:', e)
    return { success: false, error: 'Error al actualizar el puesto de trabajo' }
  }
}

export async function deleteJobPosition(id: string): Promise<ActionResult> {
  const parsed = z.string().uuid('ID inválido').safeParse(id)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  try {
    await prisma.jobPosition.delete({ where: { id: parsed.data } })
    revalidatePath('/companies', 'layout')
    return { success: true }
  } catch (e: unknown) {
    console.error('[JobPosition] Error eliminando puesto:', e)
    return { success: false, error: 'Error al eliminar el puesto de trabajo' }
  }
}
