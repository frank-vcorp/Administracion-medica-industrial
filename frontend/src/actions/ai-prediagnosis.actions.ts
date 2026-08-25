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
 *
 * Seguridad (QA-20260825-01 P1-A):
 *  - `submitDoctorStudyReview` NUNCA confía en `input.reviewedByUserId`.
 *    El ID del médico se deriva SIEMPRE de `getServerSession(authOptions)`
 *    y la sesión debe pertenecer a un rol autorizado
 *    (SUPERADMIN | DOCTOR_GENERAL | DOCTOR_VALIDATOR). El valor recibido
 *    del cliente se IGNORA (no se valida contra el ID de sesión: cualquier
 *    valor externo se descarta). El PDF congelado y la firma/cédula
 *    persistidas provienen del usuario en sesión, no de un parámetro
 *    manipulable.
 */
'use server'

import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { getServerSession } from 'next-auth'
import { revalidatePath } from 'next/cache'
// FIX-20260820-01-VERCEL-BUILD: helper síncrono vive ahora en el módulo
// compartido (no en el archivo 'use server'); getPublishedVersionForSnapshot
// permanece en el actions file (es server action async legítimo).
import { extractSnapshotVersioningFromBackendAudit } from '@/lib/calibration-v3-shared'
import { getPublishedVersionForSnapshot } from './calibration-v3.actions'
// IMPL-FEATURE-20260824-02 gap fix: validación defensiva del cuestionario
// versionado de Espirometría antes de reenviarlo al backend IA. El schema
// es la fuente única de verdad — el server action nunca debe aceptar un
// payload que no cumpla el contrato (riesgo: prompt injection / datos
// arbitrarios hacia MedGemma/DR7).
import {
  EspirometriaQuestionnairePayloadSchema,
  ESPIROMETRIA_QUESTIONNAIRE_SCHEMA_VERSION,
} from '@/schemas/clinical/espirometria-questionnaire.schema'
// IMPL-FEATURE-20260825-02 (gap-fix): mismo patrón para el cuestionario
// auditivo de Audiometría. El helper
// `extractAndValidateClinicalContextAny` decide qué schema aplicar según
// `schemaVersion` antes de aceptar el payload (defensa contra prompt
// injection y contra drift evolutivo).
import {
  AudiometriaQuestionnairePayloadSchema,
  AUDIOMETRIA_QUESTIONNAIRE_SCHEMA_VERSION,
} from '@/schemas/clinical/audiometria-questionnaire.schema'
// IMPL-FEATURE-20260825-01: validación del perfil médico y generación del
// PDF validado de Espirometría. El módulo `espirometry-pdf.tsx` no es un
// server action (no lleva 'use server'); sólo provee funciones puras
// reutilizables.
import {
  generateEspirometryValidatedPdf,
  buildEspirometryPdfData,
  resolveAmiLogoDataUrl,
} from '@/lib/espirometry-pdf'
// IMPL-FEATURE-20260825-02: generación del PDF validado de Audiometría.
// Mismo patrón que Espirometría: helper puro fuera del server action.
import {
  generateAudiometriaValidatedPdf,
  buildAudiometriaPdfData,
} from '@/lib/audiometry-pdf'
import { validateDoctorProfileForPdf } from '@/schemas/clinical/doctor-profile.schema'
import { authOptions } from '@/auth'

/**
 * QA-20260825-01 P1-A: roles autorizados para emitir revisión médica
 * (y por tanto congelar firma/cédula en el PDF). Coincide con los roles
 * que pueden editar el perfil médico (`doctor-profile.actions.ts`).
 */
