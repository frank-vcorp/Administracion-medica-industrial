/**
 * @fileoverview Editor de configuración aiCalibration por prueba médica.
 *   Formulario cliente para editar y persistir aiCalibration en MedicalTest.options.
 *   Maneja el caso inicial (sin configuración) y el caso de edición (ya configurado).
 * @id ARCH-20260327-16
 * @backup context/SPECs/SPEC_ARCH-20260327-15-PLATAFORMA-CALIBRACION-IA.md
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

  const [extractionEnabled, setExtractionEnabled] = useState(getBool(extraction, "enabled"))
  const [schemaVersion, setSchemaVersion] = useState(getStr(extraction, "schemaVersion"))
  const [targetFields, setTargetFields] = useState(
    Array.isArray(extraction?.targetFields)
      ? (extraction.targetFields as string[]).join(", ")
      : ""
  )

  const [diagnosisEnabled, setDiagnosisEnabled] = useState(getBool(diagnosis, "enabled"))
  const [promptVersion, setPromptVersion] = useState(getStr(diagnosis, "promptVersion"))
  const [requiresDoctorCalibration, setRequiresDoctorCalibration] = useState(
    getBool(diagnosis, "requiresDoctorCalibration")
  )

  // ── Estado de la acción ────────────────────────────────────────────────────
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  // ── Submit ─────────────────────────────────────────────────────────────────
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage(null)

    const data: Record<string, unknown> = {
      enabled,
      canonicalStudyType: canonicalStudyType.trim() || null,
      extraction: {
        enabled: extractionEnabled,
        schemaVersion: schemaVersion.trim() || null,
        targetFields: targetFields
          .split(",")
          .map((f) => f.trim())
          .filter(Boolean),
      },
      diagnosis: {
        enabled: diagnosisEnabled,
        promptVersion: promptVersion.trim() || null,
        requiresDoctorCalibration,
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

      {/* ── Extracción ──────────────────────────────────────────────────────── */}
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Extracción</p>

        <div className="flex items-center gap-3">
          <input
            id="extraction-enabled"
            type="checkbox"
            checked={extractionEnabled}
            onChange={(e) => setExtractionEnabled(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-400"
          />
          <label htmlFor="extraction-enabled" className="text-sm text-slate-700 select-none">
            Extracción habilitada
          </label>
        </div>

        <div>
          <label className="block text-xs text-slate-600 mb-1" htmlFor="schema-version">
            Versión de schema
          </label>
          <input
            id="schema-version"
            type="text"
            value={schemaVersion}
            onChange={(e) => setSchemaVersion(e.target.value)}
            placeholder="ej. v1"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400"
          />
        </div>

        <div>
          <label className="block text-xs text-slate-600 mb-1" htmlFor="target-fields">
            Campos objetivo{" "}
            <span className="font-normal text-slate-400">(separados por coma)</span>
          </label>
          <textarea
            id="target-fields"
            value={targetFields}
            onChange={(e) => setTargetFields(e.target.value)}
            rows={2}
            placeholder="ej. hemoglobina, hematocrito, leucocitos"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none"
          />
        </div>
      </div>

      {/* ── Diagnóstico ─────────────────────────────────────────────────────── */}
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Diagnóstico</p>

        <div className="flex items-center gap-3">
          <input
            id="diagnosis-enabled"
            type="checkbox"
            checked={diagnosisEnabled}
            onChange={(e) => setDiagnosisEnabled(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-400"
          />
          <label htmlFor="diagnosis-enabled" className="text-sm text-slate-700 select-none">
            Diagnóstico IA habilitado
          </label>
        </div>

        <div>
          <label className="block text-xs text-slate-600 mb-1" htmlFor="prompt-version">
            Versión de prompt
          </label>
          <input
            id="prompt-version"
            type="text"
            value={promptVersion}
            onChange={(e) => setPromptVersion(e.target.value)}
            placeholder="ej. v2.1"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400"
          />
        </div>

        <div className="flex items-center gap-3">
          <input
            id="requires-doctor"
            type="checkbox"
            checked={requiresDoctorCalibration}
            onChange={(e) => setRequiresDoctorCalibration(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-400"
          />
          <label htmlFor="requires-doctor" className="text-sm text-slate-700 select-none">
            Requiere calibración médica
          </label>
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
