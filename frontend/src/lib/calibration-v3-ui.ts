/**
 * @file Helpers puros para la UI de Calibración V3 — ARCH-20260820-01 Fase 2B.
 * @spec context/SPECs/SPEC_ARCH-20260820-01-CALIBRACION-FUENTE-UNICA.md §5, §6, §8
 * @decision DEC-20260820-03 (publicación V3 visible desde Calibración),
 *           DEC-20260820-02 (operationMode), BR-20260820-01 (paridad Calibración↔Events)
 *
 * Módulo SIN `'use server'` y SIN `node:crypto` para poder ser consumido
 * desde componentes cliente (Next.js 16, FIX-20260820-01-VERCEL-BUILD).
 * No importa `@/lib/calibration-v3-shared.ts` (este tiene `node:crypto` y
 * header prohibitivo); las funciones aquí son puras y derivan sólo de la
 * raíz V3 que ya está en `MedicalTest.options.aiCalibration`.
 *
 * @id ARCH-20260820-01 / IMPL-20260820-01-FASE2B
 */

import type {
  AICalibrationDraftV3,
  AICalibrationV3,
  AICalibrationVersionV3,
  OperationMode,
} from "@/types/calibration"

// ─────────────────────────────────────────────────────────────────────────────
// Tipos públicos
// ─────────────────────────────────────────────────────────────────────────────