const AUTHORIZED_REVIEWER_ROLES = new Set<string>([
  'SUPERADMIN',
  'DOCTOR_GENERAL',
  'DOCTOR_VALIDATOR',
])

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
  /** IMPL-20260513-S3: ruta estable del archivo (/api/files/<key> o /uploads/<name>) */
  fileUrl?: string
  /** ARCH-20260518-04: datos extractivos para actualización optimista sin depender de router.refresh() */
  extractionSnapshotVersion?: number
  extractedData?: unknown
  missingFields?: unknown
  rawPayload?: unknown
  /**
   * SPEC-FIX-20260824-01: campos estructurados cuando el rechazo del
   * proveedor extractivo fue clasificado como mismatch de modalidad.
   * Cuando `errorCode === 'STUDY_TYPE_MISMATCH'`, la UI debe usar `message`
   * (redactado) y `selectedStudyType`/`detectedStudyType` para guiar al
   * usuario. NUNCA debe renderizar `error` ni ningún texto crudo del
   * proveedor en este caso (privacidad FND-20260824-02).
   */
  errorCode?: string
  message?: string
  selectedStudyType?: string | null
  detectedStudyType?: string | null
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
  /**
   * IMPL-FEATURE-20260825-01: indica si el PDF validado quedó generado y
   * referenciado en la revisión (`true`) o si quedó pendiente por falta
   * de datos del médico o por error de generación (`false`). El cliente
   * usa este flag para mostrar el botón de descarga sólo cuando aplica.
   */
  pdfGenerated?: boolean
  /**
   * Mensaje legible cuando `pdfGenerated === false`: el cliente lo muestra
   * como toast/error no bloqueante. La revisión médica YA quedó guardada;
   * sólo el artefacto PDF requiere reintento.
   */
  pdfErrorMessage?: string | null
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
// IMPL-FEATURE-20260824-02 gap fix + IMPL-FEATURE-20260825-02 — helper puro:
// extraer y validar el `clinical_context` que
// `PapeletaWorkspace.handleFileUpload` adjunta al FormData cuando hay un
// cuestionario versionado guardado en `EventTest.clinicalContext`.
//
// Soporta DOS ramas (Espirometría y Audiometría) seleccionadas por
// `schemaVersion`:
//
// Reglas:
//   - Si el campo está ausente o vacío → `null` (compat: el backend corre
//     sin contexto adicional, igual que antes de FEATURE-20260824-02).
//   - Si está presente, parsear JSON. Si falla o no es un objeto → `null`
//     (no rompemos el upload: el snapshot sigue siendo válido; sólo se
//     omite el contexto para evitar prompt injection).
//   - Si parsea, validar contra el schema correspondiente al `schemaVersion`
//     declarado. Si NO cumple → `null` + log warn (sin PII). Defensa en
//     profundidad: el snapshot de `EventTest.clinicalContext` YA está
//     validado por el server action de guardado, pero el FormData puede
//     manipularse en cliente antes de llegar aquí.
//   - Si cumple → devolver el payload re-serializado (string JSON) listo
//     para enviar como campo FormData del backend.
//
// Privacidad: el cuestionario NO incluye PII del encabezado (la papeleta ya
// lo aporta); sólo antecedentes clínicos y exploración física del estudio
// (Espirometría o Audiometría según el caso).
// ---------------------------------------------------------------------------

type ValidatedClinicalContext = {
  /** JSON string listo para enviar como FormData. */
  serialized: string
  /** Versión del esquema (para audit/trazabilidad). */
  schemaVersion: string
  /** Tipo canónico del estudio, para que el caller decida si propagarlo. */
  studyType: 'Espirometria' | 'Audiometria'
  /** Indicador de presencia para que el caller lo agregue al audit. */
  present: true
}

/**
 * Tipos de cuestionario soportados por el helper. Mantenerlo como
 * conjunto cerrado facilita auditar las ramas y bloquear versiones
 * futuras desconocidas.
 */
interface SupportedClinicalContext {
  studyType: 'Espirometria' | 'Audiometria'
  schema: (raw: unknown) => { success: true; data: unknown } | { success: false }
}
const SUPPORTED_CLINICAL_CONTEXT_VERSIONS: Record<
  string,
  SupportedClinicalContext
> = {
  [ESPIROMETRIA_QUESTIONNAIRE_SCHEMA_VERSION]: {
    studyType: 'Espirometria',
    schema: (raw) =>
      EspirometriaQuestionnairePayloadSchema.safeParse(raw) as {
        success: true
        data: unknown
      } | { success: false },
  },
  [AUDIOMETRIA_QUESTIONNAIRE_SCHEMA_VERSION]: {
    studyType: 'Audiometria',
    schema: (raw) =>
      AudiometriaQuestionnairePayloadSchema.safeParse(raw) as {
        success: true
        data: unknown
      } | { success: false },
  },
}

function extractAndValidateClinicalContext(
  formData: FormData,
): ValidatedClinicalContext | null {
  return extractAndValidateClinicalContextImpl(formData)
}

/**
 * Variante exportada (con prefijo `_`) para que las pruebas V1 puedan
 * cubrir las dos ramas del helper sin tener que mockear Prisma + fetch.
 *
 * NO se consume desde el código de producción (la action usa
 * `extractAndValidateClinicalContext`, que es un thin wrapper sobre
 * `_extractAndValidateClinicalContext`). El prefijo `_` deja claro que
 * es un detalle de testing y NO es parte del contrato público del módulo.
 */
