/**
 * Elimina una sola empresa (SUPERADMIN). Reutiliza deleteCompaniesAction.
 */
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { deleteCompaniesAction } from '@/actions/company.actions'

interface Props {
  companyId: string
  companyName: string
  companyRfc: string | null
}

export default function DeleteSingleCompanyButton({
  companyId,
  companyName,
  companyRfc,
}: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleConfirm = () => {
    setError(null)
    startTransition(async () => {
      try {
        const result = await deleteCompaniesAction({
          companyIds: [companyId],
          reason: reason.trim() || undefined,
        })
        if (result.ok) {
          router.push('/companies')
          router.refresh()
          return
        }
        setError(result.error)
      } catch (err) {
        console.error('[DeleteSingleCompanyButton]', err)
        setError('Error de red o timeout. Verifica el listado de empresas.')
        router.refresh()
      }
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={isPending}
        className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-3 py-2 rounded-lg disabled:opacity-50"
      >
        Eliminar empresa
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-company-title"
        >
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6">
            <h3 id="delete-company-title" className="text-xl font-black text-slate-900 mb-2">
              Eliminar empresa
            </h3>
            <p className="text-sm text-slate-600 mb-3">
              <strong className="text-slate-900">{companyName}</strong>
              {companyRfc ? (
                <span className="ml-2 font-mono text-slate-400 text-xs">{companyRfc}</span>
              ) : null}
            </p>

            <div className="bg-red-50 border border-red-200 text-red-800 text-sm rounded-lg p-3 mb-4">
              <strong className="font-bold">Irreversible.</strong> Se borrará la empresa y se
              desvincularán trabajadores, citas y proyectos. La historia clínica se conserva.
            </div>

            <label className="block mb-4">
              <span className="text-xs font-bold text-slate-600 uppercase">
                Razón (opcional, audit)
              </span>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="mt-1 w-full bg-slate-50 ring-1 ring-slate-200 rounded-lg p-2 text-sm"
                maxLength={500}
              />
            </label>

            <label className="flex items-start gap-2 mb-4 cursor-pointer">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
              />
              <span className="text-sm text-slate-700">
                Confirmo que quiero eliminar esta empresa.
              </span>
            </label>

            {error && (
              <div className="bg-red-100 border border-red-300 text-red-800 text-sm rounded-lg p-2 mb-4">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setOpen(false)
                  setError(null)
                  setConfirmed(false)
                }}
                disabled={isPending}
                className="text-xs font-bold px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={!confirmed || isPending}
                className="text-xs font-bold px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white disabled:bg-slate-300 disabled:cursor-not-allowed"
              >
                {isPending ? 'Eliminando…' : 'Eliminar definitivamente'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
