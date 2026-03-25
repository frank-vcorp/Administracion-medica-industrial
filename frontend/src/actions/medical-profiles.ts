/**
 * @file Server Actions: Perfiles Médicos (Combos B2B)
 * @description CRUD con validación Zod server-side para MedicalProfile y catálogo MedicalTest.
 * @see context/SPECs/ARCH-20260313-01-CATALOGO-ESTUDIOS-PERFILES.md
 * @id ARCH-20260325-01
 * @backup context/checkpoints/CHK_ARCH-20260325-01.md
 */
'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import prisma from '@/lib/prisma'

// ─────────────────────────────────────────────────────────────────────────────
// SCHEMA ZOD
// ─────────────────────────────────────────────────────────────────────────────

const MedicalProfileSchema = z.object({
  name: z
    .string()
    .min(1, 'El nombre del perfil es obligatorio')
    .max(200, 'El nombre no puede exceder 200 caracteres'),
  companyId: z
    .string()
    .uuid('ID de empresa inválido')
    .nullable()
    .optional(),
  testIds: z
    .array(z.string().uuid('ID de prueba inválido'))
    .min(1, 'Debe seleccionar al menos una prueba médica'),
})

const MedicalTestSchema = z.object({
  name: z
    .string()
    .min(1, 'El nombre de la prueba es obligatorio')
    .max(200, 'El nombre no puede exceder 200 caracteres'),
  code: z
    .string()
    .min(1, 'El código de la prueba es obligatorio')
    .max(50, 'El código no puede exceder 50 caracteres'),
  categoryId: z
    .string()
    .uuid('La categoría seleccionada es inválida'),
})

// ─────────────────────────────────────────────────────────────────────────────
// TIPO RESULTADO UNIFICADO
// ─────────────────────────────────────────────────────────────────────────────

type ActionResult<T = undefined> =
  | { success: true; data?: T }
  | { success: false; error: string }

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Parsea el campo JSON de testIds desde FormData (seguro ante malformación)
// ─────────────────────────────────────────────────────────────────────────────

function parseTestIds(formData: FormData): string[] {
  const raw = formData.get('testIds')
  if (typeof raw !== 'string' || !raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is string => typeof item === 'string')
  } catch {
    return []
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// QUERIES
// ─────────────────────────────────────────────────────────────────────────────

export async function getMedicalTests() {
  return await prisma.medicalTest.findMany({
    select: {
      id: true,
      name: true,
      code: true,
      categoryId: true,
      category: { select: { name: true } },
    },
    orderBy: [
      { category: { name: 'asc' } },
      { name: 'asc' },
    ],
  })
}

export async function getTestCategories() {
  return await prisma.testCategory.findMany({
    select: {
      id: true,
      name: true,
    },
    orderBy: { name: 'asc' },
  })
}

export async function getMedicalProfilesForCompany(companyId: string) {
  return await prisma.medicalProfile.findMany({
    where: {
      OR: [
        { companyId },
        { companyId: null },
      ],
    },
    select: { id: true, name: true, companyId: true },
    orderBy: { name: 'asc' },
  })
}

export async function getMedicalProfiles() {
  return await prisma.medicalProfile.findMany({
    include: {
      company: { select: { id: true, name: true } },
      tests: {
        include: {
          test: {
            select: {
              id: true,
              name: true,
              code: true,
              category: { select: { name: true } },
            },
          },
        },
      },
      _count: { select: { tests: true } },
    },
    orderBy: { name: 'asc' },
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// MUTATIONS
// ─────────────────────────────────────────────────────────────────────────────

export async function createMedicalProfile(
  formData: FormData
): Promise<ActionResult> {
  const testIds = parseTestIds(formData)
  const rawCompanyId = formData.get('companyId')

  const parsed = MedicalProfileSchema.safeParse({
    name: formData.get('name'),
    companyId: typeof rawCompanyId === 'string' && rawCompanyId ? rawCompanyId : null,
    testIds,
  })

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  try {
    await prisma.medicalProfile.create({
      data: {
        name: parsed.data.name,
        companyId: parsed.data.companyId ?? null,
        tests: {
          create: parsed.data.testIds.map((testId) => ({ testId })),
        },
      },
    })
    revalidatePath('/admin/profiles')
    return { success: true }
  } catch (e: unknown) {
    console.error('[MedicalProfiles] Error creando perfil:', e)
    return { success: false, error: 'Error al crear el perfil médico' }
  }
}

export async function updateMedicalProfile(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  const testIds = parseTestIds(formData)
  const rawCompanyId = formData.get('companyId')

  const parsed = MedicalProfileSchema.safeParse({
    name: formData.get('name'),
    companyId: typeof rawCompanyId === 'string' && rawCompanyId ? rawCompanyId : null,
    testIds,
  })

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  try {
    // Reemplaza todos los ProfileTest del perfil en una sola operación atómica
    await prisma.medicalProfile.update({
      where: { id },
      data: {
        name: parsed.data.name,
        companyId: parsed.data.companyId ?? null,
        tests: {
          deleteMany: {},
          create: parsed.data.testIds.map((testId) => ({ testId })),
        },
      },
    })
    revalidatePath('/admin/profiles')
    return { success: true }
  } catch (e: unknown) {
    console.error('[MedicalProfiles] Error actualizando perfil:', e)
    return { success: false, error: 'Error al actualizar el perfil médico' }
  }
}

export async function deleteMedicalProfile(id: string): Promise<ActionResult> {
  try {
    // Elimina pivot rows primero (sin cascade en schema)
    await prisma.$transaction([
      prisma.profileTest.deleteMany({ where: { profileId: id } }),
      prisma.medicalProfile.delete({ where: { id } }),
    ])
    revalidatePath('/admin/profiles')
    return { success: true }
  } catch (e: unknown) {
    console.error('[MedicalProfiles] Error eliminando perfil:', e)
    return { success: false, error: 'Error al eliminar el perfil médico' }
  }
}

export async function createMedicalTest(
  formData: FormData
): Promise<ActionResult> {
  const parsed = MedicalTestSchema.safeParse({
    name: formData.get('name'),
    code: formData.get('code'),
    categoryId: formData.get('categoryId'),
  })

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  try {
    await prisma.medicalTest.create({
      data: {
        name: parsed.data.name,
        code: parsed.data.code.trim().toUpperCase(),
        categoryId: parsed.data.categoryId,
      },
    })
    revalidatePath('/admin/services')
    revalidatePath('/admin/profiles')
    return { success: true }
  } catch (e: unknown) {
    console.error('[MedicalProfiles] Error creando prueba médica:', e)
    return { success: false, error: 'Error al crear la prueba médica' }
  }
}
