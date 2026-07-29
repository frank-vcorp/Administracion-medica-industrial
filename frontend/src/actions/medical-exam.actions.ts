"use server"

import prisma from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { triggerStructuredStudyAIPrediagnosis } from "./ai-prediagnosis.actions"
// IMPL-20260507-08: Cronograma operativo persistente (ARCH-20260507-08)
import { writeTimelineEntry } from "@/lib/timeline.service"
import { 
  SomatometriaVitalesSchema, 
  AgudezaVisualSchema, 
  ExploracionFisicaSchema,
  ExamenMedicoCompletoSchema,
} from "@/schemas/clinical/exam.schema"

/**
 * @id ARCH-20260326-01
 * @backup context/checkpoints/CHK_ARCH-20260326-01.md
 */
function buildStructuredAIResultNote(input: { success: boolean; studyLabel: string; summary?: string | null; clinicalState?: string | null; error?: string | null }) {
  if (input.success) {
    const summary = input.summary?.trim()
    return summary
      ? `${input.studyLabel}: IA generada (${input.clinicalState ?? 'AI_PENDING_REVIEW'}): ${summary}`
      : `${input.studyLabel}: IA generada (${input.clinicalState ?? 'AI_PENDING_REVIEW'}).`
  }

  return `${input.studyLabel}: captura guardada, pero la IA no generó prediagnóstico: ${input.error ?? 'sin detalle'}`
}

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

export async function updateSomatometria(eventId: string, rawData: unknown) {
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

    const eventTest = await prisma.eventTest.findFirst({
      where: {
        eventId,
        OR: [
          { testNameSnapshot: { contains: 'somatometr', mode: 'insensitive' } },
          { testNameSnapshot: { contains: 'signos vitales', mode: 'insensitive' } },
        ],
      },
      select: { id: true },
    })

    let aiWarning: string | undefined
    if (eventTest) {
      const aiResult = await triggerStructuredStudyAIPrediagnosis({
        eventTestId: eventTest.id,
        eventId,
        studyType: 'Somatometria',
        extractedData: data as Record<string, unknown>,
      })
      if (!aiResult.success) aiWarning = aiResult.error
      await prisma.eventTest.update({
        where: { id: eventTest.id },
        data: {
          resultNotes: buildStructuredAIResultNote({
            success: aiResult.success,
            studyLabel: 'Somatometría',
            summary: aiResult.summary ?? null,
            clinicalState: aiResult.clinicalState ?? null,
            error: aiResult.error ?? null,
          }),
        },
      })
    }
    
    revalidatePath(`/events/${eventId}`)
    return { success: true, aiWarning }
  } catch (error: unknown) {
    console.error("Error updating somatometry:", error)
    return { success: false, error: "Datos de somatometría inválidos o error de servidor" }
  }
}

export async function updateAgudezaVisual(eventId: string, rawData: unknown) {
  try {
    const data = AgudezaVisualSchema.parse(rawData)
    
    await prisma.medicalExam.upsert({
      where: { eventId },
      update: { eyeAcuityData: data },
      create: { eventId, eyeAcuityData: data }
    })

    const eventTest = await prisma.eventTest.findFirst({
      where: {
        eventId,
        testNameSnapshot: { contains: 'agudeza visual', mode: 'insensitive' },
      },
      select: { id: true },
    })

    let aiWarning: string | undefined
    if (eventTest) {
      const aiResult = await triggerStructuredStudyAIPrediagnosis({
        eventTestId: eventTest.id,
        eventId,
        studyType: 'AgudezaVisual',
        extractedData: data as Record<string, unknown>,
      })
      if (!aiResult.success) aiWarning = aiResult.error
      await prisma.eventTest.update({
        where: { id: eventTest.id },
        data: {
          resultNotes: buildStructuredAIResultNote({
            success: aiResult.success,
            studyLabel: 'Agudeza Visual',
            summary: aiResult.summary ?? null,
            clinicalState: aiResult.clinicalState ?? null,
            error: aiResult.error ?? null,
          }),
        },
      })
    }
    
    revalidatePath(`/events/${eventId}`)
    return { success: true, aiWarning }
  } catch (error: unknown) {
    console.error("Error updating visual acuity:", error)
    return { success: false, error: "Datos de agudeza visual inválidos o error de servidor" }
  }
}

export async function updateExploracionFisica(eventId: string, rawData: unknown) {
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
  } catch (error: unknown) {
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

    const aiResult = await triggerStructuredStudyAIPrediagnosis({
      eventTestId,
      eventId,
      studyType: 'ExamenMedico',
      extractedData: data as Record<string, unknown>,
    })

    await prisma.eventTest.update({
      where: { id: eventTestId },
      data: {
        resultNotes: buildStructuredAIResultNote({
          success: aiResult.success,
          studyLabel: 'Examen Médico',
          summary: aiResult.summary ?? null,
          clinicalState: aiResult.clinicalState ?? null,
          error: aiResult.error ?? null,
        }),
      },
    })

    revalidatePath(`/events/${eventId}`)

    // IMPL-20260507-08: Entrada automática en cronograma (ARCH-20260507-08)
    await writeTimelineEntry({
      eventId,
      eventTestId,
      entryType: 'MEDICAL_EXAM_SAVED',
      area: 'Examen Médico',
      title: markComplete ? 'Examen médico completado' : 'Examen médico guardado',
    })

    return {
      success: true,
      status: newStatus,
      aiWarning: aiResult.success ? undefined : aiResult.error,
    }
  } catch (error: unknown) {
    console.error("Error saving examen médico papeleta:", error)
    return { success: false, error: "Error al guardar Examen Médico" }
  }
}
