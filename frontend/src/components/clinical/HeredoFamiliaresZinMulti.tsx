'use client'

import {
  HEREDOFAMILIARES_MULTI_OPTIONS,
  heredoFamiliaresMultiIsNegados,
  parseHeredoFamiliaresMulti,
  toggleHeredoFamiliaresMulti,
} from '@/lib/heredofamiliares-zin'

type Props = {
  value: string
  onChange: (next: string) => void
  disabled?: boolean
  idPrefix: string
}

export function HeredoFamiliaresZinMulti({ value, onChange, disabled, idPrefix }: Props) {
  const negados = heredoFamiliaresMultiIsNegados(value)
  const selected = parseHeredoFamiliaresMulti(value)

  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-[10px] font-bold text-slate-600">
        <input
          type="checkbox"
          id={`${idPrefix}-negados`}
          checked={negados}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked ? 'NEGADOS' : '')}
          className="rounded border-slate-300 text-teal-600"
        />
        NEGADOS
      </label>
      {!negados && (
        <div className="flex flex-wrap gap-1.5">
          {HEREDOFAMILIARES_MULTI_OPTIONS.map((opt) => {
            const checked = selected.includes(opt)
            return (
              <label
                key={opt}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded border text-[10px] font-medium cursor-pointer ${
                  checked
                    ? 'bg-teal-50 border-teal-400 text-teal-800'
                    : 'bg-white border-slate-200 text-slate-600'
                }`}
              >
                <input
                  type="checkbox"
                  className="rounded border-slate-300 text-teal-600"
                  checked={checked}
                  disabled={disabled}
                  onChange={(e) =>
                    onChange(toggleHeredoFamiliaresMulti(value, opt, e.target.checked))
                  }
                />
                {opt}
              </label>
            )
          })}
        </div>
      )}
    </div>
  )
}
