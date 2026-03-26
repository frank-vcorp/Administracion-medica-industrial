/**
 * @fileoverview Server Actions para Prediagnóstico IA por Estudio
 * @id IMPL-20260326-16
 * @backup context/checkpoints/CHK_IMPL-20260326-16.md
 *
 * Contratos:
 *  - triggerStudyAIAnalysis: llama al backend V2, persiste ExtractionSnapshot +
 *    AIPrediagnosisSnapshot atómicamente.
 *  - submitDoctorStudyReview: persiste la revisión médica obligatoria.
 *  - getStudyAISnapshots: lectura de snapshots históricos por estudio.
 *
 * GUARDRAIL: Las funciones de este archivo NO pueden usarse para poblar
 *   aptitud laboral, dictamen final ni firmar PDFs. El prediagnóstico IA
 *   es exclusivamente apoyo a la decisión clínica del médico.
 */
'use server'

import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

const PYTHON_API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

// ---------------------------------------------------------------------------
// Tipos internos de contrato
// ---------------------------------------------------------------------------

export interface StudyAIAnalysisResult {
  success: boolean
  error?: string
  extractionSnapshotId?: string
  prediagnosisSnapshotId?: string
  clinicalState?: string
  summary?: string
  confidence?: number
}

export interface DoctorStudyReviewInput {
  prediagnosisSnapshotId: string
  doctorStatus: 'REVIEWED_ACCEPTED' | 'REVIEWED_EDITED' | 'REVIEWED_REJECTED'
  doctorDiagnosis?: string
  doctorNotes?: string
  reviewedByUserId: string
  aiAgreementScore?: number
  aiUsefulnessScore?: number
  differenceType?: string
  errorSeverity?: string
  errorCategory?: string
  doctorFeedbackNote?: string
  eventId: string
}

export interface DoctorStudyReviewResult {
  success: boolean
  error?: string
  reviewId?: string
}

export interface StudySnapshotsResult {
  success: boolean
  error?: string
  extractions?: Array<{
    id: string
    version: number
    studyType: string
    clinicalState: string
    createdAt: Date
    isSuperseded: boolean
    structuredData: unknown
    aiPrediagnoses: Array<{
      id: string
      version: number
      clinicalState: string
      createdAt: Date
      isSuperseded: boolean
      prediagnosisData: unknown
      doctorReviews: Array<{
        id: string
        doctorStatus: string
        doctorDiagnosis: string | null
        doctorNotes: string | null
        createdAt: Date
      }>
    }>
  }>
}

// ---------------------------------------------------------------------------
// triggerStudyAIAnalysis
// ---------------------------------------------------------------------------

/**
 * Llama al backend V2 con el archivo del estudio, persiste ExtractionSnapshot
 * y AIPrediagnosisSnapshot en la DB, y actualiza el estado del EventTest.
 *
 * INMUTABILIDAD: Cada llamada crea versiones nuevas; nunca sobrescribe snapshots anteriores.
 * GUARDRAIL: prediagnosisSnapshotId no puede usarse para cerrar expediente ni emitir dictamen.
 *
 * @param eventTestId - ID del estudio (EventTest) en la papeleta
 * @param file - Archivo del estudio a analizar
 * @param triggeredByUserId - ID del usuario que dispara el análisis
 * @param eventId - ID del evento para revalidar caché
 */
