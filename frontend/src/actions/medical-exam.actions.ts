'use server'

import prisma from "@/lib/prisma"
import { revalidatePath } from "next/cache"

interface MedicalExamData {
  somatometryData?: Record<string, unknown>
  vitalSignsData?: Record<string, unknown>
  eyeAcuityData?: Record<string, unknown>
  physicalExamData?: Record<string, unknown>
  notes?: string
  weight?: number
  height?: number
  bloodPressure?: string
  heartRate?: number
}

/**
 * IMPL-20260305-01: Obtener el examen médico de un evento
 */
export async function getMedicalExam(eventId: string) {
  try {
    if (!eventId) {
      return { success: false, error: 'ID del evento es obligatorio' }
    }

    const medicalExam = await prisma.medicalExam.findUnique({
      where: { eventId }
    })

    if (!medicalExam) {
      return { success: true, data: null, message: 'Sin examen médico previo' }
    }

    return {
      success: true,
      data: {
        id: medicalExam.id,
        eventId: medicalExam.eventId,
        somatometryData: medicalExam.somatometryData || {},
        vitalSignsData: medicalExam.vitalSignsData || {},
        eyeAcuityData: medicalExam.eyeAcuityData || {},
        physicalExamData: medicalExam.physicalExamData || {},
        weight: medicalExam.weight,
        height: medicalExam.height,
        bloodPressure: medicalExam.bloodPressure,
        heartRate: medicalExam.heartRate,
        notes: medicalExam.notes,
        createdAt: medicalExam.createdAt,
        updatedAt: medicalExam.updatedAt
      }
    }
  } catch (error) {
    console.error('Error fetching medical exam:', error)
    return { success: false, error: 'Error al obtener examen médico' }
  }
}

/**
 * IMPL-20260305-01: Crear o actualizar examen médico (partial updates)
 */
export async function upsertMedicalExam(
  eventId: string,
  data: MedicalExamData
) {
  try {
    if (!eventId) {
      return { success: false, error: 'ID del evento es obligatorio' }
    }

    // Verificar evento
    const event = await prisma.medicalEvent.findUnique({
      where: { id: eventId }
    })

    if (!event) {
      return { success: false, error: 'Evento médico no encontrado' }
    }

    // Obtener examen actual para merges
    const currentExam = await prisma.medicalExam.findUnique({
      where: { eventId }
    })

    // Preparar payload con merges si es necesario
    const payloadData: any = {}
    
    if (data.somatometryData) {
      payloadData.somatometryData = currentExam?.somatometryData 
        ? { ...(currentExam.somatometryData as Record<string, unknown>), ...data.somatometryData }
        : data.somatometryData
    }
    if (data.vitalSignsData) {
      payloadData.vitalSignsData = currentExam?.vitalSignsData 
        ? { ...(currentExam.vitalSignsData as Record<string, unknown>), ...data.vitalSignsData }
        : data.vitalSignsData
    }
    if (data.eyeAcuityData) {
      payloadData.eyeAcuityData = currentExam?.eyeAcuityData 
        ? { ...(currentExam.eyeAcuityData as Record<string, unknown>), ...data.eyeAcuityData }
        : data.eyeAcuityData
    }
    if (data.physicalExamData) {
      payloadData.physicalExamData = currentExam?.physicalExamData 
        ? { ...(currentExam.physicalExamData as Record<string, unknown>), ...data.physicalExamData }
        : data.physicalExamData
    }

    if (data.notes !== undefined) payloadData.notes = data.notes
    if (data.weight !== undefined) payloadData.weight = data.weight
    if (data.height !== undefined) payloadData.height = data.height
    if (data.bloodPressure !== undefined) payloadData.bloodPressure = data.bloodPressure
    if (data.heartRate !== undefined) payloadData.heartRate = data.heartRate

    // Upsert
    const medicalExam = await prisma.medicalExam.upsert({
      where: { eventId },
      create: {
        eventId,
        somatometryData: payloadData.somatometryData || {},
        vitalSignsData: payloadData.vitalSignsData || {},
        eyeAcuityData: payloadData.eyeAcuityData || {},
        physicalExamData: payloadData.physicalExamData || {}
      } as any,
      update: payloadData
    })

    revalidatePath(`/app/events/${eventId}`)
    revalidatePath(`/events/${eventId}`)

    return {
      success: true,
      data: {
        id: medicalExam.id,
        eventId: medicalExam.eventId,
        somatometryData: medicalExam.somatometryData || {},
        vitalSignsData: medicalExam.vitalSignsData || {},
        eyeAcuityData: medicalExam.eyeAcuityData || {},
        physicalExamData: medicalExam.physicalExamData || {},
        weight: medicalExam.weight,
        height: medicalExam.height,
        bloodPressure: medicalExam.bloodPressure,
        heartRate: medicalExam.heartRate,
        notes: medicalExam.notes,
        createdAt: medicalExam.createdAt,
        updatedAt: medicalExam.updatedAt
      }
    }
  } catch (error) {
    console.error('Error upserting medical exam:', error)
    return { success: false, error: 'Error al guardar examen médico' }
  }
}

export function calculateBMIData(weightKg: number, heightM: number) {
  if (!weightKg || !heightM || heightM <= 0) {
    return { imc: null, complexion: null }
  }

  const imc = weightKg / (heightM * heightM)
  let complexion = 'NORMAL'
  
  if (imc < 18.5) complexion = 'BAJO PESO'
  else if (imc < 25) complexion = 'NORMAL'
  else if (imc < 30) complexion = 'SOBREPESO'
  else if (imc < 40) complexion = 'OBESIDAD'
  else complexion = 'OBESIDAD SEVERA'

  return { imc: Math.round(imc * 10) / 10, complexion }
}
