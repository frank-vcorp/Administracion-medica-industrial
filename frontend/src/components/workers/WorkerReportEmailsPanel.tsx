'use client'

/**
 * WorkerReportEmailsPanel — Gestión de correos adicionales de envío de resultados por paciente.
 * @id ARCH-20260708-01
 * @see context/SPECs/SPEC_ARCH-20260708-01-PERFILES-PACIENTE-CORREOS-CLONACION.md
 *
 * Worker.email es el correo principal; este panel permite hasta 5 correos adicionales
 * (constraint UI; riesgo R2 documentado en SPEC).
 */

import { useState, useTransition } from 'react'
import {
  addWorkerReportEmail,
  removeWorkerReportEmail,
} from '@/actions/worker.actions'

interface ReportEmailRow {
  id: string
  email: string
  isPrimary: boolean
}

const MAX_EMAILS = 5

interface Props {
  workerId: string
  workerName: string
  initialEmails: ReportEmailRow[]
}

export default function WorkerReportEmailsPanel({
  workerId,
  workerName,
  initialEmails,
}: Props) {
  const [emails, setEmails] = useState<ReportEmailRow[]>(initialEmails)
  const [draft, setDraft] = useState('')
  const [isPrimaryDraft, setIsPrimaryDraft] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [isPending, startTransition] = useTransition()

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message })
    setTimeout(() => setFeedback(null), 3500)
  }

  const reachedLimit = emails.length >= MAX_EMAILS

  function handleAdd() {
    const trimmed = draft.trim().toLowerCase()
    if (!trimmed) return
    if (reachedLimit) {
      showFeedback('error', `Máximo ${MAX_EMAILS} correos adicionales por paciente.`)
      return
    }
    startTransition(async () => {
      const result = await addWorkerReportEmail(workerId, {
        email: trimmed,
        isPrimary: isPrimaryDraft,
      })
      if (result.success && result.data) {
        setEmails((prev) => [
          ...prev,
          { id: result.data!.id, email: trimmed, isPrimary: isPrimaryDraft },
        ])
        setDraft('')
        setIsPrimaryDraft(false)
        showFeedback('success', 'Correo agregado al paciente')
      } else if (!result.success) {
        showFeedback('error', result.error ?? 'Error al agregar correo')
      }
    })
  }

  function handleRemove(id: string, label: string) {
    if (!confirm(`¿Quitar el correo "${label}" de ${workerName}?`)) return
    startTransition(async () => {
      const result = await removeWorkerReportEmail(id)
      if (result.success) {
        setEmails((prev) => prev.filter((e) => e.id !== id))
        showFeedback('success', 'Correo eliminado')
      } else {
        showFeedback('error', result.error ?? 'Error al eliminar correo')
      }
    })
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-slate-800">📬 Envío de resultados</h3>
          <p className="mt-1 text-xs text-slate-500">
            Correos adicionales a los que se enviarán los resultados del paciente
            (máximo {MAX_EMAILS}). El correo principal se administra en la ficha del paciente.
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
          {emails.length} / {MAX_EMAILS}
        </span>
      </header>

      {feedback && (
        <div
          role="alert"
          className={`rounded-lg border px-3 py-2 text-sm ${
            feedback.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {feedback.message}
        </div>
      )}

      {emails.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-center text-sm text-slate-500">
          Aún no se han configurado correos adicionales para este paciente.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
          {emails.map((row) => (
            <li key={row.id} className="flex items-center justify-between gap-3 px-3 py-2">
              <div className="flex items-center gap-2 truncate">
                <span className="truncate text-sm text-slate-700" title={row.email}>{row.email}</span>
                {row.isPrimary && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-700">
                    principal
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => handleRemove(row.id, row.email)}
                disabled={isPending}
                className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50"
              >
                Quitar
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Formulario inline para agregar */}
      <div className="rounded-lg bg-slate-50 p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label htmlFor="new-email-input" className="block text-xs font-semibold text-slate-600">
              Nuevo correo
            </label>
            <input
              id="new-email-input"
              type="email"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              disabled={reachedLimit || isPending}
              placeholder={reachedLimit ? `Máximo ${MAX_EMAILS} alcanzado` : 'correo@empresa.com'}
              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-slate-100 disabled:text-slate-400"
            />
          </div>
          <label className="inline-flex items-center gap-2 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={isPrimaryDraft}
              onChange={(e) => setIsPrimaryDraft(e.target.checked)}
              disabled={reachedLimit || isPending}
              className="rounded accent-blue-600"
            />
            Marcar como principal
          </label>
          <button
            type="button"
            onClick={handleAdd}
            disabled={isPending || reachedLimit || !draft.trim()}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white shadow hover:bg-blue-700 disabled:opacity-50"
          >
            {isPending ? 'Agregando…' : '+ Agregar'}
          </button>
        </div>
      </div>
    </section>
  )
}
