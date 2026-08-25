'use server'

/**
 * @fileoverview Acciones de servidor para el perfil médico (cédula/firma).
 * @id IMPL-FEATURE-20260825-01
 * @backup context/SPECs/SPEC-FEATURE-20260825-01-PDF-ESPIROMETRIA-VALIDADA.md
 *
 * Permisos (corregidos en QA-20260825-01 P3-H):
 *  - Las acciones operan SIEMPRE sobre el usuario en sesión (`session.user.id`).
 *    No exponen una variante para que un SUPERADMIN edite a OTRO médico.
 *  - SUPERADMIN / DOCTOR_GENERAL / DOCTOR_VALIDATOR pueden editar SU PROPIO
 *    perfil (fullName + professionalLicense + signatureImageUrl).
 *  - Otros roles NO pueden editar el perfil médico.
 *
 * Privacidad:
 *  - La firma autógrafa NO se expone públicamente: el endpoint de
 *    descarga del PDF (api/pdf/espirometry) valida scope por objeto
 *    (P2-C) y la UI de la papeleta no la muestra. Sólo el server action
 *    `submitDoctorStudyReview` lee la firma del médico EN SESIÓN para
 *    congelarla en `DoctorStudyReview.validatorSnapshotSignatureUrl`.
 */
import prisma from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import { revalidatePath } from 'next/cache'
import { doctorProfileSchema } from '@/schemas/clinical/doctor-profile.schema'

export interface DoctorProfileResult {
  fullName: string
  email: string
  professionalLicense: string | null
  /** Data-URL o URL. Se devuelve sólo al propio médico o a SUPERADMIN. */
  signatureImageUrl: string | null
  role: string
}

export async function getCurrentDoctorProfile(): Promise<
  | { success: true; profile: DoctorProfileResult }
  | { success: false; error: string }
> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return { success: false, error: 'No autenticado' }
  }
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      fullName: true,
      email: true,
      role: true,
      professionalLicense: true,
      signatureImageUrl: true,
    },
  })
  if (!user) {
    return { success: false, error: 'Usuario no encontrado' }
  }
  return {
    success: true,
    profile: {
      fullName: user.fullName,
      email: user.email,
      professionalLicense: user.professionalLicense ?? null,
      signatureImageUrl: user.signatureImageUrl ?? null,
      role: user.role,
    },
  }
}

/**
 * Actualiza el perfil médico del usuario en sesión. Acepta los tres campos
 * (fullName, professionalLicense, signatureImageUrl); el campo signature
 * puede omitirse y conservar el valor actual si se envía string vacío.
 *
 * Devuelve la versión actualizada del perfil.
 */
export async function updateCurrentDoctorProfile(input: {
  fullName: string
  professionalLicense?: string
  signatureImageUrl?: string
}): Promise<{ success: true; profile: DoctorProfileResult } | { success: false; error: string }> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return { success: false, error: 'No autenticado' }
  }

  // Permisos: SUPERADMIN o DOCTOR_* editan su propio perfil. (Esta acción
  // sólo edita el perfil del usuario en sesión por diseño.)
  const role = session.user.role
  const allowed =
    role === 'SUPERADMIN' ||
    role === 'DOCTOR_GENERAL' ||
    role === 'DOCTOR_VALIDATOR'
  if (!allowed) {
    return { success: false, error: 'Sin permisos para editar perfil médico' }
  }

  const parsed = doctorProfileSchema.safeParse({
    fullName: input.fullName,
    professionalLicense: input.professionalLicense ?? '',
    signatureImageUrl: input.signatureImageUrl ?? '',
  })
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Datos de perfil inválidos',
    }
  }

  // Si signatureImageUrl viene vacío, conservamos el valor actual
  // (la firma es opcional; no la borramos por accidente al editar otros campos).
  const data: {
    fullName: string
    professionalLicense: string | null
    signatureImageUrl?: string | null
  } = {
    fullName: parsed.data.fullName,
    professionalLicense: parsed.data.professionalLicense?.trim()
      ? parsed.data.professionalLicense
      : null,
  }
  if (parsed.data.signatureImageUrl && parsed.data.signatureImageUrl.trim().length > 0) {
    data.signatureImageUrl = parsed.data.signatureImageUrl
  }

  const updated = await prisma.user.update({
    where: { id: session.user.id },
    data,
    select: {
      fullName: true,
      email: true,
      role: true,
      professionalLicense: true,
      signatureImageUrl: true,
    },
  })

  revalidatePath('/profile')
  revalidatePath('/admin/users')

  return {
    success: true,
    profile: {
      fullName: updated.fullName,
      email: updated.email,
      professionalLicense: updated.professionalLicense ?? null,
      signatureImageUrl: updated.signatureImageUrl ?? null,
      role: updated.role,
    },
  }
}
