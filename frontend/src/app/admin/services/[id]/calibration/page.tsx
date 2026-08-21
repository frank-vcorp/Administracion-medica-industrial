/**
 * @fileoverview Plataforma de Calibración IA por Prueba Médica — V2 ARCH-20260327-19.
 *   Evoluciona el MVP (ARCH-20260327-15/16) para incorporar:
 *   - Layout desktop 2 columnas (izquierda: calibración / derecha: documento sticky)
 *   - Propuesta IA heurística basada en snapshots reales
 *   - Versionado automático de aiCalibration
 *   - Panel de curaduría de campos candidatos
 *   - Historial de versiones visible
 *
 *   ARCH-20260820-01 Fase 2B (DEC-20260820-03): parsea `operationMode`
 *   (DEC-20260820-02) y la raíz V3 (`schemaVersion === 'V3'`) del catálogo
 *   `MedicalTest.options`; deriva `canEdit`/`canPublish` de la sesión. Pasar
 *   esa información al workspace hace visibles los estados V3 (draft/tested,
 *   published, superseded) y el botón "Publicar" con gates (G0..G9).
 *
 * FIX-20260810-08: `getCalibrationSnapshots` ahora vive en `@/actions/calibration`
 *   (antes en `@/actions/medical-profiles`). Lee snapshots persistidos en la
 *   tabla `calibration_snapshots` (no en eventTests/event_snapshots) porque
 *   el flujo de calibración no tiene MedicalEvent. Mantiene shape legacy
 *   `EventTestEntry[]` para no romper CalibrationWorkspaceClient.
 * @id IMPL-20260327-19
 * @intervention ARCH-20260820-01-FASE2B
 * @backup context/SPECs/SPEC_ARCH-20260820-01-CALIBRACION-FUENTE-UNICA.md
 * @handoff context/interconsultas/HANDOFF_ARCH-20260820-01_FASE2B_SOFIA_EDITOR-V3.md
 */

import Link from "next/link"
import { notFound } from "next/navigation"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/auth"
import { getMedicalTestById } from "@/actions/medical-profiles"
import { getCalibrationSnapshots } from "@/actions/calibration"
import CalibrationWorkspaceClient from "@/components/calibration/CalibrationWorkspaceClient"
import { deriveSchemaFromSnapshots } from "@/lib/calibration-schema"
import { isAdminLike, isSuperAdmin } from "@/lib/auth/roles"
import { isOperationModeValue } from "@/lib/calibration-v3-ui"
import type {
  AICalibrationV2,
  AICalibrationV3,
  OperationMode,
} from "@/types/calibration"

