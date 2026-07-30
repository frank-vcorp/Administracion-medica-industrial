/**
 * @file BranchCompanyAssignment — Multi-select de empresas permitidas (tab Empresas).
 * @id IMPL-20260730-05 (PR-3 de ARCH-20260730-01)
 * @spec context/SPECs/SPEC_ARCH-20260730-01-MODULO-SUCURSALES-COMPLETO.md §7.2, §5.7
 *
 * Lista todas las empresas NO deshabilitadas (pasadas como prop desde
 * `page.tsx`) con checkbox. La asignación persiste vía
 * `updateBranchAllowedCompanies` (inversa M2M de `Company.allowedBranches`).
 *
 * Estado local de selección:
 *   - Inicializado con las empresas YA permitidas (branch.allowedByCompanies).
 *   - El usuario marca/desmarca y presiona "Guardar Asignación".
 *   - El server action hace `set` (reemplazo total) del M2M, no diff.
 */
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateBranchAllowedCompanies } from '@/actions/branch.actions'
import type { BranchDetail } from './BranchDetailTabs'

export function BranchCompanyAssignment({
  branch,
  availableCompanies,
}: {
  branch: BranchDetail
  availableCompanies: { id: string; name: string; rfc: string | null }[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [selected, setSelected] = useState<string[]>(
    branch.allowedByCompanies.map((c) => c.id),
  )

  const toggle = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
    setSuccess(false)
  }

  const handleSave = () => {
    setError(null)
    setSuccess(false)
    startTransition(async () => {
      const result = await updateBranchAllowedCompanies(branch.id, selected)
      if (!result.ok) {
        setError(result.error)
      } else {
        setError(null)
        setSuccess(true)
        router.refresh()
      }
    })
  }

  return (
    <div className="space-y-4 max-w-2xl">
      {error && (
        <div role="alert" className="bg-red-50 text-red-700 p-3 rounded text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-emerald-50 text-emerald-700 p-3 rounded text-sm">
          Asignación guardada ({selected.length} empresa(s)).
        </div>
      )}

      <p className="text-sm text-slate-500">
        {selected.length} empresa(s) permitida(s). Solo las empresas
        seleccionadas pueden asignar citas/trabajadores a esta sucursal.
      </p>

      {availableCompanies.length === 0 ? (
        <div className="border border-dashed border-slate-300 rounded p-6 text-center text-sm text-slate-400">
          No hay empresas habilitadas para asignar.
        </div>
      ) : (
        <div className="border border-slate-200 rounded divide-y divide-slate-100 max-h-96 overflow-y-auto">
          {availableCompanies.map((c) => (
            <label
              key={c.id}
              className="flex items-center gap-3 p-3 hover:bg-slate-50 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selected.includes(c.id)}
                onChange={() => toggle(c.id)}
                className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
              />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm text-slate-800 truncate">
                  {c.name}
                </div>
                <div className="text-xs text-slate-500">
                  {c.rfc ?? 'Sin RFC'}
                </div>
              </div>
            </label>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={pending}
          className="bg-purple-600 text-white px-4 py-2 rounded shadow hover:bg-purple-700 disabled:opacity-50 text-sm font-medium"
        >
          {pending ? 'Guardando...' : 'Guardar Asignación'}
        </button>
        {selected.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setSelected([])
              setSuccess(false)
            }}
            disabled={pending}
            className="px-4 py-2 rounded border border-slate-300 text-slate-600 hover:bg-slate-50 text-sm"
          >
            Limpiar selección
          </button>
        )}
      </div>
    </div>
  )
}