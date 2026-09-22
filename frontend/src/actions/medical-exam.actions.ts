"use server"

import { Prisma } from '@prisma/client'
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
import { deriveAgudezaVisualResumen } from "@/lib/clinical/agudeza-visual"
import { assertExamenMedicoReadyToClose } from "@/lib/clinical/examen-medico-capture"

/**
 * @id ARCH-20260326-01
 * @backup context/checkpoints/CHK_ARCH-20260326-01.md
 */
export type MedicalExamPersistOptions = {
  /** Guardado en segundo plano: solo persiste datos, sin IA ni cronograma. */
  autosave?: boolean
}

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

export async function updateSomatometria(
  eventId: string,
  rawData: unknown,
  options?: MedicalExamPersistOptions,
) {
  try {
    const data = SomatometriaVitalesSchema.parse(rawData)
    const autosave = options?.autosave === true

    await prisma.medicalExam.upsert({
      where: { eventId },
      update: { somatometryData: data },
      create: { eventId, somatometryData: data }
    })

    if (!autosave) {
      await prisma.medicalEvent.update({
        where: { id: eventId },
        data: { status: 'IN_PROGRESS' }
      })
    }

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
    if (eventTest && !autosave) {
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

    if (!autosave) {
      revalidatePath(`/events/${eventId}`)
    }
    return { success: true, aiWarning }
  } catch (error: unknown) {
    console.error("Error updating somatometry:", error)
    return { success: false, error: "Datos de somatometría inválidos o error de servidor" }
  }
}

export async function updateAgudezaVisual(
  eventId: string,
  rawData: unknown,
  options?: MedicalExamPersistOptions,
) {
  try {
    const autosave = options?.autosave === true
    const data = AgudezaVisualSchema.parse(rawData)
    const agudezaResumen = deriveAgudezaVisualResumen(
      data.vision_lejana_od,
      data.vision_lejana_oi,
    )
    const existing = await prisma.medicalExam.findUnique({
      where: { eventId },
      select: { physicalExamData: true },
    })
    const prevPhysical =
      (existing?.physicalExamData as Record<string, unknown> | null) ?? {}
    const physicalExamPatch =
      agudezaResumen.length > 0
        ? { ...prevPhysical, agudeza_visual_resumen: agudezaResumen }
        : prevPhysical

    await prisma.medicalExam.upsert({
      where: { eventId },
      update: {
        eyeAcuityData: data,
        physicalExamData: physicalExamPatch as Prisma.InputJsonValue,
      },
      create: {
        eventId,
        eyeAcuityData: data,
        physicalExamData: agudezaResumen.length > 0
          ? ({ agudeza_visual_resumen: agudezaResumen } as Prisma.InputJsonValue)
          : undefined,
      },
    })

    const eventTest = await prisma.eventTest.findFirst({
      where: {
        eventId,
        testNameSnapshot: { contains: 'agudeza visual', mode: 'insensitive' },
      },
      select: { id: true },
    })

    let aiWarning: string | undefined
    if (eventTest && !autosave) {
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

    if (!autosave) {
      revalidatePath(`/events/${eventId}`)
    }
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
 *   cuando `markComplete=true`, NO se pasa a `VALIDATING` ni se exige
 *   aptitud: se cierra la captura clínica del estudio y queda
 *   `RESULT_REGISTERED` (paso 2 — pendiente de interpretación/diagnóstico
 *   por estudio, SPEC ARCH-20260921-01 V2). La aptitud laboral y la firma
 *   del dictamen ocurren después (V3) vía `EventFlowController` cuando el
 *   expediente abre `?view=VALIDATING`. PDF y ZIP sólo con verdict emitido
 *   (BR-20260825-20).
 */
export async function saveExamenMedicoPapeleta(
  eventId: string,
  eventTestId: string,
  rawData: unknown,
  markComplete = false,
  options?: MedicalExamPersistOptions,
) {
  if (!eventId || !eventTestId) {
    return { success: false, error: 'Parámetros incompletos' }
  }

  try {
    const autosave = options?.autosave === true
    const data = ExamenMedicoCompletoSchema.parse(rawData)

    const priorExam = await prisma.medicalExam.findUnique({
      where: { eventId },
      select: {
        physicalExamData: true,
        somatometryData: true,
        eyeAcuityData: true,
      },
    })
    const priorPhysical =
      (priorExam?.physicalExamData as Record<string, unknown> | undefined) ?? {}

    const physicalPayload: Record<string, unknown> = { ...data }

    if (markComplete) {
      const gateError = assertExamenMedicoReadyToClose({
        somatometryData: priorExam?.somatometryData as Record<string, unknown> | null,
        eyeAcuityData: priorExam?.eyeAcuityData as Record<string, unknown> | null,
        physicalExamData: physicalPayload,
      })
      if (gateError) {
        return { success: false, error: gateError }
      }
      physicalPayload.examen_capture_closed = true
    } else if (priorPhysical.examen_capture_closed === true) {
      physicalPayload.examen_capture_closed = true
    }

    await prisma.medicalExam.upsert({
      where: { eventId },
      update: { physicalExamData: physicalPayload },
      create: { eventId, physicalExamData: physicalPayload },
    })

    const newStudyStatus = 'RESULT_REGISTERED'
    const currentTest = await prisma.eventTest.findUnique({
      where: { id: eventTestId },
      select: { status: true },
    })
    const shouldUpdateStatus = markComplete || currentTest?.status !== 'COMPLETED'
    if (shouldUpdateStatus) {
      await prisma.eventTest.update({
        where: { id: eventTestId },
        data: { status: newStudyStatus },
      })
    }

    let aiWarning: string | undefined
    if (!autosave) {
      const aiResult = await triggerStructuredStudyAIPrediagnosis({
        eventTestId,
        eventId,
        studyType: 'ExamenMedico',
        extractedData: data as Record<string, unknown>,
      })
      aiWarning = aiResult.success ? undefined : aiResult.error

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
      if (markComplete) {
        revalidatePath('/reception')
      }

      await writeTimelineEntry({
        eventId,
        eventTestId,
        entryType: 'MEDICAL_EXAM_SAVED',
        area: 'Examen Médico',
        title: markComplete
          ? 'Captura del examen médico cerrada'
          : 'Examen médico guardado',
      })
    }

    // Devolvemos `status` (Event) además de `studyStatus` (EventTest) para
    // que el caller (PapeletaWorkspace / ExamenMedicoEstudio) pueda
    // refrescar el header del expediente sin tener que re-leer el event.
    return {
      success: true,
      // El Event no cambia de estado al completar captura (null).
      status: null,
      studyStatus: shouldUpdateStatus ? newStudyStatus : (currentTest?.status ?? newStudyStatus),
      aiWarning,
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