// params es Promise en Next.js 16+ (App Router)
export default async function CalibrationPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const [test, eventTests, session] = await Promise.all([
    getMedicalTestById(id),
    getCalibrationSnapshots(id),
    getServerSession(authOptions),
  ])

  if (!test) {
    notFound()
  }

  // ── Parsear aiCalibration desde options ──────────────────────────────────
  const options =
    typeof test.options === "object" &&
    test.options !== null &&
    !Array.isArray(test.options)
      ? (test.options as Record<string, unknown>)
      : {}

  const rawCalibration =
    typeof options.aiCalibration === "object" &&
    options.aiCalibration !== null &&
    !Array.isArray(options.aiCalibration)
      ? (options.aiCalibration as Record<string, unknown>)
      : null

  // Interpretar como AICalibrationV2 si tiene el campo currentVersion
  const aiCalibrationV2: AICalibrationV2 | null =
    rawCalibration && typeof rawCalibration.currentVersion === "number"
      ? (rawCalibration as unknown as AICalibrationV2)
      : null

  // ── ARCH-20260820-01 Fase 2B (AC-2B.1): parsear operationMode validando ─
  // los 3 literales del union OperationMode. Ausente/inválido → null (no se
  // inventa). Mismo criterio que el resolver backend.
  const operationMode: OperationMode | null = isOperationModeValue(
    options.operationMode,
  )
    ? (options.operationMode as OperationMode)
    : null

  // ── Parsear raíz V3 (schemaVersion === 'V3') ─────────────────────────────
  const aiCalibrationV3: AICalibrationV3 | null =
    rawCalibration &&
    typeof (rawCalibration as { schemaVersion?: unknown }).schemaVersion === "string" &&
    (rawCalibration as { schemaVersion: string }).schemaVersion === "V3"
      ? (rawCalibration as unknown as AICalibrationV3)
      : null

  // ── RBAC server-side (autoritativo: las acciones revalidan). Estos flags
  // son UX para mostrar/ocultar editor + publicar. ────────────────────────
  const role = (session?.user as { role?: string } | undefined)?.role
  const canEdit = isAdminLike(role)
  const canPublish = isSuperAdmin(role)

  // ── Generar propuesta candidata desde snapshots (heurística) ────────────
  const allSnapshots = eventTests.flatMap((et) => et.extractionSnapshots)
  const candidateFields = deriveSchemaFromSnapshots(allSnapshots)

  // ── Métricas de resumen ─────────────────────────────────────────────────
  // FIX-20260810-08: en el flujo de calibración NO hay prediagnósticos IA
  // ni revisiones médicas (aiPrediagnoses=[] en cada snapshot sintético).
  // totalPredx y totalReviews son siempre 0 — las métricas reflejan el
  // flujo real, no se mezclan con snapshots clínicos.
  const totalExtractionSnapshots = eventTests.reduce(
    (acc, et) => acc + et.extractionSnapshots.length,
    0
  )
  const totalPredx = 0
  const totalReviews = 0

  // ── Resumen derivado para badge del header (no se inventa; AC-2B.1) ────
  const v3DraftStatus = aiCalibrationV3?.draft?.status ?? null
  const v3PublishedVersion = (() => {
    if (!aiCalibrationV3) return null
    const list = aiCalibrationV3.publishedVersions ?? []
    if (list.length === 0) return null
    if (aiCalibrationV3.currentPublishedVersionId) {
      const match = list.find(
        (v) => v.versionId === aiCalibrationV3.currentPublishedVersionId,
      )
      if (match) return match
    }
    return list.find((v) => v.status === "published" || v.status === "disabled") ?? null
  })()

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

  return (
    <div className="flex flex-col min-h-screen">
      {/* ── Encabezado superior — fuera del área de 2 columnas ───────────── */}
      <div className="px-6 py-4 space-y-4 border-b border-slate-200 bg-white">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs text-slate-400">
          <Link href="/admin/services" className="hover:text-slate-700 transition-colors">
            Catálogo de Pruebas
          </Link>
          <span>/</span>
          <span className="text-slate-600 font-medium">{test.name}</span>
          <span>/</span>
          <span className="text-violet-600 font-semibold">Calibración IA</span>
        </nav>

        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-mono text-xs">
                {test.code}
              </span>
              <span className="text-xs text-slate-400">{test.category.name}</span>
              {/* operationMode badge (siempre; null = "sin clasificar") */}
              <span
                className={`px-2 py-0.5 rounded text-xs font-mono font-semibold ${
                  operationMode
                    ? "bg-blue-100 text-blue-700"
                    : "bg-slate-100 text-slate-600"
                }`}
                data-testid="header-operation-mode"
              >
                {operationMode ?? "sin clasificar"}
              </span>
              {/* V3 badges: solo si existe raíz V3 */}
              {aiCalibrationV3 && (
                <>
                  <span
                    className="px-2 py-0.5 rounded bg-violet-100 text-violet-700 font-mono text-xs font-semibold"
                    data-testid="header-v3-draft-status"
                  >
                    draft: {v3DraftStatus ?? "—"}
                  </span>
                  {v3PublishedVersion && (
                    <span
                      className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 font-mono text-xs font-semibold"
                      data-testid="header-v3-published-version"
                    >
                      v{v3PublishedVersion.versionNumber} · {v3PublishedVersion.label}
                    </span>
                  )}
                </>
              )}
              {/* Legacy V2 badge: solo si NO hay raíz V3 */}
              {aiCalibrationV2 && !aiCalibrationV3 && (
                <span className="px-2 py-0.5 rounded bg-violet-100 text-violet-700 font-mono text-xs font-semibold">
                  {aiCalibrationV2.currentVersionLabel}
                </span>
              )}
            </div>
            <h1 className="text-xl font-bold text-slate-800 mt-1">{test.name}</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Calibración IA Asistida · IMPL-20260327-19 · ARCH-20260820-01-Fase2B
            </p>
          </div>
          <Link
            href="/admin/services"
            className="text-xs text-slate-500 hover:text-slate-700 border border-slate-200 px-3 py-1.5 rounded-lg bg-white transition-colors self-start"
          >
            ← Volver al catálogo
          </Link>
        </div>

        {/* Métricas de resumen */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {[
            { label: "Estudios", value: eventTests.length },
            { label: "Snapshots", value: totalExtractionSnapshots },
            { label: "Prediagnósticos IA", value: totalPredx },
            { label: "Revisiones médicas", value: totalReviews },
            { label: "Candidatos IA", value: candidateFields.length },
          ].map(({ label, value }) => (
            <div
              key={label}
              className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center"
            >
              <p className="text-xl font-bold text-slate-800">{value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Workspace principal — 2 columnas ─────────────────────────────── */}
      <div className="flex-1 overflow-hidden">
        <CalibrationWorkspaceClient
          testId={id}
          aiCalibration={aiCalibrationV2}
          aiCalibrationV3={aiCalibrationV3}
          initialRawCalibration={rawCalibration}
          operationMode={operationMode}
          canEdit={canEdit}
          canPublish={canPublish}
          eventTests={eventTests}
          candidateFields={candidateFields}
          apiUrl={apiUrl}
        />
      </div>
    </div>
  )
}
