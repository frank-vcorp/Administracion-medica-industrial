"use server"

import prisma from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { 
  SomatometriaVitalesSchema, 
  AgudezaVisualSchema, 
  ExploracionFisicaSchema,
  ExamenMedicoCompletoSchema,
} from "@/schemas/clinical/exam.schema"

export async function getMedicalExam(eventId: string) {
  try {
    const exam = await prisma.medicalExam.findUnique({
      where: { eventId }
    })
    return { success: true, data: exam }
  } catch (error) {
    console.error("Error fetching medical exam:", error)
    return { success: false, error: "Error al obtener examen médico" }
  }
}

export async function updateSomatometria(eventId: string, rawData: any) {
  try {
    const data = SomatometriaVitalesSchema.parse(rawData)
    
    await prisma.medicalExam.upsert({
      where: { eventId },
      update: { somatometryData: data },
      create: { eventId, somatometryData: data }
    })
    
    await prisma.medicalEvent.update({
      where: { id: eventId },
      data: { status: 'IN_PROGRESS' }
    })
    
    revalidatePath(`/events/${eventId}`)
    return { success: true }
  } catch (error: any) {
    console.error("Error updating somatometry:", error)
    return { success: false, error: "Datos de somatometría inválidos o error de servidor" }
  }
}

export async function updateAgudezaVisual(eventId: string, rawData: any) {
  try {
    const data = AgudezaVisualSchema.parse(rawData)
    
    await prisma.medicalExam.upsert({
      where: { eventId },
      update: { eyeAcuityData: data },
      create: { eventId, eyeAcuityData: data }
    })
    
    revalidatePath(`/events/${eventId}`)
    return { success: true }
  } catch (error: any) {
    console.error("Error updating visual acuity:", error)
    return { success: false, error: "Datos de agudeza visual inválidos o error de servidor" }
  }
}

export async function updateExploracionFisica(eventId: string, rawData: any) {
  try {
    const data = ExploracionFisicaSchema.parse(rawData)
    
    await prisma.medicalExam.upsert({
      where: { eventId },
      update: { physicalExamData: data },
      create: { eventId, physicalExamData: data }
    })
    
    // Si queremos marcarlo completado despues de la exploración. 
    // Por ahora solo guardamos. Se marca completado en otra accion final.
    
    revalidatePath(`/events/${eventId}`)
    return { success: true }
  } catch (error: any) {
    console.error("Error updating physical exam:", error)
    return { success: false, error: "Datos de exploración inválidos o error de servidor" }
  }
}

/**
 * Guarda el Módulo 2 (médico) del Examen Médico dentro de la papeleta.
 * Persiste en physicalExamData (exploración + impresión + antecedentes médico).
 * Actualiza el estado del EventTest según el parámetro markComplete.
 * @id IMPL-20260325-01
 */
export async function saveExamenMedicoPapeleta(
  eventId: string,
  eventTestId: string,
  rawData: unknown,
  markComplete = false
) {
  if (!eventId || !eventTestId) {
    return { success: false, error: 'Parámetros incompletos' }
  }

  try {
    const data = ExamenMedicoCompletoSchema.parse(rawData)

    await prisma.medicalExam.upsert({
      where: { eventId },
      update: { physicalExamData: data },
      create: { eventId, physicalExamData: data },
    })

    const newStatus = markComplete ? 'COMPLETED' : 'RESULT_REGISTERED'
    await prisma.eventTest.update({
      where: { id: eventTestId },
      data: { status: newStatus },
    })

    revalidatePath(`/events/${eventId}`)
    return { success: true, status: newStatus }
  } catch (error: any) {
    console.error("Error saving examen médico papeleta:", error)
    return { success: false, error: "Error al guardar Examen Médico" }
  }
}
