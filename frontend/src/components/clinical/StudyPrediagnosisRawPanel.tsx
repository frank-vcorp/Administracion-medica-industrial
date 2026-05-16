/**
 * @fileoverview Panel técnico de RAW de entrada clínica a MedGemma/Gemini.
 * Paridad visual con StudyExtractionRawPanel: bloque oscuro, monoespaciado,
 * affordance de copia y expansión equivalente.
 * @id IMPL-20260516-09
 * @spec ARCH-20260516-09
 * @backup context/checkpoints/CHK_IMPL-20260516-09.md
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

import { type MouseEvent, useState } from "react"

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
  const [copiedExtracted, setCopiedExtracted] = useState(false)
  const [copiedCalibration, setCopiedCalibration] = useState(false)

  // Compatibilidad con snapshots viejos sin input_debug
  if (!inputDebug) return null

  const promptLen = inputDebug.rendered_prompt?.length ?? 0

  const handleCopy = (
    e: MouseEvent<HTMLButtonElement>,
    text: string,
    setCopied: (v: boolean) => void,
  ) => {
    e.preventDefault()
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const extractedJson = JSON.stringify(inputDebug.extracted_data, null, 2)
  const calibrationJson = inputDebug.medical_calibration
    ? JSON.stringify(inputDebug.medical_calibration, null, 2)
    : null

  return (
    <details className="group bg-slate-900 rounded-xl overflow-hidden mt-2" open>
      {/* ── Header del panel ── */}
      <summary className="flex items-center justify-between gap-2 px-4 py-3 cursor-pointer select-none text-slate-200 hover:bg-slate-800 transition-colors list-none">
        <div className="flex items-center gap-2">
          <span className="text-slate-400 text-sm">🔬</span>
          <span className="text-xs font-bold font-mono uppercase tracking-wider">
            Raw de entrada clínica
          </span>
          {inputDebug.clinical_provider && (
            <span className="text-[10px] font-mono text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">
              {inputDebug.clinical_provider} / {inputDebug.clinical_model_used ?? '—'}
            </span>
          )}
          <span className="text-[10px] font-mono text-slate-600 bg-slate-800 px-1.5 py-0.5 rounded">
            {inputDebug.study_type}
          </span>
        </div>
        <span className="text-slate-500 text-xs transition-transform group-open:rotate-90 inline-block">▶</span>
      </summary>

      <div className="px-4 pb-4 pt-1 space-y-3">

        {/* ── extracted_data ── */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] font-bold font-mono text-slate-500 uppercase tracking-wider">
              extracted_data
            </p>
            <button
              onClick={(e) => handleCopy(e, extractedJson, setCopiedExtracted)}
              className="text-[10px] font-bold text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded transition-colors"
            >
              {copiedExtracted ? '✓ Copiado' : 'Copiar'}
            </button>
          </div>
          <pre className="text-xs font-mono text-emerald-300 bg-slate-950 rounded-lg p-3 overflow-auto max-h-48 leading-relaxed whitespace-pre-wrap break-all">
            {extractedJson}
          </pre>
        </div>

        {/* ── medical_calibration (solo si existe) ── */}
        {calibrationJson && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] font-bold font-mono text-slate-500 uppercase tracking-wider">
                medical_calibration
              </p>
              <button
                onClick={(e) => handleCopy(e, calibrationJson, setCopiedCalibration)}
                className="text-[10px] font-bold text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded transition-colors"
              >
                {copiedCalibration ? '✓ Copiado' : 'Copiar'}
              </button>
            </div>
            <pre className="text-xs font-mono text-sky-300 bg-slate-950 rounded-lg p-3 overflow-auto max-h-32 leading-relaxed whitespace-pre-wrap break-all">
              {calibrationJson}
            </pre>
          </div>
        )}

        {/* ── rendered_prompt (toggle explícito — puede ser largo) ── */}
        {inputDebug.rendered_prompt && (
          <div>
            <button
              type="button"
              onClick={() => setShowPrompt((v) => !v)}
              className="flex items-center gap-1.5 text-[10px] font-bold font-mono text-slate-500 uppercase tracking-wider hover:text-slate-300 transition-colors mb-1"
            >
              <span className={`inline-block transition-transform ${showPrompt ? 'rotate-90' : ''}`}>▶</span>
              <span>rendered_prompt</span>
              <span className="font-normal text-slate-600 normal-case">
                ({promptLen.toLocaleString()} chars)
              </span>
            </button>
            {showPrompt && (
              <pre className="text-xs font-mono text-amber-200 bg-slate-950 rounded-lg p-3 overflow-auto max-h-64 leading-relaxed whitespace-pre-wrap break-all">
                {inputDebug.rendered_prompt}
              </pre>
            )}
          </div>
        )}

        {/* ── Guardrail de seguridad ── */}
        <p className="text-[10px] font-mono text-slate-600 border-t border-slate-800 pt-2">
          ⚠ Solo datos clínicos estructurados. Sin API keys ni secretos. ARCH-20260516-08.
        </p>

      </div>
    </details>
  )
}
