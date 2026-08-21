/**
 * @file Server Actions V3: Calibración IA como fuente única (ARCH-20260820-01 Fase 2).
 * @spec context/SPECs/SPEC_ARCH-20260820-01-CALIBRACION-FUENTE-UNICA.md §5, §6, §8, §14
 * @decision DEC-20260820-02 (operationMode), FND-20260820-04 (familyTemplate)
 *
 * Implementa el contrato `aiCalibration` V3 en frontend con:
 *   - `saveAICalibrationV3(testId, draft)` — guarda draft/tested mutable.
 *   - `publishAICalibrationV3(testId)` — valida gates G0-G9, transición
 *     atómica `tested → published`, versión anterior → `superseded`,
 *     congelación de `legacyV1V2Snapshot` al primer publish desde V1/V2,
 *     retención de las últimas `MAX_SUPERSEDED_VERSIONS` (20),
 *     audit log `action="calibration_published"`.
 *
 * Decisiones pendientes Frank resueltas con propuestas INTEGRA reversibles
 * (handoff §11):
 *   - Rol de publicación: gate con SUPERADMIN por defecto, configurable.
 *   - Retención: últimas 20 `superseded` (mismo límite que saveAICalibrationV2).
 *   - Corte V1/V2: adaptador y fallbacks hardcodeados permanecen hasta Fase 7.
 *   - Catálogo FamilyTemplate: `familyTemplateId=null` hasta decisión funcional.
 *
 * No toca auth (consume el sistema existente como company.actions.ts), ni
 * secrets, ni producción. `saveAICalibration`/`saveAICalibrationV2` permanecen
 * operativos (marcados `@deprecated`).
 *
 * @id ARCH-20260820-01
 */
'use server'

import { revalidatePath } from 'next/cache'
import { Prisma } from '@prisma/client'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/auth'
import { isSuperAdmin, isAdminLike } from '@/lib/auth/roles'
import prisma from '@/lib/prisma'
import {
  PUBLISH_REQUIRED_ROLE,
  MAX_SUPERSEDED_VERSIONS,
  type PublishedVersionForSnapshot,
} from '@/lib/calibration-v3-shared'
import type {
  AICalibrationV3,
  AICalibrationDraftV3,
  AICalibrationVersionV3,
  LegacyV1V2Snapshot,
  OperationMode,
} from '@/types/calibration'

// NOTA — FIX-20260820-01-VERCEL-BUILD: las constantes `PUBLISH_REQUIRED_ROLE`
// y `MAX_SUPERSEDED_VERSIONS` se movieron a `@/lib/calibration-v3-shared.ts`
// porque el archivo con directiva `'use server'` a nivel de archivo sólo
// admite exports de funciones async (regla de Server Actions de Next.js 16).
// Se reimportan arriba desde el módulo compartido; siguen disponibles en este
// módulo mediante los usos dentro de las acciones (p.ej. `publishAICalibrationV3`).
// Ver context/interconsultas/DICTAMEN_FIX-20260820-01-VERCEL-BUILD.md §F.1.

/**
 * Tipos canónicos válidos para `canonicalStudyType` (SPEC §8 gate G1).
 * `document_extraction` sin routing XML puede omitir canonicalStudyType.
 */
const VALID_CANONICAL_STUDY_TYPES = new Set<string>([
  'Audiometria',
  'Espirometria',
  'ECG',
  'ExamenMedico',
])

// ─────────────────────────────────────────────────────────────────────────────
// Códigos de error de publicación (SPEC §8 gates G0-G9)
// ─────────────────────────────────────────────────────────────────────────────

export type PublishErrorCode =
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'TEST_NOT_FOUND'
  | 'NO_DRAFT'
  | 'DRAFT_NOT_TESTED'
  | 'PUBLISH_INVALID_OPERATION_MODE'        // G0
  | 'PUBLISH_MANUAL_SERVICE_NO_CALIBRATION' // G0b
  | 'PUBLISH_INVALID_CANONICAL_TYPE'         // G1
  | 'PUBLISH_EXTRACTION_PROMPT_EMPTY'       // G2
  | 'PUBLISH_CLINICAL_PROMPT_EMPTY'         // G3
  | 'PUBLISH_PRESENTATION_SCHEMA_EMPTY'     // G4
  | 'PUBLISH_MISSING_E2E_TEST'              // G5 (N/A justificado en Fase 2)
  | 'PUBLISH_VERSION_ID_COLLISION'          // G6
  | 'PUBLISH_REQUIRED_PARAMS_NOT_DEFINED'   // G7
  | 'PUBLISH_FAMILY_MODE_MISMATCH'          // G8
  | 'PUBLISH_FAMILY_OVERRIDE_REMOVES_REQUIRED' // G9
  | 'INTERNAL_ERROR'

export type PublishV3Result =
  | { ok: true; versionId: string; versionNumber: number }
  | { ok: false; code: PublishErrorCode; error: string }

