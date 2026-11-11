/**
 * Lectura de peso, talla y TA para la papeleta de Espirometría (contexto
 * clínico visible al valorar el estudio; no sustituye al PDF).
 */
'use client'

import type { EspirometriaDisplayVitals } from '@/lib/espirometria-display-vitals'
import { hasAnyEspirometriaDisplayVital } from '@/lib/espirometria-display-vitals'

const VARIANT_CLASS: Record<'teal' | 'amber' | 'slate', { wrap: string; title: string; dt: string; dd: string }> = {
  teal: {
    wrap: 'mt-3 pt-3 border-t border-teal-200',
    title: 'text-[10px] font-semibold text-teal-800',
    dt: 'text-[10px] text-teal-600',
    dd: 'text-xs font-semibold text-teal-900',
  },
  amber: {
    wrap: 'mt-3 pt-3 border-t border-amber-200',
    title: 'text-[10px] font-semibold text-amber-800',
    dt: 'text-[10px] text-amber-600',
    dd: 'text-xs font-semibold text-amber-900',
  },
  slate: {
    wrap: 'rounded-lg border border-slate-200 bg-slate-50 p-3',
    title: 'text-[10px] font-semibold text-slate-600 tracking-wider mb-2',
    dt: 'text-[10px] text-slate-500',
    dd: 'text-xs font-semibold text-slate-800',
  },
}

function formatTa(sys?: string, dias?: string): string | null {
  const s = sys?.trim()
  const d = dias?.trim()
  if (!s && !d) return null
  return `${s || '—'}/${d || '—'} mmHg`
}

export type EspirometriaVitalsDisplayProps = {
  vitals: EspirometriaDisplayVitals
  variant?: keyof typeof VARIANT_CLASS
}

export default function EspirometriaVitalsDisplay({
  vitals,
  variant = 'teal',
}: EspirometriaVitalsDisplayProps) {
  if (!hasAnyEspirometriaDisplayVital(vitals)) {
    return null
  }
  const c = VARIANT_CLASS[variant]
  const taLine = formatTa(vitals.ta_sistolica, vitals.ta_diastolica)

  return (
    <div className={c.wrap} data-testid="espirometria-vitals-display">
      <p className={`${c.title} mb-2`}>Peso, talla y tensión arterial</p>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
        {vitals.peso_kg?.trim() ? (
          <div className="flex flex-wrap gap-x-2 gap-y-0.5 items-baseline">
            <dt className={c.dt}>Peso</dt>
            <dd className={c.dd}>{vitals.peso_kg.trim()} kg</dd>
          </div>
        ) : null}
        {vitals.talla_m?.trim() ? (
          <div className="flex flex-wrap gap-x-2 gap-y-0.5 items-baseline">
            <dt className={c.dt}>Talla</dt>
            <dd className={c.dd}>{vitals.talla_m.trim()} m</dd>
          </div>
        ) : null}
        {taLine ? (
          <div className="flex flex-wrap gap-x-2 gap-y-0.5 items-baseline sm:col-span-2">
            <dt className={c.dt}>Tensión arterial</dt>
            <dd className={c.dd}>{taLine}</dd>
          </div>
        ) : null}
      </dl>
    </div>
  )
}
