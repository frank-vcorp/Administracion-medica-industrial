"use server"

import prisma from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { 
  SomatometriaVitalesSchema, 
  AgudezaVisualSchema, 
  ExploracionFisicaSchema 
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
