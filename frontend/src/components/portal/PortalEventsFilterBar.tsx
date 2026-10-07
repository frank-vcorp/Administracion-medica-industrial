'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

type Props = {
  initialFrom: string
  initialTo: string
  initialQuery: string
}

export default function PortalEventsFilterBar({ initialFrom, initialTo, initialQuery }: Props) {
  const router = useRouter()
  const [from, setFrom] = useState(initialFrom)
  const [to, setTo] = useState(initialTo)
  const [q, setQ] = useState(initialQuery)

  const apply = () => {
    const params = new URLSearchParams()
    if (from.trim()) params.set('from', from.trim())
    if (to.trim()) params.set('to', to.trim())
    if (q.trim()) params.set('q', q.trim())
    const qs = params.toString()
    router.push(qs ? `/portal/events?${qs}` : '/portal/events')
  }

  const clear = () => {
    setFrom('')
    setTo('')
    setQ('')
    router.push('/portal/events')
  }

  const hasFilters = Boolean(initialFrom || initialTo || initialQuery)

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      <div className="flex flex-col gap-1 min-w-[140px]">
        <label htmlFor="portal-events-from" className="text-[10px] font-bold uppercase text-slate-500">
          Desde
        </label>
        <input
          id="portal-events-from"
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800"
        />
      </div>
      <div className="flex flex-col gap-1 min-w-[140px]">
        <label htmlFor="portal-events-to" className="text-[10px] font-bold uppercase text-slate-500">
          Hasta
        </label>
        <input
          id="portal-events-to"
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800"
        />
      </div>
      <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
        <label htmlFor="portal-events-q" className="text-[10px] font-bold uppercase text-slate-500">
          Trabajador
        </label>
        <input
          id="portal-events-q"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              apply()
            }
          }}
          placeholder="Nombre o apellido…"
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800"
        />
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={apply}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700"
        >
          Filtrar
        </button>
        {hasFilters && (
          <button
            type="button"
            onClick={clear}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50"
          >
            Limpiar
          </button>
        )}
      </div>
    </div>
  )
}
