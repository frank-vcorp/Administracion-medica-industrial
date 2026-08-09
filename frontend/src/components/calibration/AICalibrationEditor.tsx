/**
 * @fileoverview Editor de configuración aiCalibration por prueba médica.
 *   Muestra solo dos prompts/versiones por prueba: extracción (Gemini) y diagnóstico (MedGemma).
 *   Maneja el caso inicial (sin configuración) y el caso de edición (ya configurado).
 * @id ARCH-20260516-03
 * @backup context/SPECs/SPEC_ARCH-20260516-03-CALIBRACION-CONFIG-SOLO-DOS-PROMPTS.md
 * @intervention ARCH-20260518-06
 * @see context/SPECs/SPEC_ARCH-20260518-06-BASE-EXTRACCION-Y-PLANTILLA-CALIBRACION.md
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

const EXTRACTION_PROMPT_TEMPLATE = `REGLAS ESPECIFICAS DEL ESTUDIO: {{nombre_del_estudio}}

OBJETIVO ESPECIFICO
Extraer todos los datos visibles de este estudio con precision literal y exhaustividad, sin interpretacion clinica.

CAMPOS CRITICOS
- identificacion del paciente
- fecha y hora del estudio
- equipo, software y condiciones tecnicas
- tabla principal de parametros
- referencias, LLN y porcentajes del predicho
- notas de calidad tecnica

SINONIMOS Y LABELS EQUIVALENTES
- lista aqui labels reales y sus equivalencias canonicas

REGLAS ESPECIFICAS DE TABLAS
- indica filas, columnas y variantes que nunca deben omitirse

REGLAS ESPECIFICAS DE CALIDAD
- indica como capturar repetibilidad, interpretabilidad o completitud documental

CAMPOS QUE NUNCA DEBEN OMITIRSE SI ESTAN VISIBLES
- agrega aqui los campos que suelen perderse

CAMPOS FRECUENTEMENTE OLVIDADOS
- agrega aqui secundarios importantes del estudio`

const CALIBRATION_REQUEST_TEMPLATE = `Genera un bloque especifico de extraccion para {{nombre_del_estudio}}.

Necesito que complemente una base universal ya existente en backend.
No repitas reglas generales de no invencion o salida JSON.
Enfocate solo en:
- campos criticos
- labels y sinonimos reales
- reglas de tablas
- reglas de calidad
- campos que nunca deben omitirse
- datos medicos tecnicos visibles que suelen perderse

No hagas interpretacion clinica. Solo extraccion precisa y exhaustiva.`

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

// ARCH-20260809-02: tipos y defaults para el selector de proveedor extractivo.
type ExtractionProvider = "gemini" | "m3"
const EXTRACTION_PROVIDERS: ExtractionProvider[] = ["gemini", "m3"]
const EXTRACTION_MODEL_PLACEHOLDERS: Record<ExtractionProvider, string> = {
  gemini: "gemini-2.5-flash",
  m3: "MiniMax-M3",
}
function isExtractionProvider(value: unknown): value is ExtractionProvider {
  return value === "gemini" || value === "m3"
}

function looksLikePromptContent(value: string): boolean {
  const normalized = value.trim()
  if (!normalized) return false
  return normalized.length > 120 || normalized.includes("\n") || normalized.includes("OBJETIVO")
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────────────────────

export default function AICalibrationEditor({ testId, initial }: AICalibrationEditorProps) {
  const extraction = getNested(initial, "extraction")
  const diagnosis = getNested(initial, "diagnosis")
  const rawExtractVersion = getStr(extraction, "version") || getStr(extraction, "schemaVersion")
  const rawExtractPrompt = getStr(extraction, "prompt")
  const rawDiagVersion = getStr(diagnosis, "version") || getStr(diagnosis, "promptVersion")
  const rawDiagPrompt = getStr(diagnosis, "prompt")

  const initialExtractPrompt = rawExtractPrompt || (looksLikePromptContent(rawExtractVersion) ? rawExtractVersion : "")
  const initialExtractVersion = looksLikePromptContent(rawExtractVersion) ? "" : rawExtractVersion
  const initialDiagPrompt = rawDiagPrompt || (looksLikePromptContent(rawDiagVersion) ? rawDiagVersion : "")
  const initialDiagVersion = looksLikePromptContent(rawDiagVersion) ? "" : rawDiagVersion

  // ARCH-20260809-02: estado del selector de proveedor extractivo.
  // Default "gemini" si ausente (migración legacy implícita).
  const rawExtractProvider = extraction?.provider
  const initialExtractProvider: ExtractionProvider = isExtractionProvider(rawExtractProvider)
    ? rawExtractProvider
    : "gemini"
  const initialExtractModel = getStr(extraction, "model")

  // ── Estado del formulario ──────────────────────────────────────────────────
  const [enabled, setEnabled] = useState(getBool(initial, "enabled"))
  const [canonicalStudyType, setCanonicalStudyType] = useState(getStr(initial, "canonicalStudyType"))

  // Extracción: se lee schemaVersion por compatibilidad con configs previas
  const [extractPromptVersion, setExtractPromptVersion] = useState(initialExtractVersion)
  const [extractPrompt, setExtractPrompt] = useState(initialExtractPrompt)
  // ARCH-20260809-02: provider + model editables para el selector multi-proveedor.
  const [extractProvider, setExtractProvider] = useState<ExtractionProvider>(initialExtractProvider)
  const [extractModel, setExtractModel] = useState(initialExtractModel)
  // Diagnóstico clínico
  const [diagPromptVersion, setDiagPromptVersion] = useState(initialDiagVersion)
  const [diagPrompt, setDiagPrompt] = useState(initialDiagPrompt)

  // ── Estado de la acción ────────────────────────────────────────────────────
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  // ── Submit ─────────────────────────────────────────────────────────────────
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage(null)

    const normalizedExtractPrompt = extractPrompt.trim() || (looksLikePromptContent(extractPromptVersion) ? extractPromptVersion.trim() : "")
    const normalizedExtractVersion = looksLikePromptContent(extractPromptVersion) ? "" : extractPromptVersion.trim()
    const normalizedDiagPrompt = diagPrompt.trim() || (looksLikePromptContent(diagPromptVersion) ? diagPromptVersion.trim() : "")
    const normalizedDiagVersion = looksLikePromptContent(diagPromptVersion) ? "" : diagPromptVersion.trim()

    // Merge sobre initial para preservar campos V2 (fieldDefinitions, versions, aiAssistance, etc.)
    const data: Record<string, unknown> = {
      ...(initial ?? {}),
      enabled,
      canonicalStudyType: canonicalStudyType.trim() || null,
      extraction: {
        ...(extraction ?? {}),
        prompt: normalizedExtractPrompt || null,
        version: normalizedExtractVersion || null,
        schemaVersion: normalizedExtractVersion || null,
        // ARCH-20260809-02: persistir selección de proveedor/modelo extractivo.
        // Merge con `...(extraction ?? {})` preserva campos legacy y no rompe consumidores.
        provider: extractProvider,
        model: extractModel.trim() || null,
      },
      diagnosis: {
        ...(diagnosis ?? {}),
        prompt: normalizedDiagPrompt || null,
        version: normalizedDiagVersion || null,
        promptVersion: normalizedDiagVersion || null,
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

      {looksLikePromptContent(rawExtractVersion) && !rawExtractPrompt && (
        <div className="px-4 py-2 rounded-lg text-sm font-medium bg-amber-50 text-amber-700 border border-amber-200">
          ⚠ Se detectó un prompt legacy guardado en la versión de extracción. El editor ya lo movió al bloque específico; al guardar, la migración quedará persistida.
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

      {/* ── Extracción documental — Gemini / MiniMax M3 ────────────────────── */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Extracción documental</p>
          {/*
            ARCH-20260809-02: badge dinámico según el proveedor seleccionado.
            Si es M3, mostramos "M3" con la misma paleta para mantener coherencia visual.
          */}
          <span
            className="text-xs font-medium px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full border border-blue-200"
            data-testid="extraction-provider-badge"
          >
            {extractProvider === "m3" ? "M3 (MiniMax)" : "Gemini"}
          </span>
        </div>
        <p className="text-xs text-blue-600">
          El backend ya aporta una base universal fija de extracción médica. Aquí captura solo el bloque específico del estudio.
        </p>

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="block text-xs text-slate-600 mb-1" htmlFor="extract-provider">
              Proveedor de extracción
            </label>
            <select
              id="extract-provider"
              value={extractProvider}
              onChange={(e) => {
                const next = e.target.value as ExtractionProvider
                if (isExtractionProvider(next)) setExtractProvider(next)
              }}
              className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm font-mono text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              {EXTRACTION_PROVIDERS.map((p) => (
                <option key={p} value={p}>
                  {p === "m3" ? "M3 (MiniMax)" : "Gemini"}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1" htmlFor="extract-model">
              Modelo de extracción
            </label>
            <input
              id="extract-model"
              type="text"
              value={extractModel}
              onChange={(e) => setExtractModel(e.target.value)}
              placeholder={EXTRACTION_MODEL_PLACEHOLDERS[extractProvider]}
              className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm font-mono text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
        </div>

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

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs text-slate-600" htmlFor="extract-prompt">
              Bloque específico de extracción
            </label>
            <button
              type="button"
              onClick={() => setExtractPrompt(EXTRACTION_PROMPT_TEMPLATE)}
              className="text-xs font-medium text-blue-700 hover:text-blue-800"
            >
              Cargar plantilla
            </button>
          </div>
          <textarea
            id="extract-prompt"
            value={extractPrompt}
            onChange={(e) => setExtractPrompt(e.target.value)}
            rows={12}
            placeholder="Pega aqui solo las reglas particulares del estudio. La base universal ya vive en backend."
            className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm font-mono text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border border-blue-200 bg-white p-3">
            <p className="mb-2 text-xs font-semibold text-blue-700 uppercase tracking-wide">Plantilla sugerida</p>
            <pre className="whitespace-pre-wrap text-[11px] leading-5 text-slate-600 font-mono">{EXTRACTION_PROMPT_TEMPLATE}</pre>
          </div>
          <div className="rounded-lg border border-blue-200 bg-white p-3">
            <p className="mb-2 text-xs font-semibold text-blue-700 uppercase tracking-wide">Qué pedirle a Copilot</p>
            <pre className="whitespace-pre-wrap text-[11px] leading-5 text-slate-600 font-mono">{CALIBRATION_REQUEST_TEMPLATE}</pre>
          </div>
        </div>
      </div>

      {/* ── Diagnóstico clínico — MedGemma ──────────────────────────────────── */}
      <div className="p-4 bg-violet-50 border border-violet-200 rounded-xl space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-violet-700 uppercase tracking-wide">Diagnóstico clínico</p>
          <span className="text-xs font-medium px-2 py-0.5 bg-violet-100 text-violet-700 rounded-full border border-violet-200">MedGemma</span>
        </div>
        <p className="text-xs text-violet-600">Prompt y versión que MedGemma usa para interpretar los datos y generar el prediagnóstico.</p>

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

        <div>
          <label className="block text-xs text-slate-600 mb-1" htmlFor="diag-prompt">
            Prompt clínico específico
          </label>
          <textarea
            id="diag-prompt"
            value={diagPrompt}
            onChange={(e) => setDiagPrompt(e.target.value)}
            rows={8}
            placeholder="Pega aqui el prompt clínico específico del estudio para MedGemma."
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
