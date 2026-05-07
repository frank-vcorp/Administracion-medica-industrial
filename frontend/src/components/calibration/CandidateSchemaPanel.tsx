/**
 * @fileoverview Panel de esquema candidato IA — curaduría de campos propuestos.
 *   Permite aceptar, editar (cambiar etiqueta/tipo) o descartar cada campo candidato.
 *   El botón "Promover" llama a saveAICalibrationV2 para crear nueva versión automática.
 * @id IMPL-20260327-19
 * @backup context/SPECs/SPEC_ARCH-20260327-19-CALIBRACION-IA-ASISTIDA-VERSIONADO-AUTOMATICO.md
 */
"use client"

import { useState, useTransition } from "react"
import type { CandidateField, CandidateRecommendation, CandidateFieldType } from "@/types/calibration"
import { saveAICalibrationV2 } from "@/actions/medical-profiles"

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface CandidateSchemaPanelProps {
  testId: string
  candidates: CandidateField[]
  /** Campos actualmente vigentes en el contrato (para detectar duplicados) */
  currentFieldKeys: string[]
  onSaved?: () => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Estado local por campo (decisión del usuario)
// ─────────────────────────────────────────────────────────────────────────────

interface FieldDecision {
  recommendation: CandidateRecommendation
  label: string
  type: CandidateFieldType
  required: boolean
  unit: string
}

type DecisionMap = Record<string, FieldDecision>

// ─────────────────────────────────────────────────────────────────────────────
// Helpers visuales
// ─────────────────────────────────────────────────────────────────────────────

const RECOMMENDATION_BADGE: Record<CandidateRecommendation, string> = {
  accept: "bg-green-100 text-green-700 border border-green-300",
  review: "bg-amber-100 text-amber-700 border border-amber-300",
  discard: "bg-slate-100 text-slate-500 border border-slate-300",
}

const RECOMMENDATION_LABEL: Record<CandidateRecommendation, string> = {
  accept: "✓ Aceptar",
  review: "? Revisar",
  discard: "✗ Descartar",
}

function ConfidenceBar({ value }: { value: number }) {
  const color = value >= 70 ? "bg-green-500" : value >= 40 ? "bg-amber-400" : "bg-red-400"
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-slate-200 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs text-slate-500 tabular-nums w-8 text-right">{value}%</span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────────────────────

export default function CandidateSchemaPanel({
  testId,
  candidates,
  currentFieldKeys,
  onSaved,
}: CandidateSchemaPanelProps) {
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [expandedKey, setExpandedKey] = useState<string | null>(null)

  // Inicializar decisiones con la recomendación IA
  const [decisions, setDecisions] = useState<DecisionMap>(() => {
    const initial: DecisionMap = {}
    for (const c of candidates) {
      initial[c.key] = {
        recommendation: c.recommendation,
        label: c.label,
        type: c.type,
        required: false,
        unit: "",
      }
    }
    return initial
  })

  function updateDecision(key: string, patch: Partial<FieldDecision>) {
    setDecisions((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }))
  }

  // Campos que el usuario ha decidido aceptar
  const accepted = candidates.filter((c) => decisions[c.key]?.recommendation === "accept")

  function handlePromote() {
    setMessage(null)

    const fieldDefinitions = accepted.map((c) => {
      const d = decisions[c.key]
      return {
        key: c.key,
        label: d.label,
        type: d.type,
        aliases: c.aliases,
        required: d.required,
        unit: d.unit.trim() || undefined,
      }
    })

    startTransition(async () => {
      const result = await saveAICalibrationV2(testId, {
        fieldDefinitions,
        source: "candidate-promotion",
        summary: `Promoción de ${fieldDefinitions.length} campo(s) desde propuesta IA`,
      })
      if (result.success) {
        setMessage({ type: "success", text: `Versión creada con ${fieldDefinitions.length} campo(s) promovidos.` })
        onSaved?.()
      } else {
        const err = result as { success: false; error: string }
        setMessage({ type: "error", text: err.error ?? "Error al guardar." })
      }
    })
  }

  if (candidates.length === 0) {
    return (
      <div className="py-8 text-center text-slate-400 space-y-2">
        <p className="text-3xl">🤖</p>
        <p className="text-sm font-medium">Sin snapshots suficientes para generar propuesta IA</p>
        <p className="text-xs">Procesa al menos un estudio para que aparezcan campos candidatos.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header con contador y acción principal */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-sm font-semibold text-slate-700">
            {candidates.length} campo(s) detectado(s)
          </p>
          <p className="text-xs text-slate-400">
            {accepted.length} aceptado(s) · listo para promover a contrato vigente
          </p>
        </div>
        <button
          onClick={handlePromote}
          disabled={isPending || accepted.length === 0}
          className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-semibold transition-colors"
        >
          {isPending ? "Guardando…" : `⬆ Promover ${accepted.length} campo(s)`}
        </button>
      </div>

      {/* Feedback */}
      {message && (
        <div
          role="alert"
          className={`px-3 py-2 rounded-lg text-xs font-medium ${
            message.type === "success"
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {message.type === "success" ? "✓ " : "✗ "}{message.text}
        </div>
      )}

      {/* Lista de candidatos */}
      <div className="space-y-2">
        {candidates.map((c) => {
          const dec = decisions[c.key]
          const isExpanded = expandedKey === c.key
          const isInContract = currentFieldKeys.includes(c.key)

          return (
            <div
              key={c.key}
              className={`border rounded-xl overflow-hidden transition-all ${
                dec.recommendation === "discard"
                  ? "opacity-50 border-slate-200"
                  : dec.recommendation === "accept"
                  ? "border-green-300 bg-green-50/30"
                  : "border-amber-200 bg-amber-50/20"
              }`}
            >
              {/* Fila principal */}
              <div className="flex items-center gap-2 px-3 py-2.5">
                {/* Clave */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <code className="text-xs font-mono font-semibold text-slate-800 truncate">{c.key}</code>
                    <span className="text-xs font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                      {dec.type}
                    </span>
                    {isInContract && (
                      <span className="text-xs bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded font-semibold">
                        en contrato
                      </span>
                    )}
                  </div>
                  <div className="mt-1">
                    <ConfidenceBar value={c.confidence} />
                  </div>
                </div>

                {/* Acciones */}
                <div className="flex items-center gap-1 shrink-0">
                  {(["accept", "review", "discard"] as CandidateRecommendation[]).map((rec) => (
                    <button
                      key={rec}
                      onClick={() => updateDecision(c.key, { recommendation: rec })}
                      className={`px-2 py-1 rounded text-xs font-semibold transition-colors ${
                        dec.recommendation === rec
                          ? RECOMMENDATION_BADGE[rec]
                          : "bg-white text-slate-400 border border-slate-200 hover:border-slate-400"
                      }`}
                      title={RECOMMENDATION_LABEL[rec]}
                    >
                      {rec === "accept" ? "✓" : rec === "discard" ? "✗" : "?"}
                    </button>
                  ))}
                  <button
                    onClick={() => setExpandedKey(isExpanded ? null : c.key)}
                    className="ml-1 px-2 py-1 rounded text-xs text-slate-400 hover:text-slate-700 transition-colors"
                  >
                    {isExpanded ? "▲" : "▼"}
                  </button>
                </div>
              </div>

              {/* Panel expandido — edición de la decisión */}
              {isExpanded && (
                <div className="border-t border-slate-200 bg-white px-3 py-3 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Etiqueta</label>
                      <input
                        type="text"
                        value={dec.label}
                        onChange={(e) => updateDecision(c.key, { label: e.target.value })}
                        className="w-full border border-slate-200 rounded px-2 py-1.5 text-xs text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-violet-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Tipo de dato</label>
                      <select
                        value={dec.type}
                        onChange={(e) => updateDecision(c.key, { type: e.target.value as CandidateFieldType })}
                        className="w-full border border-slate-200 rounded px-2 py-1.5 text-xs text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-violet-400"
                      >
                        {(["text", "number", "boolean", "date", "unknown"] as CandidateFieldType[]).map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Unidad</label>
                      <input
                        type="text"
                        value={dec.unit}
                        onChange={(e) => updateDecision(c.key, { unit: e.target.value })}
                        placeholder="ej. mg/dL, %"
                        className="w-full border border-slate-200 rounded px-2 py-1.5 text-xs font-mono text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-violet-400"
                      />
                    </div>
                    <div className="flex items-end pb-1">
                      <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={dec.required}
                          onChange={(e) => updateDecision(c.key, { required: e.target.checked })}
                          className="h-3.5 w-3.5 rounded border-slate-300 text-violet-600"
                        />
                        Campo requerido
                      </label>
                    </div>
                  </div>

                  {/* Evidencia del campo */}
                  {c.exampleValues.length > 0 && (
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Valores observados en snapshots</p>
                      <div className="flex flex-wrap gap-1.5">
                        {c.exampleValues.map((v, i) => (
                          <code key={i} className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono">
                            {v}
                          </code>
                        ))}
                      </div>
                    </div>
                  )}
                  <p className="text-xs text-slate-400">
                    Aparece en {c.frequency} de {c.totalSnapshots} snapshots ({c.confidence}% confianza)
                  </p>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
