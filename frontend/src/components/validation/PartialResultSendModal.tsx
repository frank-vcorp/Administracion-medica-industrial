'use client'

import { useCallback, useEffect, useState } from 'react'

import {
  getPartialSendOffer,
  sendPartialResultEmail,
  type PartialSendOffer,
} from '@/actions/partial-result-send.actions'

type Props = {
  eventId: string
  patientName: string
  open: boolean
  onClose: () => void
}

export default function PartialResultSendModal({
  eventId,
  patientName,
  open,
  onClose,
}: Props) {
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [offer, setOffer] = useState<PartialSendOffer | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const loadOffer = useCallback(async () => {
    setLoading(true)
    setError(null)
    setSuccess(false)
    try {
      const result = await getPartialSendOffer(eventId)
      setOffer(result)
      if (result.success && result.eligible === true) {
        setSelectedIds(new Set(result.labOptions.map((o) => o.id)))
        setEmail(result.defaultEmails[0] ?? '')
      } else if (result.success && result.eligible === false) {
        setEmail(result.defaultEmails[0] ?? '')
      }
    } catch {
      setError('No se pudo cargar la oferta de envío.')
    } finally {
      setLoading(false)
    }
  }, [eventId])

  useEffect(() => {
    if (open) {
      void loadOffer()
    } else {
      setOffer(null)
      setSelectedIds(new Set())
      setEmail('')
      setError(null)
      setSuccess(false)
    }
  }, [open, loadOffer])

  const toggleId = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSend = async () => {
    setError(null)
    if (!email.trim()) {
      setError('Indique un correo destinatario.')
      return
    }
    if (selectedIds.size === 0) {
      setError('Seleccione al menos una prueba de laboratorio.')
      return
    }

    setSending(true)
    try {
      const result = await sendPartialResultEmail({
        eventId,
        eventTestIds: [...selectedIds],
        recipientEmail: email.trim(),
      })
      if (!result.success) {
        setError(result.error ?? 'Error al enviar.')
        return
      }
      setSuccess(true)
    } catch {
      setError('Error inesperado al enviar.')
    } finally {
      setSending(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-lg w-full max-h-[90vh] overflow-y-auto"
        role="dialog"
        aria-labelledby="partial-send-title"
      >
        <div className="p-6 border-b border-slate-100">
          <h3 id="partial-send-title" className="text-lg font-black text-slate-900">
            Envío parcial — laboratorio
          </h3>
          <p className="text-sm text-slate-500 mt-1">{patientName}</p>
        </div>

        <div className="p-6 space-y-4">
          {loading && (
            <p className="text-sm text-slate-500">Cargando…</p>
          )}

          {!loading && offer && !offer.success && (
            <p className="text-sm text-red-600">{offer.error}</p>
          )}

          {!loading && offer?.success && offer.eligible === false && (
            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-xl p-4">
              {offer.reason}
            </p>
          )}

          {!loading && offer?.success && offer.eligible === true && (
            <>
              <p className="text-xs text-slate-500">
                Un solo correo con los PDF seleccionados. No incluye dictamen final ni ZIP de
                cierre.
              </p>

              <div className="space-y-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Pruebas</p>
                <ul className="space-y-2">
                  {offer.labOptions.map((opt) => (
                    <li key={opt.id}>
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(opt.id)}
                          onChange={() => toggleId(opt.id)}
                          className="rounded border-slate-300"
                        />
                        <span className="font-medium text-slate-800">{opt.label}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase">
                  Correo destinatario
                </label>
                {offer.defaultEmails.length > 1 && (
                  <select
                    className="w-full mb-2 border border-slate-200 rounded-xl px-3 py-2 text-sm"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  >
                    {offer.defaultEmails.map((em) => (
                      <option key={em} value={em}>{em}</option>
                    ))}
                  </select>
                )}
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="correo@empresa.com"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </>
          )}

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          {success && (
            <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl p-4">
              Correo enviado correctamente.
            </p>
          )}
        </div>

        <div className="p-6 border-t border-slate-100 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900"
          >
            {success ? 'Cerrar' : 'Cancelar'}
          </button>
          {!success &&
            offer?.success &&
            offer.eligible === true && (
              <button
                type="button"
                disabled={sending || loading}
                onClick={() => void handleSend()}
                className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-50"
              >
                {sending ? 'Enviando…' : 'Enviar correo'}
              </button>
            )}
        </div>
      </div>
    </div>
  )
}
