'use client'

import { useState, useTransition } from 'react'

export default function CancelWithReasonButton({
  label,
  confirmLabel,
  disabled = false,
  alreadyCancelled = false,
  existingReason,
  onConfirm,
}: {
  label: string
  confirmLabel: string
  disabled?: boolean
  alreadyCancelled?: boolean
  existingReason?: string | null
  onConfirm: (reason: string) => Promise<{ success: boolean; error?: string }>
}) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()

  if (alreadyCancelled) {
    return (
      <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
        Cancelada{existingReason ? `: ${existingReason}` : '.'}
      </p>
    )
  }

  if (!open) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          setError('')
          setOpen(true)
        }}
        className="text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 px-3 py-2 rounded-lg disabled:opacity-50"
      >
        {label}
      </button>
    )
  }

  return (
    <form
      className="space-y-2"
      onSubmit={(event) => {
        event.preventDefault()
        setError('')
        startTransition(async () => {
          const res = await onConfirm(reason)
          if (!res.success) {
            setError(res.error ?? 'No se pudo cancelar.')
            return
          }
          setReason('')
          setOpen(false)
        })
      }}
    >
      <label className="block text-[10px] font-bold uppercase text-slate-500">
        Motivo de cancelación
      </label>
      <textarea
        required
        minLength={3}
        maxLength={500}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        rows={3}
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        placeholder="Indica por qué se cancela"
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending || reason.trim().length < 3}
          className="text-xs font-bold text-white bg-red-600 hover:bg-red-700 px-3 py-2 rounded-lg disabled:opacity-50"
        >
          {pending ? 'Cancelando…' : confirmLabel}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false)
            setError('')
          }}
          className="text-xs font-bold text-slate-600 px-3 py-2"
        >
          Volver
        </button>
      </div>
    </form>
  )
}
