/**
 * @fileoverview Panel colapsable de RAW de entrada clínica a MedGemma/Gemini
 * @id IMPL-20260516-08
 * @backup context/checkpoints/CHK_IMPL-20260516-08.md
 *
 * Muestra exactamente qué payload clínico llegó al modelo de prediagnóstico:
 *   - study_type, clinical_provider, clinical_model_used
 *   - extracted_data serializado
 *   - medical_calibration aplicada (si existe)
 *   - rendered_prompt (colapsado por defecto, toggle explícito)
 *
 * GUARDRAIL: Este panel solo muestra datos clínicos estructurados.
 *   No expone API keys, tokens ni secretos del proveedor. ARCH-20260516-08.
 */
"use client"

import { useState } from "react"

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export interface PrediagnosisInputDebug {
  study_type: string
  extracted_data: Record<string, unknown>
  medical_calibration?: Record<string, unknown> | null
  clinical_provider?: string | null
  clinical_model_used?: string | null
  rendered_prompt?: string | null
}

interface StudyPrediagnosisRawPanelProps {
  inputDebug: PrediagnosisInputDebug | null | undefined
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export default function StudyPrediagnosisRawPanel({ inputDebug }: StudyPrediagnosisRawPanelProps) {
  const [showPrompt, setShowPrompt] = useState(false)

  // Compatibilidad con snapshots viejos sin input_debug
  if (!inputDebug) return null

  const promptLen = inputDebug.rendered_prompt?.length ?? 0

  return (
    <details className="mt-2">
      <summary className="cursor-pointer text-xs font-semibold text-slate-500 hover:text-slate-700 select-none flex items-center gap-1.5 py-1">
        <span>🔬</span>
        <span>RAW de entrada clínica</span>
        {inputDebug.clinical_provider && (
          <span className="font-mono text-[10px] text-slate-400 ml-1">
            {inputDebug.clinical_provider} / {inputDebug.clinical_model_used ?? '—'}
          </span>
        )}
      </summary>

      <div className="mt-2 rounded-lg border border-slate-200 bg-white overflow-hidden text-xs">

        {/* Badges de proveedor / modelo / tipo de estudio */}
        <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 flex flex-wrap gap-1.5">
          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 font-mono text-[10px]">
            proveedor: {inputDebug.clinical_provider ?? 'desconocido'}
          </span>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-purple-50 border border-purple-200 text-purple-700 font-mono text-[10px]">
            modelo: {inputDebug.clinical_model_used ?? 'desconocido'}
          </span>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-teal-50 border border-teal-200 text-teal-700 font-mono text-[10px]">
            estudio: {inputDebug.study_type}
          </span>
        </div>

        {/* extracted_data */}
        <div className="px-3 py-2.5 border-b border-slate-100">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
            extracted_data
          </p>
          <pre className="text-[11px] text-slate-700 whitespace-pre-wrap break-words leading-relaxed max-h-48 overflow-y-auto bg-slate-50 rounded px-2 py-1.5">
            {JSON.stringify(inputDebug.extracted_data, null, 2)}
          </pre>
        </div>

        {/* medical_calibration (solo si existe) */}
        {inputDebug.medical_calibration && (
          <div className="px-3 py-2.5 border-b border-slate-100">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              medical_calibration aplicada
            </p>
            <pre className="text-[11px] text-slate-700 whitespace-pre-wrap break-words leading-relaxed max-h-32 overflow-y-auto bg-slate-50 rounded px-2 py-1.5">
              {JSON.stringify(inputDebug.medical_calibration, null, 2)}
            </pre>
          </div>
        )}

        {/* rendered_prompt (toggle explícito para no sobrecargar la UI) */}
        {inputDebug.rendered_prompt && (
          <div className="px-3 py-2.5 border-b border-slate-100">
            <button
              type="button"
              onClick={() => setShowPrompt((v) => !v)}
              className="text-[10px] font-bold text-slate-400 uppercase tracking-wider hover:text-slate-600 transition-colors flex items-center gap-1"
            >
              <span>{showPrompt ? '▲' : '▶'}</span>
              <span>rendered_prompt</span>
              <span className="font-normal text-slate-300">({promptLen.toLocaleString()} chars)</span>
            </button>
            {showPrompt && (
              <pre className="mt-1.5 text-[11px] text-slate-600 whitespace-pre-wrap break-words leading-relaxed max-h-64 overflow-y-auto bg-slate-50 rounded px-2 py-1.5">
                {inputDebug.rendered_prompt}
              </pre>
            )}
          </div>
        )}

        {/* Guardrail de seguridad visible */}
        <div className="px-3 py-1.5 bg-amber-50 border-t border-amber-100">
          <p className="text-[10px] text-amber-600">
            Solo datos clínicos estructurados. No contiene API keys ni secretos del proveedor. ARCH-20260516-08.
          </p>
        </div>

      </div>
    </details>
  )
}
