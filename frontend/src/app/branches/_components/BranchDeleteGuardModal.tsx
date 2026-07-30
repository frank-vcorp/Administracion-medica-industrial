/**
 * @file BranchDeleteGuardModal — Modal de confirmación para eliminación hard.
 * @id IMPL-20260730-06 (PR-4 de ARCH-20260730-01)
 * @spec context/SPECs/SPEC_ARCH-20260730-01-MODULO-SUCURSALES-COMPLETO.md §5.6, §7.2
 *
 * Bloquea la acción mostrando los conteos de dependencias y el motivo exacto
 * por el cual no se puede borrar (en orden §3.3 propuesta A):
 *
 *   1. Si `isActive === true` → MUST_DISABLE_FIRST (gate de orden).
 *   2. Si alguna dependencia > 0 → HAS_DEPENDENCIES (lista de counts).
 *   3. Sólo si isActive=false y totalDeps===0 → confirmación tipeando nombre.
 *
 * Tras éxito: `deleteBranch()` retorna `{ok:true}`, modal se cierra y
 * `router.push('/branches')` para volver al listado.
 *
 * Decisión interna reversible: el botón que abre el modal siempre se muestra
 * pero se deshabilita si NO se cumplen los dos gates. Esto evita el patrón
 * "modal con botón muerto" del bug original que reportó ATLAS.
 */
'use client'

import { useState, useTransition, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import {
  deleteBranch,
  type DeleteBranchDependencies,
  type DeleteBranchResult,
} from '@/actions/branch.actions'

export interface BranchDeleteGuardModalProps {
  branch: { id: string; name: string }
  isActive: boolean
  dependencies: DeleteBranchDependencies
}

/**
 * Suma de todas las dependencias. Usado para mostrar el total y para habilitar
 * el botón de confirmación.
 */
function totalDependencies(deps: DeleteBranchDependencies): number {
  return Object.values(deps).reduce((sum, n) => sum + n, 0)
}

export function BranchDeleteGuardModal({
  branch,
  isActive,
  dependencies,
}: BranchDeleteGuardModalProps): ReactNode {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [confirmName, setConfirmName] = useState('')

  const totalDeps = totalDependencies(dependencies)
  // Gate doble según SPEC §3.3 propuesta A: sólo borrable si está inactiva
  // y sin dependencias, y el usuario confirma tipeando el nombre exacto.
  const canDelete = !isActive && totalDeps === 0 && confirmName === branch.name

  const handleDelete = () => {
    setError(null)
    startTransition(async () => {
      const result: DeleteBranchResult = await deleteBranch(branch.id)
      if (result.ok) {
        setOpen(false)
        setConfirmName('')
        router.push('/branches')
        router.refresh()
        return
      }
      setError(result.error || 'Error al eliminar sucursal')
    })
  }

  const handleClose = () => {
    setOpen(false)
    setError(null)
    setConfirmName('')
  }

  // Botón disparador siempre visible (consistente con el resto de zonas
  // peligrosas); se deshabilita cuando alguno de los dos gates falla para
  // evitar confirmaciones vacías.
  const triggerDisabled = isActive || totalDeps > 0
  const triggerTitle = isActive
    ? 'Desactiva la sucursal antes de poder eliminarla'
    : totalDeps > 0
      ? 'Reasigna o elimina las dependencias antes de continuar'
      : 'Eliminar permanentemente la sucursal'

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={triggerDisabled}
        title={triggerTitle}
        data-testid="branch-delete-trigger"
        className="bg-red-600 text-white px-4 py-2 rounded font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
      >
        Eliminar Sucursal Permanentemente
      </button>
    )
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="branch-delete-modal-title"
      data-testid="branch-delete-modal"
    >
      <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-md">
        <h3
          id="branch-delete-modal-title"
          className="text-lg font-bold text-red-700 mb-4"
        >
          Eliminar Sucursal
        </h3>

        {error && (
          <div
            role="alert"
            className="bg-red-50 text-red-700 p-3 rounded text-sm mb-4 border border-red-200"
          >
            {error}
          </div>
        )}

        {isActive && (
          <div
            role="status"
            data-testid="branch-delete-must-disable"
            className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded text-sm mb-4"
          >
            <p>
              <strong>Sucursal activa.</strong> Primero desactívala en esta misma
              pestaña para poder continuar.
            </p>
          </div>
        )}

        {!isActive && totalDeps > 0 && (
          <div
            role="status"
            data-testid="branch-delete-deps"
            className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded text-sm mb-4"
          >
            <p className="font-medium mb-2">
              La sucursal tiene dependencias activas:
            </p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              {dependencies.appointments > 0 && (
                <li>{dependencies.appointments} cita(s)</li>
              )}
              {dependencies.events > 0 && (
                <li>{dependencies.events} evento(s) médico(s)</li>
              )}
              {dependencies.workers > 0 && (
                <li>{dependencies.workers} trabajador(es)</li>
              )}
              {dependencies.projects > 0 && (
                <li>{dependencies.projects} proyecto(s)</li>
              )}
              {dependencies.allowedByCompanies > 0 && (
                <li>
                  {dependencies.allowedByCompanies} empresa(s) permitida(s)
                </li>
              )}
              {dependencies.defaultForCompanies > 0 && (
                <li>
                  Es default de {dependencies.defaultForCompanies} empresa(s)
                </li>
              )}
            </ul>
            <p className="mt-2 text-xs">
              Reasigna o elimina las dependencias antes de continuar.
            </p>
          </div>
        )}

        {!isActive && totalDeps === 0 && (
          <div className="space-y-3" data-testid="branch-delete-confirm">
            <p className="text-sm text-slate-600">
              Esta acción es <strong>irreversible</strong>. Para confirmar,
              escribe el nombre de la sucursal:{' '}
              <code className="bg-slate-100 px-1 rounded font-mono text-xs">
                {branch.name}
              </code>
            </p>
            <input
              type="text"
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder="Nombre de la sucursal"
              aria-label="Confirmar nombre de la sucursal"
              data-testid="branch-delete-confirm-input"
              className="w-full border border-slate-300 p-2 rounded text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
        )}

        <div className="flex justify-end gap-2 mt-6">
          <button
            type="button"
            onClick={handleClose}
            disabled={pending}
            className="px-4 py-2 rounded border border-slate-300 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={!canDelete || pending}
            data-testid="branch-delete-confirm-button"
            className="bg-red-600 text-white px-4 py-2 rounded font-medium text-sm hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {pending ? 'Eliminando...' : 'Eliminar Definitivamente'}
          </button>
        </div>
      </div>
    </div>
  )
}
