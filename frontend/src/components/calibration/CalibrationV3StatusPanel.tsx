"use client"

/**
 * @file Panel de estado V3 para la pantalla de Calibración. ARCH-20260820-01
 *   Fase 2B (DEC-20260820-03). Cierra el cableado de UI que faltaba entre
 *   `MedicalTest.options.aiCalibration` (V3) y el administrador.
 *
 *   - Muestra `operationMode` (manual_service / document_extraction /
 *     clinical_interpretation) o "sin clasificar".
 *   - Estado de publicación: draft (`draft`/`tested`/ninguno), versión
 *     publicada vigente, `supersededCount`, indicador `legacyV1V2Snapshot`.
 *   - Renderiza la lista de gates visibles (G0..G9) con N/A donde aplique.
 *   - Botón "Publicar" (solo si `canPublish=true`) invoca
 *     `publishAICalibrationV3(testId)`; en éxito muestra versionNumber +
 *     `onChanged()`; en fallo, mapping del gate fallido + resaltado.
 *   - Si `isManualService`: aviso "sin editor" + sin botón publicar.
 *   - Gate UI: si `canEdit=false`, reemplaza panel+editor por aviso
 *     "Requiere rol ADMIN o superior" (AC-2B.11). El gate server-side de
 *     `saveAICalibrationV3`/`publishAICalibrationV3` es autoritativo.
 *
 * @id ARCH-20260820-01 / IMPL-20260820-01-FASE2B
 */

import { useState, useTransition } from "react"
import { publishAICalibrationV3 } from "@/actions/calibration-v3.actions"
import type {
  AICalibrationV3,
  OperationMode,
} from "@/types/calibration"
import {
  describeCalibrationV3State,
  getPublishGateVisibility,
  mapPublishErrorCode,
} from "@/lib/calibration-v3-ui"

interface CalibrationV3StatusPanelProps {
  testId: string
  operationMode: OperationMode | null
  aiCalibrationV3: AICalibrationV3 | null
  canEdit: boolean
  canPublish: boolean
  onChanged: () => void
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("es-MX", {
      dateStyle: "short",
      timeStyle: "short",
    })
  } catch {
    return iso
  }
}

