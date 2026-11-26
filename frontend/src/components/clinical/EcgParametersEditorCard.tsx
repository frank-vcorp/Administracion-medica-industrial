'use client'

import { useState, useTransition } from 'react'
import { saveEcgClinicalParameters } from '@/actions/event-test.actions'
import {
  buildInitialEcgParametersFromExtraction,
  isEcgParametersContext,
  type EcgParametersPayload,
} from '@/lib/clinical/ecg-parameters'
import {
  buildEcgNarrativeParagraph,
  parseEcgFromExtraction,
} from '@/lib/clinical/ecg-report'

export interface EcgParametersEditorCardProps {
  eventId: string
  eventTestId: string
  extractedData: unknown
  savedContext: unknown
  readonly: boolean
  onSaved: (payload: EcgParametersPayload) => void
}

function parseOptionalIntInput(raw: string): number | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const num = Number.parseInt(trimmed, 10)
  return Number.isFinite(num) ? num : null
}

function intInputValue(value: number | null | undefined): string {
  return value == null || !Number.isFinite(value) ? '' : String(value)
}

export default function EcgParametersEditorCard({
  eventId,
  eventTestId,
  extractedData,
  savedContext,
  readonly,
  onSaved,
}: EcgParametersEditorCardProps) {
  const [form, setForm] = useState<EcgParametersPayload>(() =>
    buildInitialEcgParametersFromExtraction(extractedData, savedContext),
  )
  const [isSaving, startSaving] = useTransition()
  const [saveError, setSaveError] = useState('')
  const [saveSuccess, setSaveSuccess] = useState(false)

  const parsedExtraction = parseEcgFromExtraction(extractedData)
  const isConfirmedByDoctor = isEcgParametersContext(savedContext)
  const isGridEstimate = parsedExtraction?.origen_mediciones === 'cuadricula_visual'

  const previewText = buildEcgNarrativeParagraph(parsedExtraction, null, form)

  const handleSave = () => {
    setSaveError('')
    setSaveSuccess(false)
    startSaving(async () => {
      const res = await saveEcgClinicalParameters({
        eventTestId,
        eventId,
        parameters: form,
      })
      if (!res.success || !res.clinicalContext) {
        setSaveError(res.error || 'No se pudieron guardar los parámetros del ECG.')
        return
      }
      setForm(res.clinicalContext)
      setSaveSuccess(true)
      onSaved(res.clinicalContext)
    })
  }

  return (
    <div className="bg-violet-50/70 border border-violet-200 rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <p className="text-sm font-bold text-violet-900">
            Parámetros para reporte SME (Electrocardiograma en Reposo)
          </p>
          <p className="text-xs text-violet-700 mt-0.5">
            {isGridEstimate
              ? 'Valores iniciales estimados sobre cuadrícula de tiras pegadas (25 mm/s). Confirma o ajusta antes de emitir el PDF.'
              : 'Confirma o ajusta las mediciones para generar el párrafo oficial del reporte SME.'}
          </p>
        </div>
        <span
          className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border shrink-0 ${
            isConfirmedByDoctor
              ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
              : isGridEstimate
                ? 'bg-amber-100 text-amber-800 border-amber-200'
                : 'bg-white text-violet-700 border-violet-200'
          }`}
        >
          {isConfirmedByDoctor
            ? '✓ Confirmado por médico'
            : isGridEstimate
              ? '⚠ Estimado en cuadrícula'
              : 'Prellenado IA'}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        <label className="block">
          <span className="text-[11px] font-semibold text-slate-600">Ritmicidad</span>
          <select
            disabled={readonly || isSaving}
            value={form.ritmicidad ?? 'rítmico'}
            onChange={(e) => {
              setSaveSuccess(false)
              setForm((prev) => ({ ...prev, ritmicidad: e.target.value || null }))
            }}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 disabled:bg-slate-100"
          >
            <option value="rítmico">Rítmico</option>
            <option value="arrítmico">Arrítmico</option>
            <option value="irregularmente irregular">Irregularmente irregular</option>
          </select>
        </label>

        <label className="block">
          <span className="text-[11px] font-semibold text-slate-600">Ritmo</span>
          <input
            type="text"
            disabled={readonly || isSaving}
            placeholder="Ej. Sinusal"
            value={form.ritmo ?? ''}
            onChange={(e) => {
              setSaveSuccess(false)
              setForm((prev) => ({ ...prev, ritmo: e.target.value || null }))
            }}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 disabled:bg-slate-100"
          />
        </label>

        <label className="block">
          <span className="text-[11px] font-semibold text-slate-600">FC (lpm)</span>
          <input
            type="number"
            min={20}
            max={300}
            disabled={readonly || isSaving}
            placeholder="70"
            value={intInputValue(form.frecuencia_bpm)}
            onChange={(e) => {
              setSaveSuccess(false)
              setForm((prev) => ({
                ...prev,
                frecuencia_bpm: parseOptionalIntInput(e.target.value),
              }))
            }}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 disabled:bg-slate-100"
          />
        </label>

        <label className="block">
          <span className="text-[11px] font-semibold text-slate-600">Onda P (mseg)</span>
          <input
            type="number"
            min={20}
            max={400}
            disabled={readonly || isSaving}
            placeholder="80"
            value={intInputValue(form.duracion_p_ms)}
            onChange={(e) => {
              setSaveSuccess(false)
              setForm((prev) => ({
                ...prev,
                duracion_p_ms: parseOptionalIntInput(e.target.value),
              }))
            }}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 disabled:bg-slate-100"
          />
        </label>

        <label className="block">
          <span className="text-[11px] font-semibold text-slate-600">Intervalo PR (mseg)</span>
          <input
            type="number"
            min={40}
            max={600}
            disabled={readonly || isSaving}
            placeholder="160"
            value={intInputValue(form.intervalo_pr_ms)}
            onChange={(e) => {
              setSaveSuccess(false)
              setForm((prev) => ({
                ...prev,
                intervalo_pr_ms: parseOptionalIntInput(e.target.value),
              }))
            }}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 disabled:bg-slate-100"
          />
        </label>

        <label className="block">
          <span className="text-[11px] font-semibold text-slate-600">QRS (mseg)</span>
          <input
            type="number"
            min={20}
            max={400}
            disabled={readonly || isSaving}
            placeholder="80"
            value={intInputValue(form.duracion_qrs_ms)}
            onChange={(e) => {
              setSaveSuccess(false)
              setForm((prev) => ({
                ...prev,
                duracion_qrs_ms: parseOptionalIntInput(e.target.value),
              }))
            }}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 disabled:bg-slate-100"
          />
        </label>

        <label className="block">
          <span className="text-[11px] font-semibold text-slate-600">Eje cardiaco</span>
          <input
            type="text"
            disabled={readonly || isSaving}
            placeholder="Normal"
            value={form.eje_electrico ?? ''}
            onChange={(e) => {
              setSaveSuccess(false)
              setForm((prev) => ({ ...prev, eje_electrico: e.target.value || null }))
            }}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 disabled:bg-slate-100"
          />
        </label>

        <label className="block">
          <span className="text-[11px] font-semibold text-slate-600">Eje (°)</span>
          <input
            type="number"
            min={-180}
            max={180}
            disabled={readonly || isSaving}
            placeholder="60"
            value={intInputValue(form.eje_grados)}
            onChange={(e) => {
              setSaveSuccess(false)
              setForm((prev) => ({
                ...prev,
                eje_grados: parseOptionalIntInput(e.target.value),
              }))
            }}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 disabled:bg-slate-100"
          />
        </label>

        <label className="block">
          <span className="text-[11px] font-semibold text-slate-600">QT corregido (mseg)</span>
          <input
            type="number"
            min={200}
            max={800}
            disabled={readonly || isSaving}
            placeholder="400"
            value={intInputValue(form.qtc_ms)}
            onChange={(e) => {
              setSaveSuccess(false)
              setForm((prev) => ({
                ...prev,
                qtc_ms: parseOptionalIntInput(e.target.value),
              }))
            }}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 disabled:bg-slate-100"
          />
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <label className="block">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[11px] font-semibold text-slate-600">Morfología Onda P</span>
            {!readonly ? (
              <button
                type="button"
                disabled={isSaving}
                onClick={() => {
                  setSaveSuccess(false)
                  setForm((prev) => ({
                    ...prev,
                    morfologia_p: 'positiva en todas las derivaciones menos en aVR',
                  }))
                }}
                className="text-[10px] font-semibold text-violet-700 hover:underline"
              >
                Usar estándar sinusal
              </button>
            ) : null}
          </div>
          <input
            type="text"
            disabled={readonly || isSaving}
            placeholder="positiva en todas las derivaciones menos en aVR"
            value={form.morfologia_p ?? ''}
            onChange={(e) => {
              setSaveSuccess(false)
              setForm((prev) => ({ ...prev, morfologia_p: e.target.value || null }))
            }}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 disabled:bg-slate-100"
          />
        </label>

        <label className="block">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[11px] font-semibold text-slate-600">Segmento ST</span>
            {!readonly ? (
              <button
                type="button"
                disabled={isSaving}
                onClick={() => {
                  setSaveSuccess(false)
                  setForm((prev) => ({
                    ...prev,
                    segmento_st: 'isoeléctrico, sin alteraciones significativas',
                  }))
                }}
                className="text-[10px] font-semibold text-violet-700 hover:underline"
              >
                Usar isoeléctrico
              </button>
            ) : null}
          </div>
          <input
            type="text"
            disabled={readonly || isSaving}
            placeholder="isoeléctrico, sin alteraciones significativas"
            value={form.segmento_st ?? ''}
            onChange={(e) => {
              setSaveSuccess(false)
              setForm((prev) => ({ ...prev, segmento_st: e.target.value || null }))
            }}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 disabled:bg-slate-100"
          />
        </label>

        <label className="block">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[11px] font-semibold text-slate-600">Onda T</span>
            {!readonly ? (
              <button
                type="button"
                disabled={isSaving}
                onClick={() => {
                  setSaveSuccess(false)
                  setForm((prev) => ({
                    ...prev,
                    onda_t: 'positiva en todas las derivaciones excepto en aVR',
                  }))
                }}
                className="text-[10px] font-semibold text-violet-700 hover:underline"
              >
                Usar normal
              </button>
            ) : null}
          </div>
          <input
            type="text"
            disabled={readonly || isSaving}
            placeholder="positiva en todas las derivaciones excepto en aVR"
            value={form.onda_t ?? ''}
            onChange={(e) => {
              setSaveSuccess(false)
              setForm((prev) => ({ ...prev, onda_t: e.target.value || null }))
            }}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 disabled:bg-slate-100"
          />
        </label>

        <label className="block">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[11px] font-semibold text-slate-600">Onda Q patológica</span>
            {!readonly ? (
              <button
                type="button"
                disabled={isSaving}
                onClick={() => {
                  setSaveSuccess(false)
                  setForm((prev) => ({
                    ...prev,
                    onda_q_patologica: 'No presencia de onda Q patológica',
                  }))
                }}
                className="text-[10px] font-semibold text-violet-700 hover:underline"
              >
                Sin Q patológica
              </button>
            ) : null}
          </div>
          <input
            type="text"
            disabled={readonly || isSaving}
            placeholder="No presencia de onda Q patológica"
            value={form.onda_q_patologica ?? ''}
            onChange={(e) => {
              setSaveSuccess(false)
              setForm((prev) => ({
                ...prev,
                onda_q_patologica: e.target.value || null,
              }))
            }}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 disabled:bg-slate-100"
          />
        </label>
      </div>

      <div className="bg-white border border-violet-200/80 rounded-lg p-2.5 space-y-1">
        <p className="text-[10px] font-bold uppercase tracking-wide text-violet-700">
          Vista previa del texto para PDF SME
        </p>
        <p className="text-xs text-slate-700 leading-relaxed">{previewText}</p>
      </div>

      {saveError ? <p className="text-xs text-red-600">{saveError}</p> : null}
      {saveSuccess ? (
        <p className="text-xs font-semibold text-emerald-700">
          ✓ Parámetros guardados. Se usarán al generar el PDF validado de Electrocardiograma.
        </p>
      ) : null}

      {!readonly ? (
        <div className="flex justify-end">
          <button
            type="button"
            disabled={isSaving}
            onClick={handleSave}
            className="rounded-lg bg-violet-700 hover:bg-violet-800 text-white px-3.5 py-1.5 text-xs font-bold transition-colors disabled:opacity-50"
          >
            {isSaving ? 'Guardando...' : '💾 Guardar parámetros para reporte PDF'}
          </button>
        </div>
      ) : null}
    </div>
  )
}
