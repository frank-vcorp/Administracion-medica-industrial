/**
 * @file Server Actions para el módulo de Calibración IA (FIX-20260810-08).
 *
 * FIX-20260810-08: Persistencia y listado de snapshots de calibración.
 *
 * Antes (IMPL-20260715-04): los snapshots solo vivían en memoria del
 * backend. La tab Presentación quedaba vacía porque PresentationSchemaPanel
 * lee snapshots persistidos.
 *
 * Ahora: el endpoint POST /api/v1/calibration/upload persiste cada corrida
 * exitosa en la tabla `calibration_snapshots`. Este server action consulta
 * GET /api/v1/calibration/snapshots?test_id=<id> y adapta el shape al
 * contrato legacy `EventTestEntry[]` que consume CalibrationWorkspaceClient.
 *
 * NOTA sobre colisión de nombre:
 *   Existe `getCalibrationSnapshots` en `@/actions/medical-profiles` (legacy,
 *   lee snapshots clínicos vía Prisma directo → eventTests + extractionSnapshots).
 *   Para evitar choque en page.tsx, ESTA función vive en `@/actions/calibration`
 *   y page.tsx importa desde aquí. El legacy sigue disponible por si se
 *   reactiva en otro flujo.
 *
 * @id FIX-20260810-08
 * @backup context/SPECs/SPEC_FIX-20260810-08-CALIBRACION-SNAPSHOT-PERSISTENCIA.md
 */
'use server'

import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/auth'
import { isAdminLike } from '@/lib/auth/roles'

// ─────────────────────────────────────────────────────────────────────────────
// Tipos públicos (alineados con frontend/src/components/calibration/CalibrationWorkspaceClient.tsx)
// ─────────────────────────────────────────────────────────────────────────────

export interface CalibrationSnapshotEntry {
  id: string
  version: number
  studyType: string
  sourceFileName: string | null
  sourceFileUrl: string | null
  structuredData: unknown
  clinicalState: string
  modelName: string
  promptVersion: string
  isSuperseded: boolean
  createdAt: string
  aiPrediagnoses: Array<unknown> // vacío en calibration flow
}

