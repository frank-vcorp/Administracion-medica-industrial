/**
 * @fileoverview Plataforma de Calibración IA por Prueba Médica — V2 ARCH-20260327-19.
 *   Evoluciona el MVP (ARCH-20260327-15/16) para incorporar:
 *   - Layout desktop 2 columnas (izquierda: calibración / derecha: documento sticky)
 *   - Propuesta IA heurística basada en snapshots reales
 *   - Versionado automático de aiCalibration
 *   - Panel de curaduría de campos candidatos
 *   - Historial de versiones visible
 * @id IMPL-20260327-19
 * @backup context/SPECs/SPEC_ARCH-20260327-19-CALIBRACION-IA-ASISTIDA-VERSIONADO-AUTOMATICO.md
 */

import Link from "next/link"
import { notFound } from "next/navigation"
import { getMedicalTestById, getCalibrationSnapshots } from "@/actions/medical-profiles"
import CalibrationWorkspaceClient from "@/components/calibration/CalibrationWorkspaceClient"
import { deriveSchemaFromSnapshots } from "@/lib/calibration-schema"
import type { AICalibrationV2 } from "@/types/calibration"

// params es Promise en Next.js 16+ (App Router)
export default async function CalibrationPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const [test, eventTests] = await Promise.all([
    getMedicalTestById(id),
    getCalibrationSnapshots(id),
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

  // ── Generar propuesta candidata desde snapshots (heurística) ────────────
  const allSnapshots = eventTests.flatMap((et) => et.extractionSnapshots)
  const candidateFields = deriveSchemaFromSnapshots(allSnapshots)

  // ── Métricas de resumen ─────────────────────────────────────────────────
  const totalExtractionSnapshots = eventTests.reduce(
    (acc, et) => acc + et.extractionSnapshots.length,
    0
  )
  const totalPredx = eventTests.reduce(
    (acc, et) =>
      acc +
      et.extractionSnapshots.reduce((a, snap) => a + snap.aiPrediagnoses.length, 0),
    0
  )
  const totalReviews = eventTests.reduce(
    (acc, et) =>
      acc +
      et.extractionSnapshots.reduce(
        (a, snap) =>
          a + snap.aiPrediagnoses.reduce((b, p) => b + p.doctorReviews.length, 0),
        0
      ),
    0
  )

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
              {aiCalibrationV2 && (
                <span className="px-2 py-0.5 rounded bg-violet-100 text-violet-700 font-mono text-xs font-semibold">
                  {aiCalibrationV2.currentVersionLabel}
                </span>
              )}
            </div>
            <h1 className="text-xl font-bold text-slate-800 mt-1">{test.name}</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Calibración IA Asistida · IMPL-20260327-19
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
          initialRawCalibration={rawCalibration}
          eventTests={eventTests}
          candidateFields={candidateFields}
          apiUrl={apiUrl}
        />
      </div>
    </div>
  )
}