export function _extractAndValidateClinicalContextImpl(
  formData: FormData,
): ValidatedClinicalContext | null {
  const raw = formData.get('clinical_context')
  if (typeof raw !== 'string' || raw.trim().length === 0) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    console.warn(
      '[IMPL-FEATURE-20260825-02] clinical_context no es JSON válido; se omite sin bloquear el upload.',
    )
    return null
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    console.warn(
      '[IMPL-FEATURE-20260825-02] clinical_context no es un objeto; se omite sin bloquear el upload.',
    )
    return null
  }

  // Defensa contra prompt injection: validar contra el schema versionado
  // correspondiente. Rechazamos versiones futuras desconocidas para
  // evitar bypass evolutivos.
  const version = (parsed as { schemaVersion?: unknown }).schemaVersion
  const supported = SUPPORTED_CLINICAL_CONTEXT_VERSIONS[
    typeof version === 'string' ? version : ''
  ]
  if (!supported) {
    console.warn(
      `[IMPL-FEATURE-20260825-02] clinical_context.schemaVersion="${String(
        version,
      )}" no soportada; se omite sin bloquear el upload.`,
    )
    return null
  }

  const validated = supported.schema(parsed)
  if (!validated.success) {
    console.warn(
      '[IMPL-FEATURE-20260825-02] clinical_context no cumple el schema versionado; se omite sin bloquear el upload.',
    )
    return null
  }

  return {
    serialized: JSON.stringify(validated.data),
    schemaVersion: (validated.data as { schemaVersion: string }).schemaVersion,
    studyType: supported.studyType,
    present: true,
  }
}