export interface CalibrationV3UIState {
  operationMode: OperationMode | null
  isManualService: boolean
  /** Existe raíz V3 (options.aiCalibration.schemaVersion === 'V3'). */
  hasV3: boolean
  /** No hay raíz V3 (V1/V2 legacy o nada). */
  isLegacyOnly: boolean
  draftStatus: "draft" | "tested" | null
  currentPublishedVersion: {
    versionId: string
    versionNumber: number
    label: string
    publishedAt: string
  } | null
  supersededCount: number
  hasLegacySnapshot: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// describeCalibrationV3State
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validador interno de `operationMode` (espejo del parser de actions).
 * Acepta sólo los 3 literales del union `OperationMode`; cualquier otro
 * valor → `null` (no se inventa — §12 "Prohibido inferir").
 */
export function isOperationModeValue(value: unknown): value is OperationMode {
  return (
    value === "manual_service" ||
    value === "document_extraction" ||
    value === "clinical_interpretation"
  )
}

/**
 * Resuelve la versión vigente de un `publishedVersions[]` aplicando la
 * MISMA regla que `getPublishedCalibrationForEventTest` (handoff §4.1):
 * 1. Preferencia por `currentPublishedVersionId`.
 * 2. Si no coincide, la primera con `status === 'published' || status === 'disabled'`.
 *
 * Devuelve `null` si no hay versiones o todas están `superseded`.
 */
function resolveCurrentPublishedVersion(
  root: AICalibrationV3,
): AICalibrationVersionV3 | null {
  const list = root.publishedVersions ?? []
  if (list.length === 0) return null
  if (root.currentPublishedVersionId) {
    const match = list.find((v) => v.versionId === root.currentPublishedVersionId)
    if (match) return match
  }
  return list.find((v) => v.status === "published" || v.status === "disabled") ?? null
}

/**
 * Derivación pura de `CalibrationV3UIState` desde la raíz V3 y el
 * `operationMode` ya normalizado. NO inventa estado: si la raíz V3 es
 * `null`, `isLegacyOnly=true` y `currentPublishedVersion=null`.
 */
export function describeCalibrationV3State(
  aiCalibrationV3: AICalibrationV3 | null,
  operationMode: OperationMode | null,
): CalibrationV3UIState {
  const opMode: OperationMode | null = isOperationModeValue(operationMode)
    ? operationMode
    : null
  const isManualService = opMode === "manual_service"
  const hasV3 = aiCalibrationV3 !== null
  const isLegacyOnly = !hasV3

  const draftStatus = aiCalibrationV3?.draft?.status ?? null
  const hasLegacySnapshot = aiCalibrationV3?.legacyV1V2Snapshot != null

  const currentV = hasV3 ? resolveCurrentPublishedVersion(aiCalibrationV3) : null
  const currentPublishedVersion = currentV
    ? {
        versionId: currentV.versionId,
        versionNumber: currentV.versionNumber,
        label: currentV.label,
        publishedAt: currentV.publishedAt,
      }
    : null

  const supersededCount = hasV3
    ? (aiCalibrationV3.publishedVersions ?? []).filter(
        (v) => v.status === "superseded",
      ).length
    : 0

  return {
    operationMode: opMode,
    isManualService,
    hasV3,
    isLegacyOnly,
    draftStatus,
    currentPublishedVersion,
    supersededCount,
    hasLegacySnapshot,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// coerceV3DraftToEditorInitial
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mapea un `AICalibrationDraftV3` al shape legacy V1/V2 que el
 * `AICalibrationEditor` ya entiende (consumido desde `initial`). Sólo
 * cubre los campos que el editor expone en UI; el resto vive en V3
 * preservados por `saveAICalibrationV3` (no se pierden).
 *
 * Para `document_extraction` (clinicalCriteria=null), la sección clínica
 * del editor queda `enabled:false, prompt:""` — y `getEditorSectionsForOperationMode`
 * ya la oculta completamente (CB-14).
 *
 * No muta `draft`; devuelve un objeto nuevo.
 */
export function coerceV3DraftToEditorInitial(
  draft: AICalibrationDraftV3,
): Record<string, unknown> {
  const extraction = draft.extraction ?? {
    enabled: false,
    prompt: null,
  }
  const clinical = draft.clinicalCriteria
  return {
    enabled: draft.enabled,
    canonicalStudyType: draft.canonicalStudyType ?? "",
    extraction: {
      enabled: Boolean(extraction.enabled),
      prompt: extraction.prompt ?? "",
      version: extraction.version ?? "",
      schemaVersion: extraction.schemaVersion ?? "",
      provider: extraction.provider ?? "gemini",
      model: extraction.model ?? "",
    },
    diagnosis: {
      enabled: clinical?.prediagnosisEnabled ?? false,
      prompt: clinical?.prompt ?? "",
      promptVersion: clinical?.promptVersion ?? "",
    },
    fieldDefinitions: draft.fieldDefinitions ?? [],
    presentation: draft.presentation ?? { enabled: false, schema: null },
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLISH_GATE_VISIBILITY + mapPublishErrorCode
// ─────────────────────────────────────────────────────────────────────────────

export interface PublishGateVisibility {
  gate: string
  label: string
  /** Si aplica a este operationMode/draft; si no, `reason` explica N/A. */
  applicable: boolean
  reason: string | null
}

/**
 * Lista ordenada de gates visibles para el panel de publicación. Cada gate
 * declara si aplica al `operationMode` + draft dados. Permite al usuario
 * entender qué se valida antes de publicar (AC-2B.7, AC-2B.9).
 */
export function getPublishGateVisibility(
  operationMode: OperationMode | null,
  draft: AICalibrationDraftV3 | null,
): PublishGateVisibility[] {
  const mode = operationMode
  const isManual = mode === "manual_service"
  const isDoc = mode === "document_extraction"
  const isClinical = mode === "clinical_interpretation"

  const extractionEnabled = Boolean(draft?.extraction?.enabled)
  const clinical = draft?.clinicalCriteria ?? null
  const prediagnosisEnabled = Boolean(clinical?.prediagnosisEnabled)
  const presentationEnabled = Boolean(draft?.presentation?.enabled)
  const familyTemplateId = draft ? null : null // siempre null (P-04); placeholder del signature.

  return [
    {
      gate: "G0",
      label: "operationMode definido y válido",
      applicable: mode !== null,
      reason: mode === null ? "operationMode ausente o inválido" : null,
    },
    {
      gate: "G0b",
      label: "operationMode ≠ manual_service",
      applicable: !isManual,
      reason: isManual
        ? "manual_service no publica calibración (DEC-20260820-02)"
        : null,
    },
    {
      gate: "G1",
      label: "canonicalStudyType canónico",
      // document_extraction puede omitir canonicalStudyType (sin routing XML).
      applicable: isClinical,
      reason: isDoc
        ? "N/A — document_extraction puede omitir canonicalStudyType"
        : isManual
        ? "N/A — manual_service"
        : null,
    },
    {
      gate: "G2",
      label: "extraction.prompt no vacío si extraction.enabled",
      applicable: extractionEnabled,
      reason: !extractionEnabled
        ? "N/A — extraction.enabled=false"
        : isManual
        ? "N/A — manual_service"
        : null,
    },
    {
      gate: "G3",
      label: "clinicalCriteria.prompt no vacío si prediagnosisEnabled",
      applicable: prediagnosisEnabled && isClinical,
      reason: isDoc
        ? "N/A — document_extraction (clinicalCriteria=null)"
        : !prediagnosisEnabled
        ? "N/A — prediagnosisEnabled=false"
        : null,
    },
    {
      gate: "G4",
      label: "presentation.schema con ≥1 sección si enabled",
      applicable: presentationEnabled,
      reason: !presentationEnabled
        ? "N/A — presentation.enabled=false"
        : null,
    },
    {
      gate: "G5",
      label: "Prueba E2E previa",
      applicable: false,
      reason: "N/A — sin infraestructura E2E en Fase 2",
    },
    {
      gate: "G6",
      label: "Sin colisión de versionId",
      applicable: mode !== null,
      reason: isManual ? "N/A — manual_service" : null,
    },
    {
      gate: "G7",
      label: "fieldDefinitions define todos requiredParams",
      applicable: isClinical && clinical !== null,
      reason: isDoc
        ? "N/A — document_extraction (clinicalCriteria=null)"
        : isManual
        ? "N/A — manual_service"
        : null,
    },
    {
      gate: "G8",
      label: "Coherencia operationMode con familyTemplate",
      applicable: familyTemplateId !== null,
      reason: "N/A — sin plantilla (P-04)",
    },
    {
      gate: "G9",
      label: "Overrides no eliminan required de plantilla",
      applicable: familyTemplateId !== null,
      reason: "N/A — sin plantilla (P-04)",
    },
  ]
}

export interface PublishErrorMap {
  gate: string | null
  title: string
  hint: string
}

/**
 * Convierte un `PublishErrorCode` (o string desconocido) en metadata legible
 * para el panel de publicación. Códigos sin gate (rol/estado) → `gate=null`.
 * Código desconocido → fallback seguro (AC-2B.8).
 */
export function mapPublishErrorCode(code: string): PublishErrorMap {
  switch (code) {
    case "PUBLISH_INVALID_OPERATION_MODE":
      return { gate: "G0", title: "operationMode inválido", hint: "Define el operationMode en la prueba médica." }
    case "PUBLISH_MANUAL_SERVICE_NO_CALIBRATION":
      return { gate: "G0b", title: "manual_service no publica", hint: "Los servicios manuales no admiten calibración IA." }
    case "PUBLISH_INVALID_CANONICAL_TYPE":
      return { gate: "G1", title: "canonicalStudyType inválido", hint: "Usa uno de los tipos canónicos definidos (Audiometria, Espirometria, ECG, ExamenMedico)." }
    case "PUBLISH_EXTRACTION_PROMPT_EMPTY":
      return { gate: "G2", title: "Prompt de extracción vacío", hint: "Completa el bloque específico de extracción antes de publicar." }
    case "PUBLISH_CLINICAL_PROMPT_EMPTY":
      return { gate: "G3", title: "Prompt clínico vacío", hint: "Completa el prompt clínico de MedGemma antes de publicar." }
    case "PUBLISH_PRESENTATION_SCHEMA_EMPTY":
      return { gate: "G4", title: "Schema de presentación vacío", hint: "Define al menos una sección en presentation.schema." }
    case "PUBLISH_MISSING_E2E_TEST":
      return { gate: "G5", title: "Sin prueba E2E previa", hint: "Ejecuta una prueba E2E del draft antes de publicar." }
    case "PUBLISH_VERSION_ID_COLLISION":
      return { gate: "G6", title: "Colisión de versionId", hint: "Reintenta la publicación (UUID nuevo debería generarse)." }
    case "PUBLISH_REQUIRED_PARAMS_NOT_DEFINED":
      return { gate: "G7", title: "requiredParams no definidos", hint: "Agrega los fieldDefinitions que cubren los requiredParams del clinicalCriteria." }
    case "PUBLISH_FAMILY_MODE_MISMATCH":
      return { gate: "G8", title: "operationMode no coincide con plantilla", hint: "Alinea el operationMode con la familyTemplate (P-04 pendiente)." }
    case "PUBLISH_FAMILY_OVERRIDE_REMOVES_REQUIRED":
      return { gate: "G9", title: "Override elimina required de plantilla", hint: "Restablece los requiredParams en el override (P-04 pendiente)." }
    case "FORBIDDEN":
      return { gate: null, title: "Sin permiso", hint: "Publicar requiere rol SUPERADMIN." }
    case "NO_DRAFT":
      return { gate: null, title: "Sin draft", hint: "Guarda un draft antes de intentar publicar." }
    case "DRAFT_NOT_TESTED":
      return { gate: null, title: "Draft no está en tested", hint: "Cambia el estado del draft a 'tested' antes de publicar." }
    case "UNAUTHENTICATED":
      return { gate: null, title: "Sin sesión", hint: "Inicia sesión para publicar." }
    case "TEST_NOT_FOUND":
      return { gate: null, title: "Prueba no encontrada", hint: "Verifica que la prueba médica existe." }
    case "INTERNAL_ERROR":
      return { gate: null, title: "Error interno", hint: "Reintenta o contacta a soporte si persiste." }
    default:
      return { gate: null, title: code, hint: "Error inesperado de publicación" }
  }
}
