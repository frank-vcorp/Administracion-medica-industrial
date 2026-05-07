/**
 * @fileoverview Historial de versiones de calibración IA — muestra versiones previas
 *   y diferencia entre borrador y contrato vigente.
 * @id IMPL-20260327-19
 * @backup context/SPECs/SPEC_ARCH-20260327-19-CALIBRACION-IA-ASISTIDA-VERSIONADO-AUTOMATICO.md
 */
"use client"

import type { AICalibrationV2, CalibrationVersion, FieldDefinition } from "@/types/calibration"

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface CalibrationVersionHistoryProps {
  aiCalibration: AICalibrationV2 | null
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("es-MX", {
    dateStyle: "short",
    timeStyle: "short",
  })
}

const SOURCE_LABELS: Record<string, string> = {
  "manual-review": "Revisión manual",
  "ai-assisted-review": "Asistida por IA",
  "candidate-promotion": "Promoción candidatos",
}

const SOURCE_COLORS: Record<string, string> = {
  "manual-review": "bg-slate-100 text-slate-600",
  "ai-assisted-review": "bg-violet-100 text-violet-700",
  "candidate-promotion": "bg-green-100 text-green-700",
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-componente: Tabla de fieldDefinitions
// ─────────────────────────────────────────────────────────────────────────────

function FieldDefinitionsTable({
  fields,
  title,
  badge,
}: {
  fields: FieldDefinition[]
  title: string
  badge?: React.ReactNode
}) {
  if (fields.length === 0) {
    return (
      <div className="space-y-1">
        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide flex items-center gap-2">
          {title} {badge}
        </p>
        <div className="p-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 text-xs text-slate-400 text-center">
          Sin campos definidos
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide flex items-center gap-2">
        {title} {badge}
      </p>
      <div className="border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left px-3 py-2 text-slate-500 font-semibold">Clave</th>
              <th className="text-left px-3 py-2 text-slate-500 font-semibold">Etiqueta</th>
              <th className="text-left px-3 py-2 text-slate-500 font-semibold">Tipo</th>
              <th className="text-left px-3 py-2 text-slate-500 font-semibold">Req.</th>
            </tr>
          </thead>
          <tbody>
            {fields.map((f, i) => (
              <tr key={f.key} className={i % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                <td className="px-3 py-2 font-mono text-slate-800">{f.key}</td>
                <td className="px-3 py-2 text-slate-700">{f.label}</td>
                <td className="px-3 py-2 text-slate-500">{f.type}</td>
                <td className="px-3 py-2">
                  {f.required ? (
                    <span className="text-red-600 font-bold">✓</span>
                  ) : (
                    <span className="text-slate-300">–</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-componente: Tarjeta de versión
// ─────────────────────────────────────────────────────────────────────────────

function VersionCard({
  version,
  isLatest,
}: {
  version: CalibrationVersion
  isLatest: boolean
}) {
  const sourceCls = SOURCE_COLORS[version.source] ?? "bg-slate-100 text-slate-600"
  const sourceLabel = SOURCE_LABELS[version.source] ?? version.source

  return (
    <div
      className={`flex gap-3 p-3 rounded-lg border ${
        isLatest ? "border-violet-300 bg-violet-50" : "border-slate-200 bg-white"
      }`}
    >
      {/* Separador vertical timeline */}
      <div className="flex flex-col items-center gap-1 pt-1">
        <div
          className={`h-5 w-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
            isLatest ? "bg-violet-600 text-white" : "bg-slate-200 text-slate-600"
          }`}
        >
          {version.version}
        </div>
      </div>
      {/* Contenido */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-xs font-semibold text-slate-800">{version.label}</span>
          {isLatest && (
            <span className="px-1.5 py-0.5 rounded bg-violet-600 text-white text-xs font-semibold">
              vigente
            </span>
          )}
          <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${sourceCls}`}>
            {sourceLabel}
          </span>
        </div>
        <p className="text-xs text-slate-600">{version.summary}</p>
        <p className="text-xs text-slate-400">{formatDate(version.createdAt)}</p>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────────────────────

export default function CalibrationVersionHistory({
  aiCalibration,
}: CalibrationVersionHistoryProps) {
  if (!aiCalibration) {
    return (
      <div className="py-8 text-center text-slate-400 space-y-2">
        <p className="text-3xl">🕐</p>
        <p className="text-sm font-medium">Sin historial de versiones</p>
        <p className="text-xs">El historial se crea automáticamente al guardar la primera calibración.</p>
      </div>
    )
  }

  const versions = [...(aiCalibration.versions ?? [])].reverse() // más reciente primero
  const currentFieldDefs = aiCalibration.fieldDefinitions ?? []
  const draftFieldDefs = aiCalibration.draft?.fieldDefinitions ?? []
  const hasDraft = draftFieldDefs.length > 0

  return (
    <div className="space-y-5">
      {/* Estado actual */}
      <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
        <div className="text-center">
          <p className="text-2xl font-bold text-violet-700">v{aiCalibration.currentVersion}</p>
          <p className="text-xs text-slate-500 mt-0.5">versión actual</p>
        </div>
        <div className="flex-1 border-l border-slate-200 pl-3 space-y-0.5">
          <p className="text-xs font-mono font-semibold text-slate-700">{aiCalibration.currentVersionLabel}</p>
          {aiCalibration.updatedAt && (
            <p className="text-xs text-slate-400">Actualizado: {formatDate(aiCalibration.updatedAt)}</p>
          )}
          {aiCalibration.aiAssistance?.lastSuggestionSummary && (
            <p className="text-xs text-slate-500 italic">{aiCalibration.aiAssistance.lastSuggestionSummary}</p>
          )}
        </div>
      </div>

      {/* Contrato vigente */}
      <FieldDefinitionsTable
        fields={currentFieldDefs as FieldDefinition[]}
        title="Contrato vigente"
        badge={
          <span className="px-1.5 py-0.5 rounded bg-violet-600 text-white text-xs font-semibold">
            v{aiCalibration.currentVersion}
          </span>
        }
      />

      {/* Borrador vs. Vigente */}
      {hasDraft && (
        <FieldDefinitionsTable
          fields={draftFieldDefs as FieldDefinition[]}
          title="Borrador (pendiente de promoción)"
          badge={
            <span className="px-1.5 py-0.5 rounded bg-amber-500 text-white text-xs font-semibold">
              draft
            </span>
          }
        />
      )}

      {/* Historial de versiones */}
      {versions.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
            Historial ({versions.length} versión/es)
          </p>
          <div className="space-y-2">
            {versions.map((v, i) => (
              <VersionCard
                key={v.version}
                version={v}
                isLatest={i === 0}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
