/**
 * @file BranchCreateModal — Modal de creación de sucursal (PR-2 de ARCH-20260730-01).
 * @id IMPL-20260730-04
 * @spec context/SPECs/SPEC_ARCH-20260730-01-MODULO-SUCURSALES-COMPLETO.md §7.1, §5.3
 *
 * Reemplaza el peer-checkbox hack de `page.tsx:20-56` por un Dialog controlado
 * con `useState` (mejora accesibilidad: foco, cierre con Esc teclado pendiente
 * de <dialog> nativo en PR-3 si se requiere; por ahora el backdrop click cierra
 * manualmente).
 *
 * Validación:
 *   - `branchCreateSchema.safeParse` ANTES de invocar la server action.
 *     (Zod server-side también valida, pero el cliente obtiene feedback
 *     inmediato sin round-trip.)
 *   - Errores se muestran en banda roja.
 *   - Éxito cierra el modal; `createBranch` ya llama `revalidatePath('/branches')`.
 *
 * Solo ADMIN_LIKE puede crear (RBAC se aplica server-side; la UI no expone el
 * modal en otros roles — pendiente de gating en PR-3 con `isAdminLike`).
 */
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createBranch } from '@/actions/branch.actions'
import { branchCreateSchema } from '@/lib/schemas/branch'

export function BranchCreateModal() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const handleSubmit = async (formData: FormData) => {
    const raw = {
      name: formData.get('name') as string,
      address: formData.get('address') as string,
      phone: (formData.get('phone') as string) || undefined,
      managerName: (formData.get('managerName') as string) || undefined,
      hourlyCapacity: Number(formData.get('hourlyCapacity')),
      openingTime: formData.get('openingTime') as string,
      closingTime: formData.get('closingTime') as string,
    }
    const parsed = branchCreateSchema.safeParse(raw)
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Datos inválidos')
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await createBranch(parsed.data)
      if (result.ok) {
        setOpen(false)
        // La action ya hace revalidatePath('/branches'), pero forzamos refresh
        // para asegurar actualización inmediata de la lista en este navegador.
        router.refresh()
      } else {
        setError(result.error)
      }
    })
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="cursor-pointer bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow flex items-center gap-2"
      >
        <span>+</span> Nueva Sucursal
      </button>
    )
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Registrar Sucursal"
      onClick={(e) => {
        // cerrar al hacer click en el backdrop, no en el contenido
        if (e.target === e.currentTarget) setOpen(false)
      }}
    >
      <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold">Registrar Sucursal</h3>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Cerrar"
            className="text-slate-400 hover:text-red-500 font-bold"
          >
            ✕
          </button>
        </div>
        <form action={handleSubmit} className="space-y-4">
          {error && (
            <div
              role="alert"
              className="bg-red-50 text-red-700 p-3 rounded text-sm"
            >
              {error}
            </div>
          )}
          <input
            name="name"
            placeholder="Nombre Sede"
            required
            className="w-full border p-2 rounded"
          />
          <input
            name="address"
            placeholder="Dirección Completa"
            required
            className="w-full border p-2 rounded"
          />
          <div className="grid grid-cols-2 gap-4">
            <input
              name="phone"
              placeholder="Teléfono"
              className="border p-2 rounded"
            />
            <input
              name="managerName"
              placeholder="Encargado"
              className="border p-2 rounded"
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="flex flex-col">
              <label className="text-xs text-slate-500 mb-1">Apertura</label>
              <input
                type="time"
                name="openingTime"
                defaultValue="07:00"
                required
                className="border p-2 rounded"
              />
            </div>
            <div className="flex flex-col">
              <label className="text-xs text-slate-500 mb-1">Cierre</label>
              <input
                type="time"
                name="closingTime"
                defaultValue="17:00"
                required
                className="border p-2 rounded"
              />
            </div>
            <div className="flex flex-col">
              <label className="text-xs text-slate-500 mb-1">Capacidad/Hr</label>
              <input
                type="number"
                name="hourlyCapacity"
                defaultValue="15"
                min="1"
                required
                className="border p-2 rounded"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-4 py-2 rounded border"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={pending}
              className="bg-purple-600 text-white px-4 py-2 rounded shadow hover:bg-purple-700 font-medium disabled:opacity-50"
            >
              {pending ? 'Guardando...' : 'Guardar Sede'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
