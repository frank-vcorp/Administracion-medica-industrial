/**
 * @file MobileUnitDeleteButton — Botón de eliminación con guard.
 * @id IMPL-20260804-02-ALINEAR-ESTILO-MOBILE-UNITS
 * @spec context/SPECs/SPEC_ARCH-20260711-01-MODULO-UNIDADES-MOVILES.md §5.3
 *
 * Solo visible para ADMIN. Renderiza un botón rojo ghost que pide
 * confirmación antes de invocar `deleteMobileUnit`. Tras éxito, redirige
 * a /admin/mobile-units.
 *
 * RBAC: el gating se hace server-side en /admin/mobile-units/[id] pasando
 * `isAdmin` como prop. Defense-in-depth en la server action
 * `deleteMobileUnit` también valida sesión.
 */
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { deleteMobileUnit } from '@/actions/mobile-unit.actions'

type Props = {
  unitId: string
  unitName: string
}

export function MobileUnitDeleteButton({ unitId, unitName }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)

  const onDelete = () => {
    if (!window.confirm(`¿Eliminar la unidad "${unitName}"? Esta acción no se puede deshacer.`)) {
      return
    }
    setError(null)
    startTransition(async () => {
      const res = await deleteMobileUnit(unitId)
      if (!res.success) {
        setError(res.error ?? 'Error al eliminar')
        return
      }
      router.push('/admin/mobile-units')
      router.refresh()
    })
  }

  if (confirming) {
    return (
      <div className="flex flex-col items-end gap-2">
        <button
          type="button"
          onClick={onDelete}
          disabled={pending}
          data-testid={`delete-${unitId}`}
          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium shadow disabled:opacity-50"
        >
          {pending ? 'Eliminando…' : 'Confirmar eliminación'}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="text-xs text-slate-500 hover:text-slate-700 underline"
        >
          Cancelar
        </button>
        {error && (
          <p role="alert" className="text-xs text-red-600">
            {error}
          </p>
        )}
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      data-testid={`delete-trigger-${unitId}`}
      className="px-4 py-2 rounded-lg border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50"
    >
      Eliminar unidad
    </button>
  )
}