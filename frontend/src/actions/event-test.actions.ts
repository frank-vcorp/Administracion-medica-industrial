/**
 * @fileoverview Server Actions para gestión atómica de estudios en papeleta
 * @id IMPL-20260324-06 / IMPL-20260326-16
 * @backup context/checkpoints/CHK_IMPL-20260324-06-PAPELETA-WORKSPACE.md
 * IMPL-20260326-16: uploadEventTestFile ahora delega al flujo V2 (extracción + prediagnóstico IA)
 *   cuando el backend está disponible. Fallback a V1 si no hay conectividad.
 */
'use server'

import prisma from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { EventTestStatus } from "@prisma/client"
import { triggerStudyAIAnalysis } from "./ai-prediagnosis.actions"
import { isAIEligibleEventTest, getCanonicalAIStudyType } from "@/lib/study-ai"

/**
 * @id ARCH-20260326-01
 * @backup context/checkpoints/CHK_ARCH-20260326-01.md
 */
function buildAIResultNote(input: { success: boolean; summary?: string | null; clinicalState?: string | null; error?: string | null }) {
  if (input.success) {
    const summary = input.summary?.trim()
    return summary
      ? `IA generada (${input.clinicalState ?? 'AI_PENDING_REVIEW'}): ${summary}`
      : `IA generada (${input.clinicalState ?? 'AI_PENDING_REVIEW'}).`
  }

  return `Archivo cargado, pero la IA no generó prediagnóstico: ${input.error ?? 'sin detalle'}`
}

/**
 * Actualiza el estado operativo de un estudio en la papeleta.
 * Soporta los estados V1: PENDING, IN_PROGRESS, SAMPLE_TAKEN, RESULT_REGISTERED, COMPLETED.
 */
export async function updateEventTestStatus(
  eventTestId: string,
  status: EventTestStatus,
  eventId: string
) {
  if (!eventTestId || !status || !eventId) {
    return { success: false, error: 'Parámetros incompletos' }
  }

  try {
    await prisma.eventTest.update({
      where: { id: eventTestId },
      data: { status }
    })
    revalidatePath(`/events/${eventId}`)
    return { success: true }
  } catch (error) {
    console.error("Error updating event test status:", error)
    return { success: false, error: "Error al actualizar estado del estudio" }
  }
}

/**
 * Sube un archivo al backend Python (pipeline IA V2) y lo vincula atómicamente
 * al estudio correspondiente en la papeleta.
 * IMPL-20260326-16: Ahora usa V2 (extracción estructurada + prediagnóstico IA separado)
 * con persistencia de snapshots inmutables. Si el backend no está disponible,
 * el fallback V1 guarda el nombre del archivo como referencia.
 */
export async function uploadEventTestFile(formData: FormData) {
  const eventTestId = formData.get('eventTestId') as string
  const eventId = formData.get('eventId') as string
  const file = formData.get('file') as File
  const triggeredByUserId = (formData.get('triggeredByUserId') as string) || 'system'

  if (!eventTestId || !eventId || !file) {
    return { success: false, error: 'Faltan parámetros obligatorios' }
  }

  // IMPL-20260326-18: Verificar elegibilidad IA usando la matriz central.
  // Carga el EventTest con test/categoría desde Prisma para decisión precisa.
  let isAIEligible = false
  try {
    const eventTest = await prisma.eventTest.findUnique({
      where: { id: eventTestId },
      select: {
        testNameSnapshot: true,
        test: { select: { code: true, category: { select: { name: true } } } },
      },
    })
    if (eventTest) {
      isAIEligible = isAIEligibleEventTest(eventTest)
      if (isAIEligible) {
        const canonicalType = getCanonicalAIStudyType(eventTest)
        if (canonicalType) {
          formData.set('study_type', canonicalType)
        }
      }
    }
  } catch (eligibilityErr) {
    console.warn('[IMPL-20260326-18] No se pudo verificar elegibilidad IA, fallback V1:', eligibilityErr)
  }

  // Intentar flujo V2 con prediagnóstico IA estructurado (IMPL-20260326-16/18)
  // Solo si el estudio es elegible según la matriz canónica.
  if (isAIEligible) {
    try {
      const v2Result = await triggerStudyAIAnalysis(formData)
      if (v2Result.success) {
        await prisma.eventTest.update({
          where: { id: eventTestId },
          data: {
            resultNotes: buildAIResultNote({
              success: true,
              summary: v2Result.summary ?? null,
              clinicalState: v2Result.clinicalState ?? null,
            }),
          },
        })
        return {
          success: true,
          fileUrl: `/uploads/${file.name}`,
          aiAnalysis: {
            extractionSnapshotId: v2Result.extractionSnapshotId,
            prediagnosisSnapshotId: v2Result.prediagnosisSnapshotId,
            clinicalState: v2Result.clinicalState,
            summary: v2Result.summary,
            confidence: v2Result.confidence,
          },
        }
      }
      // Si V2 falla, loggear y caer al fallback V1
      console.warn('[IMPL-20260326-16] V2 no disponible, usando fallback V1:', v2Result.error)
    } catch (v2Error) {
      console.warn('[IMPL-20260326-16] Error en V2, usando fallback V1:', v2Error)
    }
  }

  // FALLBACK V1: guardar referencia del archivo sin análisis IA
  const fileUrl = `/uploads/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`

  try {
    await prisma.eventTest.update({
      where: { id: eventTestId },
      data: {
        fileUrl,
        status: 'RESULT_REGISTERED',
        resultNotes: buildAIResultNote({ success: false, error: 'Fallback sin análisis IA disponible' }),
      }
    })
    revalidatePath(`/events/${eventId}`)
    return { success: true, fileUrl, aiAnalysis: null }
  } catch (error) {
    console.error("Error saving event test file (fallback V1):", error)
    return { success: false, error: "Error al vincular el archivo al estudio" }
  }
}

