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
 * @intervention IMPL-20260604-01
 * @backup context/SPECs/SPEC_ARCH-20260604-01-CALIBRACION-PRESENTACION-ESTUDIOS-IA.md
 */
'use server'

import { revalidatePath } from 'next/cache'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import prisma from '@/lib/prisma'
import {
  buildPbProfileNameFromTests,
  ensurePbProfileName,
} from '@/lib/public-general-profile-name'

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
  // ARCH-20260708-01: Comentarios especiales (firma autógrafa, cédula, pruebas excluidas)
  specialNotes: z.string().max(2000).nullable().optional(),
})

// ARCH-20260708-01: Schema Zod para correos configurados por perfil médico
const ReportEmailSchema = z.object({
  email: z.string().email('Formato de correo inválido'),
  label: z.string().max(100).nullable().optional(),
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

/** Opciones ligeras para selects de alta/edición de paciente. */
export async function getMedicalProfileOptions() {
  return await prisma.medicalProfile.findMany({
    select: { id: true, name: true, companyId: true },
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
      // ARCH-20260708-01: incluir correos y notas para mostrar en panel de empresa
      specialNotes: true,
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
      reportEmails: {
        select: { id: true, email: true, label: true },
        orderBy: { createdAt: 'asc' },
      },
    },
    orderBy: { name: 'asc' },
  })
}

export async function getMedicalProfiles() {
  return await prisma.medicalProfile.findMany({
    select: {
      id: true,
      name: true,
      companyId: true,
      // ARCH-20260708-01: incluir correos y notas para mostrar en la grilla
      specialNotes: true,
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
      reportEmails: {
        select: { id: true, email: true, label: true },
        orderBy: { createdAt: 'asc' },
      },
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
  const rawSpecialNotes = formData.get('specialNotes')

  const parsed = MedicalProfileSchema.safeParse({
    name: formData.get('name'),
    companyId: typeof rawCompanyId === 'string' && rawCompanyId ? rawCompanyId : null,
    testIds,
    specialNotes: typeof rawSpecialNotes === 'string' && rawSpecialNotes ? rawSpecialNotes : null,
  })

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  try {
    await prisma.medicalProfile.create({
      data: {
        name: parsed.data.name,
        companyId: parsed.data.companyId ?? null,
        specialNotes: parsed.data.specialNotes ?? null,
        tests: {
          create: parsed.data.testIds.map((testId) => ({ testId })),
        },
      },
    })
    revalidatePath('/admin/profiles')
    revalidateCompanyProfilePath(parsed.data.companyId)
    revalidatePath('/publico-general')
    return { success: true }
  } catch (e: unknown) {
    console.error('[MedicalProfiles] Error creando perfil:', e)
    return { success: false, error: 'Error al crear el perfil médico' }
  }
}

const QuickPublicProfileSchema = z.object({
  companyId: z.string().uuid('Empresa inválida'),
  testIds: z.array(z.string().uuid()).min(1, 'Selecciona al menos una prueba'),
  name: z.string().max(200).optional().nullable(),
})

async function resolveUniquePbProfileName(
  companyId: string,
  baseName: string
): Promise<string> {
  let candidate = baseName
  let n = 2
  while (
    await prisma.medicalProfile.findFirst({
      where: { companyId, name: candidate },
      select: { id: true },
    })
  ) {
    candidate = `${baseName} (${n})`
    n += 1
  }
  return candidate
}

/** Perfil rápido en mostrador: prefijo PB + nombre auto por abreviaturas de pruebas. */
export async function createPublicGeneralQuickProfile(input: {
  companyId: string
  testIds: string[]
  name?: string | null
}): Promise<ActionResult<{ id: string; name: string }>> {
  const parsed = QuickPublicProfileSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  const tests = await prisma.medicalTest.findMany({
    where: { id: { in: parsed.data.testIds } },
    select: { id: true, code: true, name: true },
  })

  if (tests.length !== parsed.data.testIds.length) {
    return { success: false, error: 'Una o más pruebas seleccionadas no existen' }
  }

  const autoName = buildPbProfileNameFromTests(tests)
  const rawName = ensurePbProfileName(parsed.data.name, autoName)
  const finalName = await resolveUniquePbProfileName(parsed.data.companyId, rawName)

  try {
    const profile = await prisma.medicalProfile.create({
      data: {
        name: finalName,
        companyId: parsed.data.companyId,
        tests: {
          create: parsed.data.testIds.map((testId) => ({ testId })),
        },
      },
      select: { id: true, name: true },
    })

    revalidatePath('/admin/profiles')
    revalidatePath('/publico-general')
    revalidateCompanyProfilePath(parsed.data.companyId)

    return { success: true, data: profile }
  } catch (e: unknown) {
    console.error('[MedicalProfiles] Error creando perfil rápido PB:', e)
    return { success: false, error: 'Error al crear el perfil rápido' }
  }
}

export async function updateMedicalProfile(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  const testIds = parseTestIds(formData)
  const rawCompanyId = formData.get('companyId')
  const rawSpecialNotes = formData.get('specialNotes')
  const previousProfile = await prisma.medicalProfile.findUnique({
    where: { id },
    select: { companyId: true },
  })

  const parsed = MedicalProfileSchema.safeParse({
    name: formData.get('name'),
    companyId: typeof rawCompanyId === 'string' && rawCompanyId ? rawCompanyId : null,
    testIds,
    specialNotes: typeof rawSpecialNotes === 'string' ? rawSpecialNotes : null,
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
        specialNotes: parsed.data.specialNotes ?? null,
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

// ─────────────────────────────────────────────────────────────────────────────
// ARCH-20260708-01: Correos de envío, comentarios especiales y clonación
// Ref: context/SPECs/SPEC_ARCH-20260708-01-PERFILES-PACIENTE-CORREOS-CLONACION.md
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Recupera un perfil médico con sus correos configurados y notas especiales.
 */
export async function getMedicalProfileWithEmails(profileId: string) {
  return await prisma.medicalProfile.findUnique({
    where: { id: profileId },
    include: {
      reportEmails: {
        select: { id: true, email: true, label: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      },
      tests: {
        select: {
          test: { select: { id: true, name: true, code: true } },
        },
      },
    },
  })
}

/**
 * Agrega un correo configurado al perfil médico.
 */
export async function addProfileReportEmail(
  profileId: string,
  payload: { email: string; label?: string | null }
): Promise<ActionResult<{ id: string }>> {
  const parsed = ReportEmailSchema.safeParse(payload)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  try {
    const profile = await prisma.medicalProfile.findUnique({
      where: { id: profileId },
      select: { companyId: true },
    })
    if (!profile) {
      return { success: false, error: 'Perfil médico no encontrado' }
    }

    const created = await prisma.medicalProfileReportEmail.create({
      data: {
        profileId,
        email: parsed.data.email.toLowerCase().trim(),
        label: parsed.data.label ?? null,
      },
      select: { id: true },
    })

    revalidatePath('/admin/profiles')
    revalidateCompanyProfilePath(profile.companyId)
    return { success: true, data: { id: created.id } }
  } catch (e: unknown) {
    const err = e as { code?: string }
    if (err?.code === 'P2002') {
      return { success: false, error: 'Este correo ya está configurado en el perfil' }
    }
    console.error('[addProfileReportEmail]', e)
    return { success: false, error: 'Error al agregar el correo al perfil' }
  }
}

/**
 * Elimina un correo configurado del perfil médico.
 */
export async function removeProfileReportEmail(
  emailId: string
): Promise<ActionResult> {
  try {
    const row = await prisma.medicalProfileReportEmail.findUnique({
      where: { id: emailId },
      select: { profile: { select: { companyId: true, id: true } } },
    })
    if (!row) {
      return { success: false, error: 'Correo no encontrado' }
    }

    await prisma.medicalProfileReportEmail.delete({ where: { id: emailId } })

    revalidatePath('/admin/profiles')
    revalidatePath(`/admin/profiles/${row.profile.id}`)
    revalidateCompanyProfilePath(row.profile.companyId)
    return { success: true }
  } catch (e: unknown) {
    console.error('[removeProfileReportEmail]', e)
    return { success: false, error: 'Error al eliminar el correo del perfil' }
  }
}

/**
 * Actualiza el campo `specialNotes` de un perfil médico.
 * Longitud máxima: 2000 caracteres (validación Zod enforced).
 */
export async function updateProfileSpecialNotes(
  profileId: string,
  notes: string | null
): Promise<ActionResult> {
  const Schema = z
    .string()
    .max(2000, 'Las notas no pueden exceder 2000 caracteres')
    .nullable()

  const parsed = Schema.safeParse(notes ?? null)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  try {
    const profile = await prisma.medicalProfile.findUnique({
      where: { id: profileId },
      select: { companyId: true },
    })
    if (!profile) {
      return { success: false, error: 'Perfil no encontrado' }
    }

    await prisma.medicalProfile.update({
      where: { id: profileId },
      data: { specialNotes: parsed.data },
    })

    revalidatePath('/admin/profiles')
    revalidatePath(`/admin/profiles/${profileId}`)
    revalidateCompanyProfilePath(profile.companyId)
    return { success: true }
  } catch (e: unknown) {
    console.error('[updateProfileSpecialNotes]', e)
    return { success: false, error: 'Error al actualizar los comentarios del perfil' }
  }
}

/**
 * Clona un perfil médico: copia nombre (con nuevo nombre), pruebas, correos y notas.
 * Todo se ejecuta en una transacción Prisma para garantizar atomicidad.
 */
export async function cloneMedicalProfile(
  profileId: string,
  newName: string
): Promise<ActionResult<{ id: string }>> {
  const NameSchema = z
    .string()
    .min(1, 'El nombre del clon es obligatorio')
    .max(200, 'El nombre no puede exceder 200 caracteres')

  const parsed = NameSchema.safeParse(newName)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  try {
    const source = await prisma.medicalProfile.findUnique({
      where: { id: profileId },
      include: {
        tests: { select: { testId: true } },
        reportEmails: {
          select: { email: true, label: true },
        },
      },
    })

    if (!source) {
      return { success: false, error: 'Perfil de origen no encontrado' }
    }

    // Uniqueness check del nombre para no contaminar
    const duplicate = await prisma.medicalProfile.findFirst({
      where: { name: { equals: parsed.data, mode: 'insensitive' } },
      select: { id: true },
    })
    if (duplicate) {
      return {
        success: false,
        error: `Ya existe un perfil con el nombre "${parsed.data}". Usa un nombre único.`,
      }
    }

    const cloned = await prisma.$transaction(async (tx) => {
      const newProfile = await tx.medicalProfile.create({
        data: {
          name: parsed.data,
          companyId: source.companyId ?? null,
          specialNotes: source.specialNotes ?? null,
          tests: {
            create: source.tests.map(({ testId }) => ({ testId })),
          },
          reportEmails: {
            create: source.reportEmails.map(({ email, label }) => ({
              email,
              label: label ?? null,
            })),
          },
        },
        select: { id: true, companyId: true },
      })
      return newProfile
    })

    revalidatePath('/admin/profiles')
    revalidateCompanyProfilePath(source.companyId)
    return { success: true, data: { id: cloned.id } }
  } catch (e: unknown) {
    console.error('[cloneMedicalProfile]', e)
    return { success: false, error: 'Error al clonar el perfil médico' }
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
 *
 * @deprecated desde ARCH-20260820-01 Fase 2. Usar `saveAICalibrationV3` +
 *   `publishAICalibrationV3` (frontend/src/actions/calibration-v3.actions.ts)
 *   con estados de publicación `draft/tested/published/superseded/disabled`.
 *   Esta función permanece operativa hasta Fase 7 (corte de soporte V1/V2,
 *   decisión pendiente Frank — ADR §7.3). No eliminar.
 *
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
 *
 * @deprecated desde ARCH-20260820-01 Fase 2. Usar `saveAICalibrationV3` +
 *   `publishAICalibrationV3` (frontend/src/actions/calibration-v3.actions.ts)
 *   con estados de publicación `draft/tested/published/superseded/disabled`
 *   y gates G0-G9. Esta función permanece operativa hasta Fase 7 (corte de
 *   soporte V1/V2, decisión pendiente Frank — ADR §7.3). No eliminar.
 *
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
    presentation?: {
      enabled: boolean
      schema: unknown | null
      lastSuggestedAt?: string
      lastSuggestionModel?: string
      lastSuggestionSummary?: string
    }
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
  const existingPresentation =
    typeof existingCalib.presentation === 'object' && existingCalib.presentation !== null
      ? (existingCalib.presentation as Record<string, unknown>)
      : null
  const existingPresentationSchema =
    existingPresentation &&
    typeof existingPresentation.schema === 'object' &&
    existingPresentation.schema !== null
      ? existingPresentation.schema
      : null
  const existingVersions = Array.isArray(existingCalib.versions)
    ? existingCalib.versions
    : []

  const hasFieldDefinitionsChanged =
    JSON.stringify(existingFieldDefs) !== JSON.stringify(payload.fieldDefinitions)
  const hasPresentationSchemaChanged =
    Object.prototype.hasOwnProperty.call(payload, 'presentation') &&
    JSON.stringify(existingPresentationSchema) !== JSON.stringify(payload.presentation?.schema ?? null)
  const hasChanged = hasFieldDefinitionsChanged || hasPresentationSchemaChanged

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
    presentation: payload.presentation ?? existingPresentation,
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
