'use client'

import { useState, useTransition } from 'react'
import { submitPortalSpecialRequestContact } from '@/actions/portal-appointment.actions'

type Props = {
  branchId: string
  date: string
  time: string
  reason: 'capacity_full' | 'custom'
  title?: string
  description?: string
}

export default function PortalSpecialRequestPanel({
  branchId,
  date,
  time,
  reason,
  title = 'Solicitud de atención personalizada',
  description = 'Complete el formulario para solicitar citas fuera de agenda o en volumen. Nos comunicaremos con usted.',
}: Props) {
  const [count, setCount] = useState(1)
  const [contactPhone, setContactPhone] = useState('')
  const [comment, setComment] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    startTransition(async () => {
      const res = await submitPortalSpecialRequestContact({
        appointmentCount: count,
        branchId,
        date,
        time,
        reason,
        contactPhone,
        comment: comment.trim() || undefined,
      })
      if (!res.success) {
        setError(res.error ?? 'No se pudo enviar la solicitud')
        return
      }
      setSuccess(res.message)
      setComment('')
    })
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-xl border border-violet-200 bg-violet-50/80 p-4 space-y-3"
    >
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-violet-800">{title}</p>
        <p className="text-sm text-violet-950 mt-1">{description}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="text-xs font-bold uppercase text-slate-500">Cantidad de citas *</span>
          <input
            type="number"
            min={1}
            max={500}
            required
            value={count}
            onChange={(e) => setCount(Math.max(1, Number(e.target.value) || 1))}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 bg-white"
          />
        </label>

        <label className="block text-sm">
          <span className="text-xs font-bold uppercase text-slate-500">Teléfono de contacto *</span>
          <input
            type="tel"
            required
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
            placeholder="10 dígitos mínimo"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 bg-white"
          />
        </label>

        <label className="block text-sm sm:col-span-2">
          <span className="text-xs font-bold uppercase text-slate-500">Comentario (opcional)</span>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={2}
            maxLength={500}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 bg-white"
            placeholder="Ej. turnos preferidos, urgencia, etc."
          />
        </label>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex justify-center rounded-lg bg-violet-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-violet-800 disabled:opacity-50"
      >
        {pending ? 'Enviando…' : 'Enviar solicitud'}
      </button>

      {success && (
        <p className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
          {success}
        </p>
      )}
      {error && <p className="text-sm text-red-700">{error}</p>}
    </form>
  )
}
