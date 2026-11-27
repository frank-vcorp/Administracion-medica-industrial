/**
 * @file MobileUnitManager — Vista cliente para el catálogo de unidades móviles.
 * @id IMPL-20260711-01
 * @id IMPL-20260804-01-UNIFICAR-UI-UNIDADES-MOVILES: readOnly/showCreate
 * @id IMPL-20260804-02-ALINEAR-ESTILO-MOBILE-UNITS: grid de cards (paridad SME)
 * @spec context/SPECs/SPEC_ARCH-20260711-01-MODULO-UNIDADES-MOVILES.md
 */
'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Ambulance, RefreshCw } from 'lucide-react'
import { getMobileUnits } from '@/actions/mobile-unit.actions'
import { MOBILE_UNIT_STATUS_OPTIONS } from './constants'
import { MobileUnitCard } from './MobileUnitCard'
import { MobileUnitCreateModal } from './MobileUnitCreateModal'

type Unit = Awaited<ReturnType<typeof getMobileUnits>>[number]

type Props = {
  initialUnits: Unit[]
  readOnly?: boolean
}

export default function MobileUnitManager({ initialUnits, readOnly = false }: Props) {
  const router = useRouter()
  const [filter, setFilter] = useState<string>('')
  const [showInactive, setShowInactive] = useState(true)
  const [units, setUnits] = useState<Unit[]>(initialUnits)
  const [isPending, startTransition] = useTransition()

  const filtered = useMemo(() => {
    let list = units
    if (!showInactive) {
      list = list.filter((u) => u.status !== 'BAJA_PERMANENTE' && u.status !== 'FUERA_SERVICIO')
    }
    if (filter) {
      list = list.filter((u) => u.status === filter)
    }
    return list
  }, [units, filter, showInactive])

  const refresh = () => {
    startTransition(async () => {
      const fresh = await getMobileUnits()
      setUnits(fresh)
      router.refresh()
    })
  }

  return (
    <div className="space-y-6">
      {/* Barra de filtros y acciones institucional */}
      <form
        onSubmit={(e) => e.preventDefault()}
        className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-end md:justify-between"
      >
        <div className="w-full md:w-72">
          <label
            htmlFor="status-filter"
            className="block text-xs font-semibold uppercase tracking-wide text-slate-500"
          >
            Filtrar por estado
          </label>
          <select
            id="status-filter"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:border-[#592c82] focus:bg-white focus:outline-none"
            data-testid="status-filter"
          >
            {MOBILE_UNIT_STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setShowInactive((v) => !v)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
            aria-label="Toggle mostrar inactivas"
          >
            {showInactive ? 'Ocultar inactivas' : 'Mostrar inactivas'}
          </button>
          <button
            type="button"
            onClick={refresh}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${isPending ? 'animate-spin' : ''}`} />
            {isPending ? 'Actualizando…' : 'Actualizar'}
          </button>
          {!readOnly && <MobileUnitCreateModal />}
        </div>
      </form>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-amber-300 bg-amber-50/70 py-12 text-center text-slate-700">
          <span className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700">
            <Ambulance className="h-6 w-6" />
          </span>
          <p className="font-semibold text-slate-800">No hay unidades que coincidan.</p>
          {units.length === 0 && (
            <p className="mt-1 text-xs text-slate-500">
              Verifica los permisos ADMIN o el filtro de unidades inactivas.
            </p>
          )}
        </div>
      ) : (
        <div
          className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3"
          data-testid="units-table"
        >
          {filtered.map((u) => (
            <MobileUnitCard key={u.id} unit={u} readOnly={readOnly} />
          ))}
        </div>
      )}
    </div>
  )
}
