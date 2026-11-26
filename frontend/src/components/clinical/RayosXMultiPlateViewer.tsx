'use client'

import { useState } from 'react'
import StudyDocumentViewer from '@/components/clinical/StudyDocumentViewer'
import {
  formatRayosXProjectionsSummary,
  RAYOS_X_MAX_FILES,
  RAYOS_X_PROJECTION_PRESETS,
  type RayosXAttachmentItem,
} from '@/lib/clinical/rayos-x-attachments'

export interface RayosXMultiPlateViewerProps {
  testId: string
  attachments: RayosXAttachmentItem[]
  apiUrl: string
  acceptAttribute: string
  readonly: boolean
  isBusy: boolean
  needsReanalysis: boolean
  onAddPlates: (files: File[]) => void
  onRemovePlate: (fileUrl: string) => void
  onUpdateLabel: (fileUrl: string, projectionLabel: string | null) => void
  onReanalyze: () => void
}

function isPdfUrl(url: string): boolean {
  return /\.pdf(\?.*)?$/i.test(url)
}

export default function RayosXMultiPlateViewer({
  testId,
  attachments,
  apiUrl,
  acceptAttribute,
  readonly,
  isBusy,
  needsReanalysis,
  onAddPlates,
  onRemovePlate,
  onUpdateLabel,
  onReanalyze,
}: RayosXMultiPlateViewerProps) {
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null)

  if (attachments.length === 0) return null

  const activeIdx = Math.max(
    0,
    attachments.findIndex((a) => a.url === selectedUrl),
  )
  const activePlate = attachments[activeIdx] ?? attachments[0]
  const projectionsSummary = formatRayosXProjectionsSummary(attachments)
  const canAddMore = !readonly && attachments.length < RAYOS_X_MAX_FILES

  return (
    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-xs font-semibold text-emerald-700">
            {attachments.length > 1
              ? `Placas vinculadas (${attachments.length})`
              : 'Archivo vinculado'}
          </p>
          {projectionsSummary ? (
            <span className="text-[11px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-200">
              {projectionsSummary}
            </span>
          ) : null}
        </div>

        {canAddMore ? (
          <label
            className={`inline-flex items-center gap-1 rounded-lg border border-teal-300 bg-white px-2.5 py-1 text-xs font-bold text-teal-700 hover:bg-teal-50 transition-colors ${
              isBusy ? 'opacity-50 pointer-events-none' : 'cursor-pointer'
            }`}
          >
            <span>＋ Agregar placa</span>
            <input
              type="file"
              multiple
              accept={acceptAttribute}
              className="hidden"
              disabled={isBusy}
              onChange={(e) => {
                const picked = Array.from(e.target.files ?? [])
                e.target.value = ''
                if (picked.length > 0 && !isBusy) {
                  onAddPlates(picked)
                }
              }}
            />
          </label>
        ) : null}
      </div>

      {/* Selector de placas / miniaturas */}
      <div className="flex flex-wrap gap-2">
        {attachments.map((plate, idx) => {
          const isSelected = plate.url === activePlate.url
          const fullUrl = `${apiUrl}${plate.url}`
          const pdf = isPdfUrl(plate.url)
          return (
            <div
              key={plate.url}
              className={`group relative flex items-center gap-2 rounded-lg border p-1.5 pr-2 transition-colors ${
                isSelected
                  ? 'border-teal-600 bg-white ring-2 ring-teal-200'
                  : 'border-emerald-200 bg-white/80 hover:border-teal-300'
              }`}
            >
              <button
                type="button"
                onClick={() => setSelectedUrl(plate.url)}
                className="flex items-center gap-2 text-left min-w-0"
              >
                {pdf ? (
                  <span className="w-9 h-9 rounded bg-slate-100 border border-slate-200 flex items-center justify-center text-sm shrink-0">
                    📄
                  </span>
                ) : (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={fullUrl}
                    alt={plate.fileName}
                    className="w-9 h-9 rounded object-cover border border-slate-200 bg-slate-900 shrink-0"
                  />
                )}
                <div className="min-w-0">
                  <p className="text-[11px] font-bold text-slate-800 whitespace-nowrap">
                    Placa {idx + 1}
                    {plate.projectionLabel ? ` · ${plate.projectionLabel}` : ''}
                  </p>
                  <p className="text-[10px] text-slate-500 truncate max-w-[120px]" title={plate.fileName}>
                    {plate.fileName}
                  </p>
                </div>
              </button>

              {!readonly ? (
                <button
                  type="button"
                  disabled={isBusy}
                  aria-label={`Quitar placa ${idx + 1}`}
                  title="Quitar placa"
                  onClick={() => onRemovePlate(plate.url)}
                  className="ml-1 w-5 h-5 rounded-full text-xs font-bold text-slate-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center disabled:opacity-40"
                >
                  ×
                </button>
              ) : null}
            </div>
          )
        })}
      </div>

      {/* Selector rápido de proyección para la placa activa */}
      {!readonly ? (
        <div className="flex flex-wrap items-center gap-1.5 bg-white/80 border border-emerald-200/80 rounded-lg px-2.5 py-2">
          <span className="text-[11px] font-semibold text-slate-600 mr-1">
            Proyección Placa {activeIdx + 1}:
          </span>
          {RAYOS_X_PROJECTION_PRESETS.map((preset) => {
            const active =
              (activePlate.projectionLabel ?? '').toUpperCase() === preset.toUpperCase()
            return (
              <button
                key={preset}
                type="button"
                disabled={isBusy}
                onClick={() =>
                  onUpdateLabel(activePlate.url, active ? null : preset)
                }
                className={`px-2 py-0.5 rounded text-[11px] font-semibold border transition-colors disabled:opacity-50 ${
                  active
                    ? 'bg-teal-600 text-white border-teal-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-teal-300'
                }`}
              >
                {preset}
              </button>
            )
          })}
          {activePlate.projectionLabel ? (
            <button
              type="button"
              disabled={isBusy}
              onClick={() => onUpdateLabel(activePlate.url, null)}
              className="px-2 py-0.5 rounded text-[11px] font-medium text-slate-500 hover:text-slate-800 border border-transparent hover:border-slate-200 disabled:opacity-50"
            >
              Sin etiqueta
            </button>
          ) : null}
        </div>
      ) : null}

      {needsReanalysis && !readonly ? (
        <div className="bg-amber-50 border border-amber-300 rounded-lg px-3 py-2 flex items-center justify-between gap-2 flex-wrap">
          <p className="text-xs text-amber-900">
            Cambiaste las placas o etiquetas de proyección. Reanaliza para actualizar el análisis IA conjunto.
          </p>
          <button
            type="button"
            disabled={isBusy}
            onClick={onReanalyze}
            className="rounded-lg bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 text-xs font-bold transition-colors disabled:opacity-50"
          >
            {isBusy ? '⏳ Analizando...' : '🔄 Reanalizar placas con IA'}
          </button>
        </div>
      ) : null}

      <StudyDocumentViewer
        key={`${testId}:${activePlate.url}`}
        fileUrl={`${apiUrl}${activePlate.url}`}
        fileName={activePlate.fileName}
      />
    </div>
  )
}
