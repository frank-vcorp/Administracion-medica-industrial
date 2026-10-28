'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { formatCie10Unified, type Cie10Entry } from '@/lib/clinical/cie-10-format'

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

const SEARCH_LIMIT = 25
const FOCUS_PREVIEW_LIMIT = 15

async function fetchCie10Results(
  query: string,
  limit: number,
): Promise<{ results: Cie10Entry[]; unauthorized: boolean }> {
  const params = new URLSearchParams({ q: query, limit: String(limit) })
  const res = await fetch(`/api/clinical/cie-10/search?${params.toString()}`, {
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  })
  if (res.status === 401) return { results: [], unauthorized: true }
  if (!res.ok) return { results: [], unauthorized: false }
  const body = (await res.json()) as { results?: Cie10Entry[] }
  return { results: body.results ?? [], unauthorized: false }
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
  const [unauthorized, setUnauthorized] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const requestSeq = useRef(0)

  useEffect(() => {
    if (value) {
      setQuery(formatCie10Unified(value))
    } else {
      setQuery('')
    }
  }, [value])

  const runSearch = useCallback(async (q: string, limit: number) => {
    const seq = ++requestSeq.current
    setLoading(true)
    setUnauthorized(false)
    try {
      const { results: rows, unauthorized: denied } = await fetchCie10Results(q, limit)
      if (seq !== requestSeq.current) return
      setResults(rows)
      setUnauthorized(denied)
    } catch {
      if (seq !== requestSeq.current) return
      setResults([])
    } finally {
      if (seq === requestSeq.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open || disabled) return
    const q = query.trim()
    const delay = q.length === 0 ? 0 : 300
    const limit = q.length === 0 ? FOCUS_PREVIEW_LIMIT : SEARCH_LIMIT
    const t = setTimeout(() => {
      void runSearch(q, limit)
    }, delay)
    return () => clearTimeout(t)
  }, [query, open, disabled, runSearch])

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const showEmptyHint =
    !loading && !unauthorized && results.length === 0 && query.trim().length > 0

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
        onFocus={() => {
          setOpen(true)
        }}
        autoComplete="off"
        aria-autocomplete="list"
      />
      {open && !disabled && (
        <ul className="absolute z-30 w-full bg-white border border-slate-200 rounded-lg mt-1 max-h-60 overflow-auto shadow-lg">
          {loading && <li className="px-3 py-2 text-xs text-slate-500">Buscando…</li>}
          {unauthorized && (
            <li className="px-3 py-2 text-xs text-amber-700">Sesión expirada o sin permiso clínico.</li>
          )}
          {showEmptyHint && (
            <li className="px-3 py-2 text-xs text-slate-500">Sin resultados en catálogo CIE-10</li>
          )}
          {results.map((item) => (
            <li
              key={item.code}
              className="px-3 py-2 text-sm cursor-pointer hover:bg-teal-50 text-slate-700"
              onMouseDown={(e) => e.preventDefault()}
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
