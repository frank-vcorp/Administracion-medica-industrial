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
  ShieldCheck,
  Package,
} from 'lucide-react'
import {
  getCierreClinicoContactInfo,
  sendCierreClinico,
  type CierreClinicoContactInfo,
  type SendCierreClinicoInput,
} from '@/actions/cierre-clinico-send.actions'

interface CierreSendModalProps {
  isOpen: boolean
  onClose: () => void
  eventId: string
  channel: 'email' | 'whatsapp'
  onSent: (message: string, isError?: boolean) => void
  documentTitle?: string
  sendAction?: (input: SendCierreClinicoInput) => Promise<{ success: boolean; error?: string }>
}

export function CierreSendModal({
  isOpen,
  onClose,
  eventId,
  channel,
  onSent,
  documentTitle,
  sendAction,
}: CierreSendModalProps) {
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [info, setInfo] = useState<CierreClinicoContactInfo | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Tipo de destinatario: 'company' (Predeterminado) o 'worker' (Solo recomendaciones)
  const [recipientType, setRecipientType] = useState<'company' | 'worker'>('company')

  // Form states
  const [selectedEmail, setSelectedEmail] = useState<string>('')
  const [extraEmails, setExtraEmails] = useState<string>('')
  const [phone, setPhone] = useState<string>('')
  const [extraPhones, setExtraPhones] = useState<string>('')

  useEffect(() => {
    if (!isOpen) return
    let active = true
    setLoading(true)
    setError(null)
    setRecipientType('company')

    getCierreClinicoContactInfo(eventId).then((res) => {
      if (!active) return
      setLoading(false)
      if (res.success) {
        setInfo(res)
        // Predeterminado al Cliente / Empresa
        const defEmail = res.companyEmail || res.additionalEmails?.[0] || ''
        setSelectedEmail(defEmail)
        const defPhone = res.companyPhone || ''
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

  const handleSwitchRecipientType = (type: 'company' | 'worker') => {
    setRecipientType(type)
    setError(null)
    if (type === 'company') {
      setSelectedEmail(info?.companyEmail || info?.additionalEmails?.[0] || '')
      setPhone(info?.companyPhone || '')
    } else {
      setSelectedEmail(info?.workerEmail || '')
      setPhone(info?.workerPhone || '')
    }
  }

  const handleSend = async () => {
    setError(null)
    setSending(true)

    const extras = extraEmails
      .split(/[,;\n]/)
      .map((e) => e.trim())
      .filter((e) => e.length > 0 && e.includes('@'))

    const extraPhoneList = extraPhones
      .split(/[,;\n]/)
      .map((p) => p.trim())
      .filter((p) => p.length >= 10)

    const sendFn = sendAction ?? sendCierreClinico
    const res = await sendFn({
      eventId,
      channel,
      recipientType,
      recipientEmail: selectedEmail,
      additionalEmails: extras,
      recipientPhone: phone,
      additionalPhones: extraPhoneList,
    })

    setSending(false)

    if (res.success) {
      let msg = ''
      if (documentTitle) {
        msg = `${documentTitle} enviado ${
          recipientType === 'company' ? 'a la empresa' : 'al trabajador'
        } por ${channel === 'email' ? 'correo electrónico' : 'WhatsApp'}.`
      } else if (recipientType === 'company') {
        msg =
          channel === 'email'
            ? 'Expediente de cierre clínico enviado a la empresa por correo electrónico.'
            : 'Expediente de cierre clínico enviado a la empresa por WhatsApp.'
      } else {
        msg =
          channel === 'email'
            ? 'Recomendaciones de salud enviadas al trabajador por correo electrónico.'
            : 'Recomendaciones de salud enviadas al trabajador por WhatsApp.'
      }
      onSent(msg, false)
      onClose()
    } else {
      setError(res.error || 'Ocurrió un error al procesar el envío.')
    }
  }

  const modalTitle = documentTitle
    ? `Enviar ${documentTitle} a ${
        recipientType === 'company' ? 'Empresa' : 'Trabajador'
      } (${channel === 'email' ? 'Correo' : 'WhatsApp'})`
    : recipientType === 'company'
      ? channel === 'email'
        ? 'Enviar Cierre a Empresa (Correo)'
        : 'Enviar Cierre a Empresa (WhatsApp)'
      : channel === 'email'
      ? 'Enviar Recomendaciones a Trabajador (Correo)'
      : 'Enviar Recomendaciones a Trabajador (WhatsApp)'

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
                {modalTitle}
              </h3>
              <p className="text-xs text-slate-500">
                {info?.patientName ? `${info.patientName}` : 'Expediente digital'}
                {info?.companyName ? ` · ${info.companyName}` : ''}
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

              {/* Selector de Destinatario: Empresa (Cliente) vs Trabajador */}
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                  Destinatario del Envío
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleSwitchRecipientType('company')}
                    className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-bold transition-all ${
                      recipientType === 'company'
                        ? channel === 'email'
                          ? 'border-sky-500 bg-sky-50 text-sky-800 ring-2 ring-sky-400/30'
                          : 'border-[#128C7E] bg-emerald-50 text-emerald-800 ring-2 ring-emerald-400/30'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Building2 className="h-4 w-4" />
                    <span>{documentTitle ? 'Empresa / Cliente' : 'Empresa / Cliente (Default)'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSwitchRecipientType('worker')}
                    className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-bold transition-all ${
                      recipientType === 'worker'
                        ? channel === 'email'
                          ? 'border-sky-500 bg-sky-50 text-sky-800 ring-2 ring-sky-400/30'
                          : 'border-[#128C7E] bg-emerald-50 text-emerald-800 ring-2 ring-emerald-400/30'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <User className="h-4 w-4" />
                    <span>{documentTitle ? 'Trabajador / Paciente' : 'Trabajador (Solo Recs.)'}</span>
                  </button>
                </div>
              </div>

              {/* Banner informativo según destinatario */}
              {documentTitle ? (
                recipientType === 'company' ? (
                  <div className="rounded-xl border border-sky-100 bg-sky-50/70 p-3 text-xs text-sky-900 flex items-start gap-2.5">
                    <Package className="h-4 w-4 text-sky-600 shrink-0 mt-0.5" />
                    <div>
                      <strong>{documentTitle} (PDF) para la Empresa:</strong> Se enviará el{' '}
                      <strong>{documentTitle} oficial en PDF</strong> con dictamen de aptitud y firma
                      del médico certificador.
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-3 text-xs text-emerald-950 flex items-start gap-2.5">
                    <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <strong>{documentTitle} (PDF) para el Paciente:</strong> Se enviará el{' '}
                      <strong>{documentTitle} oficial en PDF</strong> directamente al trabajador.
                    </div>
                  </div>
                )
              ) : recipientType === 'company' ? (
                <div className="rounded-xl border border-sky-100 bg-sky-50/70 p-3 text-xs text-sky-900 flex items-start gap-2.5">
                  <Package className="h-4 w-4 text-sky-600 shrink-0 mt-0.5" />
                  <div>
                    <strong>Expediente Completo para la Empresa:</strong> Se enviará el archivo{' '}
                    <strong>ZIP de cierre clínico</strong> con el Dictamen General de Aptitud firmado,
                    reporte de recomendaciones y todos los estudios validados.
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-3 text-xs text-emerald-950 flex items-start gap-2.5">
                  <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <strong>Confidencialidad Médica:</strong> Al trabajador se le enviará{' '}
                    <em>únicamente su PDF de Recomendaciones de Salud y Bienestar</em> para su cuidado
                    personal (sin dictamen de aptitud patronal ni reportes corporativos).
                  </div>
                </div>
              )}

              {channel === 'email' ? (
                /* Canal Email */
                <div className="space-y-4">
                  {/* Preset email options */}
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                      {recipientType === 'company'
                        ? 'Correo Principal de la Empresa'
                        : 'Correo del Trabajador'}
                    </label>

                    <div className="space-y-2">
                      {recipientType === 'company' ? (
                        <>
                          {info?.companyEmail && (
                            <button
                              type="button"
                              onClick={() => setSelectedEmail(info.companyEmail || '')}
                              className={`w-full text-left flex items-center gap-3 p-3 rounded-xl border transition-all ${
                                selectedEmail === info.companyEmail
                                  ? 'border-sky-500 bg-sky-50/60 ring-1 ring-sky-400'
                                  : 'border-slate-200 hover:bg-slate-50'
                              }`}
                            >
                              <Building2 className="h-4 w-4 text-slate-500" />
                              <div className="flex-1">
                                <div className="text-xs text-slate-500 font-semibold">
                                  Empresa: {info.companyName || 'Cliente'}
                                </div>
                                <div className="text-sm font-bold text-slate-800">
                                  {info.companyEmail}
                                </div>
                              </div>
                            </button>
                          )}
                        </>
                      ) : (
                        <>
                          {info?.workerEmail && (
                            <button
                              type="button"
                              onClick={() => setSelectedEmail(info.workerEmail || '')}
                              className={`w-full text-left flex items-center gap-3 p-3 rounded-xl border transition-all ${
                                selectedEmail === info.workerEmail
                                  ? 'border-emerald-500 bg-emerald-50/60 ring-1 ring-emerald-400'
                                  : 'border-slate-200 hover:bg-slate-50'
                              }`}
                            >
                              <User className="h-4 w-4 text-slate-500" />
                              <div className="flex-1">
                                <div className="text-xs text-slate-500 font-semibold">
                                  Trabajador: {info.patientName}
                                </div>
                                <div className="text-sm font-bold text-slate-800">
                                  {info.workerEmail}
                                </div>
                              </div>
                            </button>
                          )}
                        </>
                      )}

                      {/* Custom primary email input */}
                      <div>
                        <span className="text-xs text-slate-500 block mb-1">
                          {recipientType === 'company'
                            ? 'Correo principal de envío (editable):'
                            : 'Correo del trabajador (editable):'}
                        </span>
                        <input
                          type="email"
                          placeholder={
                            recipientType === 'company'
                              ? 'contacto@empresa.com'
                              : 'trabajador@correo.com'
                          }
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
                      Separa con coma o salto de línea (ej. rrhh@empresa.com, medico@empresa.com)
                    </p>
                    <textarea
                      rows={2}
                      placeholder="correo1@empresa.com, correo2@empresa.com"
                      value={extraEmails}
                      onChange={(e) => setExtraEmails(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 resize-none"
                    />
                  </div>
                </div>
              ) : (
                /* Canal WhatsApp */
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                      {recipientType === 'company'
                        ? 'Número de WhatsApp de la Empresa'
                        : 'Número de WhatsApp del Trabajador'}
                    </label>

                    <div className="space-y-2">
                      {recipientType === 'company' ? (
                        <>
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
                              <span className="text-sm font-bold text-slate-900">
                                {info.companyPhone}
                              </span>
                            </button>
                          )}
                        </>
                      ) : (
                        <>
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
                              <span className="text-sm font-bold text-slate-900">
                                {info.workerPhone}
                              </span>
                            </button>
                          )}
                        </>
                      )}

                      <div>
                        <span className="text-xs text-slate-500 block mb-1">
                          Número principal (10 dígitos):
                        </span>
                        <input
                          type="tel"
                          placeholder="8112345678"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#128C7E] focus:ring-1 focus:ring-[#128C7E]"
                        />
                      </div>

                      {/* Números adicionales de WhatsApp */}
                      <div className="pt-2">
                        <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                          <Plus className="h-3.5 w-3.5 text-slate-500" />
                          Números de WhatsApp Adicionales (Opcional)
                        </label>
                        <p className="text-xs text-slate-500 mb-1.5">
                          Separa con coma o salto de línea (ej. 8111223344, 8122334455)
                        </p>
                        <input
                          type="text"
                          placeholder="8111223344, 8122334455"
                          value={extraPhones}
                          onChange={(e) => setExtraPhones(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#128C7E] focus:ring-1 focus:ring-[#128C7E]"
                        />
                      </div>
                    </div>
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
                  {recipientType === 'company'
                    ? channel === 'email'
                      ? 'Enviar Cierre a Empresa'
                      : 'Enviar Cierre por WhatsApp'
                    : channel === 'email'
                    ? 'Enviar Recomendaciones'
                    : 'Enviar Recomendaciones por WhatsApp'}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
