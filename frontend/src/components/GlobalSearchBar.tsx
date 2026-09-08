'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  globalSearchAction,
  type GlobalSearchResult,
} from '@/actions/global-search.actions'

const TYPE_LABELS: Record<GlobalSearchResult['type'], string> = {
  patient: 'Pacientes',
  expediente: 'Expedientes',
  company: 'Empresas',
}

const TYPE_ICONS: Record<GlobalSearchResult['type'], string> = {
  patient: '👤',
  expediente: '📋',
  company: '🏢',
}

const SEARCH_HINTS = [
  'Nombre o apellido del paciente',
  'ID universal o CURP',
  'Folio de expediente (8+ caracteres)',
  'Nombre o RFC de empresa (admin)',
]

const RECENT_KEY = 'ami-global-search-recent'
const MAX_RECENT = 5

function groupResults(results: GlobalSearchResult[]) {
  const order: GlobalSearchResult['type'][] = ['patient', 'expediente', 'company']
  return order
    .map((type) => ({
      type,
      label: TYPE_LABELS[type],
      items: results.filter((r) => r.type === type),
    }))
    .filter((g) => g.items.length > 0)
}

function flattenResults(groups: ReturnType<typeof groupResults>) {
  return groups.flatMap((g) => g.items)
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function highlightMatch(text: string, query: string) {
  const trimmed = query.trim()
  if (!trimmed || !text) return text

  const terms = trimmed.split(/\s+/).filter(Boolean)
  const pattern = terms.map(escapeRegExp).join('|')
  if (!pattern) return text

  const parts = text.split(new RegExp(`(${pattern})`, 'gi'))

  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <mark key={i} className="rounded bg-teal-100 px-0.5 font-medium text-teal-900">
        {part}
      </mark>
    ) : (
      part
    ),
  )
}

function readRecent(): GlobalSearchResult[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(RECENT_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as GlobalSearchResult[]
    return Array.isArray(parsed) ? parsed.slice(0, MAX_RECENT) : []
  } catch {
    return []
  }
}

function saveRecent(item: GlobalSearchResult) {
  const prev = readRecent().filter((r) => r.id !== item.id)
  const next = [item, ...prev].slice(0, MAX_RECENT)
  window.localStorage.setItem(RECENT_KEY, JSON.stringify(next))
}