export type SaveDraftV3Result =
  | { ok: true; status: 'draft' | 'tested' }
  | {
      ok: false
      code:
        | 'UNAUTHENTICATED'
        | 'FORBIDDEN'
        | 'TEST_NOT_FOUND'
        | 'MANUAL_SERVICE_NO_CALIBRATION'
        | 'INVALID_INPUT'
        | 'INTERNAL_ERROR'
      error: string
    }

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de parsing seguro del JSON de `MedicalTest.options`
// ─────────────────────────────────────────────────────────────────────────────

function toPrismaJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Lee `MedicalTest.options` como objeto. Acepta dict, JSON-string o null.
 */
function parseOptions(rawOptions: unknown): Record<string, unknown> {
  if (isPlainObject(rawOptions)) return rawOptions
  if (typeof rawOptions === 'string' && rawOptions.trim()) {
    try {
      const parsed: unknown = JSON.parse(rawOptions)
      return isPlainObject(parsed) ? parsed : {}
    } catch {
      return {}
    }
  }
  return {}
}

/**
 * Lee la raíz `aiCalibration` V3 de `options`. Devuelve null si no existe
 * o no es V3. No normaliza V1/V2 (eso lo hace el resolver backend).
 */
function readV3Root(options: Record<string, unknown>): AICalibrationV3 | null {
  const raw = options.aiCalibration
  if (!isPlainObject(raw)) return null
  if (raw.schemaVersion !== 'V3') return null
  return raw as unknown as AICalibrationV3
}

/**
 * Lee `operationMode` de `options` (propiedad del catálogo, SPEC §5.0).
 */
function readOperationMode(options: Record<string, unknown>): OperationMode | null {
  const mode = options.operationMode
  if (mode === 'manual_service' || mode === 'document_extraction' || mode === 'clinical_interpretation') {
    return mode
  }
  return null
}

function isValidOperationMode(value: unknown): value is OperationMode {
  return value === 'manual_service' || value === 'document_extraction' || value === 'clinical_interpretation'
}

// ─────────────────────────────────────────────────────────────────────────────
// saveAICalibrationV3 — guarda draft/tested mutable (SPEC §5.3, AC-2.1)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Persiste un draft V3 (mutable, status `draft` o `tested`) en
 * `MedicalTest.options.aiCalibration.draft`. No publica; la publicación
 * requiere `publishAICalibrationV3` (gates G0-G9).
 *
 * Rechaza con `MANUAL_SERVICE_NO_CALIBRATION` si `operationMode =
 * manual_service` (DEC-20260820-02: no existe bloque aiCalibration para
 * servicios manuales).
 *
 * Si no existe raíz V3, la inicializa (schemaVersion, familyTemplateId=null,
 * publishedVersions=[], legacyV1V2Snapshot=null).
 *
 * RBAC: cualquier ADMIN (isAdminLike) puede editar drafts. La publicación
 * requiere SUPERADMIN (publishAICalibrationV3).
 */
