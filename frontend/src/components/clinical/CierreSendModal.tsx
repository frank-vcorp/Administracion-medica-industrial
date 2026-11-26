'use client'

import { useState, useEffect } from 'react'
import {
  X,
  Mail,
  MessageSquare,
  Building2,
  User,
  Loader2,
  Send,
  AlertCircle,
  Plus,
} from 'lucide-react'
import {
  getCierreClinicoContactInfo,
  sendCierreClinico,
  type CierreClinicoContactInfo,
} from '@/actions/cierre-clinico-send.actions'

interface CierreSendModalProps {
  isOpen: boolean
  onClose: () => void
  eventId: string
  channel: 'email' | 'whatsapp'
  onSent: (message: string, isError?: boolean) => void
}

export function CierreSendModal({
  isOpen,
  onClose,
  eventId,
  channel,
  onSent,
}: CierreSendModalProps) {
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [info, setInfo] = useState<CierreClinicoContactInfo | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Form states
  const [selectedEmail, setSelectedEmail] = useState<string>('')
  const [extraEmails, setExtraEmails] = useState<string>('')
  const [phone, setPhone] = useState<string>('')

  useEffect(() => {
    if (!isOpen) return
    let active = true
    setLoading(true)
    setError(null)

    getCierreClinicoContactInfo(eventId).then((res) => {
      if (!active) return
      setLoading(false)
      if (res.success) {
        setInfo(res)
        // Default to company email if present, else worker email
        const defEmail = res.companyEmail || res.workerEmail || res.additionalEmails?.[0] || ''
        setSelectedEmail(defEmail)
        // Default phone: worker phone or company phone
        const defPhone = res.workerPhone || res.companyPhone || ''
        setPhone(defPhone)
      } else {
        setError(res.error || 'No se pudo obtener la información de contacto.')
      }
    })

    return () => {
      active = false
    }
  }, [isOpen, eventId])

  if (!isOpen) return null

  const handleSend = async () => {
    setError(null)
    setSending(true)

    const extras = extraEmails
      .split(/[,;\n]/)
      .map((e) => e.trim())
      .filter((e) => e.length > 0 && e.includes('@'))

    const res = await sendCierreClinico({
      eventId,
      channel,
      recipientEmail: selectedEmail,
      additionalEmails: extras,
      recipientPhone: phone,
    })

    setSending(false)

    if (res.success) {
      const msg =
        channel === 'email'
          ? 'Cierre clínico enviado exitosamente por correo electrónico.'
          : 'Cierre clínico enviado exitosamente por WhatsApp.'
      onSent(msg, false)
      onClose()
    } else {
      setError(res.error || 'Ocurrió un error al procesar el envío.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div
              className={`p-2 rounded-xl text-white ${
                channel === 'email' ? 'bg-sky-600' : 'bg-[#128C7E]'
              }`}
            >
              {channel === 'email' ? (
                <Mail className="h-5 w-5" />
              ) : (
                <MessageSquare className="h-5 w-5" />
              )}
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-base">
                {channel === 'email'
                  ? 'Enviar Cierre Clínico por Correo'
                  : 'Enviar Cierre Clínico por WhatsApp'}
              </h3>
              <p className="text-xs text-slate-500">
                {info?.patientName ? `Paciente: ${info.patientName}` : 'Expediente digital'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={sending}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-10 space-y-3">
              <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
              <p className="text-sm text-slate-500">Cargando datos de contacto...</p>
            </div>
          ) : (
            <>
              {error && (
                <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-sm text-rose-800">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {channel === 'email' ? (
                <div className="space-y-4">
                  {/* Preset email options */}
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                      Destinatario Principal
                    </label>
                    <div className="space-y-2">
                      {info?.companyEmail && (
                        <label
                          className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                            selectedEmail === info.companyEmail
                              ? 'border-sky-500 bg-sky-50/50 ring-1 ring-sky-400'
                              : 'border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <input
                            type="radio"
                            name="primaryEmail"
                            value={info.companyEmail}
                            checked={selectedEmail === info.companyEmail}
                            onChange={(e) => setSelectedEmail(e.target.value)}
                            className="text-sky-600 focus:ring-sky-500"
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                              <Building2 className="h-3.5 w-3.5 text-slate-500" />
                              <span>Empresa: {info.companyName || 'Cliente'}</span>
                            </div>
                            <span className="text-sm font-medium text-slate-900">
                              {info.companyEmail}
                            </span>
                          </div>
                        </label>
                      )}

                      {info?.workerEmail && (
                        <label
                          className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                            selectedEmail === info.workerEmail
                              ? 'border-sky-500 bg-sky-50/50 ring-1 ring-sky-400'
                              : 'border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <input
                            type="radio"
                            name="primaryEmail"
                            value={info.workerEmail}
                            checked={selectedEmail === info.workerEmail}
                            onChange={(e) => setSelectedEmail(e.target.value)}
                            className="text-sky-600 focus:ring-sky-500"
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                              <User className="h-3.5 w-3.5 text-slate-500" />
                              <span>Trabajador</span>
                            </div>
                            <span className="text-sm font-medium text-slate-900">
                              {info.workerEmail}
                            </span>
                          </div>
                        </label>
                      )}

                      {/* Custom primary email input */}
                      <div className="pt-1">
                        <span className="text-xs text-slate-500 block mb-1">
                          O escribe otro correo principal:
                        </span>
                        <input
                          type="email"
                          placeholder="contacto@empresa.com"
                          value={selectedEmail}
                          onChange={(e) => setSelectedEmail(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Additional Emails */}
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                      <Plus className="h-3.5 w-3.5 text-slate-500" />
                      Correos Adicionales (Opcional)
                    </label>
                    <p className="text-xs text-slate-500 mb-2">
                      Separa múltiples direcciones con coma (ej. rrhh@empresa.com, medico@empresa.com)
                    </p>
                    <textarea
                      rows={2}
                      placeholder="correo1@empresa.com, correo2@empresa.com"
                      value={extraEmails}
                      onChange={(e) => setExtraEmails(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 resize-none"
                    />
                  </div>

                  {/* Attachment Note */}
                  <div className="rounded-xl border border-sky-100 bg-sky-50/70 p-3 text-xs text-sky-900">
                    📦 <strong>Se adjuntará:</strong> Archivo ZIP de cierre clínico con el
                    Dictamen General firmado, Reporte de recomendaciones del paciente y estudios
                    validados.
                  </div>
                </div>
              ) : (
                /* WhatsApp Channel */
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                      Número de WhatsApp de Entrega
                    </label>
                    <div className="space-y-2">
                      {info?.workerPhone && (
                        <button
                          type="button"
                          onClick={() => setPhone(info.workerPhone || '')}
                          className={`w-full text-left p-3 rounded-xl border transition-all ${
                            phone === info.workerPhone
                              ? 'border-[#128C7E] bg-emerald-50/50 ring-1 ring-emerald-400'
                              : 'border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                            <User className="h-3.5 w-3.5 text-slate-500" />
                            <span>Teléfono del Trabajador:</span>
                          </div>
                          <span className="text-sm font-medium text-slate-900">
                            {info.workerPhone}
                          </span>
                        </button>
                      )}

                      {info?.companyPhone && (
                        <button
                          type="button"
                          onClick={() => setPhone(info.companyPhone || '')}
                          className={`w-full text-left p-3 rounded-xl border transition-all ${
                            phone === info.companyPhone
                              ? 'border-[#128C7E] bg-emerald-50/50 ring-1 ring-emerald-400'
                              : 'border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                            <Building2 className="h-3.5 w-3.5 text-slate-500" />
                            <span>Teléfono de la Empresa:</span>
                          </div>
                          <span className="text-sm font-medium text-slate-900">
                            {info.companyPhone}
                          </span>
                        </button>
                      )}

                      <div className="pt-1">
                        <span className="text-xs text-slate-500 block mb-1">
                          Número (10 dígitos):
                        </span>
                        <input
                          type="tel"
                          placeholder="8112345678"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#128C7E] focus:ring-1 focus:ring-[#128C7E]"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-3 text-xs text-emerald-900">
                    💬 <strong>Envío directo:</strong> El ZIP de cierre clínico se enviará como
                    documento adjunto a través de la línea institucional de WhatsApp de Soluciones
                    Médico Empresariales.
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-100 bg-slate-50/50 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            className="px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-200/70 rounded-xl transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={
              loading ||
              sending ||
              (channel === 'email' ? !selectedEmail.trim() : !phone.trim())
            }
            className={`px-6 py-2.5 rounded-xl font-bold text-white shadow-md transition-all flex items-center gap-2 disabled:opacity-50 ${
              channel === 'email'
                ? 'bg-sky-600 hover:bg-sky-700 shadow-sky-200'
                : 'bg-[#128C7E] hover:bg-[#0f7a6e] shadow-emerald-200'
            }`}
          >
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Enviando...</span>
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                <span>
                  {channel === 'email' ? 'Enviar por Correo' : 'Enviar por WhatsApp'}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
