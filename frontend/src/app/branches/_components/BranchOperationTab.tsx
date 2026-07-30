/**
 * @file BranchOperationTab — Tab Operación: horarios + capacity + toggle activo + delete guard.
 * @id IMPL-20260730-05 (PR-3) + IMPL-20260730-06 (PR-4) — ARCH-20260730-01
 * @spec context/SPECs/SPEC_ARCH-20260730-01-MODULO-SUCURSALES-COMPLETO.md §7.2, §3.2, §5.6
 *
 * Edita: openingTime, closingTime, hourlyCapacity. Toggle activo/inactivo.
 * Zona peligrosa: BranchDeleteGuardModal con conteos de dependencias
 * (appointments/events/workers/projects/allowedByCompanies/defaultForCompanies).
 *
 * Validación:
 *   - `branchUpdateSchema.safeParse` client-side (UX rápido).
 *   - `updateBranch` / `toggleBranchActive` / `deleteBranch` server-side revalidan.
 *
 * Toggle:
 *   - Si desactivar y es defaultBranch de empresas HABILITADAS, la action
 *     emite audit con warning (SPEC §5.5). El usuario recibe feedback
 *     estándar {ok:true} — el warning queda en auditoría.
 */
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  updateBranch,
  toggleBranchActive,
} from '@/actions/branch.actions'
import { branchUpdateSchema } from '@/lib/schemas/branch'
import type { BranchDetail } from './BranchDetailTabs'
import { BranchDeleteGuardModal } from './BranchDeleteGuardModal'

export function BranchOperationTab({ branch }: { branch: BranchDetail }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [successHours, setSuccessHours] = useState(false)

  const handleSubmitHours = async (formData: FormData) => {
    const raw = {
      openingTime: formData.get('openingTime') as string,
      closingTime: formData.get('closingTime') as string,
      hourlyCapacity: Number(formData.get('hourlyCapacity')),
    }
    const parsed = branchUpdateSchema.safeParse(raw)
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Datos inválidos')
      setSuccessHours(false)
      return
    }
    setError(null)
    setSuccessHours(false)
    startTransition(async () => {
      const result = await updateBranch(branch.id, parsed.data)
      if (!result.ok) {
        setError(result.error)
      } else {
        setError(null)
        setSuccessHours(true)
        router.refresh()
      }
    })
  }

  const handleToggle = () => {
    setError(null)
    startTransition(async () => {
      const result = await toggleBranchActive(branch.id, !branch.isActive)
      if (!result.ok) {
        setError(result.error)
      } else {
        setError(null)
        router.refresh()
      }
    })
  }

  return (
    <div className="space-y-8 max-w-2xl">
      {error && (
        <div role="alert" className="bg-red-50 text-red-700 p-3 rounded text-sm">
          {error}
        </div>
      )}
      {successHours && (
        <div className="bg-emerald-50 text-emerald-700 p-3 rounded text-sm">
          Horarios actualizados.
        </div>
      )}

      <form action={handleSubmitHours} className="space-y-4">
        <h3 className="font-bold text-slate-800">Horarios y Capacidad</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Apertura</label>
            <input
              type="time"
              name="openingTime"
              defaultValue={branch.openingTime}
              required
              className="w-full border border-slate-300 p-2 rounded text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Cierre</label>
            <input
              type="time"
              name="closingTime"
              defaultValue={branch.closingTime}
              required
              className="w-full border border-slate-300 p-2 rounded text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Capacidad/Hr</label>
            <input
              type="number"
              name="hourlyCapacity"
              defaultValue={branch.hourlyCapacity}
              min="1"
              max="100"
              required
              className="w-full border border-slate-300 p-2 rounded text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={pending}
          className="bg-purple-600 text-white px-4 py-2 rounded shadow hover:bg-purple-700 disabled:opacity-50 text-sm font-medium"
        >
          {pending ? 'Guardando...' : 'Actualizar Horarios'}
        </button>
      </form>

      <div className="border-t border-slate-200 pt-6">
        <h3 className="font-bold text-slate-800 mb-2">Estado de la Sucursal</h3>
        <p className="text-sm text-slate-500 mb-4">
          {branch.isActive
            ? 'La sucursal está activa y visible para asignar citas.'
            : 'La sucursal está inactiva y no acepta nuevas asignaciones.'}
        </p>
        <button
          type="button"
          onClick={handleToggle}
          disabled={pending}
          className={`px-4 py-2 rounded font-medium text-sm transition-colors ${
            branch.isActive
              ? 'bg-slate-200 text-slate-700 hover:bg-slate-300'
              : 'bg-emerald-600 text-white hover:bg-emerald-700'
          }`}
        >
          {branch.isActive ? 'Desactivar Sucursal' : 'Activar Sucursal'}
        </button>
        <p className="text-xs text-slate-400 mt-2">
          {branch.isActive
            ? 'Al desactivar, la sucursal deja de estar disponible para nuevas citas (soft-disable).'
            : 'Al activar, la sucursal vuelve a estar disponible.'}
        </p>
      </div>

      {/* IMPL-20260730-06 (PR-4): Zona peligrosa — borrado hard con guard.
          SPEC §5.6: must disable first + sin dependencias + confirmar nombre. */}
      <div className="border-t border-red-200 pt-6 bg-red-50/40 -mx-2 px-2 rounded-lg">
        <h3 className="font-bold text-red-700 mb-2">Zona Peligrosa</h3>
        <p className="text-sm text-slate-600 mb-4">
          Eliminar la sucursal es <strong>irreversible</strong>. Sólo es posible
          si está inactiva y sin dependencias (citas, eventos, trabajadores,
          proyectos, empresas permitidas o empresas que la usan como
          predeterminada).
        </p>
        <BranchDeleteGuardModal
          branch={{ id: branch.id, name: branch.name }}
          isActive={branch.isActive}
          dependencies={{
            appointments: branch._count.appointments,
            events: branch._count.events,
            workers: branch._count.workers,
            projects: branch._count.projects,
            allowedByCompanies: branch._count.allowedByCompanies,
            defaultForCompanies: branch._count.companies,
          }}
        />
      </div>
    </div>
  )
}