/**
 * @fileoverview Plataforma de Calibración IA por Prueba Médica — MVP administrativo.
 *   Muestra la prueba del catálogo, su configuración aiCalibration y los tabs
 *   de extracción/diagnóstico con snapshots reales del sistema.
 *   Incremento ARCH-20260327-16: editor UI de aiCalibration con guardado.
 * @id ARCH-20260327-16
 * @backup context/SPECs/SPEC_ARCH-20260327-15-PLATAFORMA-CALIBRACION-IA.md
 */

import Link from "next/link"
import { notFound } from "next/navigation"
import { getMedicalTestById, getCalibrationSnapshots } from "@/actions/medical-profiles"
import CalibrationTabs from "@/components/calibration/CalibrationTabs"
import AICalibrationEditor from "@/components/calibration/AICalibrationEditor"

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

  // Leer configuración aiCalibration desde options (puede ser JSON object o array vacío por default)
  const options =
    typeof test.options === "object" &&
    test.options !== null &&
    !Array.isArray(test.options)
      ? (test.options as Record<string, unknown>)
      : {}
  const aiCalibration = (options.aiCalibration ?? null) as Record<string, unknown> | null

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

  // Métricas de resumen
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

  return (
    <div className="space-y-6">
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

      {/* Encabezado de la prueba */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-mono text-xs">
              {test.code}
            </span>
            <span className="text-xs text-slate-400">{test.category.name}</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-800 mt-1">{test.name}</h1>
          <p className="text-sm text-slate-500 mt-0.5">Plataforma de Calibración IA · ARCH-20260327-15</p>
        </div>
        <Link
          href="/admin/services"
          className="text-xs text-slate-500 hover:text-slate-700 border border-slate-200 px-3 py-1.5 rounded-lg bg-white transition-colors self-start"
        >
          ← Volver al catálogo
        </Link>
      </div>

      {/* Métricas de resumen */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Estudios vinculados", value: eventTests.length },
          { label: "Snapshots extracción", value: totalExtractionSnapshots },
          { label: "Prediagnósticos IA", value: totalPredx },
          { label: "Revisiones médicas", value: totalReviews },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="bg-white border border-slate-200 rounded-xl p-4 text-center shadow-sm"
          >
            <p className="text-2xl font-bold text-slate-800">{value}</p>
            <p className="text-xs text-slate-500 mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Bloque de configuración aiCalibration — editable (ARCH-20260327-16) */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
            Configuración de Calibración IA
          </h2>
          {aiCalibration ? (
            <span className="px-2 py-0.5 rounded bg-green-100 text-green-700 text-xs font-semibold">
              ✓ Configurada
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-700 text-xs font-medium">
              Sin configurar — rellena el formulario para inicializar
            </span>
          )}
        </div>

        <AICalibrationEditor testId={id} initial={aiCalibration} />
      </div>

      {/* Tabs principales — Extracción / Diagnóstico */}
      <CalibrationTabs eventTests={eventTests} apiUrl={apiUrl} />
    </div>
  )
}
