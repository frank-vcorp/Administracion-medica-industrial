/**
 * @fileoverview Rail de asistencia IA contextual — observaciones y sugerencias
 *   basadas en el estado actual de la calibración y los snapshots analizados.
 * @id IMPL-20260327-19
 * @backup context/SPECs/SPEC_ARCH-20260327-19-CALIBRACION-IA-ASISTIDA-VERSIONADO-AUTOMATICO.md
 */
"use client"

import type { CandidateField, AICalibrationV2, FieldDefinition } from "@/types/calibration"

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface CalibrationAIAssistantRailProps {
  candidates: CandidateField[]
  aiCalibration: AICalibrationV2 | null
  snapshotCount: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Tipos de observación
// ─────────────────────────────────────────────────────────────────────────────

type ObservationType = "info" | "warning" | "error" | "suggestion"

interface Observation {
  type: ObservationType
  message: string
}

const OBS_STYLE: Record<ObservationType, string> = {
  info: "bg-blue-50 border-blue-200 text-blue-800",
  warning: "bg-amber-50 border-amber-200 text-amber-800",
  error: "bg-red-50 border-red-200 text-red-800",
  suggestion: "bg-violet-50 border-violet-200 text-violet-800",
}

const OBS_ICON: Record<ObservationType, string> = {
  info: "ℹ",
  warning: "⚠",
  error: "✗",
  suggestion: "💡",
}

// ─────────────────────────────────────────────────────────────────────────────
// Generador de observaciones heurísticas
// ─────────────────────────────────────────────────────────────────────────────

function generateObservations(
  candidates: CandidateField[],
  aiCalibration: AICalibrationV2 | null,
  snapshotCount: number
): Observation[] {
  const obs: Observation[] = []

  // Sobre cobertura de snapshots
  if (snapshotCount === 0) {
    obs.push({
      type: "warning",
      message: "Sin snapshots reales. La propuesta IA no puede generarse hasta que se procesen estudios.",
    })
    return obs
  }

  obs.push({
    type: "info",
    message: `Propuesta basada en ${snapshotCount} snapshot(s) de extracción reales.`,
  })

  // Campos con alta confianza
  const highConfidence = candidates.filter((c) => c.confidence >= 80)
  if (highConfidence.length > 0) {
    obs.push({
      type: "suggestion",
      message: `${highConfidence.length} campo(s) con confianza ≥80%: ${highConfidence.map((c) => c.key).slice(0, 4).join(", ")}${highConfidence.length > 4 ? "…" : ""}. Candidatos fuertes para aceptar.`,
    })
  }

  // Campos de baja confianza
  const lowConfidence = candidates.filter((c) => c.confidence < 30)
  if (lowConfidence.length > 0) {
    obs.push({
      type: "warning",
      message: `${lowConfidence.length} campo(s) con confianza <30% (aparecen solo en pocos snapshots). Revisar antes de incluir.`,
    })
  }

  // Comparar contrato vigente vs. candidatos
  if (aiCalibration) {
    const currentFieldDefs = (aiCalibration.fieldDefinitions ?? []) as FieldDefinition[]
    const currentKeys = new Set(currentFieldDefs.map((f) => f.key))
    const candidateKeys = new Set(candidates.map((c) => c.key))

    // Campos vigentes que ya no aparecen en snapshots recientes
    const obsolete = currentFieldDefs.filter((f) => !candidateKeys.has(f.key))
    if (obsolete.length > 0) {
      obs.push({
        type: "warning",
        message: `${obsolete.length} campo(s) vigente(s) no detectado(s) en snapshots recientes: ${obsolete.map((f) => f.key).join(", ")}. Pueden estar obsoletos.`,
      })
    }

    // Candidatos nuevos que no están en el contrato vigente
    const newCandidates = candidates.filter(
      (c) => !currentKeys.has(c.key) && c.confidence >= 50
    )
    if (newCandidates.length > 0) {
      obs.push({
        type: "suggestion",
        message: `${newCandidates.length} campo(s) nuevo(s) con confianza ≥50% no incluido(s) aún en el contrato: ${newCandidates.map((c) => c.key).slice(0, 3).join(", ")}${newCandidates.length > 3 ? "…" : ""}.`,
      })
    }

    // Sin campos definidos
    if (currentFieldDefs.length === 0) {
      obs.push({
        type: "warning",
        message: "El contrato vigente no tiene campos definidos. Promueve los candidatos para establecer el esquema.",
      })
    } else {
      obs.push({
        type: "info",
        message: `Contrato vigente: ${currentFieldDefs.length} campo(s) definido(s) en versión ${aiCalibration.currentVersionLabel}.`,
      })
    }
  } else {
    obs.push({
      type: "warning",
      message: "Sin calibración configurada. Promueve los campos candidatos para crear la primera versión.",
    })
  }

  // Tipos mixtos (campos donde hay ambigüedad de tipo)
  const unknownType = candidates.filter((c) => c.type === "unknown")
  if (unknownType.length > 0) {
    obs.push({
      type: "warning",
      message: `${unknownType.length} campo(s) con tipo de dato incierto. Revisar y ajustar manualmente antes de promover.`,
    })
  }

  return obs
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────────────────────

export default function CalibrationAIAssistantRail({
  candidates,
  aiCalibration,
  snapshotCount,
}: CalibrationAIAssistantRailProps) {
  const observations = generateObservations(candidates, aiCalibration, snapshotCount)

  return (
    <div className="space-y-3">
      {/* Encabezado del rail */}
      <div className="flex items-center gap-2">
        <span className="text-base">🤖</span>
        <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Asistente IA</p>
        <span className="ml-auto px-2 py-0.5 rounded bg-violet-100 text-violet-700 text-xs font-semibold">
          {observations.length} obs.
        </span>
      </div>

      {/* Lista de observaciones */}
      <div className="space-y-2">
        {observations.map((obs, i) => (
          <div
            key={i}
            className={`flex gap-2 px-3 py-2.5 rounded-lg border text-xs ${OBS_STYLE[obs.type]}`}
          >
            <span className="shrink-0 font-bold mt-0.5">{OBS_ICON[obs.type]}</span>
            <span className="leading-relaxed">{obs.message}</span>
          </div>
        ))}
      </div>

      {/* Resumen de asistencia previa */}
      {aiCalibration?.aiAssistance?.lastSuggestedAt && (
        <div className="p-2 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-500">
          Última sugerencia IA:{" "}
          {new Date(aiCalibration.aiAssistance.lastSuggestedAt).toLocaleString("es-MX", {
            dateStyle: "short",
            timeStyle: "short",
          })}
        </div>
      )}
    </div>
  )
}