export function GlobalSearchBar({ className = '' }: { className?: string }) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<GlobalSearchResult[]>([])
  const [recent, setRecent] = useState<GlobalSearchResult[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeIndex, setActiveIndex] = useState(-1)
  const rootRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const trimmedQuery = query.trim()
  const isSearching = trimmedQuery.length >= 2

  const runSearch = useCallback(async (q: string) => {
    const trimmed = q.trim()
    if (trimmed.length < 2) {
      setResults([])
      setError(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    const res = await globalSearchAction(trimmed)
    setLoading(false)
    if (!res.success) {
      setResults([])
      setError(res.error ?? 'Error de búsqueda')
      return
    }
    setResults(res.results)
  }, [])

  useEffect(() => {
    setRecent(readRecent())
  }, [])

  useEffect(() => {
    if (!open) return
    const timer = window.setTimeout(() => {
      void runSearch(query)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [query, open, runSearch])

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false)
        setActiveIndex(-1)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  const groups = useMemo(() => groupResults(results), [results])
  const flatResults = useMemo(() => flattenResults(groups), [groups])
  const indexedGroups = useMemo(() => {
    let index = 0
    return groups.map((group) => ({
      ...group,
      items: group.items.map((item) => ({
        item,
        index: index++,
      })),
    }))
  }, [groups])

  useEffect(() => {
    setActiveIndex(flatResults.length > 0 ? 0 : -1)
  }, [flatResults])

  useEffect(() => {
    if (activeIndex < 0 || !listRef.current) return
    const el = listRef.current.querySelector<HTMLElement>(
      `[data-search-index="${activeIndex}"]`,
    )
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  const navigateTo = useCallback(
    (item: GlobalSearchResult) => {
      saveRecent(item)
      setRecent(readRecent())
      setOpen(false)
      setQuery('')
      setActiveIndex(-1)
      router.push(item.href)
    },
    [router],
  )

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) return

    if (e.key === 'Escape') {
      setOpen(false)
      setActiveIndex(-1)
      return
    }

    if (!isSearching || flatResults.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => (i + 1) % flatResults.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => (i <= 0 ? flatResults.length - 1 : i - 1))
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault()
      const item = flatResults[activeIndex]
      if (item) navigateTo(item)
    }
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <label className="sr-only" htmlFor="global-search-input">
        Búsqueda general del sistema
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
          🔍
        </span>
        <input
          id="global-search-input"
          type="search"
          role="combobox"
          aria-expanded={open}
          aria-controls="global-search-listbox"
          aria-autocomplete="list"
          aria-activedescendant={
            activeIndex >= 0 ? `global-search-option-${activeIndex}` : undefined
          }
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Buscar paciente, folio, empresa, ID…"
          autoComplete="off"
          className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-teal-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/30"
        />
      </div>

      {open && (
        <div
          id="global-search-listbox"
          ref={listRef}
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-2 max-h-[min(24rem,70vh)] overflow-y-auto rounded-xl border border-slate-200 bg-white py-2 shadow-lg"
        >
          {!isSearching && (
            <div className="px-4 py-2">
              <p className="text-xs font-medium text-slate-600">
                Escribe al menos 2 caracteres para buscar
              </p>
              <p className="mt-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                Puedes buscar por
              </p>
              <ul className="mt-1 space-y-1">
                {SEARCH_HINTS.map((hint) => (
                  <li key={hint} className="text-xs text-slate-500">
                    · {hint}
                  </li>
                ))}
              </ul>
              {recent.length > 0 && (
                <>
                  <p className="mt-3 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                    Recientes
                  </p>
                  <ul className="mt-1">
                    {recent.map((item) => (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => navigateTo(item)}
                          className="flex w-full items-start gap-2 rounded-lg px-1 py-1.5 text-left hover:bg-teal-50"
                        >
                          <span className="mt-0.5 text-base leading-none">
                            {TYPE_ICONS[item.type]}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium text-slate-800">
                              {item.title}
                            </span>
                            {item.subtitle && (
                              <span className="block truncate text-xs text-slate-500">
                                {item.subtitle}
                              </span>
                            )}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}

          {isSearching && loading && (
            <p className="px-4 py-3 text-sm text-slate-500">Buscando…</p>
          )}

          {isSearching && !loading && error && (
            <p className="px-4 py-3 text-sm text-red-600">{error}</p>
          )}

          {isSearching && !loading && !error && groups.length === 0 && (
            <p className="px-4 py-3 text-sm text-slate-500">
              Sin resultados para &ldquo;{trimmedQuery}&rdquo;
            </p>
          )}

          {isSearching &&
            !loading &&
            !error &&
            indexedGroups.map((group) => (
              <div key={group.type} className="px-2 py-1">
                <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                  {group.label}
                </p>
                <ul>
                  {group.items.map(({ item, index: idx }) => {
                    const isActive = idx === activeIndex
                    return (
                      <li key={item.id}>
                        <Link
                          id={`global-search-option-${idx}`}
                          data-search-index={idx}
                          href={item.href}
                          role="option"
                          aria-selected={isActive}
                          onClick={(e) => {
                            e.preventDefault()
                            navigateTo(item)
                          }}
                          className={`flex items-start gap-2 rounded-lg px-2 py-2 ${
                            isActive ? 'bg-teal-100' : 'hover:bg-teal-50'
                          }`}
                        >
                          <span className="mt-0.5 text-base leading-none">
                            {TYPE_ICONS[item.type]}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium text-slate-800">
                              {highlightMatch(item.title, trimmedQuery)}
                            </span>
                            {item.subtitle && (
                              <span className="block truncate text-xs text-slate-500">
                                {highlightMatch(item.subtitle, trimmedQuery)}
                              </span>
                            )}
                          </span>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}

          {isSearching && !loading && flatResults.length > 0 && (
            <p className="border-t border-slate-100 px-4 py-2 text-[10px] text-slate-400">
              ↑↓ navegar · Enter abrir · Esc cerrar
            </p>
          )}
        </div>
      )}
    </div>
  )
}
