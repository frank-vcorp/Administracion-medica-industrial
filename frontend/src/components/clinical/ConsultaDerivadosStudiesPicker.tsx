'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  addConsultaDerivadosStudies,
  getConsultaDerivadosCatalog,
  type ConsultaDerivadosCatalogItem,
} from '@/actions/consulta-derivados.actions'

export default function ConsultaDerivadosStudiesPicker({
  eventId,
  consultaEventTestId,
  readonly = false,
}: {
  eventId: string
  consultaEventTestId: string
  readonly?: boolean
}) {
  const router = useRouter()
  const [catalog, setCatalog] = useState<ConsultaDerivadosCatalogItem[]>([])
  const [loadError, setLoadError] = useState('')
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [actionError, setActionError] = useState('')
  const [actionMsg, setActionMsg] = useState('')
  const [isPending, startTransition] = useTransition()

  const loadCatalog = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    const res = await getConsultaDerivadosCatalog(eventId)
    setLoading(false)
    if (!res.success || !res.tests) {
      setLoadError(res.error ?? 'No se pudo cargar el catálogo.')
      setCatalog([])
      return
    }
    setCatalog(res.tests)
  }, [eventId])

  useEffect(() => {
    void loadCatalog()
  }, [loadCatalog])

  const byCategory = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filtered = q
      ? catalog.filter(
          (t) =>
            t.name.toLowerCase().includes(q) ||
            t.code.toLowerCase().includes(q) ||
            t.categoryName.toLowerCase().includes(q),
        )
      : catalog
    return filtered.reduce<Record<string, ConsultaDerivadosCatalogItem[]>>((acc, test) => {
      const cat = test.categoryName
      if (!acc[cat]) acc[cat] = []
      acc[cat].push(test)
      return acc
    }, {})
  }, [catalog, search])

  const toggle = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  const handleAdd = () => {
    setActionError('')
    setActionMsg('')
    if (selectedIds.length === 0) {
      setActionError('Selecciona al menos una prueba del catálogo.')
      return
    }
    startTransition(async () => {
      const res = await addConsultaDerivadosStudies({
        eventId,
        consultaEventTestId,
        medicalTestIds: selectedIds,
      })
      if (!res.success) {
        setActionError(res.error ?? 'No se pudo agregar.')
        return
      }
      setSelectedIds([])
      setActionMsg(
        res.added === 1
          ? '1 estudio agregado a la papeleta.'
          : `${res.added ?? 0} estudios agregados a la papeleta.`,
      )
      await loadCatalog()
      router.refresh()
    })
  }

  const inputClass =
    'w-full bg-slate-50 ring-1 ring-slate-200 focus:ring-2 focus:ring-teal-400 border-none p-2.5 rounded-lg text-sm outline-none disabled:opacity-60'

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-600">
        Elige pruebas del catálogo de Servicios que aún no están en esta papeleta. Se crearán como
        estudios normales del evento (toma, resultado, dictamen y cobro por catálogo).
      </p>

      <input
        className={inputClass}
        type="search"
        placeholder="Buscar por nombre, código o categoría…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        disabled={readonly || loading}
      />

      {loading && <p className="text-xs text-slate-500">Cargando catálogo…</p>}
      {loadError && <p className="text-xs text-red-600">{loadError}</p>}

      {!loading && !loadError && catalog.length === 0 && (
        <p className="text-xs text-slate-500 rounded-lg bg-slate-50 border border-slate-100 p-3">
          No hay pruebas pendientes por agregar: todas las del catálogo ya están en la papeleta o no
          aplican.
        </p>
      )}

      <div className="max-h-[min(420px,50vh)] overflow-y-auto space-y-4 pr-1">
        {Object.entries(byCategory).map(([category, tests]) => (
          <div key={category}>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              {category}
            </p>
            <ul className="space-y-1">
              {tests.map((test) => (
                <li key={test.id}>
                  <label
                    className={`flex items-start gap-2 rounded-lg border p-2.5 cursor-pointer transition-colors ${
                      selectedIds.includes(test.id)
                        ? 'border-teal-300 bg-teal-50'
                        : 'border-slate-100 bg-white hover:border-slate-200'
                    } ${readonly ? 'opacity-60 cursor-not-allowed' : ''}`}
                  >
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={selectedIds.includes(test.id)}
                      onChange={() => !readonly && toggle(test.id)}
                      disabled={readonly || isPending}
                    />
                    <span className="text-sm text-slate-800">
                      <span className="font-semibold">{test.name}</span>
                      <span className="text-slate-400 text-xs ml-2">{test.code}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {!readonly && catalog.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100">
          <button
            type="button"
            disabled={isPending || selectedIds.length === 0}
            onClick={handleAdd}
            className="bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-colors"
          >
            {isPending ? 'Agregando…' : 'Agregar a la papeleta'}
          </button>
          {selectedIds.length > 0 && (
            <span className="text-xs text-slate-500">{selectedIds.length} seleccionada(s)</span>
          )}
        </div>
      )}

      {actionMsg && <p className="text-xs text-teal-700 font-medium">{actionMsg}</p>}
      {actionError && <p className="text-xs text-red-600">{actionError}</p>}
    </div>
  )
}