// eslint-disable-next-line @typescript-eslint/no-redeclare
function extractAndValidateClinicalContextImpl(
  formData: FormData,
): ValidatedClinicalContext | null {
  return _extractAndValidateClinicalContextImpl(formData)
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
    // IMPL-20260326-18: Reenviar study_type canónico si fue determinado por el helper central
    const studyType = (formData.get('study_type') as string) || null
    // ARCH-20260820-01 Fase 3 (SPEC §9.1, §12.1, §17.4): propagar la fuente de
    // resolución de la calibración al snapshot de extracción/prediagnóstico.
    //   - 'published_v3'        → routing por canonicalStudyType published (AC-3.2)
    //   - 'legacy_heuristic'    → fallback heurístico trazado (AC-3.3)
    //   - 'calibration_disabled'→ snapshot disabled persistido aparte (AC-3.1)
    const calibrationSource =
      (formData.get('calibration_source') as string | null) ?? null
    const calibrationVersionId =
      (formData.get('calibration_version_id') as string | null) ?? null
    const eventTest = await prisma.eventTest.findUnique({
      where: { id: eventTestId },
      select: {
        test: {
          select: {
            options: true,
          },
        },
      },
    })

    const testOptions = eventTest?.test?.options
    const aiCalibration =
      testOptions &&
      typeof testOptions === 'object' &&
      !Array.isArray(testOptions) &&
      'aiCalibration' in testOptions &&
      testOptions.aiCalibration &&
      typeof testOptions.aiCalibration === 'object' &&
      !Array.isArray(testOptions.aiCalibration)
        ? (testOptions.aiCalibration as Prisma.JsonObject)
        : null

    const uploadForm = new FormData()
    uploadForm.append('file', file)
    uploadForm.append('triggered_by_user_id', triggeredByUserId)
    if (studyType) {
      uploadForm.append('study_type', studyType)
    }
    if (aiCalibration) {
      uploadForm.append('ai_calibration_json', JSON.stringify(aiCalibration))
    }
    // IMPL-FEATURE-20260824-02 gap fix: reenviar el `clinical_context`
    // (cuestionario versionado de Espirometría) al backend como FormData
    // opcional. El backend lo lee en `/api/v2/studies/upload-and-analyze`
    // y lo pasa al prompt de MedGemma/DR7 como contexto adicional
    // estructurado. Si el payload está ausente o no es válido, el helper
    // devuelve `null` y NO se reenvía — el upload sigue funcionando sin
    // contexto adicional (compat con FEATURE-20260824-02 AC-6).
    const clinicalContext = extractAndValidateClinicalContext(formData)
    if (clinicalContext) {
      uploadForm.append('clinical_context', clinicalContext.serialized)
    }

    const response = await fetch(`${PYTHON_API}/api/v2/studies/upload-and-analyze`, {
      method: 'POST',
      body: uploadForm,
    })

    if (!response.ok) {
      // SPEC-FIX-20260824-01: aún si el HTTP status no es OK, intentamos
      // parsear un body estructurado para detectar STUDY_TYPE_MISMATCH
      // (main.py responde 200 con status='error' + error_code estructurado,
      // pero mantenemos el parsing defensivo para HTTP 4xx/5xx también).
      let errBody: {
        status?: string
        error?: string
        error_code?: string
        message?: string
        selected_study_type?: string | null
        detected_study_type?: string | null
      } | null = null
      try {
        const errText = await response.text().catch(() => '')
        errBody = errText ? JSON.parse(errText) : null
      } catch {
        // No JSON parseable: caemos al mensaje genérico.
      }
      if (errBody && errBody.error_code === 'STUDY_TYPE_MISMATCH') {
        return {
          success: false,
          error: errBody.error ?? errBody.message ?? 'Documento incompatible con el estudio seleccionado.',
          errorCode: 'STUDY_TYPE_MISMATCH',
          message: errBody.message ?? errBody.error ?? undefined,
          selectedStudyType: errBody.selected_study_type ?? null,
          detectedStudyType: errBody.detected_study_type ?? null,
        }
      }
      const errText = await response.text().catch(() => 'Sin detalle')
      return {
        success: false,
        error: `Backend V2 respondió ${response.status}: ${errText.slice(0, 200)}`,
      }
    }

    const result = await response.json()

    if (result.status !== 'success') {
      // SPEC-FIX-20260824-01: mapear STUDY_TYPE_MISMATCH a campos
      // estructurados. NO exponer el `error` crudo al consumidor — la UI
      // debe usar `message` (redactado por el backend vía
      // build_user_facing_message) y `selectedStudyType`/`detectedStudyType`
      // para guiar al usuario.
      if (result.error_code === 'STUDY_TYPE_MISMATCH') {
        return {
          success: false,
          // `error` se conserva para retrocompat con callers que sólo
          // inspeccionan `error` — contiene el mensaje redactado.
          error:
            result.error ??
            result.message ??
            'Documento incompatible con el estudio seleccionado.',
          errorCode: 'STUDY_TYPE_MISMATCH',
          message: result.message ?? result.error ?? null,
          selectedStudyType: result.selected_study_type ?? null,
          detectedStudyType: result.detected_study_type ?? null,
        }
      }
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

    const activeExtractionIds = (
      await prisma.studyExtractionSnapshot.findMany({
        where: { eventTestId, isSuperseded: false },
        select: { id: true },
      })
    ).map(snapshot => snapshot.id)

    const predxData = result.prediagnosis_snapshot ?? {}
    const clinicalState: string = predxData.clinical_state ?? 'AI_PENDING_REVIEW'

    // ARCH-20260820-01 Fase 3: fusionar `calibration_source` y versionId en el
    // audit del snapshot (trazabilidad de fallback, SPEC §12.1/§17.4). El
    // backend ya puede aportar su propio `audit.calibration_source` (Fase 4
    // consumirá el resolver); aquí garantizamos el trazo frontend cuando no.
    const backendExtractionAudit =
      (result.extraction_snapshot?.audit as Record<string, unknown> | undefined) ?? {}
    // ARCH-20260820-01 Fase 5: resolver el published version local (para
    // fallback si el backend no expuso hashes en su respuesta).
    const publishedVersionForSnap = await getPublishedVersionForSnapshot(eventTestId)
    const versioningV2 = extractSnapshotVersioningFromBackendAudit({
      backendAudit: backendExtractionAudit,
      publishedVersion: publishedVersionForSnap,
    })
    const mergedExtractionAudit: Record<string, unknown> = {
      ...backendExtractionAudit,
      triggered_by_user_id: triggeredByUserId,
      trigger_reason: 'initial_upload',
      ...(calibrationSource
        ? { calibration_source: calibrationSource }
        : {}),
      ...(calibrationVersionId
        ? { calibration_version_id: calibrationVersionId }
        : {}),
      // Fase 5: incluir hashes/schema congelados también en el JSON legacy.
      ...(versioningV2.extractionPromptHash
        ? { extraction_prompt_hash: versioningV2.extractionPromptHash }
        : {}),
      ...(versioningV2.presentationSchemaSnapshot
        ? { presentation_schema_snapshot: versioningV2.presentationSchemaSnapshot }
        : {}),
      // IMPL-FEATURE-20260824-02 gap fix: trazabilidad del cuestionario
      // estructurado de Espirometría cuando fue reenviado al backend.
      // Guardamos sólo el schemaVersion (no el payload completo: ya vive
      // en EventTest.clinicalContext y es PII-mínimo por contrato).
      ...(clinicalContext
        ? { clinical_context_schema_version: clinicalContext.schemaVersion }
        : {}),
    }
    const mergedExtractionSnapshot = {
      ...(result.extraction_snapshot ?? {}),
      audit: mergedExtractionAudit,
    }

    const backendPredxAudit =
      (predxData.audit as Record<string, unknown> | undefined) ?? {}
    const mergedPredxAudit: Record<string, unknown> = {
      ...backendPredxAudit,
      triggered_by_user_id: triggeredByUserId,
      ...(calibrationSource
        ? { calibration_source: calibrationSource }
        : {}),
      ...(calibrationVersionId
        ? { calibration_version_id: calibrationVersionId }
        : {}),
      // Fase 5: incluir hashes clínicos congelados también en el JSON legacy.
      ...(versioningV2.clinicalPromptHash
        ? { clinical_prompt_hash: versioningV2.clinicalPromptHash }
        : {}),
      ...(versioningV2.clinicalCriteriaHash
        ? { clinical_criteria_hash: versioningV2.clinicalCriteriaHash }
        : {}),
      // IMPL-FEATURE-20260824-02 gap fix: misma trazabilidad a nivel del
      // prediagnóstico (consistente con extraction audit). El contenido del
      // contexto NO se duplica en el snapshot: vive en EventTest.clinicalContext.
      ...(clinicalContext
        ? { clinical_context_schema_version: clinicalContext.schemaVersion }
        : {}),
    }
    const mergedPredxData = { ...predxData, audit: mergedPredxAudit }

    // 3-6. Mantener histórico y desplazar la vigencia a la nueva corrida.
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
          studyType: result.extraction_snapshot?.study_type ?? result.classification?.detected_type ?? 'Otro',
          sourceFileName: result.file,
          sourceFileUrl: result.file_url ?? `/uploads/${result.file}`,
          sourceFileHash: result.extraction_snapshot?.audit?.source_file_hash ?? null,
          structuredData: mergedExtractionSnapshot,
          clinicalState: 'DRAFT_EXTRACTED',
          modelName: result.extraction_snapshot?.audit?.model_name ?? 'gemini-2.5-flash',
          promptVersion: result.extraction_snapshot?.audit?.prompt_version ?? 'extract-v2',
          pipelineVersion: result.extraction_snapshot?.audit?.pipeline_version ?? 'ai-pipeline-2026-03',
          triggeredByUserId,
          triggerReason: 'initial_upload',
          isSuperseded: false,
          // ARCH-20260820-01 Fase 5: snapshot versionado — capa extractiva congelada.
          calibrationVersionId: versioningV2.calibrationVersionId,
          calibrationVersionNumber: versioningV2.calibrationVersionNumber,
          presentationSchemaSnapshot:
            (versioningV2.presentationSchemaSnapshot as Prisma.InputJsonValue) ?? Prisma.JsonNull,
          extractionPromptHash: versioningV2.extractionPromptHash,
        },
      })

      const nextPrediagnosisSnapshot = await tx.aIPrediagnosisSnapshot.create({
        data: {
          extractionSnapshotId: nextExtractionSnapshot.id,
          version: 1,
          prediagnosisData: mergedPredxData,
          clinicalState,
          modelName: predxData.audit?.model_name ?? 'gemini-2.5-flash',
          promptVersion: predxData.audit?.prompt_version ?? 'predx-v1',
          corpusVersion: predxData.audit?.corpus_version ?? null,
          triggeredByUserId,
          isSuperseded: false,
          // ARCH-20260820-01 Fase 5: snapshot versionado — capa interpretativa congelada.
          calibrationVersionId: versioningV2.calibrationVersionId,
          calibrationVersionNumber: versioningV2.calibrationVersionNumber,
          clinicalPromptHash: versioningV2.clinicalPromptHash,
          clinicalCriteriaHash: versioningV2.clinicalCriteriaHash,
        },
      })

      await tx.eventTest.update({
        where: { id: eventTestId },
        data: {
          fileUrl: result.file_url ?? `/uploads/${result.file}`,
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
      success: true,
      extractionSnapshotId: extractionSnapshot.id,
      prediagnosisSnapshotId: prediagnosisSnapshot.id,
      clinicalState,
      summary: predxData.summary ?? null,
      confidence: predxData.confidence ?? null,
      // IMPL-20260513-S3: propagar ruta estable para que uploadEventTestFile actualice estado local
      fileUrl: result.file_url ?? `/uploads/${result.file}`,
      // ARCH-20260518-04: datos extractivos para actualización optimista del cliente
      extractionSnapshotVersion: extractionVersion,
      extractedData: (result.extraction_snapshot?.extracted_data ?? null) as unknown,
      missingFields: (result.extraction_snapshot?.missing_fields ?? null) as unknown,
      rawPayload: (result.extraction_snapshot ?? null) as unknown,
    }
  } catch (error) {
    console.error('[IMPL-20260326-16] Error en triggerStudyAIAnalysis:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error interno al procesar análisis IA',
    }
  }
}

