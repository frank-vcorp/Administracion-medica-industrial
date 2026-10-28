'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { searchCie10ForConsulta } from '@/actions/consulta-medica.actions'
import { formatCie10Unified, type Cie10Entry } from '@/lib/clinical/cie-10-catalog'

export type Cie10Selection = {
  code: string
  description: string
}

type Props = {
  label?: string
  value: Cie10Selection | null
  onChange: (value: Cie10Selection | null) => void
  disabled?: boolean
  inputClassName?: string
  placeholder?: string
}

export function Cie10Autocomplete({
  label = 'Diagnóstico unificado CIE',
  value,
  onChange,
  disabled = false,
  inputClassName,
  placeholder = 'Buscar código o descripción CIE-10…',
}: Props) {
  const [query, setQuery] = useState(value ? formatCie10Unified(value) : '')
  const [results, setResults] = useState<Cie10Entry[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (value) {
      setQuery(formatCie10Unified(value))
    } else {
      setQuery('')
    }
  }, [value])

  const fetchAction = useCallback(async (q: string) => searchCie10ForConsulta(q), [])

  useEffect(() => {
    const t = setTimeout(async () => {
      const q = query.trim()
      if (q.length < 2 || disabled) {
        setResults([])
        return
      }
      if (value && formatCie10Unified(value) === q) {
        setResults([])
        return
      }
      setLoading(true)
      try {
        const r = await fetchAction(q)
        setResults(r)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [query, fetchAction, value, disabled])

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  return (
    <div className="relative space-y-1" ref={ref}>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
      <input
        type="text"
        className={inputClassName}
        value={query}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => {
          setQuery(e.target.value)
          onChange(null)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        autoComplete="off"
        aria-autocomplete="list"
      />
      {open && !disabled && (
        <ul className="absolute z-30 w-full bg-white border border-slate-200 rounded-lg mt-1 max-h-60 overflow-auto shadow-lg">
          {loading && <li className="px-3 py-2 text-xs text-slate-500">Buscando…</li>}
          {!loading && results.length === 0 && query.trim().length >= 2 && (
            <li className="px-3 py-2 text-xs text-slate-500">Sin resultados en catálogo CIE-10</li>
          )}
          {results.map((item) => (
            <li
              key={item.code}
              className="px-3 py-2 text-sm cursor-pointer hover:bg-teal-50 text-slate-700"
              onClick={() => {
                onChange({ code: item.code, description: item.description })
                setQuery(formatCie10Unified(item))
                setOpen(false)
              }}
            >
              <span className="font-mono text-teal-800">{formatCie10Unified(item).split(' — ')[0]}</span>
              <span className="text-slate-600"> — {item.description}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