export async function triggerStudyAIAnalysis(
  formData: FormData
): Promise<StudyAIAnalysisResult> {
  const eventTestId = formData.get('eventTestId') as string
  const eventId = formData.get('eventId') as string
  const triggeredByUserId = (formData.get('triggeredByUserId') as string) || 'system'
  const file = formData.get('file') as File | null

  if (!eventTestId || !eventId) {
    return { success: false, error: 'eventTestId y eventId son obligatorios' }
  }
  if (!file) {
    return { success: false, error: 'Se requiere un archivo para el análisis IA' }
  }

  try {
    // 1. Llamar al backend V2
    const uploadForm = new FormData()
    uploadForm.append('file', file)
    uploadForm.append('triggered_by_user_id', triggeredByUserId)

    const response = await fetch(`${PYTHON_API}/api/v2/studies/upload-and-analyze`, {
      method: 'POST',
      body: uploadForm,
    })

    if (!response.ok) {
      const errText = await response.text().catch(() => 'Sin detalle')
      return {
        success: false,
        error: `Backend V2 respondió ${response.status}: ${errText.slice(0, 200)}`,
      }
    }

    const result = await response.json()

    if (result.status !== 'success') {
      return {
        success: false,
        error: result.error || 'Error desconocido en backend V2',
      }
    }

    // 2. Calcular versión de extracción (inmutabilidad)
    const existingExtractions = await prisma.studyExtractionSnapshot.count({
      where: { eventTestId },
    })
    const extractionVersion = existingExtractions + 1

    // 3. Persistir ExtractionSnapshot (inmutable)
    const extractionSnapshot = await prisma.studyExtractionSnapshot.create({
      data: {
        eventTestId,
        version: extractionVersion,
        studyType: result.extraction_snapshot?.study_type ?? result.classification?.detected_type ?? 'Otro',
        sourceFileName: result.file,
        sourceFileUrl: `/uploads/${result.file}`,
        sourceFileHash: result.extraction_snapshot?.audit?.source_file_hash ?? null,
        structuredData: result.extraction_snapshot ?? {},
        clinicalState: 'DRAFT_EXTRACTED',
        modelName: result.extraction_snapshot?.audit?.model_name ?? 'gemini-2.5-flash',
        promptVersion: result.extraction_snapshot?.audit?.prompt_version ?? 'extract-v2',
        pipelineVersion: result.extraction_snapshot?.audit?.pipeline_version ?? 'ai-pipeline-2026-03',
        triggeredByUserId,
        triggerReason: 'initial_upload',
        isSuperseded: false,
      },
    })

    // 4. Calcular versión de prediagnóstico
    const existingPredx = await prisma.aIPrediagnosisSnapshot.count({
      where: { extractionSnapshotId: extractionSnapshot.id },
    })
    const predxVersion = existingPredx + 1

    const predxData = result.prediagnosis_snapshot ?? {}
    const clinicalState: string = predxData.clinical_state ?? 'AI_PENDING_REVIEW'

    // 5. Persistir AIPrediagnosisSnapshot (inmutable)
    const prediagnosisSnapshot = await prisma.aIPrediagnosisSnapshot.create({
      data: {
        extractionSnapshotId: extractionSnapshot.id,
        version: predxVersion,
        prediagnosisData: predxData,
        clinicalState,
        modelName: predxData.audit?.model_name ?? 'gemini-2.5-flash',
        promptVersion: predxData.audit?.prompt_version ?? 'predx-v1',
        corpusVersion: predxData.audit?.corpus_version ?? null,
        triggeredByUserId,
        isSuperseded: false,
      },
    })

    // 6. Actualizar estado del EventTest (el archivo ya fue subido al backend)
    await prisma.eventTest.update({
      where: { id: eventTestId },
      data: {
        fileUrl: `/uploads/${result.file}`,
        status: 'RESULT_REGISTERED',
      },
    })

    revalidatePath(`/events/${eventId}`)

    return {
      success: true,
      extractionSnapshotId: extractionSnapshot.id,
      prediagnosisSnapshotId: prediagnosisSnapshot.id,
      clinicalState,
      summary: predxData.summary ?? null,
      confidence: predxData.confidence ?? null,
    }
  } catch (error) {
    console.error('[IMPL-20260326-16] Error en triggerStudyAIAnalysis:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error interno al procesar análisis IA',
    }
  }
}

// ---------------------------------------------------------------------------
// submitDoctorStudyReview
// ---------------------------------------------------------------------------

/**
 * Persiste la revisión médica obligatoria sobre un prediagnóstico IA.
 * El médico debe aceptar, corregir o rechazar explícitamente la sugerencia.
 *
 * GUARDRAIL: Esta revisión NO cierra el expediente ni emite dictamen final.
 *   Solo registra la postura del médico frente al prediagnóstico IA.
 */
