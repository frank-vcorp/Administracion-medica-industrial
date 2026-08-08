/**
 * @file CompanySelectableTable — Tabla densa de Empresas con selección multi-fila.
 * @id IMPL-20260731-02 (Opción A vista Companies)
 * @fix  FIX-FRANK-20260731-05 — vista densa para SUPERADMIN (cards ocupaban mucho espacio vertical).
 * @fix  FIX-20260808-02 (DIAG-20260808-02) — fallback Sucursal a allowedBranches[0]
 *       cuando defaultBranchId es null (flujo auto-alta no asigna defaultBranchId).
 *
 * Reemplaza al grid anterior `CompanySelectableGrid`. Mismas props y mismo
 * callback de selección para que el padre (`CompanyBulkDeleteShell`) funcione
 * sin cambios.
 *
 * Layout:
 *   - Tabla con sticky thead, columnas: Checkbox, #, Empresa (link), RFC,
 *     Contacto, Email, Vendedor, Sucursal, Estado+Origen, Acciones.
 *   - Filas de 56-64px de alto — mucho más denso que las cards.
 *   - Truncamiento con hover-overflow si RFC/email largos.
 *   - Zebra striping sutil + hover row highlight.
 *   - Badge estado/origen inline (compactos).
 *   - Botón "Configurar" como link completo en fila.
 *
 * Selección:
 *   - Checkbox principal en thead: toggle all.
 *   - Cada fila tiene su propio checkbox.
 *   - Estado se eleva al padre via `onSelectionChange(Set, meta)` igual que antes.
 *
 * Empty state: colspan con texto contextual según filtros.
 */
'use client'

import { useCallback, useEffect } from 'react'
import Link from 'next/link'
import { CompanyStatusBadge } from '@/components/companies/CompanyStatusBadge'

export interface SelectableCompany {
  id: string
  name: string
  rfc: string | null
  contactName: string | null
  email: string | null
  defaultBranch: { id: string; name: string } | null
  /**
   * FIX-20260808-02 (DIAG-20260808-02): lista de sucursales permitidas (M2M).
   * Se usa como fallback en la columna Sucursal cuando `defaultBranch` es null
   * (típico de empresas auto-registradas cuyo defaultBranchId no se asigna).
   * Opcional para mantener compat con callers que aún no la propaguen.
   */
  allowedBranches?: Array<{ id: string; name: string }>
  estado: import('@prisma/client').CompanyStatus
  origen: import('@prisma/client').CompanyOrigin
  seller?: { fullName?: string } | null
}

interface Props {
  companies: SelectableCompany[]
  /** Si true, renderiza checkboxes y permite selección. */
  selectable: boolean
  selectedIds: Set<string>
  onSelectionChange: (
    next: Set<string>,
    meta: { selectedNames: Array<{ id: string; name: string; rfc: string }> }
  ) => void
}

