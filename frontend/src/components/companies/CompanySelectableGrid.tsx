/**
 * @file CompanySelectableGrid — grid de tarjetas con selección multi-empresa.
 * @id IMPL-20260730-01 (retry de IMPL-20260730-01 BLOCKED)
 * @spec context/SPECs/SPEC_ARCH-20260730-01-DELETE-COMPANIES-SUPERADMIN.md
 *
 * Client component. Sólo SUPERADMIN recibe checkboxes de selección. Para
 * otros roles el render es idéntico al grid anterior (sin checkboxes).
 *
 * La selección se eleva al padre vía callback `onSelectionChange(ids, names)`
 * para que `DeleteCompaniesButton` pueda consumirla desde un componente
 * hermano en la misma página.
 */
'use client'

import { useCallback } from 'react'
import Link from 'next/link'
import type { CompanyStatus, CompanyOrigin } from '@prisma/client'
import { CompanyStatusBadge } from '@/components/companies/CompanyStatusBadge'

export interface SelectableCompany {
  id: string
  name: string
  rfc: string | null
  contactName: string | null
  email: string | null
  defaultBranch: { id: string; name: string } | null
  estado: CompanyStatus
  origen: CompanyOrigin
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

export default function CompanySelectableGrid({
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

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
      {companies.length === 0 && (
        <div className="col-span-3 text-center py-12 text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-300">
          No hay empresas registradas aún.
        </div>
      )}
      {companies.map((c) => (
        <CompanyCard
          key={c.id}
          company={c}
          selectable={selectable}
          selected={selectedIds.has(c.id)}
          onToggle={() => toggle(c.id)}
        />
      ))}
    </div>
  )
}

interface CompanyCardProps {
  company: SelectableCompany
  selectable: boolean
  selected: boolean
  onToggle: () => void
}

function CompanyCard({ company, selectable, selected, onToggle }: CompanyCardProps) {
  const c = company
  return (
    <div
      className={[
        'bg-white p-6 rounded-xl shadow-sm border transition-all group relative',
        selected ? 'border-red-400 ring-2 ring-red-200' : 'border-slate-200 hover:shadow-md',
      ].join(' ')}
    >
      {selectable && (
        <label className="absolute top-3 left-3 inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            className="w-5 h-5 rounded border-slate-300 text-red-600 focus:ring-red-500"
            checked={selected}
            onChange={onToggle}
            aria-label={`Seleccionar ${c.name}`}
          />
        </label>
      )}
      <div className="flex justify-between items-start mb-4 gap-2 pl-7">
        <div className="w-12 h-12 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
          🏢
        </div>
        <CompanyStatusBadge estado={c.estado} origen={c.origen} size="sm" />
      </div>

      <h3 className="font-bold text-slate-800 text-lg mb-1">{c.name}</h3>
      <p className="text-xs font-mono text-slate-400 mb-4">{c.rfc || 'Sin RFC'}</p>

      <div className="space-y-2 border-t border-slate-50 pt-3">
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">Contacto</span>
          <span className="font-medium text-slate-700">{c.contactName || '---'}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">Email</span>
          <span className="font-medium text-slate-700">{c.email || '-'}</span>
        </div>
        {c.seller?.fullName && (
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Vendedor</span>
            <span className="font-medium text-slate-700">{c.seller.fullName}</span>
          </div>
        )}
        {c.defaultBranch?.name && (
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Sucursal</span>
            <span className="font-medium text-slate-700">{c.defaultBranch.name}</span>
          </div>
        )}
      </div>

      <div className="mt-4 pt-3">
        <Link
          href={`/companies/${c.id}`}
          className="block w-full text-center bg-slate-900 hover:bg-slate-800 text-white py-1.5 rounded text-xs font-medium transition-colors"
        >
          Configurar Empresa
        </Link>
      </div>
    </div>
  )
}