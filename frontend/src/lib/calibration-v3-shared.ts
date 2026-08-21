/**
 * @file Módulo compartido (no Server Action) para tipos, constantes y helpers
 *   puros del contrato `aiCalibration` V3 — ARCH-20260820-01 Fase 2 / Fase 5.
 * @spec context/SPECs/SPEC_ARCH-20260820-01-CALIBRACION-FUENTE-UNICA.md §6, §10, §14
 * @decision FIX-20260820-01-VERCEL-BUILD — Opción A (extracción de exports no-async
 *   del archivo `'use server'` para no violar el contrato de Server Actions de
 *   Next.js 16 — ver context/interconsultas/DICTAMEN_FIX-20260820-01-VERCEL-BUILD.md).
 *
 * Este archivo NO lleva `'use server'`. Contiene:
 *   - Constantes de configuración reversibles (PUBLISH_REQUIRED_ROLE, MAX_SUPERSEDED_VERSIONS).
 *   - Tipo/interfaz PublishedVersionForSnapshot (consumido por el helper síncrono y por
 *     la firma de retorno del server action getPublishedVersionForSnapshot).
 *   - Helper síncrono `extractSnapshotVersioningFromBackendAudit` y sus privados
 *     `_sha256Prefixed` / `readString`. Es una función pura (sin Prisma, sin session)
 *     usada por otros server actions y tests; no debe ser Server Action.
 *
 * CONVENCIÓN (header warning):
 *   Este módulo importa `node:crypto` (vía require) para SHA-256 síncrono. NO debe
 *   importarse desde componentes cliente (rompería el bundle del navegador). Los
 *   consumidores válidos son server actions y tests vitest en entorno Node.
 *
 * @id ARCH-20260820-01 / FIX-20260820-01-VERCEL-BUILD
 */

import type { UserRole } from '@prisma/client'

// ─────────────────────────────────────────────────────────────────────────────
// Configuración (propuesta INTEGRA reversible — handoff §11)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Rol requerido para publicar calibración (ADR §7.1 pendiente; propuesta
 * INTEGRA: SUPERADMIN por defecto, configurable). No inventar rol CALIBRATOR.
 */
export const PUBLISH_REQUIRED_ROLE: UserRole = 'SUPERADMIN'

/**
 * Máximo de versiones `superseded` conservadas por MedicalTest (ADR §7.2
 * pendiente; propuesta INTEGRA: 20, mismo límite que saveAICalibrationV2).
 */
export const MAX_SUPERSEDED_VERSIONS = 20

// ─────────────────────────────────────────────────────────────────────────────
// Interfaz PublishedVersionForSnapshot (Fase 5 — §10, AC-5.1/AC-5.2/AC-5.3)
// ─────────────────────────────────────────────────────────────────────────────

