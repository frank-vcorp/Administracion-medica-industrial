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
        status: 'RESULT_REGISTERED'
      }
    })
    revalidatePath(`/events/${eventId}`)
    return { success: true, fileUrl, aiAnalysis: null }
  } catch (error) {
    console.error("Error saving event test file (fallback V1):", error)
    return { success: false, error: "Error al vincular el archivo al estudio" }
  }
}