/**
 * Regenera el análisis IA de un estudio que ya tiene fileUrl pero carece de snapshots.
 * Descarga el archivo desde NEXT_PUBLIC_API_URL + fileUrl, reconstruye un File/Blob
 * y reutiliza triggerStudyAIAnalysis para persistir los snapshots de forma inmutable.
 * Si la regeneración falla, persiste el error en resultNotes.
 *
 * @id IMPL-20260326-03
 * @backup context/checkpoints/CHK_IMPL-20260326-03.md
 */
export async function regenerateStudyAI(
  eventTestId: string,
  eventId: string,
  triggeredByUserId: string = 'system'
): Promise<{ success: boolean; error?: string }> {
  if (!eventTestId || !eventId) {
    return { success: false, error: 'Parámetros incompletos' }
  }

  try {
    const eventTest = await prisma.eventTest.findUnique({
      where: { id: eventTestId },
      select: {
        fileUrl: true,
        testNameSnapshot: true,
        test: { select: { code: true, category: { select: { name: true } } } },
      },
    })

    if (!eventTest?.fileUrl) {
      return { success: false, error: 'El estudio no tiene archivo vinculado' }
    }

    // Descargar el archivo desde el storage del backend
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
    const fileResponse = await fetch(`${apiBase}${eventTest.fileUrl}`)
    if (!fileResponse.ok) {
      const errMsg = `No se pudo descargar el archivo para regenerar IA: HTTP ${fileResponse.status}`
      await prisma.eventTest.update({
        where: { id: eventTestId },
        data: { resultNotes: `Error al regenerar IA: ${errMsg}` },
      })
      revalidatePath(`/events/${eventId}`)
      return { success: false, error: errMsg }
    }

    const blob = await fileResponse.blob()
    const fileName = eventTest.fileUrl.split('/').pop() || 'study-file.pdf'
    const file = new File([blob], fileName, { type: blob.type || 'application/pdf' })

    // Determinar tipo canónico para el backend V2
    const canonicalType = getCanonicalAIStudyType(eventTest)

    const formData = new FormData()
    formData.set('eventTestId', eventTestId)
    formData.set('eventId', eventId)
    formData.set('file', file)
    formData.set('triggeredByUserId', triggeredByUserId)
    if (canonicalType) {
      formData.set('study_type', canonicalType)
    }

    const aiResult = await triggerStudyAIAnalysis(formData)

    // Persistir resultNotes según el resultado de la regeneración
    const resultNotes = buildAIResultNote({
      success: aiResult.success,
      summary: aiResult.summary ?? null,
      clinicalState: aiResult.clinicalState ?? null,
      error: aiResult.error ?? null,
    })
    await prisma.eventTest.update({
      where: { id: eventTestId },
      data: { resultNotes },
    })

    revalidatePath(`/events/${eventId}`)
    return { success: aiResult.success, error: aiResult.error }
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error interno al regenerar IA'
    console.error('[IMPL-20260326-03] Error en regenerateStudyAI:', error)
    try {
      await prisma.eventTest.update({
        where: { id: eventTestId },
        data: { resultNotes: `Error al regenerar IA: ${msg}` },
      })
      revalidatePath(`/events/${eventId}`)
    } catch (_persistErr) {
      // No interrumpir si falla la persistencia del error
    }
    return { success: false, error: msg }
  }
}