export default function CompanySelectableTable({
  companies,
  selectable,
  selectedIds,
  onSelectionChange,
}: Props) {
  const toggle = useCallback(
    (id: string) => {
      const next = new Set(selectedIds)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      const selectedNames = companies
        .filter((c) => next.has(c.id))
        .map((c) => ({ id: c.id, name: c.name, rfc: c.rfc ?? '' }))
      onSelectionChange(next, { selectedNames })
    },
    [companies, onSelectionChange, selectedIds]
  )

  const toggleAll = useCallback(() => {
    if (selectedIds.size === companies.length && companies.length > 0) {
      // deselect all
      onSelectionChange(new Set(), { selectedNames: [] })
    } else {
      // select all
      const next = new Set(companies.map((c) => c.id))
      const selectedNames = companies.map((c) => ({
        id: c.id,
        name: c.name,
        rfc: c.rfc ?? '',
      }))
      onSelectionChange(next, { selectedNames })
    }
  }, [companies, onSelectionChange, selectedIds])

  // Mantener visible la selección al filtrar: si la página cambia
  // y un id seleccionado ya no existe, limpiar.
  useEffect(() => {
    const validIds = new Set(companies.map((c) => c.id))
    const stale = [...selectedIds].filter((id) => !validIds.has(id))
    if (stale.length > 0) {
      const next = new Set([...selectedIds].filter((id) => validIds.has(id)))
      const selectedNames = companies
        .filter((c) => next.has(c.id))
        .map((c) => ({ id: c.id, name: c.name, rfc: c.rfc ?? '' }))
      onSelectionChange(next, { selectedNames })
    }
  }, [companies, onSelectionChange, selectedIds])

  const allSelected = companies.length > 0 && selectedIds.size === companies.length
  const someSelected = selectedIds.size > 0 && !allSelected

  if (companies.length === 0) {
    return (
      <div className="text-center py-12 text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-300">
        No hay empresas registradas aún.
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
            <tr className="text-left text-[11px] font-bold text-slate-500 uppercase tracking-wide">
              {selectable && (
                <th className="px-3 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someSelected
                    }}
                    onChange={toggleAll}
                    aria-label="Seleccionar todas"
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                </th>
              )}
              <th className="px-3 py-3 w-8">#</th>
              <th className="px-3 py-3 min-w-[180px]">Empresa</th>
              <th className="px-3 py-3 hidden md:table-cell">RFC</th>
              <th className="px-3 py-3 hidden lg:table-cell">Contacto</th>
              <th className="px-3 py-3 hidden lg:table-cell">Email</th>
              <th className="px-3 py-3 hidden lg:table-cell">Vendedor</th>
              <th className="px-3 py-3 hidden lg:table-cell">Sucursal</th>
              <th className="px-3 py-3">Estado</th>
              <th className="px-3 py-3 text-right w-28">Acción</th>
            </tr>
          </thead>
          <tbody>
            {companies.map((c, idx) => {
              const isSelected = selectedIds.has(c.id)
              return (
                <tr
                  key={c.id}
                  className={[
                    'border-b border-slate-100 transition-colors',
                    idx % 2 === 1 ? 'bg-slate-50/40' : '',
                    isSelected ? 'bg-indigo-50/60 hover:bg-indigo-100/60' : 'hover:bg-slate-50',
                  ].join(' ')}
                >
                  {selectable && (
                    <td className="px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggle(c.id)}
                        aria-label={`Seleccionar ${c.name}`}
                        className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                    </td>
                  )}
                  <td className="px-3 py-2.5 text-slate-400 font-mono text-xs">
                    {idx + 1}
                  </td>
                  <td className="px-3 py-2.5">
                    <Link
                      href={`/companies/${c.id}`}
                      className="font-bold text-slate-800 hover:text-indigo-600 transition-colors"
                    >
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 hidden md:table-cell font-mono text-xs text-slate-600 whitespace-nowrap">
                    {c.rfc || <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-3 py-2.5 hidden lg:table-cell text-slate-700">
                    {c.contactName || <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-3 py-2.5 hidden lg:table-cell text-slate-600 text-xs max-w-[180px] truncate">
                    {c.email || <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-3 py-2.5 hidden lg:table-cell text-slate-700 text-xs">
                    {c.seller?.fullName || <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-3 py-2.5 hidden lg:table-cell text-slate-700 text-xs">
                    {c.defaultBranch?.name
                      ?? c.allowedBranches?.[0]?.name
                      ?? <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-3 py-2.5">
                    <CompanyStatusBadge estado={c.estado} origen={c.origen} size="sm" />
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <Link
                      href={`/companies/${c.id}`}
                      className="inline-block bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-3 py-1.5 rounded-md transition-colors"
                    >
                      Configurar
                    </Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 text-xs text-slate-500">
        Mostrando <strong className="text-slate-800">{companies.length}</strong>{' '}
        {companies.length === 1 ? 'empresa' : 'empresas'}
        {selectable && selectedIds.size > 0 && (
          <span className="ml-3 text-indigo-700 font-bold">
            · {selectedIds.size} seleccionada{selectedIds.size === 1 ? '' : 's'}
          </span>
        )}
      </div>
    </div>
  )
}
