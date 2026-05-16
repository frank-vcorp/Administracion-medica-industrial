/**
 * @fileoverview Editor de configuración aiCalibration por prueba médica.
 *   Muestra solo dos prompts/versiones por prueba: extracción (Gemini) y diagnóstico (MedGemma).
 *   Maneja el caso inicial (sin configuración) y el caso de edición (ya configurado).
 * @id ARCH-20260516-03
 * @backup context/SPECs/SPEC_ARCH-20260516-03-CALIBRACION-CONFIG-SOLO-DOS-PROMPTS.md
 */
"use client"

import { useState, useTransition } from "react"
import { saveAICalibration } from "@/actions/medical-profiles"

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface AICalibrationEditorProps {
  testId: string
  initial: Record<string, unknown> | null
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de acceso seguro a datos anidados del JSON
// ─────────────────────────────────────────────────────────────────────────────

function getStr(obj: Record<string, unknown> | null, key: string): string {
  if (!obj) return ""
  const val = obj[key]
  return val != null ? String(val) : ""
}

function getBool(obj: Record<string, unknown> | null, key: string): boolean {
  if (!obj) return false
  return Boolean(obj[key])
}

function getNested(obj: Record<string, unknown> | null, key: string): Record<string, unknown> | null {
  if (!obj) return null
  const val = obj[key]
  return typeof val === "object" && val !== null && !Array.isArray(val)
    ? (val as Record<string, unknown>)
    : null
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────────────────────

export default function AICalibrationEditor({ testId, initial }: AICalibrationEditorProps) {
  const extraction = getNested(initial, "extraction")
  const diagnosis = getNested(initial, "diagnosis")

  // ── Estado del formulario ──────────────────────────────────────────────────
  const [enabled, setEnabled] = useState(getBool(initial, "enabled"))
  const [canonicalStudyType, setCanonicalStudyType] = useState(getStr(initial, "canonicalStudyType"))

  // Extracción: se lee schemaVersion por compatibilidad con configs previas
  const [extractPromptVersion, setExtractPromptVersion] = useState(getStr(extraction, "schemaVersion"))
  // Diagnóstico clínico
  const [diagPromptVersion, setDiagPromptVersion] = useState(getStr(diagnosis, "promptVersion"))

  // ── Estado de la acción ────────────────────────────────────────────────────
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  // ── Submit ─────────────────────────────────────────────────────────────────
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage(null)

    // Merge sobre initial para preservar campos V2 (fieldDefinitions, versions, aiAssistance, etc.)
    const data: Record<string, unknown> = {
      ...(initial ?? {}),
      enabled,
      canonicalStudyType: canonicalStudyType.trim() || null,
      extraction: {
        ...(extraction ?? {}),
        schemaVersion: extractPromptVersion.trim() || null,
      },
      diagnosis: {
        ...(diagnosis ?? {}),
        promptVersion: diagPromptVersion.trim() || null,
      },
    }

    startTransition(async () => {
      const result = await saveAICalibration(testId, data)
      if (result.success) {
        setMessage({ type: "success", text: "Configuración guardada correctamente." })
      } else {
        const errResult = result as { success: false; error: string }
        setMessage({ type: "error", text: errResult.error ?? "Error al guardar." })
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" aria-label="Editor de calibración IA">
      {/* Nota si es configuración nueva */}
      {!initial && (
        <div className="flex items-start gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
          <span>⚠</span>
          <span>
            Esta prueba aún no tiene <code className="font-mono">aiCalibration</code>. Al guardar se creará
            la configuración inicial en <code className="font-mono">MedicalTest.options</code>.
          </span>
        </div>
      )}

      {/* Feedback de la acción */}
      {message && (
        <div
          role="alert"
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            message.type === "success"
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {message.type === "success" ? "✓ " : "✗ "}
          {message.text}
        </div>
      )}

      {/* ── General ─────────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">General</p>

        <div className="flex items-center gap-3">
          <input
            id="cal-enabled"
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-400"
          />
          <label htmlFor="cal-enabled" className="text-sm text-slate-700 select-none">
            Calibración IA activa
          </label>
        </div>

        <div>
          <label className="block text-xs text-slate-600 mb-1" htmlFor="canonical-study-type">
            Tipo de estudio canónico
          </label>
          <input
            id="canonical-study-type"
            type="text"
            value={canonicalStudyType}
            onChange={(e) => setCanonicalStudyType(e.target.value)}
            placeholder="ej. LABORATORIO_GENERAL"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400"
          />
        </div>
      </div>

      {/* ── Extracción documental — Gemini ────────────────────────────────── */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Extracción documental</p>
          <span className="text-xs font-medium px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full border border-blue-200">Gemini</span>
        </div>
        <p className="text-xs text-blue-600">Versión del prompt que Gemini usa para extraer datos del documento.</p>

        <div>
          <label className="block text-xs text-slate-600 mb-1" htmlFor="extract-prompt-version">
            Versión de prompt de extracción
          </label>
          <input
            id="extract-prompt-version"
            type="text"
            value={extractPromptVersion}
            onChange={(e) => setExtractPromptVersion(e.target.value)}
            placeholder="ej. extract-audio-gemini-v2"
            className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm font-mono text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
      </div>

      {/* ── Diagnóstico clínico — MedGemma ──────────────────────────────────── */}
      <div className="p-4 bg-violet-50 border border-violet-200 rounded-xl space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-violet-700 uppercase tracking-wide">Diagnóstico clínico</p>
          <span className="text-xs font-medium px-2 py-0.5 bg-violet-100 text-violet-700 rounded-full border border-violet-200">MedGemma</span>
        </div>
        <p className="text-xs text-violet-600">Versión del prompt que MedGemma usa para interpretar los datos y generar el prediagnóstico.</p>

        <div>
          <label className="block text-xs text-slate-600 mb-1" htmlFor="diag-prompt-version">
            Versión de prompt de diagnóstico
          </label>
          <input
            id="diag-prompt-version"
            type="text"
            value={diagPromptVersion}
            onChange={(e) => setDiagPromptVersion(e.target.value)}
            placeholder="ej. predx-audio-medgemma-v2"
            className="w-full border border-violet-200 rounded-lg px-3 py-2 text-sm font-mono text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400"
          />
        </div>
      </div>

      {/* ── Acción ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="px-5 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:bg-violet-300 text-white text-sm font-semibold transition-colors"
        >
          {isPending ? "Guardando…" : "Guardar calibración"}
        </button>
        {isPending && (
          <span className="text-xs text-slate-400 animate-pulse">Actualizando configuración…</span>
        )}
      </div>
    </form>
  )
}
