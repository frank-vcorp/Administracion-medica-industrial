"use client"

/**
 * @fileoverview Panel técnico de raw JSON del extraction snapshot.
 * Separado visualmente del prediagnóstico IA y de los valores capturados humanos.
 * @id IMPL-20260327-01
 * @spec ARCH-20260327-01
 * @backup context/checkpoints/CHK_IMPL-20260327-01-WORKSPACE-IA-DOBLE-COLUMNA.md
 */

import { type MouseEvent, useState } from "react"

interface StudyExtractionRawPanelProps {
  rawPayload: unknown
  snapshotId?: string
  version?: number
}

export default function StudyExtractionRawPanel({
  rawPayload,
  snapshotId,
  version,
}: StudyExtractionRawPanelProps) {
  const [copied, setCopied] = useState(false)

  const json = rawPayload ? JSON.stringify(rawPayload, null, 2) : null

  const handleCopy = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    if (!json) return
    navigator.clipboard.writeText(json).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <details className="group bg-slate-900 rounded-xl overflow-hidden" open>
      <summary className="flex items-center justify-between gap-2 px-4 py-3 cursor-pointer select-none text-slate-200 hover:bg-slate-800 transition-colors list-none">
        <div className="flex items-center gap-2">
          <span className="text-slate-400 text-sm">🔩</span>
          <span className="text-xs font-bold font-mono uppercase tracking-wider">Raw de extracción</span>
          {version !== undefined && (
            <span className="text-[10px] font-mono text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">
              v{version}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {json && (
            <button
              onClick={handleCopy}
              className="text-[10px] font-bold text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded transition-colors"
            >
              {copied ? '✓ Copiado' : 'Copiar'}
            </button>
          )}
          <span className="text-slate-500 text-xs transition-transform group-open:rotate-90 inline-block">▶</span>
        </div>
      </summary>

      <div className="px-4 pb-4 pt-1">
        {snapshotId && (
          <p className="text-[10px] font-mono text-slate-600 mb-2 truncate" title={snapshotId}>
            snapshot: {snapshotId}
          </p>
        )}
        {json ? (
          <pre className="text-xs font-mono text-emerald-300 bg-slate-950 rounded-lg p-3 overflow-auto max-h-[380px] leading-relaxed whitespace-pre-wrap break-all">
            {json}
          </pre>
        ) : (
          <div className="bg-slate-950 rounded-lg p-4 text-center">
            <p className="text-xs text-slate-500 font-mono">Sin datos raw disponibles para este snapshot.</p>
          </div>
        )}
      </div>
    </details>
  )
}
