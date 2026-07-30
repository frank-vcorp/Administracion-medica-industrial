/**
 * @file DeleteWorkersButton — barra inferior fija + modal de confirmación.
 * @id IMPL-20260730-07
 * @spec context/SPECs/SPEC_FIX-20260730-06-DELETE-WORKERS-SUPERADMIN.md
 *
 * Client component. Sólo se renderiza cuando hay al menos 1 paciente
 * seleccionado. La barra aparece fija al fondo de la página. Al pulsar
 * "Eliminar" abre un modal controlado con:
 *   - Lista de pacientes a eliminar (scrollable si > 5)
 *   - Advertencia roja de IRREVERSIBILIDAD (hard delete total)
 *   - Input opcional de razón
 *   - Checkbox obligatorio de aceptación que desbloquea el botón rojo
 *
 * Llama a `deleteWorkersAction` (server action) y refresca la página al
 * terminar vía router.refresh() para garantizar revalidate. Si la action
 * lanza (timeout / error de red), también se hace router.refresh() porque
 * los chunks previos pueden haberse commitido (FIX-20260730-05-H3 aplicado).
 */
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { deleteWorkersAction } from '@/actions/worker.actions'

interface Props {
  selectedNames: Array<{ id: string; fullName: string; universalId: string }>
  onClearSelection: () => void
}

export default function DeleteWorkersButton({ selectedNames, onClearSelection }: Props) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  if (selectedNames.length === 0) return null

  const handleConfirm = () => {
    setError(null)
    startTransition(async () => {
      try {
        const result = await deleteWorkersAction({
          workerIds: selectedNames.map((s) => s.id),
          reason: reason.trim() || undefined,
        })
        if (result.ok) {
          setOpen(false)
          setReason('')
          setConfirmed(false)
          onClearSelection()
          router.refresh()
        } else {
          setError(`${result.code}: ${result.error}`)
        }
      } catch (err) {
        // FIX-20260730-05-H3: timeout o error de red. Los chunks previos pueden
        // haberse commitido (semántica per-chunk). Refrescamos la lista para
        // que el usuario vea el estado real y re-intente con los restantes.
        console.error('[DeleteWorkersButton] delete failed:', err)
        router.refresh()
        setOpen(false)
        onClearSelection()
        setError(
          'La operación pudo haber eliminado algunos pacientes. ' +
          'La página se actualizó. Verifique la lista y re-intente con los restantes.'
        )
      }
    })
  }

  return (
    <>
      {/* Barra inferior fija */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900 text-white shadow-lg border-t border-slate-700">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <span className="font-bold text-sm">
            {selectedNames.length}{' '}
            {selectedNames.length === 1 ? 'paciente seleccionado' : 'pacientes seleccionados'}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClearSelection}
              className="text-xs font-bold px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="text-xs font-bold px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white flex items-center gap-1"
            >
              <span aria-hidden="true">🗑</span> Eliminar
            </button>
          </div>
        </div>
      </div>

      {/* Modal de confirmación */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-workers-modal-title"
        >
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3
              id="delete-workers-modal-title"
              className="text-xl font-black text-slate-900 mb-2"
            >
              Eliminar {selectedNames.length}{' '}
              {selectedNames.length === 1 ? 'paciente' : 'pacientes'}
            </h3>
            <p className="text-sm text-slate-500 mb-4">
              Revisa la lista y confirma que entiendes que esta acción no se puede deshacer.
            </p>

            <div className="bg-slate-50 rounded-lg border border-slate-200 p-3 max-h-48 overflow-y-auto mb-4">
              <ul className="text-sm space-y-1">
                {selectedNames.map((s) => (
                  <li key={s.id} className="flex justify-between gap-2">
                    <span className="font-medium text-slate-800 truncate">{s.fullName}</span>
                    <span className="font-mono text-slate-400 text-xs">{s.universalId}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-red-50 border border-red-200 text-red-800 text-sm rounded-lg p-3 mb-4">
              <strong className="font-bold">⚠️ Atención — IRREVERSIBLE:</strong> Se
              eliminarán los pacientes y TODO su historial clínico: appointments,
              medical events, lab orders, resultados, papeletas y registros
              asociados. No se puede deshacer.
            </div>

            <label className="block mb-4">
              <span className="text-xs font-bold text-slate-600 uppercase">
                Razón de la eliminación (opcional, se registra en audit)
              </span>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ej. paciente duplicado, solicitud del titular"
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
                Entiendo que esto es irreversible y borrará todo el historial clínico.
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
                {isPending
                  ? 'Eliminando…'
                  : `Eliminar ${selectedNames.length} ${selectedNames.length === 1 ? 'paciente' : 'pacientes'}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}