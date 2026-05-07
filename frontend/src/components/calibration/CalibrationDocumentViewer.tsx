/**
 * @fileoverview Visor de documento fuente — panel derecho dominante, sticky.
 *   Muestra PDF/imágenes en iframe/img con prioridad de ancho/alto.
 *   Soporta selector de documento cuando hay múltiples snapshots disponibles.
 * @id IMPL-20260327-19
 * @backup context/SPECs/SPEC_ARCH-20260327-19-CALIBRACION-IA-ASISTIDA-VERSIONADO-AUTOMATICO.md
 */
"use client"

import { useState } from "react"

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

export interface DocumentEntry {
  id: string
  label: string
  url: string
  fileName?: string | null
}

interface CalibrationDocumentViewerProps {
  documents: DocumentEntry[]
  /** Índice del documento seleccionado por el panel izquierdo (sincronización opcional) */
  externalSelectedIdx?: number
  onSelectDocument?: (idx: number) => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Detectar tipo de documento
// ─────────────────────────────────────────────────────────────────────────────

function detectDocType(url: string): "pdf" | "image" | "other" {
  const lower = url.toLowerCase()
  if (lower.includes(".pdf") || lower.includes("pdf")) return "pdf"
  if (/\.(png|jpe?g|gif|webp|bmp|tiff?)(\?|$)/.test(lower)) return "image"
  return "pdf" // default a iframe
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente
// ─────────────────────────────────────────────────────────────────────────────

export default function CalibrationDocumentViewer({
  documents,
  externalSelectedIdx,
  onSelectDocument,
}: CalibrationDocumentViewerProps) {
  const [internalIdx, setInternalIdx] = useState(0)

  const selectedIdx = externalSelectedIdx ?? internalIdx
  const selected = documents[selectedIdx] ?? null

  function handleSelect(idx: number) {
    setInternalIdx(idx)
    onSelectDocument?.(idx)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Selector de documentos */}
      {documents.length > 1 && (
        <div className="flex gap-1.5 flex-wrap p-3 border-b border-slate-200 bg-slate-50 rounded-t-xl">
          {documents.map((doc, idx) => (
            <button
              key={doc.id}
              onClick={() => handleSelect(idx)}
              className={`px-3 py-1 rounded text-xs font-mono font-semibold transition-colors border ${
                selectedIdx === idx
                  ? "bg-violet-600 text-white border-violet-600"
                  : "bg-white text-slate-600 border-slate-300 hover:border-violet-400"
              }`}
              title={doc.fileName ?? doc.label}
            >
              {doc.label}
            </button>
          ))}
        </div>
      )}

      {/* Área del documento */}
      <div className="flex-1 min-h-0 relative">
        {selected ? (
          <div className="h-full flex flex-col">
            {/* Encabezado del documento */}
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-800 text-slate-200 text-xs">
              <span className="text-slate-400">📄</span>
              <span className="flex-1 truncate font-mono">{selected.fileName ?? selected.label}</span>
              <a
                href={selected.url}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 px-2 py-0.5 rounded bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white text-xs font-semibold transition-colors"
              >
                ↗ Abrir
              </a>
            </div>

            {/* Visor principal */}
            <div className="flex-1 min-h-0">
              {detectDocType(selected.url) === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={selected.url}
                  alt={selected.fileName ?? "Documento fuente"}
                  className="w-full h-full object-contain bg-slate-100"
                />
              ) : (
                <iframe
                  src={selected.url}
                  title={selected.fileName ?? "Documento fuente"}
                  className="w-full h-full border-0 bg-slate-100"
                  allow="fullscreen"
                />
              )}
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center gap-3 bg-slate-50 rounded-b-xl text-slate-400">
            <span className="text-5xl">📭</span>
            <p className="text-sm font-medium">Sin documento fuente disponible</p>
            <p className="text-xs text-center max-w-xs">
              Los documentos aparecerán aquí cuando los snapshots registren archivos fuente.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
