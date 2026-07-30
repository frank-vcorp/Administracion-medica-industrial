/**
 * @file BranchEditForm — Form de edición de datos básicos (tab General).
 * @id IMPL-20260730-05 (PR-3 de ARCH-20260730-01)
 * @spec context/SPECs/SPEC_ARCH-20260730-01-MODULO-SUCURSALES-COMPLETO.md §7.2, §3.2
 *
 * Edita: name, address, phone, managerName. NO edita horarios ni capacity
 * (eso lo hace BranchOperationTab).
 *
 * Validación:
 *   - `branchUpdateSchema.safeParse` client-side (UX rápido).
 *   - `updateBranch` server-side vuelve a validar con el mismo schema (defense
 *     in depth).
 *
 * Éxito: `router.refresh()` para recargar datos del server (Next 16 Server
 * Components).
 */
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateBranch } from '@/actions/branch.actions'
import { branchUpdateSchema } from '@/lib/schemas/branch'
import type { BranchDetail } from './BranchDetailTabs'

export function BranchEditForm({ branch }: { branch: BranchDetail }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (formData: FormData) => {
    const raw = {
      name: formData.get('name') as string,
      address: (formData.get('address') as string) ?? '',
      phone: (formData.get('phone') as string) || undefined,
      managerName: (formData.get('managerName') as string) || undefined,
    }
    const parsed = branchUpdateSchema.safeParse(raw)
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Datos inválidos')
      setSuccess(false)
      return
    }
    setError(null)
    setSuccess(false)
    startTransition(async () => {
      const result = await updateBranch(branch.id, parsed.data)
      if (result.ok) {
        setSuccess(true)
        router.refresh()
      } else {
        setError(result.error)
      }
    })
  }

  return (
    <form action={handleSubmit} className="space-y-4 max-w-2xl">
      {error && (
        <div role="alert" className="bg-red-50 text-red-700 p-3 rounded text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-emerald-50 text-emerald-700 p-3 rounded text-sm">
          Cambios guardados correctamente.
        </div>
      )}

      <div>
        <label className="text-xs text-slate-500 mb-1 block">Nombre</label>
        <input
          name="name"
          defaultValue={branch.name}
          required
          className="w-full border border-slate-300 p-2 rounded text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
      </div>

      <div>
        <label className="text-xs text-slate-500 mb-1 block">Dirección</label>
        <input
          name="address"
          defaultValue={branch.address ?? ''}
          required
          className="w-full border border-slate-300 p-2 rounded text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-slate-500 mb-1 block">Teléfono</label>
          <input
            name="phone"
            defaultValue={branch.phone ?? ''}
            className="w-full border border-slate-300 p-2 rounded text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>
        <div>
          <label className="text-xs text-slate-500 mb-1 block">Encargado</label>
          <input
            name="managerName"
            defaultValue={branch.managerName ?? ''}
            className="w-full border border-slate-300 p-2 rounded text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="bg-purple-600 text-white px-4 py-2 rounded shadow hover:bg-purple-700 disabled:opacity-50 text-sm font-medium"
      >
        {pending ? 'Guardando...' : 'Guardar Cambios'}
      </button>
    </form>
  )
}