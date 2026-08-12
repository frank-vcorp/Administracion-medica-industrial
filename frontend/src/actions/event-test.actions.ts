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
import { EventTestStatus, Prisma } from "@prisma/client"
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
 * IMPL-20260729-01 — Trigger automático: cuando un EventTest de categoría
 * Laboratorio pasa a SAMPLE_TAKEN, se materializa una LabOrder DRAFT con su
 * LabOrderItem, si aún no existe LabOrder para el MedicalEvent.
 *
 * Política:
 *  - Idempotente: si ya hay LabOrder para el medicalEvent, solo agrega un
 *    LabOrderItem si no existe ya ese eventTestId registrado.
 *  - Folio: max(folio) + 1 (compatible con la generación existente en
 *    lab-order.actions.ts → createLabOrderAction).
 *  - createdById: primer usuario ADMIN encontrado. Fallback: cualquier User.
 *  - doctorName: 'Dr. Sistema' como placeholder; el médico real se asigna en
 *    la admisión posterior (Slice B NOVA, ARCH-20260701-03).
 */
async function ensureLabOrderForSampledLabTest(
  eventTestId: string,
  eventId: string,
): Promise<void> {
  try {
    const eventTest = await prisma.eventTest.findUnique({
      where: { id: eventTestId },
      select: {
        testId: true,
        event: {
          select: {
            id: true,
            workerId: true,
            billingCompanyId: true,
          },
        },
        test: {
          select: {
            id: true,
            category: { select: { name: true } },
          },
        },
      },
    })

    if (!eventTest?.test?.category) return
    if (eventTest.test.category.name !== 'Laboratorio') return
    if (!eventTest.testId) return

    // Buscar o crear LabOrder para el MedicalEvent
    let labOrder = await prisma.labOrder.findFirst({
      where: { medicalEventId: eventId },
      select: { id: true },
    })

    if (!labOrder) {
      // Resolver createdById: ADMIN preferido, fallback a cualquier User
      const adminUser =
        (await prisma.user.findFirst({
          where: { role: 'ADMIN' },
          select: { id: true },
          orderBy: { createdAt: 'asc' },
        })) ??
        (await prisma.user.findFirst({
          select: { id: true },
          orderBy: { createdAt: 'asc' },
        }))

      if (!adminUser) {
        console.warn(
          '[IMPL-20260729-01] No hay usuarios en BD; no se pudo crear LabOrder automática.',
        )
        return
      }

      // Folio: max + 1
      const lastFolio = await prisma.labOrder.findFirst({
        orderBy: { folio: 'desc' },
        select: { folio: true },
      })
      const nextFolio = (lastFolio?.folio ?? 0) + 1

      const workerCompany = await prisma.worker.findUnique({
        where: { id: eventTest.event.workerId },
        select: { companyId: true },
      })

      labOrder = await prisma.labOrder.create({
        data: {
          folio: nextFolio,
          workerId: eventTest.event.workerId,
          companyId:
            eventTest.event.billingCompanyId ??
            workerCompany?.companyId ??
            null,
          medicalEventId: eventTest.event.id,
          doctorName: 'Dr. Sistema',
          createdById: adminUser.id,
          status: 'DRAFT',
        },
        select: { id: true },
      })
    }

    // Idempotencia: no duplicar LabOrderItem para el mismo eventTest
    const existingItem = await prisma.labOrderItem.findFirst({
      where: { labOrderId: labOrder.id, eventTestId },
      select: { id: true },
    })
    if (existingItem) return

    await prisma.labOrderItem.create({
      data: {
        labOrderId: labOrder.id,
        medicalTestId: eventTest.testId,
        eventTestId,
      },
    })
  } catch (err) {
    // No interrumpir el flujo clínico ante un fallo de la auto-creación.
    console.error('[IMPL-20260729-01] ensureLabOrderForSampledLabTest failed:', err)
  }
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
            // IMPL-20260729-01: cada hermano promovido también debe
            // materializar su LabOrderItem si es de categoría Laboratorio.
            for (const sibId of siblingIdsToUpdate) {
              await ensureLabOrderForSampledLabTest(sibId, eventId)
            }
          }
        }
      }
    }

    // IMPL-20260729-01: Si el estudio en sí es de Laboratorio, dispara la
    // materialización de LabOrder DRAFT + LabOrderItem.
    if (status === 'SAMPLE_TAKEN') {
      await ensureLabOrderForSampledLabTest(eventTestId, eventId)
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
 * FIX-20260729-03-G-XML: Detecta si un archivo es XML del audiómetro.
 *
 * Estrategia defensiva de 3 capas (cualquiera basta):
 *   1. MIME type declarado por el navegador (`application/xml` / `text/xml`)
 *   2. Extensión `.xml` (case-insensitive)
 *   3. Magic bytes `<?xml` en los primeros 64 bytes del contenido
 *
 * Usar las 3 capas es robusto contra:
 *   - Navegadores que reportan `application/octet-stream` para archivos .xml
 *   - Archivos sin extensión explícita que aun así son XML
 *   - Falsos positivos tipo .docx (que internamente son XML pero NO son
 *     audiometría — para esos se requiere validación posterior del payload).
 */
async function isXmlFile(file: File): Promise<boolean> {
  const mime = (file.type || '').toLowerCase()
  if (mime === 'application/xml' || mime === 'text/xml') return true

  const name = (file.name || '').toLowerCase()
  if (name.endsWith('.xml')) return true

  try {
    // slice(0, 64) evita cargar archivos grandes en memoria para un sniff
    const head = await file.slice(0, 64).text()
    const trimmed = head.trimStart().toLowerCase()
    if (trimmed.startsWith('<?xml')) return true
  } catch {
    // Si file.slice falla (p.ej. entornos sin Blob), no es XML detectable
  }

  return false
}

/**
 * FIX-20260729-03-G-XML: Persiste los snapshots inmutables (extracción +
 * prediagnóstico) resultantes del parser XML directo, manteniendo la misma
 * semántica de supersedencia que el flujo V2/Gemini.
 *
 * Devuelve un objeto con la forma compatible con la rama V2 (extractionSnapshotData,
 * aiAnalysis) para que PapeletaWorkspace renderice sin cambios estructurales.
 */
async function persistXmlDirectSnapshots(args: {
  eventTestId: string
  eventId: string
  triggeredByUserId: string
  xmlResult: {
    file: string
    file_url: string
    extraction_snapshot: {
      study_type: string
      extracted_data: Record<string, unknown>
      missing_fields?: string[] | null
      audit?: Record<string, unknown>
    }
    prediagnosis_snapshot: Record<string, unknown>
  }
}): Promise<{
  extractionSnapshotId: string
  prediagnosisSnapshotId: string
  clinicalState: string
  summary: string | null
  confidence: number | null
  fileUrl: string
  extractionVersion: number
}> {
  const { eventTestId, eventId, triggeredByUserId, xmlResult } = args

  const existingExtractions = await prisma.studyExtractionSnapshot.count({
    where: { eventTestId },
  })
  const extractionVersion = existingExtractions + 1

  const activeExtractionIds = (
    await prisma.studyExtractionSnapshot.findMany({
      where: { eventTestId, isSuperseded: false },
      select: { id: true },
    })
  ).map(s => s.id)

  const predxData = (xmlResult.prediagnosis_snapshot ?? {}) as Record<string, unknown>
  const clinicalState =
    (typeof predxData.clinical_state === 'string' && predxData.clinical_state) ||
    'AI_PENDING_REVIEW'

  const extractionAudit = (xmlResult.extraction_snapshot.audit ?? {}) as Record<string, unknown>
  const structuredDataPayload = {
    study_type: xmlResult.extraction_snapshot.study_type,
    extracted_data: xmlResult.extraction_snapshot.extracted_data,
    missing_fields: xmlResult.extraction_snapshot.missing_fields ?? [],
    quality_notes: ['xml_direct', 'audiometry_dd65_v2'],
    data_source: 'xml_direct',
    audit: {
      ...extractionAudit,
      triggered_by_user_id: triggeredByUserId,
      trigger_reason: 'initial_upload_xml',
    },
  } as Prisma.InputJsonValue

  const { extractionSnapshot, prediagnosisSnapshot } = await prisma.$transaction(async (tx) => {
    if (activeExtractionIds.length > 0) {
      await tx.aIPrediagnosisSnapshot.updateMany({
        where: {
          extractionSnapshotId: { in: activeExtractionIds },
          isSuperseded: false,
        },
        data: { isSuperseded: true },
      })
      await tx.studyExtractionSnapshot.updateMany({
        where: { eventTestId, isSuperseded: false },
        data: { isSuperseded: true },
      })
    }

    const nextExtractionSnapshot = await tx.studyExtractionSnapshot.create({
      data: {
        eventTestId,
        version: extractionVersion,
        studyType: xmlResult.extraction_snapshot.study_type,
        sourceFileName: xmlResult.file,
        sourceFileUrl: xmlResult.file_url ?? `/uploads/${xmlResult.file}`,
        sourceFileHash:
          (extractionAudit.source_file_hash as string | null) ?? null,
        structuredData: structuredDataPayload,
        clinicalState: 'DRAFT_EXTRACTED',
        modelName: (extractionAudit.model_name as string) || 'xml_parser',
        promptVersion: (extractionAudit.prompt_version as string) || 'xml_direct_v1',
        pipelineVersion:
          (extractionAudit.pipeline_version as string) || 'ai-pipeline-2026-03',
        triggeredByUserId,
        triggerReason: 'initial_upload_xml',
        isSuperseded: false,
      },
    })

    const predxAudit = (predxData.audit ?? {}) as Record<string, unknown>
    const nextPrediagnosisSnapshot = await tx.aIPrediagnosisSnapshot.create({
      data: {
        extractionSnapshotId: nextExtractionSnapshot.id,
        version: 1,
        prediagnosisData: predxData as Prisma.InputJsonValue,
        clinicalState,
        modelName: (predxAudit.model_name as string) || 'gemini-2.5-flash',
        promptVersion: (predxAudit.prompt_version as string) || 'predx-v1',
        corpusVersion: (predxAudit.corpus_version as string | null) ?? null,
        triggeredByUserId,
        isSuperseded: false,
      },
    })

    await tx.eventTest.update({
      where: { id: eventTestId },
      data: {
        fileUrl: xmlResult.file_url ?? `/uploads/${xmlResult.file}`,
        status: 'RESULT_REGISTERED',
      },
    })

    return {
      extractionSnapshot: nextExtractionSnapshot,
      prediagnosisSnapshot: nextPrediagnosisSnapshot,
    }
  })

  revalidatePath(`/events/${eventId}`)

  return {
    extractionSnapshotId: extractionSnapshot.id,
    prediagnosisSnapshotId: prediagnosisSnapshot.id,
    clinicalState,
    summary: (predxData.summary as string | null) ?? null,
    confidence: (predxData.confidence as number | null) ?? null,
    fileUrl: xmlResult.file_url ?? `/uploads/${xmlResult.file}`,
    extractionVersion,
  }
}

/**
 * FIX-20260729-03-G-XML: Llama al endpoint FastAPI de parser XML directo
 * (POST /api/v2/event-tests/upload-xml-audiometry). Devuelve el payload
 * crudo del backend; la persistencia de snapshots ocurre en
 * `persistXmlDirectSnapshots`.
 */
async function uploadXmlAudiometryDirect(
  apiBase: string,
  eventTestId: string,
  file: File,
  triggeredByUserId: string
): Promise<{
  success: boolean
  error?: string
  payload?: {
    file: string
    file_url: string
    extraction_snapshot: {
      study_type: string
      extracted_data: Record<string, unknown>
      missing_fields?: string[] | null
      audit?: Record<string, unknown>
    }
    prediagnosis_snapshot: Record<string, unknown>
  }
}> {
  try {
    const xmlForm = new FormData()
    xmlForm.append('file', file)
    xmlForm.append('event_test_id', eventTestId)
    if (triggeredByUserId && triggeredByUserId !== 'system') {
      xmlForm.append('triggered_by_user_id', triggeredByUserId)
    }

    const response = await fetch(
      `${apiBase}/api/v2/event-tests/upload-xml-audiometry`,
      { method: 'POST', body: xmlForm }
    )

    const text = await response.text()
    type XmlBackendBody = {
      status?: string
      error?: string
      detail?: string
      file?: string
      file_url?: string
      extraction_snapshot?: {
        study_type: string
        extracted_data: Record<string, unknown>
        missing_fields?: string[] | null
        audit?: Record<string, unknown>
      }
      prediagnosis_snapshot?: Record<string, unknown>
      raw?: string
    }
    let body: XmlBackendBody | null = null
    try {
      body = text ? (JSON.parse(text) as XmlBackendBody) : null
    } catch {
      body = { raw: text.slice(0, 500) }
    }

    if (!response.ok) {
      return {
        success: false,
        error:
          (body && (body.detail || body.error)) ||
          `HTTP ${response.status} sin detalle del backend XML`,
      }
    }
    if (!body || body.status !== 'success') {
      return {
        success: false,
        error: (body && body.error) || 'Backend XML respondió sin status=success',
      }
    }
    if (!body.file || !body.file_url || !body.extraction_snapshot || !body.prediagnosis_snapshot) {
      return {
        success: false,
        error: 'Backend XML sin campos obligatorios (file/file_url/extraction_snapshot/prediagnosis_snapshot).',
      }
    }
    return {
      success: true,
      payload: {
        file: body.file,
        file_url: body.file_url,
        extraction_snapshot: {
          study_type: body.extraction_snapshot.study_type,
          extracted_data: body.extraction_snapshot.extracted_data,
          missing_fields: body.extraction_snapshot.missing_fields ?? null,
          audit: body.extraction_snapshot.audit ?? {},
        },
        prediagnosis_snapshot: body.prediagnosis_snapshot,
      },
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Error de red al llamar endpoint XML',
    }
  }
}

/**
 * Sube un archivo al backend Python (pipeline IA V2) y lo vincula atómicamente
 * al estudio correspondiente en la papeleta.
 * IMPL-20260326-16: Ahora usa V2 (extracción estructurada + prediagnóstico IA separado)
 * con persistencia de snapshots inmutables. Si el backend no está disponible,
 * el fallback V1 guarda el nombre del archivo como referencia.
 *
 * FIX-20260729-03-G-XML: Antes de invocar el pipeline V2/Gemini, detecta si
 * el archivo es XML y el estudio es audiometría. En ese caso, rutea al
 * parser XML directo (parse_audiometry_xml) del backend, evitando el
 * HTTP 400 que Gemini devuelve sobre archivos no-PDF/imagen.
 */
export async function uploadEventTestFile(formData: FormData) {
  const eventTestId = formData.get('eventTestId') as string
  const eventId = formData.get('eventId') as string
  const file = formData.get('file') as File
  const triggeredByUserId = (formData.get('triggeredByUserId') as string) || 'system'
  void triggeredByUserId

  if (!eventTestId || !eventId || !file) {
    return { success: false, error: 'Faltan parámetros obligatorios' }
  }

  // IMPL-20260326-18: Verificar elegibilidad IA usando la matriz central.
  // Carga el EventTest con test/categoría desde Prisma para decisión precisa.
  let isAIEligible = false
  let canonicalTypeForXml: string | null = null
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
          canonicalTypeForXml = canonicalType
        } else {
          // FIX-20260812-11 Cambio #5: el EventTest es AI-eligible pero su
          // test no tiene mapping canónico en study-ai.ts → el FormData
          // viaja sin study_type. El backend (FIX-20260812-11 Cambios #1+#2)
          // ya cubre esto defensivamente: skip del classifier Gemini y
          // detected_type='unknown' cuando default provider=m3. Log explícito
          // para diagnóstico de mappings faltantes (BACKLOG TKT-20260812-11-01).
          console.warn(
            '[FIX-20260812-11] EventTest AI-eligible pero sin mapping canónico; el backend caerá a classifier o a detected_type=unknown',
            {
              eventTestId,
              testCode: eventTest?.test?.code,
              categoryName: eventTest?.test?.category?.name,
            }
          )
        }
      }
    }
  } catch (eligibilityErr) {
    console.warn('[IMPL-20260326-18] No se pudo verificar elegibilidad IA, fallback V1:', eligibilityErr)
  }

  // FIX-20260729-03-G-XML: Rama XML directa para audiometría.
  // Si el archivo es XML y el estudio canónico es audiometría, NO invocar
  // el pipeline Gemini (que devuelve HTTP 400 sobre XML). En su lugar,
  // llamar al parser XML directo del backend y persistir los snapshots.
  if (isAIEligible && canonicalTypeForXml === 'Audiometria') {
    try {
      const xmlDetected = await isXmlFile(file)
      if (xmlDetected) {
        console.log('[FIX-20260729-03-G-XML] Detectado XML de audiometría; ruteando a parser directo.')
        const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
        const xmlResponse = await uploadXmlAudiometryDirect(
          apiBase,
          eventTestId,
          file,
          triggeredByUserId
        )
        if (xmlResponse.success && xmlResponse.payload) {
          const persisted = await persistXmlDirectSnapshots({
            eventTestId,
            eventId,
            triggeredByUserId,
            xmlResult: xmlResponse.payload,
          })
          await prisma.eventTest.update({
            where: { id: eventTestId },
            data: {
              resultNotes: buildAIResultNote({
                success: true,
                summary: persisted.summary,
                clinicalState: persisted.clinicalState,
              }),
            },
          })
          const extractionSnapshotData = {
            id: persisted.extractionSnapshotId,
            version: persisted.extractionVersion,
            extractedData: xmlResponse.payload.extraction_snapshot.extracted_data,
            missingFields: xmlResponse.payload.extraction_snapshot.missing_fields ?? null,
            rawPayload: xmlResponse.payload.extraction_snapshot,
          }
          return {
            success: true,
            fileUrl: persisted.fileUrl,
            extractionSnapshotData,
            aiAnalysis: {
              extractionSnapshotId: persisted.extractionSnapshotId,
              prediagnosisSnapshotId: persisted.prediagnosisSnapshotId,
              clinicalState: persisted.clinicalState,
              summary: persisted.summary,
              confidence: persisted.confidence,
            },
          }
        }
        // Si el endpoint XML falló, NO caer a Gemini (causa original del gap).
        // Reportar el error para que el médico decida cómo proceder.
        console.warn(
          '[FIX-20260729-03-G-XML] Parser XML directo falló; no se reintentará Gemini:',
          xmlResponse.error
        )
        return {
          success: false,
          error: xmlResponse.error || 'Parser XML directo no disponible.',
        }
      }
    } catch (xmlBranchErr) {
      console.error(
        '[FIX-20260729-03-G-XML] Error inesperado en rama XML:',
        xmlBranchErr
      )
      // Continuar al flujo V2 como defensa (el gap documentado).
      // Pero si el archivo ES XML, no debería llegar a Gemini — propagamos
      // el error para diagnóstico.
      const msg = xmlBranchErr instanceof Error ? xmlBranchErr.message : String(xmlBranchErr)
      return {
        success: false,
        error: `FIX-20260729-03-G-XML: rama XML falló y no se reintenta Gemini (causa: ${msg})`,
      }
    }
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
      void _persistErr
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
