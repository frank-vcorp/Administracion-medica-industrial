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
// IMPL-20260507-08: Cronograma operativo persistente (ARCH-20260507-08)
import { writeTimelineEntry } from "@/lib/timeline.service"
import { TimelineEntryType } from "@prisma/client"

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
 * ARCH-20260507-06: Resuelve el grupo de muestra de un EventTest.
 * Fuente principal: test.options.sampleType (campo JSON en MedicalTest).
 * Fallback heurístico: palabras clave en testNameSnapshot.
 * Devuelve 'otro' cuando no hay grupo definido (no propagar entre estudios sin grupo).
 */
function resolveSampleGroupFromSnapshot(testNameSnapshot: string, options: unknown): string {
  if (options && typeof options === 'object' && !Array.isArray(options)) {
    const sampleType = (options as Record<string, unknown>).sampleType
    if (typeof sampleType === 'string' && sampleType.trim()) {
      return sampleType.trim().toLowerCase()
    }
  }
  const name = testNameSnapshot.toLowerCase()
  if (
    name.includes('sangre') || name.includes('sanguín') || name.includes('sanguinea') ||
    name.includes('biometría') || name.includes('biometria') ||
    name.includes('química') || name.includes('quimica') ||
    name.includes('glucosa') || name.includes('colesterol') ||
    name.includes('hemograma')
  ) return 'sangre'
  if (name.includes('orina') || name.includes('ego') || name.includes('urin')) return 'orina'
  if (name.includes('heces') || name.includes('copro')) return 'heces'
  return 'otro'
}