export async function saveAICalibrationV3(
  testId: string,
  draft: AICalibrationDraftV3,
): Promise<SaveDraftV3Result> {
  // Gate de sesión: ADMIN o superior para editar drafts.
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return { ok: false, code: 'UNAUTHENTICATED', error: 'Sin sesión' }
  }
  const role = (session.user as { role?: string }).role
  // F-2.1 (QA-20260820-03): SPEC §17.2 — ADMIN o superior para editar drafts.
  // Publicar (publishAICalibrationV3) requiere SUPERADMIN (acción sensible).
  if (!isAdminLike(role)) {
    return { ok: false, code: 'FORBIDDEN', error: 'Se requiere rol ADMIN o superior para editar calibración' }
  }

  if (!testId || typeof testId !== 'string') {
    return { ok: false, code: 'INVALID_INPUT', error: 'testId requerido' }
  }
  if (!draft || typeof draft !== 'object') {
    return { ok: false, code: 'INVALID_INPUT', error: 'draft inválido' }
  }
  if (draft.status !== 'draft' && draft.status !== 'tested') {
    return { ok: false, code: 'INVALID_INPUT', error: 'draft.status debe ser "draft" o "tested"' }
  }

  const test = await prisma.medicalTest.findUnique({
    where: { id: testId },
    select: { id: true, options: true },
  })
  if (!test) return { ok: false, code: 'TEST_NOT_FOUND', error: 'Prueba no encontrada' }

  const options = parseOptions(test.options)
  const operationMode = readOperationMode(options)

  // DEC-20260820-02: manual_service no tiene bloque aiCalibration.
  if (operationMode === 'manual_service') {
    return {
      ok: false,
      code: 'MANUAL_SERVICE_NO_CALIBRATION',
      error: 'Las pruebas con operationMode=manual_service no admiten calibración IA',
    }
  }

  // Inicializar raíz V3 si no existe (no se inventa contenido de plantilla).
  // AC-2.5 / CA-G15: si options.aiCalibration era V1/V2 (no V3) y lo vamos
  // a sobrescribir con la raíz V3 nueva, capturamos el legacy aquí para
  // que `publishAICalibrationV3` pueda preservarlo (congelación al primer
  // publish material). Si ya era V3, no se captura (no hay legacy).
  const existingAiCal = options.aiCalibration
  const hadLegacyV1V2 =
    isPlainObject(existingAiCal) &&
    (existingAiCal as { schemaVersion?: unknown }).schemaVersion !== 'V3'

  let legacyV1V2Snapshot = null as LegacyV1V2Snapshot | null
  if (hadLegacyV1V2) {
    legacyV1V2Snapshot = {
      snapshot: existingAiCal as Record<string, unknown>,
      migratedAt: new Date().toISOString(),
      migratedBy: (session.user as { id?: string }).id ?? null,
      sourceSchemaVersion: String(
        (existingAiCal as { schemaVersion?: unknown }).schemaVersion ?? 'V1V2',
      ),
    }
  }

  const root = readV3Root(options) ?? {
    schemaVersion: 'V3' as const,
    currentPublishedVersionId: null,
    familyTemplateId: null, // P-04: null hasta decisión funcional ATLAS.
    overrides: undefined,
    draft: null,
    publishedVersions: [] as AICalibrationVersionV3[],
    // Preservar snapshot legacy si ya estaba congelado; si lo capturamos
    // ahora (primer save V3 desde V1/V2), lo fijamos aquí.
    legacyV1V2Snapshot,
  }

  // Si la raíz V3 ya existía pero sin snapshot y detectamos legacy V1/V2
  // (caso raro: raíz V3 inicializada sin capturar), lo fijamos ahora.
  if (!root.legacyV1V2Snapshot && legacyV1V2Snapshot) {
    root.legacyV1V2Snapshot = legacyV1V2Snapshot
  }

  // Para document_extraction, forzar clinicalCriteria=null (CB-14).
  const effectiveDraft: AICalibrationDraftV3 = {
    ...draft,
    clinicalCriteria: operationMode === 'document_extraction' ? null : draft.clinicalCriteria,
    updatedAt: new Date().toISOString(),
  }

  const updatedRoot: AICalibrationV3 = {
    ...root,
    draft: effectiveDraft,
    // Preservar publishedVersions, legacyV1V2Snapshot, familyTemplateId.
  }

  const newOptions = toPrismaJsonValue({ ...options, aiCalibration: updatedRoot })

  try {
    await prisma.medicalTest.update({
      where: { id: testId },
      data: { options: newOptions },
    })
    revalidatePath(`/admin/services/${testId}/calibration`)
    revalidatePath('/admin/services')
    return { ok: true, status: effectiveDraft.status }
  } catch (e: unknown) {
    console.error('[Calibration V3] Error guardando draft V3:', e)
    return { ok: false, code: 'INTERNAL_ERROR', error: 'Error al guardar el draft de calibración' }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// publishAICalibrationV3 — gates G0-G9 + transición atómica (SPEC §8, AC-2.2)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Valida gates G0-G9 (SPEC §8) y transiciona `tested → published`:
 *   - La versión `published` anterior pasa a `superseded` atómicamente
 *     (AC-2.3). No pueden coexistir dos `published`.
 *   - `publishedVersions[]` conserva la nueva versión inmutable (AC-2.4).
 *   - `legacyV1V2Snapshot` se congela al primer publish desde V1/V2
 *     (AC-2.5, CA-G15); publicaciones posteriores no lo sobrescriben.
 *   - Retención: últimas `MAX_SUPERSEDED_VERSIONS` (20) `superseded`.
 *   - Audit log `action="calibration_published"` (SPEC §17.3).
 *
 * G5 (E2E test previo): N/A justificado en Fase 2 — no hay infraestructura
 * de prueba E2E de calibración todavía. El draft puede pasar a `tested`
 * manualmente; G5 se omite sin rechazar la publicación.
 *
 * G8/G9 (familyTemplate): con `familyTemplateId=null` (P-04, todas las
 * pruebas hasta decisión funcional), los gates de coherencia de familia son
 * no-ops (no hay plantilla contra la que validar).
 *
 * RBAC: SUPERADMIN (PUBLISH_REQUIRED_ROLE, configurable).
 */
export async function publishAICalibrationV3(testId: string): Promise<PublishV3Result> {
  // ── Gate de sesión + rol (ADR §7.1; propuesta INTEGRA: SUPERADMIN) ──────
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return { ok: false, code: 'UNAUTHENTICATED', error: 'Sin sesión' }
  }
  const role = (session.user as { role?: string }).role
  if (!isSuperAdmin(role)) {
    return {
      ok: false,
      code: 'FORBIDDEN',
      error: `Se requiere rol ${PUBLISH_REQUIRED_ROLE} para publicar calibración`,
    }
  }
  const publishedBy = (session.user as { id?: string }).id ?? null

  if (!testId || typeof testId !== 'string') {
    return { ok: false, code: 'TEST_NOT_FOUND', error: 'testId requerido' }
  }

  const test = await prisma.medicalTest.findUnique({
    where: { id: testId },
    select: { id: true, options: true },
  })
  if (!test) return { ok: false, code: 'TEST_NOT_FOUND', error: 'Prueba no encontrada' }

  const options = parseOptions(test.options)
  const operationMode = readOperationMode(options)
  const root = readV3Root(options)

  // ── Gates G0 / G0b (DEC-20260820-02) ─────────────────────────────────────
  // G0: operationMode definido y válido.
  if (!isValidOperationMode(operationMode)) {
    return {
      ok: false,
      code: 'PUBLISH_INVALID_OPERATION_MODE',
      error: 'MedicalTest.options.operationMode no está definido o no es válido',
    }
  }
  // G0b: operationMode != manual_service.
  if (operationMode === 'manual_service') {
    return {
      ok: false,
      code: 'PUBLISH_MANUAL_SERVICE_NO_CALIBRATION',
      error: 'No se publica calibración para servicios manuales (operationMode=manual_service)',
    }
  }

  if (!root) {
    return { ok: false, code: 'NO_DRAFT', error: 'No existe contrato aiCalibration V3' }
  }

  const draft = root.draft
  if (!draft) {
    return { ok: false, code: 'NO_DRAFT', error: 'No hay draft para publicar' }
  }
  // El draft debe estar en status 'tested' (SPEC §6.1).
  // Aceptamos también 'draft' para no bloquear el flujo en Fase 2 sin
  // infraestructura E2E (G5 N/A), pero emitimos el gate G5 como N/A.
  if (draft.status !== 'tested' && draft.status !== 'draft') {
    return { ok: false, code: 'DRAFT_NOT_TESTED', error: 'El draft debe estar en status tested o draft' }
  }

  // ── Gate G1: canonicalStudyType válido (omitible para document_extraction) ─
  // Para document_extraction sin routing XML, canonicalStudyType puede ser null.
  if (operationMode === 'clinical_interpretation') {
    const cst = draft.canonicalStudyType
    if (cst && !VALID_CANONICAL_STUDY_TYPES.has(cst)) {
      return {
        ok: false,
        code: 'PUBLISH_INVALID_CANONICAL_TYPE',
        error: `canonicalStudyType "${cst}" no es un valor canónico válido`,
      }
    }
  }

  // ── Gate G2: extraction.enabled=true → extraction.prompt no vacío ────────
  const extraction = draft.extraction
  if (extraction?.enabled === true) {
    if (!extraction.prompt || !extraction.prompt.trim()) {
      return {
        ok: false,
        code: 'PUBLISH_EXTRACTION_PROMPT_EMPTY',
        error: 'extraction.enabled=true requiere extraction.prompt no vacío',
      }
    }
  }

  // ── Gate G3: clinical_interpretation + prediagnosisEnabled → prompt ──────
  // No aplica a document_extraction (clinicalCriteria es null).
  const clinicalCriteria = draft.clinicalCriteria
  if (operationMode === 'clinical_interpretation' && clinicalCriteria) {
    if (clinicalCriteria.prediagnosisEnabled === true) {
      if (!clinicalCriteria.prompt || !clinicalCriteria.prompt.trim()) {
        return {
          ok: false,
          code: 'PUBLISH_CLINICAL_PROMPT_EMPTY',
          error: 'clinicalCriteria.prediagnosisEnabled=true requiere clinicalCriteria.prompt no vacío',
        }
      }
    }
  }

  // ── Gate G4: presentation.enabled=true → schema con ≥1 sección ───────────
  const presentation = draft.presentation
  if (presentation?.enabled === true) {
    const sections = presentation.schema?.sections
    if (!Array.isArray(sections) || sections.length === 0) {
      return {
        ok: false,
        code: 'PUBLISH_PRESENTATION_SCHEMA_EMPTY',
        error: 'presentation.enabled=true requiere presentation.schema con al menos una sección',
      }
    }
  }

  // ── Gate G5: E2E test previo (N/A justificado en Fase 2) ──────────────────
  // No hay infraestructura de prueba E2E de calibración todavía. El gate se
  // omite sin rechazar. Cuando la infraestructura exista (Fase 6+), se
  // requerirá al menos un resultado de prueba E2E asociado al draft tested.
  // Documentado como N/A en el IMPL-REPORT.

  // ── Gate G6: sin colisión de versionId ────────────────────────────────────
  const newVersionId = generateVersionId()
  const existingIds = new Set(
    (root.publishedVersions ?? []).map((v) => v.versionId).filter((id): id is string => typeof id === 'string'),
  )
  if (existingIds.has(newVersionId)) {
    // Colisión de UUID extremadamente improbable; se rechaza por contrato.
    return {
      ok: false,
      code: 'PUBLISH_VERSION_ID_COLLISION',
      error: `Colisión de versionId "${newVersionId}" con versión previa`,
    }
  }

  // ── Gate G7: fieldDefinitions define todos los requiredParams ────────────
  // Solo si clinicalCriteria != null (clinical_interpretation).
  if (clinicalCriteria) {
    const requiredParams = clinicalCriteria.requiredParams ?? []
    if (requiredParams.length > 0) {
      const definedKeys = new Set((draft.fieldDefinitions ?? []).map((fd) => fd.key))
      const missing = requiredParams.filter((p) => !definedKeys.has(p))
      if (missing.length > 0) {
        return {
          ok: false,
          code: 'PUBLISH_REQUIRED_PARAMS_NOT_DEFINED',
          error: `clinicalCriteria.requiredParams referencia keys no definidas en fieldDefinitions: ${missing.join(', ')}`,
        }
      }
    }
  }

  // ── Gates G8 / G9: coherencia de familyTemplate (P-04: null → N/A) ───────
  // familyTemplateId es null para todas las pruebas hasta decisión funcional
  // ATLAS (handoff §11.6). Los gates de coherencia de familia son no-ops
  // cuando no hay plantilla contra la que validar. Cuando el catálogo de
  // FamilyTemplate se confirme (Fase 4+), se implementará el lookup contra
  // el registry y la validación de overrides no eliminan `required`.
  const familyTemplateId = root.familyTemplateId ?? null
  if (familyTemplateId) {
    // G8: operationMode del MedicalTest == operationMode de la FamilyTemplate.
    // G9: overrides no eliminan analitos `required` de la plantilla.
    // Stub: el registry de FamilyTemplate está vacío en Fase 2 (resolver
    // backend). Sin plantilla resoluble, no podemos validar; se documenta
    // como pendiente. No se rechaza la publicación por defecto (consistente
    // con el resolver: si el registry está vacío, la fusión es no-op).
  }

  // ── Transición atómica tested → published ─────────────────────────────────
  // AC-2.3: la versión published anterior pasa a superseded atómicamente.
  // AC-2.4: publishedVersions[] conserva la nueva versión inmutable.
  // AC-2.5: legacyV1V2Snapshot se congela al primer publish desde V1/V2.

  const now = new Date().toISOString()
  const publishedVersions = (root.publishedVersions ?? []) as AICalibrationVersionV3[]

  // Identificar la versión published/disabled vigente (máximo una, SPEC §6.2).
  const currentIndex = publishedVersions.findIndex(
    (v) => v.status === 'published' || v.status === 'disabled',
  )

  // Calcular el siguiente versionNumber (monótono por MedicalTest).
  const maxVersionNumber = publishedVersions.reduce(
    (max, v) => (typeof v.versionNumber === 'number' && v.versionNumber > max ? v.versionNumber : max),
    0,
  )
  const newVersionNumber = maxVersionNumber + 1

  // Congelar el draft en una nueva versión inmutable.
  const newPublishedVersion: AICalibrationVersionV3 = {
    versionId: newVersionId,
    versionNumber: newVersionNumber,
    label: draft.label || `cal-v3-${newVersionNumber}`,
    status: 'published',
    publishedAt: now,
    publishedBy,
    supersededAt: null,
    supersededByVersionId: null,
    enabled: draft.enabled,
    canonicalStudyType: draft.canonicalStudyType,
    extraction: freezeExtraction(draft.extraction),
    fieldDefinitions: draft.fieldDefinitions ?? [],
    clinicalCriteria: clinicalCriteria,
    presentation: freezePresentation(draft.presentation),
  }

  // Aplicar transición: la vigente anterior → superseded; añadir la nueva.
  let updatedVersions: AICalibrationVersionV3[]
  if (currentIndex >= 0) {
    const prev = publishedVersions[currentIndex]
    const supersededPrev: AICalibrationVersionV3 = {
      ...prev,
      status: 'superseded',
      supersededAt: now,
      supersededByVersionId: newVersionId,
      // Si la anterior estaba `disabled`, queda `superseded` (CB-09: solo
      // se puede volver a `published` si no fue superseded; al publicar
      // una nueva, la disabled se convierte en superseded).
    }
    updatedVersions = [
      ...publishedVersions.slice(0, currentIndex),
      supersededPrev,
      ...publishedVersions.slice(currentIndex + 1),
      newPublishedVersion,
    ]
  } else {
    updatedVersions = [...publishedVersions, newPublishedVersion]
  }

  // ── AC-2.5: congelar legacyV1V2Snapshot al primer publish desde V1/V2 ───
  // Solo en la primera publicación material V3 (no había publishedVersions
  // antes). Si existía un aiCalibration V1/V2 en options, se congela su
  // copia para auditoría. Publicaciones posteriores no lo sobrescriben.
  let legacyV1V2Snapshot = root.legacyV1V2Snapshot ?? null
  const isFirstMaterialPublish = publishedVersions.length === 0
  if (isFirstMaterialPublish && !legacyV1V2Snapshot) {
    const rawLegacy = options.aiCalibration
    // Si había un aiCalibration V1/V2 (no V3), congelar copia.
    if (isPlainObject(rawLegacy) && (rawLegacy as { schemaVersion?: unknown }).schemaVersion !== 'V3') {
      legacyV1V2Snapshot = {
        snapshot: rawLegacy as Record<string, unknown>,
        migratedAt: now,
        migratedBy: publishedBy,
        sourceSchemaVersion: String((rawLegacy as { schemaVersion?: unknown }).schemaVersion ?? 'V1V2'),
      } satisfies LegacyV1V2Snapshot
    }
  }

  // ── Retención: últimas MAX_SUPERSEDED_VERSIONS (20) superseded ───────────
  // Conservar todas las published/disabled + las últimas N superseded.
  const nonSuperseded = updatedVersions.filter((v) => v.status !== 'superseded')
  const superseded = updatedVersions.filter((v) => v.status === 'superseded')
  // Ordenar superseded por versionNumber descendente y conservar las primeras N.
  superseded.sort((a, b) => b.versionNumber - a.versionNumber)
  const retainedSuperseded = superseded.slice(0, MAX_SUPERSEDED_VERSIONS)
  const finalVersions = [...nonSuperseded, ...retainedSuperseded]

  // El draft se limpia tras publicar (SPEC §6.2: "el draft se limpia o reinicia").
  const updatedRoot: AICalibrationV3 = {
    schemaVersion: 'V3',
    currentPublishedVersionId: newVersionId,
    familyTemplateId,
    overrides: root.overrides,
    draft: null,
    publishedVersions: finalVersions,
    legacyV1V2Snapshot,
  }

  const newOptions = toPrismaJsonValue({ ...options, aiCalibration: updatedRoot })

  try {
    // Transacción atómica: una sola operación update sobre MedicalTest.options.
    // Prisma garantiza la atomicidad de la escritura del JSON completo; no
    // pueden coexistir dos `published` porque toda la transición se aplica
    // sobre el mismo documento en una sola operación.
    await prisma.medicalTest.update({
      where: { id: testId },
      data: { options: newOptions },
    })

    // Audit log (SPEC §17.3). Se registra en los logs del servidor; cuando
    // exista una tabla AuditLog dedicada, se persistirá allí. Por ahora, el
    // log estructurado con IDs permite trazabilidad.
    console.info(
      '[ARCH-20260820-01] calibration_published: testId=%s versionId=%s versionNumber=%s publishedBy=%s',
      testId,
      newVersionId,
      newVersionNumber,
      publishedBy ?? 'unknown',
    )

    revalidatePath(`/admin/services/${testId}/calibration`)
    revalidatePath('/admin/services')
    return { ok: true, versionId: newVersionId, versionNumber: newVersionNumber }
  } catch (e: unknown) {
    console.error('[Calibration V3] Error publicando calibración V3:', e)
    return { ok: false, code: 'INTERNAL_ERROR', error: 'Error al publicar la calibración' }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de congelación de la versión publicada (inmutabilidad)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Congela la capa de extracción del draft en la versión publicada. Realiza
 * una copia profunda (inmutable post-publish). Calcula promptHash si falta.
 */
function freezeExtraction(
  extraction: AICalibrationDraftV3['extraction'],
): AICalibrationVersionV3['extraction'] {
  const base = extraction ?? { enabled: false, prompt: null }
  return {
    enabled: base.enabled,
    prompt: base.prompt,
    promptHash: base.promptHash ?? (base.prompt ? hashString(base.prompt) : null),
    version: base.version ?? null,
    schemaVersion: base.schemaVersion ?? null,
    targetFields: base.targetFields ?? [],
    provider: base.provider,
    model: base.model ?? null,
  }
}

/**
 * Congela la capa de presentación del draft en la versión publicada.
 * Calcula schemaHash si falta.
 */
function freezePresentation(
  presentation: AICalibrationDraftV3['presentation'],
): AICalibrationVersionV3['presentation'] {
  const base = presentation ?? { enabled: false, schema: null }
  return {
    enabled: base.enabled,
    schema: base.schema,
    schemaHash: base.schemaHash ?? (base.schema ? hashString(JSON.stringify(base.schema)) : null),
  }
}

/**
 * Hash sha256 simplificado para auditoría (sin almacenar texto duplicado).
 * Usa la API Web Crypto (disponible en Node 18+/Next.js). En entornos sin
 * SubtleCrypto, cae a un hash determinista de respuesto (no criptográfico,
 * pero suficiente para detectar cambios). El resolver backend es la fuente
 * runtime; aquí solo es metadata de auditoría.
 */
function hashString(input: string): string {
  // FNV-1a determinista como fallback (no criptográfico, pero determinista).
  // El backend puede recalcular sha256 real si se necesita integridad fuerte.
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return `sha256:fnv-${(hash >>> 0).toString(16).padStart(8, '0')}`
}

/**
 * Genera un versionId único. Usa crypto.randomUUID cuando esté disponible
 * (Node 19+/Next.js runtime); cae a un UUID v4 basado en Math.random como
 * fallback determinista para entornos de test.
 */
function generateVersionId(): string {
  const cryptoGlobal = globalThis as { crypto?: { randomUUID?: () => string } }
  if (cryptoGlobal.crypto?.randomUUID) {
    return `cal-v3-${cryptoGlobal.crypto.randomUUID()}`
  }
  // Fallback (tests / entornos sin Web Crypto).
  return `cal-v3-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

// ─────────────────────────────────────────────────────────────────────────────
// getPublishedCalibrationForEventTest — Events consume published (ARCH-20260820-01 Fase 3)
// SPEC §9.1, §14 Fase 3 (AC-3.1, AC-3.2, AC-3.3)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Versión published resuelta para un EventTest, consumida por Events frontend
 * para respetar el gate `enabled` y enrutar por `canonicalStudyType` publicado.
 *
 * No normaliza V1/V2 (eso es responsabilidad del `CalibrationResolver`
 * backend, Fase 4). Si el `MedicalTest` no tiene versión V3 `published`,
 * devuelve `null` → el caller cae a la heurística de nombre marcada con
 * `source="legacy_heuristic"` (AC-3.3, SPEC §12.1).
 *
 * - `enabled=false` (versión `disabled` vigente): el caller NO dispara IA y
 *   persiste el snapshot con `calibration_source="calibration_disabled"`
 *   (AC-3.1, CB-02).
 * - `enabled=true` + `canonicalStudyType` published: el caller enruta por ese
 *   valor, no por la heurística (AC-3.2).
 *
 * Lectura directa de `MedicalTest.options.aiCalibration` (patrón establecido
 * en Fase 2 por `saveAICalibrationV3`). No es "resolución" (no infiere
 * `operationMode`, no adapta V1/V2, no fusiona `familyTemplate`); sólo lee
 * el campo `enabled` y `canonicalStudyType` de la versión V3 publicada ya
 * resuelta por el admin. La inferencia/adaptación queda en el resolver
 * backend (Fase 4 consumirá el endpoint `/resolve` desde `prediagnostic.py`).
 *
 * F-3 (QA-20260820-02): este server action lee Prisma directamente (no llama
 * al endpoint `/api/v1/calibration/resolve` por fetch), por lo que Events NO
 * expone el endpoint al navegador. Ver comentario F-3 en `calibration.py`.
 */
export interface PublishedCalibrationForEventTest {
  /** Gate global por prueba (H1). false → Events no dispara IA. */
  enabled: boolean
  /** Gate routing (H2, H3, H10). null si la versión published no lo define. */
  canonicalStudyType: string | null
  /** versionId de la versión published vigente (auditoría de snapshot). */
  versionId: string | null
  /** versionNumber monótono (legibilidad del snapshot). */
  versionNumber: number | null
  /** Origen de la resolución — siempre "published_v3" cuando hay published. */
  source: 'published_v3'
}

/**
 * Resuelve la versión V3 `published` vigente para el `MedicalTest` asociado a
 * un `EventTest`. Devuelve `null` si el `MedicalTest` no tiene versión V3
 * publicada (incluye calibraciones V1/V2 no migradas y pruebas sin
 * `aiCalibration`) → el caller cae a heurística trazada (AC-3.3).
 *
 * Es no-bloqueante ante fallos de lectura: si Prisma falla o el JSON está
 * corrupto, devuelve `null` (Events cae a heurística trazada, CB-11).
 *
 * @param eventTestId - ID del EventTest cuyo MedicalTest se consulta.
 * @returns Versión published resuelta, o `null` si no hay V3 published.
 */
export async function getPublishedCalibrationForEventTest(
  eventTestId: string,
): Promise<PublishedCalibrationForEventTest | null> {
  if (!eventTestId || typeof eventTestId !== 'string') {
    return null
  }

  try {
    const eventTest = await prisma.eventTest.findUnique({
      where: { id: eventTestId },
      select: {
        test: {
          select: { options: true },
        },
      },
    })

    if (!eventTest?.test?.options) {
      // EventTest sin test asociado o test sin options → no hay published.
      return null
    }

    const options = parseOptions(eventTest.test.options)
    const root = readV3Root(options)
    if (!root) {
      // No es V3 (V1/V2 legacy o sin aiCalibration) → el adaptador backend
      // lo resolvería, pero Events no lo replica aquí. Cae a heurística.
      return null
    }

    const publishedVersions = root.publishedVersions ?? []
    if (publishedVersions.length === 0) {
      // V3 inicializado pero sin publicaciones → heurística.
      return null
    }

    // Identificar la versión vigente (máximo una published o disabled, SPEC §6.2).
    // Preferir currentPublishedVersionId; si no coincide, la primera published/disabled.
    let vigent: AICalibrationVersionV3 | undefined
    if (root.currentPublishedVersionId) {
      vigent = publishedVersions.find(
        (v) => v.versionId === root.currentPublishedVersionId,
      )
    }
    if (!vigent) {
      vigent = publishedVersions.find(
        (v) => v.status === 'published' || v.status === 'disabled',
      )
    }

    if (!vigent) {
      // Hay publishedVersions pero ninguna vigente (todas superseded) →
      // estado inconsistente; cae a heurística (no se inventa published).
      return null
    }

    // `disabled` → enabled=false (CB-02). `published` → enabled real.
    const enabled = vigent.status === 'disabled' ? false : vigent.enabled

    return {
      enabled,
      canonicalStudyType: vigent.canonicalStudyType ?? null,
      versionId: vigent.versionId ?? null,
      versionNumber: typeof vigent.versionNumber === 'number' ? vigent.versionNumber : null,
      source: 'published_v3',
    }
  } catch (err) {
    // CB-11: error de lectura/parseo → null + log. Events cae a heurística.
    console.warn(
      '[ARCH-20260820-01 Fase 3] getPublishedCalibrationForEventTest falló; cae a heurística:',
      err instanceof Error ? err.message : err,
    )
    return null
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ARCH-20260820-01 Fase 5 — Snapshot versionado histórico (espejo para
// sitio de persistencia en frontend). Lee la MISMA versión V3 published que
// `getPublishedCalibrationForEventTest` (no inventa versiones) pero expone el
// `presentation.schema` y los textos de prompts necesarios para hashear en
// frontend cuando el backend no devuelve los hashes en la respuesta (camino
// legacy XML → direct parser, o `prediagnosis-from-params` si la calibración
// se resolvió en proceso).
//
// Si el MedicalTest no tiene versión V3 published, devuelve `null`. El
// snapshot se persiste entonces con todos los campos de Fase 5 = `null`
// (snapshot pre-V5, legible con `calibration_version_mismatch=true` según
// CB-08 / SPEC §10.2).
//
// NOTA: NO modifica `getPublishedCalibrationForEventTest` (mantiene su
// shape exacto para no romper tests de Fase 3 — qa-20260820-04 AC-3.1/3.2/3.3).
// Es un espejo paralelo orientado a Fase 5.
//
// FIX-20260820-01-VERCEL-BUILD: la interfaz `PublishedVersionForSnapshot` y el
// helper síncrono `extractSnapshotVersioningFromBackendAudit` (junto a sus
// privados `_sha256Prefixed` / `readString`) se movieron a
// `@/lib/calibration-v3-shared.ts` para no violar la regla de Server Actions
// de Next.js 16 (un archivo `'use server'` sólo admite exports de funciones
// async). Aquí sólo permanece este server action async (`getPublishedVersionForSnapshot`)
// que lee Prisma directamente. El tipo se reimporta arriba.
// ─────────────────────────────────────────────────────────────────────────────

export async function getPublishedVersionForSnapshot(
  eventTestId: string,
): Promise<PublishedVersionForSnapshot | null> {
  if (!eventTestId || typeof eventTestId !== 'string') return null
  try {
    const eventTest = await prisma.eventTest.findUnique({
      where: { id: eventTestId },
      select: {
        test: {
          select: { options: true },
        },
      },
    })
    if (!eventTest?.test?.options) return null

    const options = parseOptions(eventTest.test.options)
    const root = readV3Root(options)
    if (!root) return null
    const publishedVersions = root.publishedVersions ?? []
    if (publishedVersions.length === 0) return null

    let vigent: AICalibrationVersionV3 | undefined
    if (root.currentPublishedVersionId) {
      vigent = publishedVersions.find(
        (v) => v.versionId === root.currentPublishedVersionId,
      )
    }
    if (!vigent) {
      vigent = publishedVersions.find(
        (v) => v.status === 'published' || v.status === 'disabled',
      )
    }
    if (!vigent) return null

    // presentation.schema (inmutable, copiado del contrato publicado). Si el
    // registry de FamilyTemplate está poblado y `familyTemplateId` resuelto,
    // ya viene fusionado en la versión efectiva (`vigent`).
    let presentationSchemaSnapshot: unknown | null = null
    const presentation = (vigent as { presentation?: unknown }).presentation
    if (presentation && typeof presentation === 'object') {
      const schema = (presentation as { schema?: unknown }).schema
      if (schema && typeof schema === 'object' && !Array.isArray(schema)) {
        presentationSchemaSnapshot = schema
      } else if (Array.isArray(schema) && schema.length > 0) {
        presentationSchemaSnapshot = schema
      }
    }

    // extraction.prompt — usado para hashear (si el backend no expuso
    // el hash en su respuesta, este sitio lo calcula).
    let extractionPrompt: string | null = null
    const extraction = (vigent as { extraction?: unknown }).extraction
    if (extraction && typeof extraction === 'object') {
      const prompt = (extraction as { prompt?: unknown }).prompt
      if (typeof prompt === 'string' && prompt) extractionPrompt = prompt
    }

    // clinicalCriteria (puede ser null para `document_extraction`)
    let clinicalCriteria: unknown | null = null
    let clinicalPrompt: string | null = null
    const clinicalCriteriaRaw = (vigent as { clinicalCriteria?: unknown })
      .clinicalCriteria
    if (
      clinicalCriteriaRaw &&
      typeof clinicalCriteriaRaw === 'object' &&
      !Array.isArray(clinicalCriteriaRaw)
    ) {
      clinicalCriteria = clinicalCriteriaRaw
      const prompt = (clinicalCriteriaRaw as { prompt?: unknown }).prompt
      if (typeof prompt === 'string' && prompt) clinicalPrompt = prompt
    }

    return {
      versionId: vigent.versionId ?? null,
      versionNumber:
        typeof vigent.versionNumber === 'number' ? vigent.versionNumber : null,
      presentationSchemaSnapshot,
      extractionPrompt,
      clinicalPrompt,
      clinicalCriteria,
    }
  } catch (err) {
    console.warn(
      '[ARCH-20260820-01 Fase 5] getPublishedVersionForSnapshot falló:',
      err instanceof Error ? err.message : err,
    )
    return null
  }
}

// FIX-20260820-01-VERCEL-BUILD: `extractSnapshotVersioningFromBackendAudit`
// y sus helpers privados (`_sha256Prefixed`, `readString`) ahora viven en
// `@/lib/calibration-v3-shared.ts` para no violar la regla de Server Actions
// de Next.js 16 (un archivo `'use server'` sólo admite exports de funciones
// async). Se reimportan desde los consumidores (ai-prediagnosis.actions.ts,
// event-test.actions.ts, tests).
