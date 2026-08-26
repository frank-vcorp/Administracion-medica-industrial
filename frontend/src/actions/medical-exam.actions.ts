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
 *
 * @id IMPL-20260325-01
 * @id IMPL-FEATURE-20260825-03 (ronda 4 / DEC-20260825-19 / FND-20260825-22):
 *   cuando `markComplete=true`, el MedicalEvent pasa a `VALIDATING`
 *   (no firma, no auto-crea `MedicalVerdict`). El médico revisa y firma
 *   desde el flujo existente "Firmar y Emitir Dictamen" en
 *   `EventFlowController`. PDF y ZIP sólo se habilitan con verdict
 *   emitido (BR-20260825-20). El `EventTest` del estudio se marca
 *   `COMPLETED` (o `RESULT_REGISTERED` si no es completar) — sigue
 *   siendo la unidad de captura del médico.
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

    const newStudyStatus = markComplete ? 'COMPLETED' : 'RESULT_REGISTERED'
    await prisma.eventTest.update({
      where: { id: eventTestId },
      data: { status: newStudyStatus },
    })

    // DEC-20260825-19 / FND-20260825-22 / BR-20260825-20:
    // Completar NO firma ni emite MedicalVerdict. Sólo lleva el
    // MedicalEvent al paso `VALIDATING`. El médico firma explícitamente
    // desde `EventFlowController.handleSign` (saveVerdict +
    // signMedicalDictamPDF). Mantenemos `EventTest.status` como `COMPLETED`
    // porque ésa es la unidad de captura del estudio y debe reflejar
    // que el médico terminó la captura del Examen Médico.
    if (markComplete) {
      await prisma.medicalEvent.update({
        where: { id: eventId },
        data: { status: 'VALIDATING' },
      })
    }

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

    // Devolvemos `status` (Event) además de `studyStatus` (EventTest) para
    // que el caller (PapeletaWorkspace / ExamenMedicoEstudio) pueda
    // refrescar el header del expediente sin tener que re-leer el event.
    return {
      success: true,
      // Event status: 'VALIDATING' si completar, sin cambio si borrador.
      // Usamos `null` para borrador porque no tocamos el Event.
      status: markComplete ? 'VALIDATING' : null,
      studyStatus: newStudyStatus,
      aiWarning: aiResult.success ? undefined : aiResult.error,
    }
  } catch (error: unknown) {
    console.error("Error saving examen médico papeleta:", error)
    return { success: false, error: "Error al guardar Examen Médico" }
  }
}

/**
 * IMPL-20260809-02 (ARCH-20260809-01 v2): `saveAntecedentesCaptura` ELIMINADO.
 *
 * En SPEC v2 los Antecedentes pasan a ser PRIMERA sub-pestaña dentro de
 * "Examen Médico" (componente controlado en `AntecedentesCaptura.tsx`) y
 * su persistencia se integra en `saveExamenMedicoPapeleta` (mismo action
 * que Módulo 1 / Exploración / Impresión). Esto:
 *
 * - Reduce la superficie del módulo (un action menos).
 * - Hace que la IA prediagnóstico dispare al guardar antecedentes, igual
 *   que al guardar el resto del examen (consistente y deseable: los
 *   antecedentes son contexto clínico relevante para la IA).
 * - El snapshot `physicalExamData.antecedentes_captured` se persiste
 *   vía el full-replace que ya hace `saveExamenMedicoPapeleta` con
 *   `ExamenMedicoCompletoSchema.parse(...)` — esquema ya acepta el campo
 *   desde IMPL-20260809-01 I-1.
 *
 * Si se necesita restaurar la acción autónoma, consultar
 * `context/interconsultas/HANDOFF_ARCH-20260809-01_v2_SOFIA_ANTECEDENTES-SUB-PESTANA.md`
 * y la versión previa en git (commit anterior a IMPL-20260809-02).
 */