export default function CalibrationV3StatusPanel({
  testId,
  operationMode,
  aiCalibrationV3,
  canEdit,
  canPublish,
  onChanged,
}: CalibrationV3StatusPanelProps) {
  const state = describeCalibrationV3State(aiCalibrationV3, operationMode)
  const draft = aiCalibrationV3?.draft ?? null
  const gates = getPublishGateVisibility(state.operationMode, draft)

  // ── Gate UI: sin permisos de edición → sólo aviso (AC-2B.11) ────────────────
  if (!canEdit) {
    return (
      <div
        className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800"
        data-testid="calibration-v3-status-panel-no-permission"
        role="status"
      >
        Requiere rol <strong>ADMIN</strong> o superior para editar la calibración.
        La publicación (disponible para <strong>SUPERADMIN</strong>) también está deshabilitada.
      </div>
    )
  }

  // ── manual_service: sin editor, sin publicar (DEC-20260820-02, AC-2B.9) ─────
  if (state.isManualService) {
    return (
      <div
        className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-600 space-y-2"
        data-testid="calibration-v3-status-panel-manual-service"
        role="status"
      >
        <p>
          <strong>Servicio manual</strong> — <code className="font-mono">operationMode=manual_service</code>.
        </p>
        <p>
          Los servicios manuales no admiten calibración IA (DEC-20260820-02). No se muestra editor
          ni botón de publicación.
        </p>
      </div>
    )
  }

  return (
    <div
      className="p-4 bg-white border border-slate-200 rounded-xl space-y-4"
      data-testid="calibration-v3-status-panel"
    >
      {/* ── operationMode ──────────────────────────────────────────────────── */}
      <header className="flex items-center gap-2 flex-wrap">
        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
          Estado V3
        </p>
        <span
          className={`px-2 py-0.5 rounded text-xs font-mono font-semibold ${
            state.operationMode
              ? "bg-blue-100 text-blue-700"
              : "bg-slate-100 text-slate-600"
          }`}
          data-testid="calibration-v3-operation-mode"
        >
          {state.operationMode ?? "sin clasificar"}
        </span>
        {!state.hasV3 && (
          <span className="px-2 py-0.5 rounded text-xs font-mono bg-amber-100 text-amber-700">
            legacy V1/V2
          </span>
        )}
        {state.hasLegacySnapshot && (
          <span className="px-2 py-0.5 rounded text-xs font-mono bg-violet-100 text-violet-700">
            snapshot legacy congelado
          </span>
        )}
      </header>

      {/* ── Estado de publicación ──────────────────────────────────────────── */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Draft</p>
          <p className="mt-1 font-mono font-semibold text-slate-700" data-testid="calibration-v3-draft-status">
            {state.draftStatus ?? "—"}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Versión publicada</p>
          {state.currentPublishedVersion ? (
            <p className="mt-1 font-mono font-semibold text-slate-700" data-testid="calibration-v3-published-version">
              v{state.currentPublishedVersion.versionNumber} · {state.currentPublishedVersion.label}
              <span className="block text-xs font-normal text-slate-500 mt-0.5">
                {formatDate(state.currentPublishedVersion.publishedAt)}
              </span>
            </p>
          ) : (
            <p className="mt-1 text-slate-400">—</p>
          )}
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Histórico superseded</p>
          <p className="mt-1 font-mono font-semibold text-slate-700">{state.supersededCount}</p>
        </div>
      </section>

      {/* ── Publicar + lista de gates ──────────────────────────────────────── */}
      <PublishSection
        testId={testId}
        canPublish={canPublish}
        state={state}
        gates={gates}
        onChanged={onChanged}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-componente: publicar + gates visibles
// ─────────────────────────────────────────────────────────────────────────────

function PublishSection({
  testId,
  canPublish,
  state,
  gates,
  onChanged,
}: {
  testId: string
  canPublish: boolean
  state: ReturnType<typeof describeCalibrationV3State>
  gates: ReturnType<typeof getPublishGateVisibility>
  onChanged: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<{
    type: "success" | "error"
    title: string
    hint: string
    gate: string | null
    versionNumber?: number
  } | null>(null)

  function handlePublish() {
    setMessage(null)
    startTransition(async () => {
      const res = await publishAICalibrationV3(testId)
      if (res.ok) {
        setMessage({
          type: "success",
          title: `Versión v${res.versionNumber} publicada`,
          hint: "La calibración ya está activa para Events.",
          gate: null,
          versionNumber: res.versionNumber,
        })
        onChanged()
      } else {
        const mapped = mapPublishErrorCode(res.code)
        setMessage({
          type: "error",
          title: mapped.title,
          hint: mapped.hint,
          gate: mapped.gate,
        })
      }
    })
  }

  const failedGate = message?.type === "error" ? message.gate : null

  return (
    <section className="space-y-3 border-t border-slate-200 pt-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
          Publicar calibración
        </p>
        {canPublish ? (
          <button
            type="button"
            onClick={handlePublish}
            disabled={isPending}
            data-testid="calibration-v3-publish-button"
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white text-sm font-semibold transition-colors"
          >
            {isPending ? "Publicando…" : "Publicar"}
          </button>
        ) : (
          <span className="text-xs text-slate-500" data-testid="calibration-v3-publish-legend">
            Publicar requiere rol <strong>SUPERADMIN</strong>.
          </span>
        )}
      </div>

      {message && (
        <div
          role="alert"
          className={`px-3 py-2 rounded-lg text-xs font-medium border ${
            message.type === "success"
              ? "bg-green-50 text-green-800 border-green-200"
              : "bg-red-50 text-red-800 border-red-200"
          }`}
        >
          <p className="font-semibold">
            {message.type === "success" ? "✓ " : "✗ "}
            {message.title}
          </p>
          <p className="mt-0.5">{message.hint}</p>
        </div>
      )}

      {/* Lista de gates visibles (sirve como diagnóstico al usuario) */}
      <ul className="space-y-1 text-xs" data-testid="calibration-v3-gates-list">
        {gates.map((g) => {
          const isFailed = failedGate === g.gate
          const cls = isFailed
            ? "bg-red-50 border-red-300 text-red-800 font-semibold"
            : g.applicable
              ? "bg-slate-50 border-slate-200 text-slate-700"
              : "bg-slate-50 border-slate-200 text-slate-400"
          return (
            <li
              key={g.gate}
              className={`flex items-center gap-2 px-2 py-1 rounded border ${cls}`}
              data-testid={`calibration-v3-gate-${g.gate}`}
              data-applicable={g.applicable ? "true" : "false"}
              data-failed={isFailed ? "true" : "false"}
            >
              <span className="font-mono font-bold w-10 shrink-0">{g.gate}</span>
              <span className="flex-1">{g.label}</span>
              {g.reason && <span className="text-[11px] italic">{g.reason}</span>}
              {isFailed && message?.hint && (
                <span className="text-[11px] italic">{message.hint}</span>
              )}
            </li>
          )
        })}
      </ul>
      <p className="text-[11px] text-slate-400">
        G8/G9 y G5 se muestran como N/A (P-04 y sin infra E2E en Fase 2; no bloquean).
      </p>
      {/* El estado `state` se conserva intencionalmente para futuros gates derivados. */}
      <span data-testid="calibration-v3-state-summary" hidden>
        {state.hasV3 ? "v3" : "legacy"} draft={state.draftStatus ?? "none"} superseded={state.supersededCount}
      </span>
    </section>
  )
}
