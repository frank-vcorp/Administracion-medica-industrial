/**
 * @file Server Actions: Perfiles Médicos (Combos B2B) + Calibración IA por Prueba
 * @description CRUD con validación Zod server-side para MedicalProfile y catálogo MedicalTest.
 * @see context/SPECs/ARCH-20260313-01-CATALOGO-ESTUDIOS-PERFILES.md
 * @id ARCH-20260325-01
 * @backup context/checkpoints/CHK_ARCH-20260325-01.md
 * @id ARCH-20260327-15 (extensión calibración IA)
 * @backup context/SPECs/SPEC_ARCH-20260327-15-PLATAFORMA-CALIBRACION-IA.md
 * @intervention ARCH-20260327-17
 * @see context/checkpoints/CHK_ARCH-20260327-17-FIX-PRISMA-JSON-CALIBRATION.md
 * @intervention IMPL-20260327-19
 * @see context/SPECs/SPEC_ARCH-20260327-19-CALIBRACION-IA-ASISTIDA-VERSIONADO-AUTOMATICO.md
 * @intervention IMPL-20260527-01
 * @backup context/SPECs/SPEC_ARCH-20260527-04-PERFILES-MEDICOS-EN-EMPRESA-Y-ASIGNACION-A-PUESTOS.md
 * @see context/SPECs/SPEC_ARCH-20260527-04-PERFILES-MEDICOS-EN-EMPRESA-Y-ASIGNACION-A-PUESTOS.md
 */
'use server'

import { revalidatePath } from 'next/cache'
import { Prisma } from '@prisma/client'
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

function toPrismaJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}

function revalidateCompanyProfilePath(companyId: string | null | undefined) {
  if (!companyId) {
    return
  }

  revalidatePath(`/companies/${companyId}`)
}

// ─────────────────────────────────────────────────────────────────────────────
// QUERIES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Códigos de pruebas legacy excluidas del catálogo seleccionable.
 * No se borran de la DB — solo se ocultan de la UI.
 * @see SPEC_ARCH-20260518-16-DEPURACION-CATALOGO-PRUEBAS-LEGACY
 * @id IMPL-20260518-16
 */
const CATALOG_LEGACY_HIDDEN = ['GEN-01', 'GEN-02'] as const

