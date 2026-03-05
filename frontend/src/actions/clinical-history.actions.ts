'use server'

import prisma from "@/lib/prisma"
import { ClinicalHistoryDataSchema } from "@/schemas/clinical/history.schema"
import { revalidatePath } from "next/cache"
import { z } from "zod"

/**
 * IMPL-20260305-01: Obtiene el historial clínico de un trabajador
 * @param workerId - ID del trabajador
 * @returns Objeto con el historial clínico o null si no existe
 */
export async function getWorkerClinicalHistory(workerId: string) {
  try {
    if (!workerId) {
      return { success: false, error: 'ID del trabajador es obligatorio' }
    }

    const clinicalHistory = await prisma.clinicalHistory.findUnique({
      where: { workerId },
      include: {
        worker: {
          select: { id: true, firstName: true, lastName: true, universalId: true }
        }
      }
    })

    if (!clinicalHistory) {
      return { success: true, data: null, message: 'Sin historial previo' }
    }

    return {
      success: true,
      data: {
        id: clinicalHistory.id,
        workerId: clinicalHistory.workerId,
        worker: clinicalHistory.worker,
        data: clinicalHistory.data as Record<string, any>,
        lastUpdated: clinicalHistory.lastUpdated,
        updatedAt: clinicalHistory.updatedAt
      }
    }
  } catch (error) {
    console.error('Error fetching clinical history:', error)
    return { success: false, error: 'Error al obtener historial clínico' }
  }
}

/**
 * IMPL-20260305-01: Crea o actualiza el historial clínico de un trabajador
 * @param workerId - ID del trabajador
 * @param data - Datos del historial clínico (validados con Zod)
 * @returns Objeto con el historial creado/actualizado o error
 */
export async function upsertWorkerClinicalHistory(
  workerId: string,
  data: any
) {
  try {
    if (!workerId) {
      return { success: false, error: 'ID del trabajador es obligatorio' }
    }

    // Validar que el trabajador existe
    const worker = await prisma.worker.findUnique({
      where: { id: workerId }
    })

    if (!worker) {
      return { success: false, error: 'Trabajador no encontrado' }
    }

    // Validar data con esquema Zod
    const validatedData = ClinicalHistoryDataSchema.parse(data)

    // Upsert: Crear si no existe, actualizar si existe
    const clinicalHistory = await prisma.clinicalHistory.upsert({
      where: { workerId },
      create: {
        workerId,
        data: validatedData,
        lastUpdated: new Date()
      },
      update: {
        data: validatedData,
        lastUpdated: new Date()
      },
      include: {
        worker: {
          select: { id: true, firstName: true, lastName: true, universalId: true }
        }
      }
    })

    revalidatePath(`/history/${workerId}`)
    revalidatePath(`/workers/${workerId}`)

    return {
      success: true,
      data: {
        id: clinicalHistory.id,
        workerId: clinicalHistory.workerId,
        worker: clinicalHistory.worker,
        data: clinicalHistory.data,
        message: 'Historial clínico guardado exitosamente'
      }
    }
  } catch (error) {
    console.error('Error upserting clinical history:', error)

    if (error instanceof z.ZodError) {
      const messages = Object.values(error.flatten().fieldErrors)
        .flat()
        .join(', ')
      return {
        success: false,
        error: `Validación fallida: ${messages || 'Datos inválidos'}`
      }
    }

    return { success: false, error: 'Error al guardar historial clínico' }
  }
}
