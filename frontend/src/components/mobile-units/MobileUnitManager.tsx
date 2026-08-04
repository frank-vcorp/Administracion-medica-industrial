/**
 * @file MobileUnitManager — Vista cliente para el catálogo de unidades móviles.
 * @id IMPL-20260711-01
 * @id IMPL-20260804-01-UNIFICAR-UI-UNIDADES-MOVILES: readOnly/showCreate
 * @id IMPL-20260804-02-ALINEAR-ESTILO-MOBILE-UNITS: grid de cards (paridad /branches)
 * @spec context/SPECs/SPEC_ARCH-20260711-01-MODULO-UNIDADES-MOVILES.md
 *
 * Migrado a tokens del sistema:
 *   - Header text-2xl font-bold text-slate-800 + subtítulo text-sm text-slate-500
 *   - Botón primario MobileUnitCreateModal (slate-900)
 *   - Toggle "Mostrar todas / solo activas" (text-xs text-slate-500 underline)
 *   - Filtros en card bg-white p-4 rounded-xl border border-slate-200 shadow-sm
 *   - Lista en grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 (MobileUnitCard)
 *   - Empty state banner ámbar (paridad con branches)
 */
'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
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

  // IMPL-20260804-02: la eliminación de unidades se hace desde la página de
  // detalle /admin/mobile-units/[id] (visible solo para ADMIN), no desde la card.
  // Ver MobileUnitDeleteButton.

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Catálogo de Unidades Móviles</h2>
          <p className="text-sm text-slate-500">
            Gestión de trailers/vehículos equipados como clínicas móviles.
            {units.length > 0 && ` (${units.length} en sistema)`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowInactive((v) => !v)}
            className="text-xs text-slate-500 hover:text-slate-700 underline"
            aria-label="Toggle mostrar inactivas"
          >
            {showInactive ? 'Ocultar inactivas' : 'Mostrar inactivas'}
          </button>
          <button
            onClick={refresh}
            disabled={isPending}
            className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white hover:bg-slate-50 disabled:opacity-50"
          >
            {isPending ? 'Actualizando…' : 'Actualizar'}
          </button>
          {!readOnly && <MobileUnitCreateModal />}
        </div>
      </header>

      {/* Filtros en card (paridad con /companies) */}
      <form
        onSubmit={(e) => e.preventDefault()}
        className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-3"
      >
        <div>
          <label htmlFor="status-filter" className="text-[11px] font-bold text-slate-500 uppercase">
            Estado
          </label>
          <select
            id="status-filter"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full bg-slate-50 ring-1 ring-slate-200 rounded-lg p-2 text-sm mt-1"
            data-testid="status-filter"
          >
            {MOBILE_UNIT_STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </form>

      {filtered.length === 0 ? (
        <div className="col-span-full text-center py-12 text-slate-600 bg-amber-50 rounded-xl border border-amber-300">
          <p className="font-medium mb-2">No hay unidades que coincidan.</p>
          {units.length === 0 && (
            <p className="text-xs">
              Si esperas ver unidades, verifica que:
              <br />
              (a) tu sesión tenga permisos ADMIN,
              <br />
              (b) las unidades no estén filtradas como "inactivas".
            </p>
          )}
        </div>
      ) : (
        <div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
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