function listMissingFields(extractedData: Record<string, unknown>): string[] {
  return Object.entries(extractedData)
    .filter(([, value]) => {
      if (value === null || value === undefined) return true
      if (typeof value === 'string') {
        const normalized = value.trim().toUpperCase()
        return normalized === '' || normalized === 'NO APLICA'
      }
      return false
    })
    .map(([key]) => key)
}

export async function triggerStructuredStudyAIPrediagnosis(input: {
  eventTestId: string
  eventId: string
  studyType: string
  extractedData: Record<string, unknown>
  triggeredByUserId?: string
  triggerReason?: string
}): Promise<StudyAIAnalysisResult> {
  const {
    eventTestId,
    eventId,
    studyType,
    extractedData,
    triggeredByUserId = 'system',
    triggerReason = 'internal_form_capture',
  } = input

  if (!eventTestId || !eventId || !studyType) {
    return { success: false, error: 'eventTestId, eventId y studyType son obligatorios' }
  }

  try {
    const normalizedExtractedData = JSON.parse(JSON.stringify(extractedData)) as Prisma.InputJsonValue

    const response = await fetch(`${PYTHON_API}/api/v2/studies/prediagnosis-from-params`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        study_type: studyType,
        extracted_data: extractedData,
        triggered_by_user_id: triggeredByUserId,
      }),
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
      return { success: false, error: result.error || 'Error desconocido en prediagnóstico estructurado' }
    }

    // ARCH-20260820-01 Fase 5: resolver published version + extraer hashes del
    // audit que el backend ya incluye en `result.audit` (ver §2.2 backend).
    const publishedVersionStructuredSnap = await getPublishedVersionForSnapshot(eventTestId)
    const versioningStructured = extractSnapshotVersioningFromBackendAudit({
      backendAudit: (result.audit as Record<string, unknown> | undefined) ?? null,
      publishedVersion: publishedVersionStructuredSnap,
    })

    const extractionVersion = await prisma.studyExtractionSnapshot.count({
      where: { eventTestId },
    }) + 1

    const extractionSnapshot = await prisma.studyExtractionSnapshot.create({
      data: {
        eventTestId,
        version: extractionVersion,
        studyType,
        sourceFileName: null,
        sourceFileUrl: null,
        sourceFileHash: null,
        structuredData: {
          study_type: studyType,
          source_file_name: null,
          extracted_data: normalizedExtractedData,
          missing_fields: listMissingFields(extractedData),
          quality_notes: ['structured_internal_form'],
          audit: {
            model_name: 'internal-structured-form',
            prompt_version: 'internal-form-v1',
            pipeline_version: 'ai-pipeline-2026-03',
            triggered_by_user_id: triggeredByUserId,
            trigger_reason: 'manual_regeneration',
            created_at: new Date().toISOString(),
            // ARCH-20260820-01 Fase 5: incluir hashes/schema congelados también
            // en el JSON legacy para auditoría del snapshot de extracción.
            ...(versioningStructured.extractionPromptHash
              ? { extraction_prompt_hash: versioningStructured.extractionPromptHash }
              : {}),
            ...(versioningStructured.presentationSchemaSnapshot
              ? {
                  presentation_schema_snapshot:
                    versioningStructured.presentationSchemaSnapshot,
                }
              : {}),
          },
        } as Prisma.InputJsonValue,
        clinicalState: 'DRAFT_EXTRACTED',
        modelName: 'internal-structured-form',
        promptVersion: 'internal-form-v1',
        pipelineVersion: 'ai-pipeline-2026-03',
        triggeredByUserId,
        triggerReason,
        isSuperseded: false,
        // ARCH-20260820-01 Fase 5: snapshot versionado — capa extractiva
        // congelada (compartida con el de prediagnóstico, misma versión).
        calibrationVersionId: versioningStructured.calibrationVersionId,
        calibrationVersionNumber: versioningStructured.calibrationVersionNumber,
        presentationSchemaSnapshot:
          (versioningStructured.presentationSchemaSnapshot as Prisma.InputJsonValue) ??
          Prisma.JsonNull,
        extractionPromptHash: versioningStructured.extractionPromptHash,
      },
    })

    const predxData = result.prediagnosis ?? {}
    const clinicalState: string = predxData.clinical_state ?? result.clinical_state ?? 'AI_PENDING_REVIEW'

    const prediagnosisSnapshot = await prisma.aIPrediagnosisSnapshot.create({
      data: {
        extractionSnapshotId: extractionSnapshot.id,
        version: 1,
        prediagnosisData: {
          ...predxData,
          audit: {
            ...(result.audit ?? {}),
            triggered_by_user_id: triggeredByUserId,
            // ARCH-20260820-01 Fase 5: hashes clínicos congelados también en
            // el JSON legacy para auditoría sin recarga a Prisma.
            ...(versioningStructured.clinicalPromptHash
              ? { clinical_prompt_hash: versioningStructured.clinicalPromptHash }
              : {}),
            ...(versioningStructured.clinicalCriteriaHash
              ? { clinical_criteria_hash: versioningStructured.clinicalCriteriaHash }
              : {}),
          },
        },
        clinicalState,
        modelName: result.audit?.model_name ?? 'gemini-2.5-flash',
        promptVersion: result.audit?.prompt_version ?? 'predx-v1',
        corpusVersion: result.audit?.corpus_version ?? null,
        triggeredByUserId,
        isSuperseded: false,
        // ARCH-20260820-01 Fase 5: snapshot versionado — capa interpretativa
        // congelada (mismas versiones y hashes clínicos que el audit de arriba).
        calibrationVersionId: versioningStructured.calibrationVersionId,
        calibrationVersionNumber: versioningStructured.calibrationVersionNumber,
        clinicalPromptHash: versioningStructured.clinicalPromptHash,
        clinicalCriteriaHash: versioningStructured.clinicalCriteriaHash,
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
    console.error('[IMPL-20260326-19] Error en triggerStructuredStudyAIPrediagnosis:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error interno al procesar prediagnóstico estructurado',
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
    // QA-20260825-01 P1-A: el `reviewedByUserId` enviado por el cliente se
    // EXTRAE pero NO SE USA. El ID efectivo se deriva de la sesión.
    reviewedByUserId: _clientReviewedByUserId,
    aiAgreementScore,
    aiUsefulnessScore,
    differenceType,
    errorSeverity,
    errorCategory,
    doctorFeedbackNote,
    eventId,
  } = input

  if (!prediagnosisSnapshotId || !doctorStatus) {
    return { success: false, error: 'Faltan campos obligatorios en la revisión médica' }
  }

  const validStatuses = ['REVIEWED_ACCEPTED', 'REVIEWED_EDITED', 'REVIEWED_REJECTED']
  if (!validStatuses.includes(doctorStatus)) {
    return { success: false, error: `Estado de revisión inválido: ${doctorStatus}` }
  }

  // ── QA-20260825-01 P1-A: binding de sesión ─────────────────────────────
  // El ID del médico se toma SIEMPRE de `getServerSession`. El valor del
  // cliente se ignora silenciosamente para no romper la firma del action
  // (retrocompat con callers existentes que aún lo mandan).
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return { success: false, error: 'No autenticado' }
  }
  if (!AUTHORIZED_REVIEWER_ROLES.has(session.user.role)) {
    return { success: false, error: 'Sin permisos para emitir revisión médica' }
  }
  const reviewedByUserId = session.user.id

  try {
    // Verificar que el snapshot existe y traer su prediagnosisData + chain
    // mínima para generar el PDF cuando aplique.
    const snapshot = await prisma.aIPrediagnosisSnapshot.findUnique({
      where: { id: prediagnosisSnapshotId },
      include: {
        extractionSnapshot: {
          select: {
            studyType: true,
            structuredData: true,
            eventTest: {
              select: {
                testNameSnapshot: true,
                eventId: true,
                event: {
                  select: {
                    worker: {
                      select: {
                        firstName: true,
                        lastName: true,
                        universalId: true,
                        company: { select: { name: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    })
    if (!snapshot) {
      return { success: false, error: 'Snapshot de prediagnóstico no encontrado' }
    }

    // ── IMPL-FEATURE-20260825-01 ────────────────────────────────────────────
    // Congelar identidad del médico en la revisión (sólo si la revisión va
    // a generar PDF: ACCEPTED o EDITED). Para REJECTED la firma/cédula NO
    // se persisten en el snapshot — el rechazo no genera PDF y el médico
    // sigue siendo trazable por `reviewedByUserId` (de sesión).
    const shouldGeneratePdf =
      doctorStatus === 'REVIEWED_ACCEPTED' || doctorStatus === 'REVIEWED_EDITED'

    let snapshotFullName: string | null = null
    let snapshotLicense: string | null = null
    let snapshotSignatureUrl: string | null = null
    if (shouldGeneratePdf) {
      const reviewer = await prisma.user.findUnique({
        where: { id: reviewedByUserId },
        select: { fullName: true, professionalLicense: true, signatureImageUrl: true },
      })
      if (!reviewer) {
        return { success: false, error: 'Médico revisor no encontrado' }
      }
      const validationError = validateDoctorProfileForPdf({
        fullName: reviewer.fullName,
        professionalLicense: reviewer.professionalLicense,
        signatureImageUrl: reviewer.signatureImageUrl,
      })
      if (validationError) {
        return {
          success: false,
          error: validationError,
        }
      }
      snapshotFullName = reviewer.fullName
      snapshotLicense = reviewer.professionalLicense ?? null
      snapshotSignatureUrl = reviewer.signatureImageUrl ?? null
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
        // IMPL-FEATURE-20260825-01: snapshot congelado de identidad.
        validatorSnapshotFullName: snapshotFullName,
        validatorSnapshotProfessionalLicense: snapshotLicense,
        validatorSnapshotSignatureUrl: snapshotSignatureUrl,
      },
    })

    // Actualizar clinicalState del prediagnóstico al estado revisado
    await prisma.aIPrediagnosisSnapshot.update({
      where: { id: prediagnosisSnapshotId },
      data: { clinicalState: doctorStatus },
    })

    // ── IMPL-FEATURE-20260825-01: generación de PDF validado ────────────────
    // ── IMPL-FEATURE-20260825-02: dispatch por tipo de estudio ────────────
    let pdfGenerated = false
    let pdfErrorMessage: string | null = null
    if (shouldGeneratePdf && snapshotFullName && snapshotLicense && snapshotSignatureUrl) {
      try {
        const eventTestData = snapshot.extractionSnapshot?.eventTest
        const worker = eventTestData?.event?.worker
        const studyType =
          (snapshot.extractionSnapshot?.studyType ?? '') as string

        // QA-20260825-01 P3-G: resolver el logo UNA VEZ por proceso (cacheado).
        const logoDataUrl = await resolveAmiLogoDataUrl()

        const baseInput = {
          reviewId: review.id,
          doctorStatus:
            doctorStatus === 'REVIEWED_ACCEPTED'
              ? 'REVIEWED_ACCEPTED'
              : 'REVIEWED_EDITED',
          doctorDiagnosis,
          doctorNotes,
          reviewCreatedAt: review.createdAt,
          prediagnosisData: snapshot.prediagnosisData,
          extractionStructuredData: snapshot.extractionSnapshot?.structuredData,
          studyName: eventTestData?.testNameSnapshot ?? null,
          studyType,
          patient: {
            firstName: worker?.firstName ?? '',
            lastName: worker?.lastName ?? '',
            universalId: worker?.universalId ?? null,
            companyName: worker?.company?.name ?? null,
          },
          medico: {
            fullName: snapshotFullName,
            professionalLicense: snapshotLicense,
            signatureImageUrl: snapshotSignatureUrl,
          },
          logoDataUrl,
        }

        // IMPL-FEATURE-20260825-02: dispatch por tipo. Espirometría conserva
        // el flujo existente (IMPL-FEATURE-20260825-01). Audiometría usa el
        // template propio con PTA3, PTA fuente, capas NOM/AMI/fuente.
        let pdfResult:
          | { url: string | null; hash: string; buffer: Buffer }
          | null = null
        const typedDoctorStatus =
          doctorStatus === 'REVIEWED_ACCEPTED'
            ? 'REVIEWED_ACCEPTED' as const
            : 'REVIEWED_EDITED' as const
        if (studyType === 'Audiometria') {
          const pdfData = buildAudiometriaPdfData({
            ...baseInput,
            doctorStatus: typedDoctorStatus,
          })
          pdfResult = await generateAudiometriaValidatedPdf({
            reviewId: review.id,
            data: pdfData,
          })
        } else {
          // Default: Espirometría (FEATURE-20260825-01). Otros estudios sin
          // template propio: NO se genera PDF (contrato vigente).
          const pdfData = buildEspirometryPdfData({
            ...baseInput,
            doctorStatus: typedDoctorStatus,
          })
          pdfResult = await generateEspirometryValidatedPdf({
            reviewId: review.id,
            data: pdfData,
          })
        }

        await prisma.doctorStudyReview.update({
          where: { id: review.id },
          data: {
            validatedPdfUrl: pdfResult.url,
            validatedPdfGeneratedAt: new Date(),
            validatedPdfHash: pdfResult.hash,
            validatedPdfError: null,
          },
        })
        pdfGenerated = true
      } catch (pdfErr) {
        // IMPL-FEATURE-20260825-01: error visible y la revisión NO queda
        // marcada como PDF listo. Persistimos el mensaje para que la UI
        // pueda mostrarlo en reintento.
        pdfErrorMessage =
          pdfErr instanceof Error
            ? pdfErr.message
            : 'Error desconocido al generar el PDF validado.'
        try {
          await prisma.doctorStudyReview.update({
            where: { id: review.id },
            data: { validatedPdfError: pdfErrorMessage },
          })
        } catch (persistErr) {
          console.error(
            '[IMPL-FEATURE-20260825-01] No se pudo persistir validatedPdfError:',
            persistErr,
          )
        }
      }
    }

    revalidatePath(`/events/${eventId}`)

    return {
      success: true,
      reviewId: review.id,
      pdfGenerated,
      pdfErrorMessage,
    }
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