/**
 * Actualiza el estado operativo de un estudio en la papeleta.
 * Soporta los estados V1: PENDING, IN_PROGRESS, SAMPLE_TAKEN, RESULT_REGISTERED, COMPLETED.
 * ARCH-20260507-06: Si status === SAMPLE_TAKEN, propaga a todos los EventTest hermanos
 * del mismo grupo de muestra dentro del mismo eventId.
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
    // IMPL-20260507-08: Leer estado previo para evitar duplicar entradas en timeline
    // cuando no hubo transición real de estado.
    const prevTest = await prisma.eventTest.findUnique({
      where: { id: eventTestId },
      select: { status: true },
    })
    const oldStatus = prevTest?.status

    await prisma.eventTest.update({
      where: { id: eventTestId },
      data: { status }
    })

    // ARCH-20260507-06: Propagar SAMPLE_TAKEN a hermanos del mismo grupo de muestra.
    // No se propaga RESULT_REGISTERED ni COMPLETED.
    if (status === 'SAMPLE_TAKEN') {
      const currentTest = await prisma.eventTest.findUnique({
        where: { id: eventTestId },
        select: {
          testNameSnapshot: true,
          test: { select: { options: true } },
        },
      })
      if (currentTest) {
        const currentGroup = resolveSampleGroupFromSnapshot(
          currentTest.testNameSnapshot,
          currentTest.test?.options,
        )
        if (currentGroup !== 'otro') {
          const siblings = await prisma.eventTest.findMany({
            where: {
              eventId,
              id: { not: eventTestId },
              status: { in: ['PENDING', 'IN_PROGRESS'] },
            },
            select: {
              id: true,
              testNameSnapshot: true,
              test: { select: { options: true } },
            },
          })
          const siblingIdsToUpdate = siblings
            .filter(
              s => resolveSampleGroupFromSnapshot(s.testNameSnapshot, s.test?.options) === currentGroup,
            )
            .map(s => s.id)
          if (siblingIdsToUpdate.length > 0) {
            await prisma.eventTest.updateMany({
              where: { id: { in: siblingIdsToUpdate } },
              data: { status: 'SAMPLE_TAKEN' },
            })
          }
        }
      }
    }

    // IMPL-20260507-08: Escritura automática en cronograma operativo (ARCH-20260507-08)
    // No bloqueante — nunca interrumpe el flujo clínico ante un error de timeline.
    const statusToTimelineType: Partial<Record<EventTestStatus, TimelineEntryType>> = {
      IN_PROGRESS:       'STUDY_STARTED',
      SAMPLE_TAKEN:      'SAMPLE_TAKEN',
      RESULT_REGISTERED: 'RESULT_REGISTERED',
      COMPLETED:         'STUDY_COMPLETED',
    }
    const timelineType = statusToTimelineType[status]
    if (timelineType && oldStatus !== status) {
      const testInfo = await prisma.eventTest.findUnique({
        where: { id: eventTestId },
        select: {
          testNameSnapshot: true,
          test: { select: { category: { select: { name: true } } } },
        },
      })
      const testName = testInfo?.testNameSnapshot ?? 'Estudio'
      const area = testInfo?.test?.category?.name ?? 'general'
      const titleMap: Record<TimelineEntryType, string> = {
        STUDY_STARTED:      `Estudio iniciado: ${testName}`,
        SAMPLE_TAKEN:       `Muestra tomada: ${testName}`,
        RESULT_REGISTERED:  `Resultado registrado: ${testName}`,
        STUDY_COMPLETED:    `Estudio completado: ${testName}`,
        MEDICAL_EXAM_SAVED: `Examen médico guardado`,
        ADMIN_INCIDENCE:    testName,
      }
      await writeTimelineEntry({
        eventId,
        eventTestId,
        entryType: timelineType,
        area,
        title: titleMap[timelineType],
      })
    }

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
        const extractionSnapshotData = v2Result.extractionSnapshotId
          ? {
              id: v2Result.extractionSnapshotId,
              version: v2Result.extractionSnapshotVersion ?? 1,
              extractedData: v2Result.extractedData ?? null,
              missingFields: v2Result.missingFields ?? null,
              rawPayload: v2Result.rawPayload ?? null,
            }
          : null
        return {
          success: true,
          fileUrl: v2Result.fileUrl ?? `/uploads/${file.name}`,
          extractionSnapshotData,
          aiAnalysis: {
            extractionSnapshotId: v2Result.extractionSnapshotId,
            prediagnosisSnapshotId: v2Result.prediagnosisSnapshotId,
            clinicalState: v2Result.clinicalState,
            summary: v2Result.summary,
            confidence: v2Result.confidence,
          },
        }
      }
      console.warn('[IMPL-20260326-16] V2 falló para estudio IA elegible; se cancela fallback V1:', v2Result.error)
      return {
        success: false,
        error: v2Result.error || 'La IA no pudo procesar el estudio en el pipeline V2.',
      }
    } catch (v2Error) {
      console.warn('[IMPL-20260326-16] Error en V2 para estudio IA elegible; se cancela fallback V1:', v2Error)
      return {
        success: false,
        error: v2Error instanceof Error ? v2Error.message : 'Error al procesar el estudio con IA.',
      }
    }
  }

  // FALLBACK V1 — FIX ARCH-20260326-04: subir físicamente al backend antes de guardar fileUrl.
  // No se genera una ruta inventada; si el upload falla, fileUrl queda null y se informa al usuario.
  try {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
    const uploadForm = new FormData()
    uploadForm.append('file', file)

    let fileUrl: string | null = null
    try {
      const uploadResponse = await fetch(`${apiBase}/api/v1/upload-only`, {
        method: 'POST',
        body: uploadForm,
      })
      if (uploadResponse.ok) {
        const uploadResult = await uploadResponse.json()
        if (uploadResult?.status === 'success' && uploadResult?.file_url) {
          fileUrl = uploadResult.file_url as string
        }
      }
    } catch (uploadErr) {
      console.warn('[FIX ARCH-20260326-04] upload-only falló:', uploadErr)
    }

    const resultNotes = fileUrl
      ? buildAIResultNote({ success: false, error: 'Archivo guardado. Prediagnóstico IA no disponible; se requiere análisis manual.' })
      : buildAIResultNote({ success: false, error: 'Pipeline IA y almacenamiento no disponibles. Suba el archivo nuevamente para regenerar el análisis.' })

    await prisma.eventTest.update({
      where: { id: eventTestId },
      data: {
        ...(fileUrl ? { fileUrl } : {}),
        status: 'RESULT_REGISTERED',
        resultNotes,
      }
    })
    revalidatePath(`/events/${eventId}`)
    return fileUrl
      ? { success: true, fileUrl, aiAnalysis: null }
      : { success: false, error: 'No se pudo persistir el archivo físicamente. El pipeline IA tampoco está disponible. Intente subir el archivo nuevamente.' }
  } catch (error) {
    console.error('[FIX ARCH-20260326-04] Error en fallback V1:', error)
    return { success: false, error: 'Error al intentar guardar el archivo. Intente nuevamente.' }
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
      // FIX ARCH-20260326-04: 404 ocurre cuando fileUrl fue inventada en el fallback anterior.
      // Dar mensaje claro al usuario en lugar de exponer HTTP 404 internamente.
      const errMsg = fileResponse.status === 404
        ? 'El archivo del estudio ya no está disponible en el servidor. Vuelva a subir el archivo para regenerar el análisis IA.'
        : `No se pudo descargar el archivo para regenerar IA: HTTP ${fileResponse.status}`
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

    // ARCH-20260326-05: Si IA no está disponible, consultar /api/v2/ai/status para causa raíz exacta.
    let enrichedError = aiResult.error ?? null
    if (!aiResult.success && aiResult.error?.includes('Servicios de IA no están disponibles')) {
      try {
        const statusResp = await fetch(`${apiBase}/api/v2/ai/status`)
        if (statusResp.ok) {
          const aiStatus = await statusResp.json() as {
            api_key_present: boolean
            last_init_error?: string | null
            classifier: boolean
            extractor: boolean
            prediagnostic: boolean
          }
          const parts: string[] = []
          if (!aiStatus.api_key_present) parts.push('GEMINI_API_KEY ausente')
          if (aiStatus.last_init_error) parts.push(aiStatus.last_init_error)
          if (!aiStatus.classifier) parts.push('classifier no inicializado')
          else if (!aiStatus.extractor) parts.push('extractor no inicializado')
          else if (!aiStatus.prediagnostic) parts.push('prediagnostic no inicializado')
          if (parts.length > 0) {
            enrichedError = `Servicios de IA no están disponibles: ${parts.join('; ')}`
          }
        }
      } catch {
        // Mantener error original si /api/v2/ai/status no está accesible
      }
    }

    // Persistir resultNotes según el resultado de la regeneración
    const resultNotes = buildAIResultNote({
      success: aiResult.success,
      summary: aiResult.summary ?? null,
      clinicalState: aiResult.clinicalState ?? null,
      error: enrichedError,
    })
    await prisma.eventTest.update({
      where: { id: eventTestId },
      data: { resultNotes },
    })

    revalidatePath(`/events/${eventId}`)
    return { success: aiResult.success, error: enrichedError ?? undefined }
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

/**
 * ARCH-20260518-04: Limpia el archivo activo y los snapshots vigentes de un estudio,
 * dejándolo en estado PENDING listo para nueva captura.
 *
 * Política de auditoría:
 *   - Los StudyExtractionSnapshot y AIPrediagnosisSnapshot previos se marcan isSuperseded=true.
 *   - NO se hace hard delete. El historial queda trazable internamente.
 *   - El EventTest queda con fileUrl=null, status=PENDING y resultNotes de auditoría.
 *
 * @id ARCH-20260518-04
 * @backup context/checkpoints/CHK_IMPL-20260518-04-DOBLE-FLUJO-ARCHIVO-IA.md
 */
