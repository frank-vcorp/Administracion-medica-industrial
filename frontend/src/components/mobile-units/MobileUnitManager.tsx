/**
 * @file MobileUnitManager — Vista cliente para el catálogo de unidades móviles.
 * @id IMPL-20260711-01
 * @id IMPL-20260804-01-UNIFICAR-UI-UNIDADES-MOVILES: añadido props readOnly/showCreate para reutilizar en /operations/mobile-units
 * @spec context/SPECs/SPEC_ARCH-20260711-01-MODULO-UNIDADES-MOVILES.md
 *
 * Componente client. Recibe la lista inicial de unidades (server-side) y
 * muestra tabla con: thumbnail, nombre, placa, status, capacidad, próximo
 * mantenimiento, acciones (ver, editar, eliminar). Filtro por status.
 *
 * IMPL-20260804-01: soporta modo `readOnly` (oculta acciones de edición/eliminación
 * y el botón "Nueva Unidad", útil para staff no-admin en /operations/mobile-units)
 * y `showCreate` (override explícito para mostrar/ocultar el botón de alta).
 */
'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { getMobileUnits, deleteMobileUnit } from '@/actions/mobile-unit.actions'
import {
  MOBILE_UNIT_STATUS_LABEL as STATUS_LABEL,
  MOBILE_UNIT_STATUS_OPTIONS as STATUS_OPTIONS,
} from './constants'

type Unit = Awaited<ReturnType<typeof getMobileUnits>>[number]

type Props = {
  initialUnits: Unit[]
  /** IMPL-20260804-01: oculta botones de edición/borrado cuando el viewer no tiene permisos. */
  readOnly?: boolean
  /** IMPL-20260804-01: override del botón "+ Nueva Unidad". Default: !readOnly. */
  showCreate?: boolean
}

export default function MobileUnitManager({ initialUnits, readOnly = false, showCreate }: Props) {
  const router = useRouter()
  const [filter, setFilter] = useState<string>('')
  const [units, setUnits] = useState<Unit[]>(initialUnits)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const canCreate = showCreate ?? !readOnly

  const filtered = useMemo(() => {
    if (!filter) return units
    return units.filter((u) => u.status === filter)
  }, [units, filter])

  const refresh = () => {
    startTransition(async () => {
      const fresh = await getMobileUnits()
      setUnits(fresh)
      router.refresh()
    })
  }

  const onDelete = async (id: string, name: string) => {
    if (!window.confirm(`¿Eliminar la unidad "${name}"? Esta acción no se puede deshacer.`)) return
    setError(null)
    const res = await deleteMobileUnit(id)
    if (!res.success) {
      setError(res.error ?? 'Error al eliminar')
      return
    }
    setUnits((prev) => prev.filter((u) => u.id !== id))
  }

  return (
    <div className="p-6 space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Unidades Móviles</h1>
          <p className="text-sm text-slate-600">
            Catálogo de trailers/vehículos equipados como clínicas móviles.
            {units.length > 0 && ` (${units.length} en sistema)`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="border rounded-md px-3 py-1.5 text-sm"
            aria-label="Filtrar por estado"
            data-testid="status-filter"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <button
            onClick={refresh}
            disabled={isPending}
            className="px-3 py-1.5 text-sm border rounded-md bg-white hover:bg-slate-50 disabled:opacity-50"
          >
            {isPending ? 'Actualizando…' : 'Actualizar'}
          </button>
          {canCreate && (
            <Link
              href="/admin/mobile-units/new"
              className="px-3 py-1.5 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700"
              data-testid="new-unit-button"
            >
              + Nueva Unidad
            </Link>
          )}
        </div>
      </header>

      {error && (
        <div className="border border-red-300 bg-red-50 text-red-800 rounded-md px-3 py-2 text-sm" role="alert">
          {error}
        </div>
      )}

      <div className="overflow-x-auto border rounded-lg">
        <table className="min-w-full text-sm" data-testid="units-table">
          <thead className="bg-slate-50">
            <tr className="text-left text-xs uppercase text-slate-600">
              <th className="px-3 py-2">Imagen</th>
              <th className="px-3 py-2">Nombre</th>
              <th className="px-3 py-2">Placa</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2">Capacidad</th>
              <th className="px-3 py-2">Próximo mantenimiento</th>
              <th className="px-3 py-2">Proyectos</th>
              <th className="px-3 py-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-slate-500">
                  {units.length === 0
                    ? readOnly
                      ? 'No hay unidades registradas en el sistema.'
                      : 'No hay unidades registradas. Crea la primera con “Nueva Unidad”.'
                    : 'Sin unidades que coincidan con el filtro.'}
                </td>
              </tr>
            ) : (
              filtered.map((u) => {
                const meta = STATUS_LABEL[u.status] ?? { label: u.status, color: 'bg-slate-100' }
                return (
                  <tr key={u.id} className="border-t hover:bg-slate-50">
                    <td className="px-3 py-2">
                      {u.imageUrl ? (
                        <Image
                          src={u.imageUrl}
                          alt={u.name}
                          width={64}
                          height={40}
                          className="object-cover rounded border"
                          unoptimized
                        />
                      ) : (
                        <div className="w-16 h-10 bg-slate-200 rounded border flex items-center justify-center text-xs text-slate-500">
                          sin img
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 font-medium">
                      <Link href={`/admin/mobile-units/${u.id}`} className="text-blue-600 hover:underline">
                        {u.name}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-slate-700">{u.plate ?? '—'}</td>
                    <td className="px-3 py-2">
                      <span className={`text-xs px-2 py-0.5 rounded border ${meta.color}`}>{meta.label}</span>
                    </td>
                    <td className="px-3 py-2">{u.capacity ?? '—'}</td>
                    <td className="px-3 py-2">
                      {u.nextMaintenanceDate ? (
                        <span className="text-xs">
                          {new Date(u.nextMaintenanceDate).toLocaleDateString('es-MX')}
                          {u.nextMaintenanceType && <span className="ml-1 text-slate-500">({u.nextMaintenanceType})</span>}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">{u._count.projects}</td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1">
                        <Link href={`/admin/mobile-units/${u.id}`} className="text-blue-600 hover:underline text-xs">Ver</Link>
                        {!readOnly && (
                          <>
                            <Link href={`/admin/mobile-units/${u.id}/edit`} className="text-amber-600 hover:underline text-xs">Editar</Link>
                            <Link href={`/admin/mobile-units/${u.id}/maintenance`} className="text-emerald-600 hover:underline text-xs">Calendario</Link>
                            <button
                              onClick={() => onDelete(u.id, u.name)}
                              className="text-red-600 hover:underline text-xs"
                              data-testid={`delete-${u.id}`}
                            >
                              Eliminar
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
