'use client'

import { FACTORES_RIESGO_LABORAL_REFERENCIA } from '@/lib/antecedentes-fields'

/**
 * Referencia de factores de riesgo (NOM / medicina industrial) junto a la
 * captura de historia laboral. No sustituye el campo "Especifique" del trabajador.
 */
export default function HistoriaLaboralFactoresRiesgoReferencia({
  compact = false,
}: {
  compact?: boolean
}) {
  const boxClass = compact
    ? 'text-[10px] text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-2 py-2 space-y-1'
    : 'text-xs text-gray-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 space-y-1.5'

  return (
    <div className={boxClass} data-testid="historia-laboral-factores-riesgo-ref">
      <p className={`font-bold text-slate-700 ${compact ? 'text-[10px]' : 'text-xs'}`}>
        Factores de riesgo (referencia)
      </p>
      <ul className={`list-disc list-inside ${compact ? 'space-y-0.5' : 'space-y-1'} text-slate-600`}>
        {FACTORES_RIESGO_LABORAL_REFERENCIA.map((row) => (
          <li key={row.categoria}>
            <span className="font-semibold text-slate-700">{row.categoria}:</span>{' '}
            {row.ejemplos}.
          </li>
        ))}
      </ul>
    </div>
  )
}
