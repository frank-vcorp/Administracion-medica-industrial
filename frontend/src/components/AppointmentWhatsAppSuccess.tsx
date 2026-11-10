'use client'

import WhatsAppAutoSendButton from '@/components/shared/WhatsAppAutoSendButton'
import type { AppointmentPassWhatsAppResult } from '@/actions/appointment-pass-whatsapp.actions'

type Props = {
  phone: string
  message: string
  appointmentId: string
  whatsApp?: AppointmentPassWhatsAppResult
}

export default function AppointmentWhatsAppSuccess({
  phone,
  message,
  appointmentId,
  whatsApp,
}: Props) {
  if (whatsApp?.sent) {
    return (
      <div className="space-y-1">
        <p className="text-sm text-emerald-700 font-bold text-center py-2">
          📱 Pase enviado por WhatsApp (línea institucional)
        </p>
        {whatsApp.triptychSent ? (
          <p className="text-[11px] text-emerald-600 text-center font-medium">
            Tríptico de preparación enviado.
          </p>
        ) : (
          <p className="text-[11px] text-amber-700 text-center">
            Tríptico: pendiente (gateway) o enlace de respaldo enviado.
          </p>
        )}
      </div>
    )
  }

  if (whatsApp?.skipped) {
    return (
      <div className="bg-slate-100 text-slate-500 py-3 rounded-xl font-medium text-xs px-4 text-center">
        WhatsApp automático desactivado o sin teléfono válido.
      </div>
    )
  }

  if (whatsApp?.fallbackWaUrl) {
    return (
      <a
        href={whatsApp.fallbackWaUrl}
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
      attachPatientTriptych
      className="block w-full bg-[#25D366] hover:bg-[#128C7E] text-white py-3 rounded-xl font-bold transition-all hover:scale-[1.02] flex items-center justify-center gap-2 disabled:opacity-70"
    >
      <span>📱</span> Reintentar envío por WhatsApp
    </WhatsAppAutoSendButton>
  )
}