export interface PublishedVersionForSnapshot {
  /** `versionId` de la versión publicada (`null` si pre-V5). */
  versionId: string | null
  /** `versionNumber` monótono (`null` si pre-V5). */
  versionNumber: number | null
  /** `schema` persistido en `presentation.schema` (post-fusión si registry poblado). */
  presentationSchemaSnapshot: unknown | null
  /** Texto del prompt de extracción (front-end computa su propio hash si el
   *  backend no lo expuso en la respuesta). */
  extractionPrompt: string | null
  /** Texto del prompt clínico (idem; puede ser null para document_extraction). */
  clinicalPrompt: string | null
  /** `clinicalCriteria` completo (idem). */
  clinicalCriteria: unknown | null
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: extractSnapshotVersioningFromBackendAudit (Fase 5, AC-5.1)
// ─────────────────────────────────────────────────────────────────────────────

function _sha256Prefixed(value: unknown): string | null {
  /**
   * ARCH-20260820-01 Fase 5: `sha256:<hex>` del JSON canónico. Si el valor es
   * `null`/`undefined`/vacío → devuelve `null` (NO hashea nulls).
   *
   * Implementación determinista y sync (server actions Node 20). Mismo prefijo
   * `sha256:` que el backend (`build_snapshot_versioning_payload`) para que la
   * tabla de auditoría sea comparable entre runtime backend y snapshots
   * persistidos.
   */
  if (value === null || value === undefined) return null
  if (typeof value === 'string') {
    if (!value) return null
    // Node 20 `node:crypto` sincroniza SHA-256; usamos createHash en lugar de
    // la WebCrypto (subtle.digest es async y complica la API pública).
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const nodeCrypto = require('node:crypto') as typeof import('node:crypto')
    return `sha256:${nodeCrypto
      .createHash('sha256')
      .update(value, 'utf8')
      .digest('hex')}`
  }
  if (typeof value === 'object') {
    // JSON canónico: claves ordenadas, sin caracteres no-ASCII escapados.
    const canonical = JSON.stringify(
      value,
      Object.keys(value as Record<string, unknown>).sort(),
      2,
    )
    if (!canonical) return null
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const nodeCrypto = require('node:crypto') as typeof import('node:crypto')
    return `sha256:${nodeCrypto
      .createHash('sha256')
      .update(canonical, 'utf8')
      .digest('hex')}`
  }
  return null
}

/**
 * Helper interno: toma el `audit` (u objeto) que el backend embebe en su
 * respuesta y extrae los campos congelados de Fase 5 con prioridad al valor
 * backend (sha256 real). Si el backend no los expuso, calcula hashes de
 * respaldo a partir del `publishedVersion` (sha256 también — determinista).
 *
 * Devuelve SIEMPRE un objeto con todos los campos presentes (null si no hay).
 */
export function extractSnapshotVersioningFromBackendAudit(args: {
  backendAudit: Record<string, unknown> | null | undefined
  publishedVersion: PublishedVersionForSnapshot | null
}): {
  calibrationVersionId: string | null
  calibrationVersionNumber: number | null
  presentationSchemaSnapshot: unknown | null
  extractionPromptHash: string | null
  clinicalPromptHash: string | null
  clinicalCriteriaHash: string | null
} {
  const backend = args.backendAudit ?? {}
  const pub = args.publishedVersion

  // VersionId/Number: backend payload es la verdad si está presente;
  // caemos al publishedVersion para rutas que ya lo tienen cargado.
  const calibrationVersionId = readString(backend.calibration_version_id) ?? pub?.versionId ?? null
  const calibrationVersionNumber =
    typeof backend.calibration_version_number === 'number'
      ? (backend.calibration_version_number as number)
      : pub?.versionNumber ?? null

  // presentationSchemaSnapshot: prioridad backend; si no, derivado de la
  // published version.
  const presentationSchemaSnapshot =
    (backend.presentation_schema_snapshot as unknown) ??
    pub?.presentationSchemaSnapshot ??
    null

  // Hashes: prioridad backend (sha256 canónico). Si no, calculamos
  // localmente con la publishedVersion como auditoría secundaria.
  const extractionPromptHash =
    readString(backend.extraction_prompt_hash) ??
    (pub?.extractionPrompt ? _sha256Prefixed(pub.extractionPrompt) : null)
  const clinicalPromptHash =
    readString(backend.clinical_prompt_hash) ??
    (pub?.clinicalPrompt ? _sha256Prefixed(pub.clinicalPrompt) : null)
  const clinicalCriteriaHash =
    readString(backend.clinical_criteria_hash) ??
    (pub?.clinicalCriteria
      ? _sha256Prefixed(pub.clinicalCriteria)
      : null)

  return {
    calibrationVersionId,
    calibrationVersionNumber,
    presentationSchemaSnapshot,
    extractionPromptHash,
    clinicalPromptHash,
    clinicalCriteriaHash,
  }
}

function readString(v: unknown): string | null {
  return typeof v === 'string' && v ? v : null
}
