'use client'

import {
  CONSULTA_ANTECEDENTES_RUBROS,
  type AntecedentesConsultaResumen,
} from '@/lib/clinical/consulta-antecedentes-resumen'

export function ConsultaAntecedentesResumen({
  value,
  onChange,
  readonly = false,
}: {
  value: AntecedentesConsultaResumen
  onChange: (next: AntecedentesConsultaResumen) => void
  readonly?: boolean
}) {
  const inputClass =
    'w-full mt-1 min-h-[56px] bg-slate-50 ring-1 ring-slate-200 focus:ring-2 focus:ring-teal-400 border-none p-2.5 rounded-lg text-sm outline-none disabled:opacity-60 resize-y'

  return (
    <section className="space-y-3 bg-teal-50/60 border border-teal-200 rounded-xl p-4">
      <div>
        <h3 className="text-sm font-bold text-teal-900">
          Antecedentes personales (nota de consulta)
        </h3>
        <p className="text-xs text-teal-800 mt-1">
          Rubros solicitados para consulta médica: patológicos y no patológicos en seis apartados.
          Se incluyen en la nota PDF. Puedes precargar desde el cuestionario estructurado de abajo.
        </p>
      </div>
      <ol className="space-y-3 list-none">
        {CONSULTA_ANTECEDENTES_RUBROS.map(({ key, label, hint }, idx) => (
          <li key={key}>
            <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wide">
              {idx + 1}. {label}
            </label>
            <p className="text-[10px] text-slate-500 mb-0.5">{hint}</p>
            <textarea
              className={inputClass}
              value={value[key]}
              onChange={(e) => onChange({ ...value, [key]: e.target.value })}
              disabled={readonly}
              rows={2}
              maxLength={4000}
              placeholder="Negados o describir…"
            />
          </li>
        ))}
      </ol>
    </section>
  )
}