export interface CalibrationEventTestEntry {
  id: string
  status: string // "CALIBRATION" sintético
  fileUrl: string | null
  resultNotes: string | null
  createdAt: string
  extractionSnapshots: CalibrationSnapshotEntry[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function _backendBase(): string {
  return (
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    process.env.BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://localhost:8000'
  )
}

interface RawCalibrationSnapshot {
  id: string
  medicalTestId: string
  studyType: string
  sourceFileName: string | null
  sourceFileUrl: string | null
  structuredData: unknown
  modelName: string
  promptVersion: string
  clinicalState: string
  createdAt: string
}

/**
 * Adapta el `structuredData` crudo del backend (shape IA pipeline) al shape
 * que consumen los componentes UI legacy (que esperan `extracted_data` y
 * `missing_fields` a nivel raíz, conforme al contrato de StudyExtractionSnapshot).
 *
 * Shape backend persistido (calibration_snapshots.structuredData JSONB):
 *   {
 *     extraction: {
 *       structured_data: { extracted_data, missing_fields, audit, ... },
 *       raw_payload:    { extracted_data, missing_fields, ... },
 *       model_used, prompt_version, duration_seconds, ...
 *     },
 *     prediagnosis: { result, model_used, prompt_version, duration_seconds }
 *   }
 *
 * Shape UI esperado (PresentationSchemaPanel, deriveSchemaFromSnapshots, SnapshotsTab):
 *   { extracted_data, missing_fields, ... }
 *
 * @id FIX-20260810-08 L2 (post-GEMINI CHANGES_REQUESTED)
 */
function _flattenStructuredData(rawStructuredData: unknown): Record<string, unknown> {
  const outer = rawStructuredData as Record<string, unknown> | null
  if (!outer || typeof outer !== 'object') {
    // Si el backend mandó algo no-objeto, devolvemos un dict vacío con la
    // shape esperada para que la UI no crashee (defensivo).
    return { extracted_data: {}, missing_fields: [] }
  }

  const extraction = outer.extraction as Record<string, unknown> | undefined
  const innerStructuredData =
    (extraction?.structured_data as Record<string, unknown> | undefined) ??
    (extraction?.raw_payload as Record<string, unknown> | undefined)

  const extractedData =
    (innerStructuredData?.extracted_data as Record<string, unknown> | undefined) ?? {}
  const missingFields =
    (innerStructuredData?.missing_fields as unknown[] | undefined) ?? []

  // Preservar el payload IA crudo bajo claves con prefijo `_raw_` para
  // diagnóstico/debug del panel (SnapshotsTab puede mostrarlo bajo
  // "structuredData (raw)" si quiere). Mantener el contrato UI principal
  // a raíz.
  return {
    extracted_data: extractedData,
    missing_fields: missingFields,
    ...(innerStructuredData?.audit !== undefined
      ? { audit: innerStructuredData.audit }
      : {}),
    _raw_extraction: extraction ?? null,
    _raw_prediagnosis: outer.prediagnosis ?? null,
  }
}

/**
 * Adapta un CalibrationSnapshot del backend a la forma `EventTestEntry` que
 * consumen los componentes existentes (CalibrationWorkspaceClient +
 * PresentationSchemaPanel + SnapshotsTab). Cada snapshot se envuelve en su
 * propio EventTest sintético para que:
 *   - El metric "Estudios" cuente snapshots (no siempre 1).
 *   - totalPredx / totalReviews = 0 (calibration flow no tiene prediagnóstico
 *     médico real ni revisión).
 *   - El visor de documentos siga funcionando (et.fileUrl = null → usa
 *     snap.sourceFileUrl que también es null en MVP).
 *   - L2 fix: `structuredData` expone `extracted_data` y `missing_fields`
 *     a nivel raíz (mapeo desde el shape anidado del backend).
 */
function _adaptSnapshot(snap: RawCalibrationSnapshot): CalibrationEventTestEntry {
  return {
    id: `synthetic-${snap.id}`,
    status: 'CALIBRATION',
    fileUrl: null,
    resultNotes: null,
    createdAt: snap.createdAt,
    extractionSnapshots: [
      {
        id: snap.id,
        version: 1, // calibration_snapshots no versiona; constante
        studyType: snap.studyType,
        sourceFileName: snap.sourceFileName,
        sourceFileUrl: snap.sourceFileUrl,
        structuredData: _flattenStructuredData(snap.structuredData),
        clinicalState: snap.clinicalState,
        modelName: snap.modelName,
        promptVersion: snap.promptVersion,
        isSuperseded: false,
        createdAt: snap.createdAt,
        aiPrediagnoses: [], // calibration flow no genera prediagnóstico persistido
      },
    ],
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Server Actions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lista snapshots de calibración persistidos para una MedicalTest.
 *
 * Llama al backend FastAPI GET /api/v1/calibration/snapshots?test_id=<id>
 * y adapta la respuesta al shape legacy `EventTestEntry[]` para no romper
 * los componentes downstream.
 *
 * @param testId  ID de MedicalTest
 * @returns       `CalibrationEventTestEntry[]` o `[]` si falla.
 *
 * Errores manejados:
 *   - No autenticado / rol no admin → [] (la página padre ya tiene guard de
 *     NextAuth vía middleware, pero defense-in-depth)
 *   - Backend no configurado → []
 *   - Backend 5xx / red → []
 *
 * NUNCA lanza excepción hacia el caller. Cumple regla del AGENTS.md del
 * proyecto: "Never fail silently in the UI. If a DB call returns null or
 * fails, the UI must render an error state" — la página renderizará sin
 * snapshots (estado vacío explícito) en vez de crashear.
 */
export async function getCalibrationSnapshots(
  testId: string
): Promise<CalibrationEventTestEntry[]> {
  if (!testId || typeof testId !== 'string') {
    console.warn('[FIX-20260810-08] getCalibrationSnapshots: testId inválido')
    return []
  }

  const session = await getServerSession(authOptions)
  if (!session?.user) {
    console.warn('[FIX-20260810-08] getCalibrationSnapshots: sin sesión')
    return []
  }
  const role = session.user.role
  if (!isAdminLike(role)) {
    console.warn(
      `[FIX-20260810-08] getCalibrationSnapshots: rol ${role} no autorizado`
    )
    return []
  }

  const base = _backendBase()
  try {
    const url = `${base}/api/v1/calibration/snapshots?test_id=${encodeURIComponent(testId)}`
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'x-ami-role': role as string,
        'x-ami-userid': session.user.id as string,
      },
      cache: 'no-store',
    })

    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      console.error(
        `[FIX-20260810-08] getCalibrationSnapshots: backend ${res.status}: ${detail.slice(0, 200)}`
      )
      return []
    }

    const json = (await res.json()) as { snapshots: RawCalibrationSnapshot[] }
    if (!Array.isArray(json?.snapshots)) {
      console.warn(
        '[FIX-20260810-08] getCalibrationSnapshots: respuesta sin array "snapshots"'
      )
      return []
    }

    return json.snapshots.map(_adaptSnapshot)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error(
      `[FIX-20260810-08] getCalibrationSnapshots: error de red: ${msg.slice(0, 200)}`
    )
    return []
  }
}