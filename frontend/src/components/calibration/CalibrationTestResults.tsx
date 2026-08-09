/**
 * @fileoverview Visualizador de resultados de un PDF de prueba procesado en
 *   el módulo de calibración. Muestra extracción y prediagnóstico con tabs,
 *   métricas (modelo, versión de prompt, tiempo) y JSON formateado.
 * @id IMPL-20260715-04
 * @backup context/SPECs/SPEC_ARCH-20260715-04-UPLOAD-PDFS-CALIBRACION.md
 *
 * Recibe un `CalibrationTestResults` que viene del backend
 * `POST /api/v1/calibration/upload` y solo lo presenta — no lo muta ni
 * lo persiste (el cache vive en memoria del backend).
 */
"use client"

import { useMemo, useState } from "react"
import type { CalibrationTestResults } from "@/types/calibration"

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

export interface CalibrationTestResultsProps {
  results: CalibrationTestResults
}

// ─────────────────────────────────────────────────────────────────────────────
// Tipos de tab interno
// ─────────────────────────────────────────────────────────────────────────────

type ResultTab = "extraccion" | "prediagnostico"

const TAB_LABELS: Record<ResultTab, string> = {
  extraccion: "🧬 Extracción",
  prediagnostico: "🩺 Prediagnóstico",
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || Number.isNaN(seconds)) return "—"
  if (seconds < 1) return `${Math.round(seconds * 1000)} ms`
  return `${seconds.toFixed(2)} s`
}

function formatTimestamp(ts: string | undefined): string {
  if (!ts) return "—"
  try {
    return new Date(ts).toLocaleString("es-MX", {
      dateStyle: "short",
      timeStyle: "medium",
    })
  } catch {
    return ts
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Subcomponentes
// ─────────────────────────────────────────────────────────────────────────────

function MetricPill({
  label,
  value,
  tone = "slate",
}: {
  label: string
  value: string
  tone?: "slate" | "violet" | "teal"
}) {
  const toneCls: Record<string, string> = {
    slate: "bg-slate-100 text-slate-700 border-slate-200",
    violet: "bg-violet-100 text-violet-700 border-violet-200",
    teal: "bg-teal-50 text-teal-700 border-teal-200",
  }
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-mono ${toneCls[tone]}`}
    >
      <span className="font-sans font-semibold uppercase tracking-wide opacity-70">{label}</span>
      <span className="font-semibold">{value}</span>
    </span>
  )
}

function MetricsRow({ results }: { results: CalibrationTestResults }) {
  // ARCH-20260809-02: trazabilidad multi-proveedor (Gemini + MiniMax M3).
  const extractionProviderUsed = results.extraction.extraction_provider_used ?? "gemini"
  const extractionFallbackReason = results.extraction.extraction_fallback_reason ?? null
  return (
    <div className="flex flex-wrap gap-2">
      <MetricPill label="Test ID" value={results.test_id} tone="violet" />
      {results.canonical_study_type && (
        <MetricPill label="Tipo" value={results.canonical_study_type} tone="teal" />
      )}
      <MetricPill label="Extracción" value={results.extraction.model_used} tone="slate" />
      <MetricPill label="Proveedor" value={extractionProviderUsed} tone="teal" />
      {extractionFallbackReason && (
        <MetricPill
          label="Fallback"
          value={extractionFallbackReason}
          tone="violet"
        />
      )}
      <MetricPill label="Prompt v" value={results.extraction.prompt_version} tone="slate" />
      <MetricPill label="Extr. ⏱" value={formatDuration(results.extraction.duration_seconds)} />
      <MetricPill label="Predx" value={results.prediagnosis.model_used} tone="slate" />
      <MetricPill
        label="Prompt v"
        value={results.prediagnosis.prompt_version}
        tone="slate"
      />
      <MetricPill label="Predx ⏱" value={formatDuration(results.prediagnosis.duration_seconds)} />
    </div>
  )
}

function JsonBlock({ data }: { data: unknown }) {
  const pretty = useMemo(() => {
    try {
      return JSON.stringify(data, null, 2)
    } catch {
      return String(data)
    }
  }, [data])

  return (
    <pre className="bg-slate-950 text-green-300 text-xs p-4 rounded-lg overflow-x-auto max-h-[28rem] whitespace-pre-wrap break-all">
      {pretty}
    </pre>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────────────────────

export default function CalibrationTestResults({ results }: CalibrationTestResultsProps) {
  const [activeTab, setActiveTab] = useState<ResultTab>("extraccion")

  const extractionData = results.extraction.structured_data
  const prediagnosisData = results.prediagnosis.result

  const extractionBytes = useMemo(() => {
    try {
      return JSON.stringify(extractionData ?? {}).length
    } catch {
      return 0
    }
  }, [extractionData])

  const predxBytes = useMemo(() => {
    try {
      return JSON.stringify(prediagnosisData ?? {}).length
    } catch {
      return 0
    }
  }, [prediagnosisData])

  const tabCls = (tab: ResultTab) =>
    `px-3 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition-colors whitespace-nowrap ${
      activeTab === tab
        ? "border-violet-600 text-violet-700 bg-white"
        : "border-transparent text-slate-500 hover:text-slate-700 bg-slate-50"
    }`

  return (
    <section
      aria-label="Resultados de PDF de prueba"
      className="space-y-3 border border-slate-200 rounded-xl bg-white p-4 shadow-sm"
    >
      <header className="space-y-2">
        <div className="flex items-baseline justify-between gap-2 flex-wrap">
          <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
            Resultados de la prueba
          </p>
          <p className="text-xs text-slate-400 font-mono">
            {formatTimestamp(results.created_at)}
          </p>
        </div>
        <MetricsRow results={results} />
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
          ⚠ Estos resultados son de prueba — no se persisten en DB ni generan EventTest.
        </p>
      </header>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 bg-slate-50 rounded-t-lg overflow-x-auto">
        {(["extraccion", "prediagnostico"] as ResultTab[]).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={tabCls(tab)}
            aria-pressed={activeTab === tab}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {activeTab === "extraccion" && (
          <div className="space-y-2">
            <div className="flex items-baseline justify-between text-xs text-slate-500">
              <span className="font-semibold uppercase tracking-wide">Datos extraídos</span>
              <span className="font-mono">{extractionBytes.toLocaleString("es-MX")} bytes</span>
            </div>
            <JsonBlock data={extractionData} />
          </div>
        )}

        {activeTab === "prediagnostico" && (
          <div className="space-y-2">
            <div className="flex items-baseline justify-between text-xs text-slate-500">
              <span className="font-semibold uppercase tracking-wide">Interpretación IA</span>
              <span className="font-mono">{predxBytes.toLocaleString("es-MX")} bytes</span>
            </div>
            <JsonBlock data={prediagnosisData} />
          </div>
        )}
      </div>
    </section>
  )
}