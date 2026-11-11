'use client'

import { useMemo } from 'react'
import { VitalSignsPrediagnosisPanel } from '@/components/clinical/VitalSignsPrediagnosisPanel'
import { StudyCaptureFieldLabel } from '@/components/clinical/studies/StudyCaptureUi'
import {
  computeBmi,
  complexionFromImc,
  formatTallaMetersForDisplay,
  formatTallaMetersWhileTyping,
} from '@/lib/clinical/talla-meters'

export type SomaSignosVitalesValue = {
  peso_kg: string
  talla_m: string
  imc?: string
  complexion?: string
  ta_sistolica: string
  ta_diastolica: string
  fc_min: string
  fr_min: string
  temperatura: string
  spo2: string
}

type Spo2Field = 'spo2_pct' | 'saturacion_oxigeno'

export type ClinicalSomaSignosVitalesCaptureProps = {
  value: SomaSignosVitalesValue
  onChange: (next: SomaSignosVitalesValue) => void
  readonly?: boolean
  spo2Field?: Spo2Field
  sexoForPrediagnosis?: string
  inputClass?: string
}

const defaultInputClass =
  'w-full mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 disabled:opacity-60'

/**
 * Bloque compartido somatometría + signos vitales (examen médico / certificado).
 */
export function ClinicalSomaSignosVitalesCapture({
  value,
  onChange,
  readonly = false,
  spo2Field = 'spo2_pct',
  sexoForPrediagnosis,
  inputClass = defaultInputClass,
}: ClinicalSomaSignosVitalesCaptureProps) {
  const { imc, imcValue } = useMemo(
    () => computeBmi(value.peso_kg, value.talla_m),
    [value.peso_kg, value.talla_m],
  )
  const complexion = useMemo(() => complexionFromImc(imcValue), [imcValue])

  const patch = (partial: Partial<SomaSignosVitalesValue>) => {
    onChange({ ...value, ...partial })
  }

  const vitalsForPanel = {
    ta_sistolica: value.ta_sistolica,
    ta_diastolica: value.ta_diastolica,
    fc_min: value.fc_min,
    fr_min: value.fr_min,
    temperatura: value.temperatura,
    saturacion_oxigeno: value.spo2,
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <StudyCaptureFieldLabel>Peso (kg)</StudyCaptureFieldLabel>
          <input
            type="number"
            step="0.1"
            min={0}
            className={inputClass}
            value={value.peso_kg}
            onChange={(e) => patch({ peso_kg: e.target.value })}
            disabled={readonly}
          />
        </div>
        <div>
          <StudyCaptureFieldLabel>Talla (m)</StudyCaptureFieldLabel>
          <input
            type="text"
            inputMode="decimal"
            className={inputClass}
            value={value.talla_m}
            onChange={(e) => {
              const v = e.target.value
              const next =
                v.includes('.') || v.includes(',')
                  ? v.replace(',', '.')
                  : formatTallaMetersWhileTyping(v)
              patch({ talla_m: next })
            }}
            onBlur={(e) => {
              const formatted = formatTallaMetersForDisplay(e.target.value)
              if (formatted !== e.target.value.trim()) {
                patch({ talla_m: formatted })
              }
            }}
            disabled={readonly}
          />
        </div>
        <div className="col-span-2 bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500">IMC calculado</p>
            <div className="text-2xl font-black text-slate-700">{imc || '—'}</div>
          </div>
          <div
            className={`px-3 py-1.5 rounded-lg font-bold text-xs ${
              complexion === 'NORMAL'
                ? 'bg-green-100 text-green-700'
                : complexion === 'SOBREPESO'
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-red-100 text-red-700'
            }`}
          >
            {complexion || '—'}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="col-span-2">
          <StudyCaptureFieldLabel>Tensión arterial (sist / diast)</StudyCaptureFieldLabel>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              max={300}
              className={`${inputClass} font-mono text-center`}
              value={value.ta_sistolica}
              onChange={(e) => patch({ ta_sistolica: e.target.value })}
              disabled={readonly}
              placeholder="120"
            />
            <span className="text-slate-400 font-bold">/</span>
            <input
              type="number"
              min={0}
              max={200}
              className={`${inputClass} font-mono text-center`}
              value={value.ta_diastolica}
              onChange={(e) => patch({ ta_diastolica: e.target.value })}
              disabled={readonly}
              placeholder="80"
            />
          </div>
        </div>
        {(
          [
            ['fc_min', 'FC (lpm)', 'BPM'],
            ['temperatura', 'Temperatura (°C)', '°C'],
            ['fr_min', 'FR (rpm)', 'RPM'],
          ] as const
        ).map(([key, label, ph]) => (
          <div key={key}>
            <label className="text-[10px] font-semibold text-slate-500">{label}</label>
            <input
              type="number"
              step={key === 'temperatura' ? '0.1' : 1}
              className={`${inputClass} font-mono text-center`}
              value={value[key]}
              onChange={(e) => patch({ [key]: e.target.value })}
              disabled={readonly}
              placeholder={ph}
            />
          </div>
        ))}
        <div>
          <label className="text-[10px] font-semibold text-slate-500">
            SpO₂ (%){spo2Field === 'saturacion_oxigeno' ? '' : ''}
          </label>
          <input
            type="number"
            min={0}
            max={100}
            className={`${inputClass} font-mono text-center`}
            value={value.spo2}
            onChange={(e) => patch({ spo2: e.target.value })}
            disabled={readonly}
            placeholder="%"
          />
        </div>
      </div>

      <VitalSignsPrediagnosisPanel vitals={vitalsForPanel} sexo={sexoForPrediagnosis} />
    </div>
  )
}
