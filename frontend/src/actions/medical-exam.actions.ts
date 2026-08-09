"use server"

import prisma from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { triggerStructuredStudyAIPrediagnosis } from "./ai-prediagnosis.actions"
// IMPL-20260507-08: Cronograma operativo persistente (ARCH-20260507-08)
import { writeTimelineEntry } from "@/lib/timeline.service"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/auth"
import {
  SomatometriaVitalesSchema,
  AgudezaVisualSchema,
  ExploracionFisicaSchema,
  ExamenMedicoCompletoSchema,
  AntecedentesCapturaSchema,
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

/**
 * Guarda el snapshot por cita de los Antecedentes del paciente dentro de la
 * outer-tab "Antecedentes" del Examen Médico.
 *
 * **Persistencia:** merge (read-modify-write) sobre `physicalExamData` —
 * preserva Exploración, Impresión, Módulo 1 y `antecedentes_medico` existentes.
 *
 * **Restricciones (ADR-20260809-01):**
 * - NO sobrescribe el historial maestro (`WorkerClinicalHistory`).
 * - NO dispara IA prediagnóstico.
 * - NO cambia `EventTest.status`.
 * - NO añade entrada de cronograma (es captura puntual).
 *
 * @id IMPL-20260809-01
 * @spec ARCH-20260809-01
 */
export async function saveAntecedentesCaptura(
  eventId: string,
  rawData: unknown,
): Promise<{ success: boolean; error?: string }> {
  if (!eventId) {
    return { success: false, error: 'eventId es obligatorio' }
  }

  // Auth: la página /events/[id] ya aplica el control de acceso por rol/estado
  // (ver page.tsx:186). Aquí exigimos sesión como mínimo indispensable.
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return { success: false, error: 'No autorizado' }
  }

  try {
    // 1) Validación Zod server-side (obligatoria — AGENTS.md §3).
    const parsed = AntecedentesCapturaSchema.parse(rawData)

    // 2) Ownership check: el evento debe existir. Si no, abortamos para no
    //    crear un MedicalExam huérfano al upsert.
    const event = await prisma.medicalEvent.findUnique({
      where: { id: eventId },
      select: { id: true, workerId: true },
    })
    if (!event) {
      return { success: false, error: 'Evento no encontrado' }
    }

    // 3) Read-modify-write merge sobre physicalExamData.
    const existingExam = await prisma.medicalExam.findUnique({
      where: { eventId },
      select: { physicalExamData: true },
    })
    const existingData =
      existingExam?.physicalExamData &&
      typeof existingExam.physicalExamData === 'object' &&
      !Array.isArray(existingExam.physicalExamData)
        ? (existingExam.physicalExamData as Record<string, unknown>)
        : {}

    // Inyectamos source='captured' + timestamp ISO; cualquier dato del portal o
    // longitudinal debe haber sido fusionado por el cliente antes de llamar
    // al action (la UI trae los campos planos en `parsed`).
    const nextProvenance = {
      source: 'captured' as const,
      updatedAt: new Date().toISOString(),
      capturedBy: session.user.id ?? undefined,
    }

    const merged = {
      ...existingData,
      antecedentes_captured: {
        ...parsed,
        _provenance: nextProvenance,
      },
    }

    await prisma.medicalExam.upsert({
      where: { eventId },
      update: { physicalExamData: merged },
      create: { eventId, physicalExamData: merged },
    })

    revalidatePath(`/events/${eventId}`)

    return { success: true }
  } catch (error: unknown) {
    // Errores de validación Zod se reportan de forma genérica para no
    // filtrar estructura interna; los detalles quedan en logs server-side.
    console.error('Error saving antecedentes captura:', error)
    return { success: false, error: 'Datos de antecedentes inválidos o error de servidor' }
  }
}