export async function clearEventTestFile(
  eventTestId: string,
  eventId: string,
  clearedByUserId: string = 'system'
): Promise<{ success: boolean; error?: string }> {
  if (!eventTestId || !eventId) {
    return { success: false, error: 'Parámetros incompletos' }
  }

  try {
    // 1. Buscar snapshots activos (no superseded) para marcarlos históricos
    const activeExtractions = await prisma.studyExtractionSnapshot.findMany({
      where: { eventTestId, isSuperseded: false },
      select: { id: true },
    })

    if (activeExtractions.length > 0) {
      const extractionIds = activeExtractions.map((s) => s.id)

      // Marcar extracciones como superseded (semántica de "vigente eliminado")
      await prisma.studyExtractionSnapshot.updateMany({
        where: { id: { in: extractionIds } },
        data: { isSuperseded: true },
      })

      // Marcar prediagnósticos asociados como superseded
      await prisma.aIPrediagnosisSnapshot.updateMany({
        where: { extractionSnapshotId: { in: extractionIds } },
        data: { isSuperseded: true },
      })
    }

    // 2. Limpiar el EventTest operativo
    const auditNote = `[ARCH-20260518-04] Estudio limpiado para nueva captura por ${clearedByUserId} el ${new Date().toISOString()}. Historial previo conservado con isSuperseded=true (${activeExtractions.length} snapshots).`
    await prisma.eventTest.update({
      where: { id: eventTestId },
      data: {
        fileUrl: null,
        status: 'PENDING',
        resultNotes: auditNote,
      },
    })

    revalidatePath(`/events/${eventId}`)
    return { success: true }
  } catch (error) {
    console.error('[ARCH-20260518-04] Error en clearEventTestFile:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error interno al limpiar el estudio',
    }
  }
}
