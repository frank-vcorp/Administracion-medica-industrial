'use client'

import { useEffect, useRef, useState } from 'react'
import WhatsAppAutoSendButton from '@/components/shared/WhatsAppAutoSendButton'
import { sendWhatsAppTextMessage } from '@/actions/whatsapp-send.actions'

type Props = {
  phone: string
  message: string
  appointmentId: string
}

export default function AppointmentWhatsAppSuccess({ phone, message, appointmentId }: Props) {
  const attempted = useRef(false)
  const [phase, setPhase] = useState<'sending' | 'sent' | 'fallback' | 'retry'>('sending')
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null)

  useEffect(() => {
    if (attempted.current) return
    attempted.current = true
    void sendWhatsAppTextMessage({
      phone,
      text: message,
      auditContext: 'appointment_pass',
      entityId: appointmentId,
    }).then((res) => {
      if (res.sent) setPhase('sent')
      else if (res.fallbackWaUrl) {
        setFallbackUrl(res.fallbackWaUrl)
        setPhase('fallback')
      } else setPhase('retry')
    })
  }, [phone, message, appointmentId])

  if (phase === 'sent') {
    return (
      <p className="text-sm text-emerald-700 font-bold text-center py-3">
        📱 Pase enviado por WhatsApp (línea institucional)
      </p>
    )
  }

  if (phase === 'sending') {
    return (
      <p className="text-sm text-slate-500 font-medium text-center py-3">Enviando pase por WhatsApp…</p>
    )
  }

  if (phase === 'fallback' && fallbackUrl) {
    return (
      <a
        href={fallbackUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block w-full bg-[#25D366] hover:bg-[#128C7E] text-white py-3 rounded-xl font-bold transition-all hover:scale-[1.02] flex items-center justify-center gap-2"
      >
        <span>📱</span> Abrir WhatsApp manualmente (respaldo)
      </a>
    )
  }

  return (
    <WhatsAppAutoSendButton
      phone={phone}
      text={message}
      auditContext="appointment_pass"
      entityId={appointmentId}
      className="block w-full bg-[#25D366] hover:bg-[#128C7E] text-white py-3 rounded-xl font-bold transition-all hover:scale-[1.02] flex items-center justify-center gap-2 disabled:opacity-70"
    >
      <span>📱</span> Enviar Pase por WhatsApp
    </WhatsAppAutoSendButton>
  )
}
