'use client'

import {
  HEREDOFAMILIARES_MULTI_OPTIONS,
  parseHeredoFamiliaresSelection,
  serializeHeredoFamiliaresSelection,
  toggleHeredoFamiliaresOption,
} from '@/lib/heredo-familiares-multiselect'

type Props = {
  value: string
  onChange: (next: string) => void
  disabled?: boolean
  /** Clases del contenedor de cada checkbox */
  itemClassName?: string
}

/** F-23: varios parentescos por enfermedad (PADRE + HERMANOS, etc.). */
export function HeredofamiliaresRelacionMultiSelect({
  value,
  onChange,
  disabled = false,
  itemClassName = 'flex items-center gap-1.5 text-xs text-slate-700',
}: Props) {
  const selected = parseHeredoFamiliaresSelection(value)

  const toggle = (option: string) => {
    onChange(serializeHeredoFamiliaresSelection(toggleHeredoFamiliaresOption(selected, option)))
  }

  return (
    <div className="space-y-2">
      <label className={itemClassName}>
        <input
          type="checkbox"
          checked={selected.includes('NEGADOS')}
          disabled={disabled}
          onChange={() => toggle('NEGADOS')}
          className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
        />
        <span className="font-semibold">NEGADOS</span>
      </label>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 pl-1">
        {HEREDOFAMILIARES_MULTI_OPTIONS.map((option) => (
          <label key={option} className={itemClassName}>
            <input
              type="checkbox"
              checked={selected.includes(option)}
              disabled={disabled || selected.includes('NEGADOS')}
              onChange={() => toggle(option)}
              className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
            />
            <span>{option}</span>
          </label>
        ))}
      </div>
      <p className="text-[10px] text-slate-500">Puede marcar más de un familiar.</p>
    </div>
  )
}
