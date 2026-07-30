/**
 * @file Panel client de acciones sobre la Company (cambiar vendedor, toggle, revisar).
 * @id IMPL-20260623-03
 *
 * Encapsula los 3 botones interactivos para mantener la page server-side pura.
 * Consume las server actions ya existentes:
 *   - changeCompanySellerAction
 *   - toggleCompanyEnabledAction
 *   - reviewAndEnableCompanyAction
 */
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { CompanyStatus } from '@prisma/client'
import {
  changeCompanySellerAction,
  toggleCompanyEnabledAction,
  reviewAndEnableCompanyAction,
} from '@/actions/company.actions'
import { isAdminLike, isSellerLike } from '@/lib/auth/roles'

export interface SellerOption {
  id: string
  fullName: string
  email: string
}

interface Props {
  companyId: string
  estado: CompanyStatus
  currentSellerId: string | null
  sellers: SellerOption[]
  role: 'ADMIN' | 'VENDEDOR' | 'COMPANY_CLIENT' | string
}

export default function CompanyActionsPanel({
  companyId,
  estado,
  currentSellerId,
  sellers,
  role,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  // Modal cambiar vendedor
  const [sellerModalOpen, setSellerModalOpen] = useState(false)
  const [newSellerId, setNewSellerId] = useState<string>(currentSellerId ?? '')
  const [reason, setReason] = useState('')

  // Modal revisar y habilitar
  const [reviewModalOpen, setReviewModalOpen] = useState(false)
  const [reviewSellerId, setReviewSellerId] = useState<string>('')

  const canChangeSeller = isSellerLike(role)
  const canToggle = isAdminLike(role)
  const canReview = isSellerLike(role) && estado === 'PENDIENTE_REVISION'

  function handleChangeSeller() {
    setError(null)
    setInfo(null)
    const target = newSellerId === '' ? null : newSellerId
    if (target === currentSellerId) {
      setSellerModalOpen(false)
      return
    }
    startTransition(async () => {
      const res = await changeCompanySellerAction({
        companyId,
        newSellerId: target,
        reason: reason.trim() || undefined,
      })
      if (res.ok) {
        setInfo('Vendedor actualizado correctamente.')
        setSellerModalOpen(false)
        setReason('')
        router.refresh()
      } else {
        setError(res.error || 'No se pudo cambiar el vendedor.')
      }
    })
  }

  function handleToggle(enabled: boolean) {
    setError(null)
    setInfo(null)
    const msg = enabled
      ? '¿Habilitar este cliente? Quedará disponible para operaciones.'
      : '¿Deshabilitar este cliente? No podrá recibir nuevas citas.'
    if (!confirm(msg)) return
    startTransition(async () => {
      const res = await toggleCompanyEnabledAction({ companyId, enabled })
      if (res.ok) {
        setInfo(enabled ? 'Cliente habilitado.' : 'Cliente deshabilitado.')
        router.refresh()
      } else {
        setError(res.error || 'No se pudo cambiar el estado.')
      }
    })
  }

  function handleReviewAndEnable() {
    setError(null)
    setInfo(null)
    if (!reviewSellerId) {
      setError('Selecciona un vendedor para asignar.')
      return
    }
    startTransition(async () => {
      const res = await reviewAndEnableCompanyAction({
        companyId,
        sellerId: reviewSellerId,
      })
      if (res.ok) {
        setInfo('Empresa revisada y habilitada.')
        setReviewModalOpen(false)
        router.refresh()
      } else {
        setError(res.error || 'No se pudo revisar la empresa.')
      }
    })
  }

  return (
    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
      <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">
        Acciones
      </h2>

      {(error || info) && (
        <div
          className={`text-sm p-2 rounded-lg ${
            error
              ? 'bg-red-50 border border-red-200 text-red-700'
              : 'bg-emerald-50 border border-emerald-200 text-emerald-700'
          }`}
        >
          {error || info}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {canChangeSeller && (
          <button
            type="button"
            onClick={() => setSellerModalOpen(true)}
            disabled={isPending}
            className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-3 py-2 rounded-lg disabled:opacity-50"
          >
            Cambiar vendedor
          </button>
        )}

        {canToggle && (
          <button
            type="button"
            onClick={() => handleToggle(estado !== 'HABILITADO')}
            disabled={isPending}
            className={`text-xs font-bold px-3 py-2 rounded-lg text-white disabled:opacity-50 ${
              estado === 'HABILITADO'
                ? 'bg-rose-600 hover:bg-rose-700'
                : 'bg-emerald-600 hover:bg-emerald-700'
            }`}
          >
            {estado === 'HABILITADO' ? 'Deshabilitar' : 'Habilitar'}
          </button>
        )}

        {canReview && (
          <button
            type="button"
            onClick={() => {
              setReviewSellerId(currentSellerId ?? '')
              setReviewModalOpen(true)
            }}
            disabled={isPending}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3 py-2 rounded-lg disabled:opacity-50"
          >
            Revisar y Habilitar
          </button>
        )}
      </div>

      {/* Modal cambiar vendedor */}
      {sellerModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-black text-slate-800">Cambiar vendedor</h3>
            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase">
                Nuevo vendedor
              </label>
              <select
                value={newSellerId}
                onChange={(e) => setNewSellerId(e.target.value)}
                className="w-full bg-slate-50 ring-1 ring-slate-200 rounded-lg p-2 text-sm mt-1"
              >
                <option value="">— Sin vendedor —</option>
                {sellers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.fullName} ({s.email})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase">
                Motivo (opcional)
              </label>
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={200}
                className="w-full bg-slate-50 ring-1 ring-slate-200 rounded-lg p-2 text-sm mt-1"
                placeholder="Ej. Reasignación por cobertura"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSellerModalOpen(false)}
                disabled={isPending}
                className="text-xs font-bold text-slate-600 px-3 py-2 rounded-lg hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleChangeSeller}
                disabled={isPending}
                className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-3 py-2 rounded-lg disabled:opacity-50"
              >
                {isPending ? 'Guardando…' : 'Confirmar cambio'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal revisar y habilitar */}
      {reviewModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-black text-slate-800">
              Revisar y habilitar
            </h3>
            <p className="text-sm text-slate-600">
              Esta empresa se creó por auto-alta y aún está{' '}
              <strong>PENDIENTE_REVISION</strong>. Confirma el vendedor asignado y
              se habilitará para operar.
            </p>
            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase">
                Vendedor a asignar
              </label>
              <select
                value={reviewSellerId}
                onChange={(e) => setReviewSellerId(e.target.value)}
                className="w-full bg-slate-50 ring-1 ring-slate-200 rounded-lg p-2 text-sm mt-1"
              >
                <option value="">Seleccionar…</option>
                {sellers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.fullName} ({s.email})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setReviewModalOpen(false)}
                disabled={isPending}
                className="text-xs font-bold text-slate-600 px-3 py-2 rounded-lg hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleReviewAndEnable}
                disabled={isPending}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3 py-2 rounded-lg disabled:opacity-50"
              >
                {isPending ? 'Procesando…' : 'Confirmar y habilitar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