export async function submitDoctorStudyReview(
  input: DoctorStudyReviewInput
): Promise<DoctorStudyReviewResult> {
  const {
    prediagnosisSnapshotId,
    doctorStatus,
    doctorDiagnosis,
    doctorNotes,
    reviewedByUserId,
    aiAgreementScore,
    aiUsefulnessScore,
    differenceType,
    errorSeverity,
    errorCategory,
    doctorFeedbackNote,
    eventId,
  } = input

  if (!prediagnosisSnapshotId || !doctorStatus || !reviewedByUserId) {
    return { success: false, error: 'Faltan campos obligatorios en la revisión médica' }
  }

  const validStatuses = ['REVIEWED_ACCEPTED', 'REVIEWED_EDITED', 'REVIEWED_REJECTED']
  if (!validStatuses.includes(doctorStatus)) {
    return { success: false, error: `Estado de revisión inválido: ${doctorStatus}` }
  }

  try {
    // Verificar que el snapshot existe
    const snapshot = await prisma.aIPrediagnosisSnapshot.findUnique({
      where: { id: prediagnosisSnapshotId },
    })
    if (!snapshot) {
      return { success: false, error: 'Snapshot de prediagnóstico no encontrado' }
    }

    const review = await prisma.doctorStudyReview.create({
      data: {
        prediagnosisSnapshotId,
        doctorStatus,
        doctorDiagnosis: doctorDiagnosis ?? null,
        doctorNotes: doctorNotes ?? null,
        reviewedByUserId,
        aiAgreementScore: aiAgreementScore ?? null,
        aiUsefulnessScore: aiUsefulnessScore ?? null,
        differenceType: differenceType ?? null,
        errorSeverity: errorSeverity ?? 'none',
        errorCategory: errorCategory ?? null,
        doctorFeedbackNote: doctorFeedbackNote ?? null,
      },
    })

    // Actualizar clinicalState del prediagnóstico al estado revisado
    await prisma.aIPrediagnosisSnapshot.update({
      where: { id: prediagnosisSnapshotId },
      data: { clinicalState: doctorStatus },
    })

    revalidatePath(`/events/${eventId}`)

    return { success: true, reviewId: review.id }
  } catch (error) {
    console.error('[IMPL-20260326-16] Error en submitDoctorStudyReview:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error interno al guardar revisión médica',
    }
  }
}

// ---------------------------------------------------------------------------
// getStudyAISnapshots
// ---------------------------------------------------------------------------

/**
 * Devuelve el historial completo de snapshots IA para un estudio (EventTest).
 * Incluye extracciones, prediagnósticos y revisiones médicas históricas.
 *
 * GUARDRAIL: Lectura sin autorizar modificaciones ni cierre de expediente.
 */
export async function getStudyAISnapshots(
  eventTestId: string
): Promise<StudySnapshotsResult> {
  if (!eventTestId) {
    return { success: false, error: 'eventTestId es requerido' }
  }

  try {
    const extractions = await prisma.studyExtractionSnapshot.findMany({
      where: { eventTestId },
      orderBy: { createdAt: 'asc' },
      include: {
        aiPrediagnoses: {
          orderBy: { createdAt: 'asc' },
          include: {
            doctorReviews: {
              orderBy: { createdAt: 'desc' },
              select: {
                id: true,
                doctorStatus: true,
                doctorDiagnosis: true,
                doctorNotes: true,
                createdAt: true,
              },
            },
          },
        },
      },
    })

    return { success: true, extractions }
  } catch (error) {
    console.error('[IMPL-20260326-16] Error en getStudyAISnapshots:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error al consultar snapshots',
    }
  }
}

/**
 * Devuelve el snapshot de extracción más reciente activo (no superseded) para un estudio.
 * Útil para mostrar el estado actual en la UI de la papeleta.
 */
export async function getLatestStudyExtractionSnapshot(eventTestId: string) {
  if (!eventTestId) return null

  try {
    return await prisma.studyExtractionSnapshot.findFirst({
      where: { eventTestId, isSuperseded: false },
      orderBy: { createdAt: 'desc' },
      include: {
        aiPrediagnoses: {
          where: { isSuperseded: false },
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            doctorReviews: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: {
                id: true,
                doctorStatus: true,
                doctorDiagnosis: true,
                doctorNotes: true,
                createdAt: true,
              },
            },
          },
        },
      },
    })
  } catch {
    return null
  }
}