export async function getMedicalTests() {
  return await prisma.medicalTest.findMany({
    where: {
      code: { notIn: [...CATALOG_LEGACY_HIDDEN] },
    },
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
    select: {
      id: true,
      name: true,
      companyId: true,
      tests: {
        select: {
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
    },
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
    revalidateCompanyProfilePath(parsed.data.companyId)
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
  const previousProfile = await prisma.medicalProfile.findUnique({
    where: { id },
    select: { companyId: true },
  })

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
    revalidateCompanyProfilePath(previousProfile?.companyId)
    revalidateCompanyProfilePath(parsed.data.companyId)
    return { success: true }
  } catch (e: unknown) {
    console.error('[MedicalProfiles] Error actualizando perfil:', e)
    return { success: false, error: 'Error al actualizar el perfil médico' }
  }
}

export async function deleteMedicalProfile(id: string): Promise<ActionResult> {
  try {
    const profile = await prisma.medicalProfile.findUnique({
      where: { id },
      select: { companyId: true },
    })

    // Elimina pivot rows primero (sin cascade en schema)
    await prisma.$transaction([
      prisma.profileTest.deleteMany({ where: { profileId: id } }),
      prisma.medicalProfile.delete({ where: { id } }),
    ])
    revalidatePath('/admin/profiles')
    revalidateCompanyProfilePath(profile?.companyId)
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

// ─────────────────────────────────────────────────────────────────────────────
// CALIBRACIÓN IA — ARCH-20260327-15
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Recupera una prueba médica individual con su campo options (aiCalibration).
 * @id ARCH-20260327-15
 */
export async function getMedicalTestById(id: string) {
  return await prisma.medicalTest.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      code: true,
      options: true,
      categoryId: true,
      category: { select: { name: true } },
    },
  })
}

/**
 * Recupera snapshots de extracción y prediagnóstico asociados a una prueba
 * mediante la cadena MedicalTest → EventTest → StudyExtractionSnapshot → AIPrediagnosisSnapshot → DoctorStudyReview.
 * @id ARCH-20260327-15
 */
export async function getCalibrationSnapshots(testId: string) {
  return await prisma.eventTest.findMany({
    where: { testId },
    select: {
      id: true,
      status: true,
      fileUrl: true,
      resultNotes: true,
      createdAt: true,
      extractionSnapshots: {
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          version: true,
          studyType: true,
          sourceFileName: true,
          sourceFileUrl: true,
          structuredData: true,
          clinicalState: true,
          modelName: true,
          promptVersion: true,
          isSuperseded: true,
          createdAt: true,
          aiPrediagnoses: {
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              version: true,
              prediagnosisData: true,
              clinicalState: true,
              modelName: true,
              promptVersion: true,
              isSuperseded: true,
              createdAt: true,
              doctorReviews: {
                orderBy: { createdAt: 'desc' },
                take: 1,
                select: {
                  id: true,
                  doctorStatus: true,
                  doctorDiagnosis: true,
                  doctorNotes: true,
                  aiAgreementScore: true,
                  aiUsefulnessScore: true,
                  differenceType: true,
                  errorSeverity: true,
                  errorCategory: true,
                  doctorFeedbackNote: true,
                  createdAt: true,
                },
              },
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })
}

/**
 * Persiste la configuración aiCalibration dentro de MedicalTest.options (JSON merge).
 * No rompe otros campos existentes en options.
 * @id ARCH-20260327-15
 */
export async function saveAICalibration(
  testId: string,
  calibrationData: Record<string, unknown>
): Promise<ActionResult> {
  const test = await prisma.medicalTest.findUnique({
    where: { id: testId },
    select: { id: true, options: true },
  })
  if (!test) return { success: false, error: 'Prueba no encontrada' }

  const currentOptions =
    typeof test.options === 'object' &&
    test.options !== null &&
    !Array.isArray(test.options)
      ? (test.options as Record<string, unknown>)
      : {}

  const newOptions = toPrismaJsonValue({
    ...currentOptions,
    aiCalibration: calibrationData,
  })

  try {
    await prisma.medicalTest.update({
      where: { id: testId },
      data: { options: newOptions },
    })
    revalidatePath(`/admin/services/${testId}/calibration`)
    revalidatePath('/admin/services')
    return { success: true }
  } catch (e: unknown) {
    console.error('[Calibration] Error guardando calibración IA:', e)
    return { success: false, error: 'Error al guardar la configuración de calibración' }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// V2: Guardado con versionado automático — IMPL-20260327-19
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Persiste la configuración aiCalibration V2 con versionado automático.
 * Si `fieldDefinitions` cambia respecto al contrato vigente, se genera
 * una nueva versión de calibración sin que el usuario capture el número.
 * Preserva compatibilidad con todos los campos V1 existentes.
 * @id IMPL-20260327-19
 * @backup context/SPECs/SPEC_ARCH-20260327-19-CALIBRACION-IA-ASISTIDA-VERSIONADO-AUTOMATICO.md
 */
export async function saveAICalibrationV2(
  testId: string,
  payload: {
    fieldDefinitions: Array<{
      key: string
      label: string
      type: string
      aliases: string[]
      required: boolean
      unit?: string
    }>
    source: 'manual-review' | 'ai-assisted-review' | 'candidate-promotion'
    summary?: string
    /** Campos V1 a preservar (enabled, canonicalStudyType, extraction, diagnosis) */
    legacyFields?: Record<string, unknown>
  }
): Promise<ActionResult> {
  const test = await prisma.medicalTest.findUnique({
    where: { id: testId },
    select: { id: true, options: true },
  })
  if (!test) return { success: false, error: 'Prueba no encontrada' }

  const currentOptions =
    typeof test.options === 'object' &&
    test.options !== null &&
    !Array.isArray(test.options)
      ? (test.options as Record<string, unknown>)
      : {}

  const existingCalib =
    typeof currentOptions.aiCalibration === 'object' &&
    currentOptions.aiCalibration !== null
      ? (currentOptions.aiCalibration as Record<string, unknown>)
      : {}

  // Auto-versionado: comparar fieldDefinitions actual vs. nuevo
  const currentVersion =
    typeof existingCalib.currentVersion === 'number' ? existingCalib.currentVersion : 0
  const existingFieldDefs = Array.isArray(existingCalib.fieldDefinitions)
    ? existingCalib.fieldDefinitions
    : []
  const existingVersions = Array.isArray(existingCalib.versions)
    ? existingCalib.versions
    : []

  const hasChanged =
    JSON.stringify(existingFieldDefs) !== JSON.stringify(payload.fieldDefinitions)

  const nextVersion = hasChanged || currentVersion === 0 ? currentVersion + 1 : currentVersion
  const now = new Date().toISOString()

  const newVersionEntry =
    hasChanged || currentVersion === 0
      ? {
          version: nextVersion,
          label: `calib-v${nextVersion}`,
          createdAt: now,
          source: payload.source,
          summary:
            payload.summary ??
            `Actualización con ${payload.fieldDefinitions.length} campo(s) — ${payload.source}`,
        }
      : null

  // Mantener historial de las últimas 20 versiones
  const versions = newVersionEntry
    ? [...existingVersions, newVersionEntry].slice(-20)
    : existingVersions

  const updatedCalib = {
    // Preservar campos V1 existentes
    ...existingCalib,
    ...(payload.legacyFields ?? {}),
    // Campos V2
    currentVersion: nextVersion,
    currentVersionLabel: `calib-v${nextVersion}`,
    updatedAt: now,
    versions,
    fieldDefinitions: payload.fieldDefinitions,
    aiAssistance: {
      ...((typeof existingCalib.aiAssistance === 'object' && existingCalib.aiAssistance !== null
        ? existingCalib.aiAssistance
        : {}) as Record<string, unknown>),
      lastSuggestedAt: now,
      lastSuggestionSummary: payload.summary ?? '',
    },
  }

  const newOptions = toPrismaJsonValue({
    ...currentOptions,
    aiCalibration: updatedCalib,
  })

  try {
    await prisma.medicalTest.update({
      where: { id: testId },
      data: { options: newOptions },
    })
    revalidatePath(`/admin/services/${testId}/calibration`)
    revalidatePath('/admin/services')
    return { success: true }
  } catch (e: unknown) {
    console.error('[Calibration V2] Error guardando calibración IA V2:', e)
    return { success: false, error: 'Error al guardar la configuración de calibración (V2)' }
  }
}
