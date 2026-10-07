'use client'

import { useState } from 'react'
import { sendWhatsAppTextMessage } from '@/actions/whatsapp-send.actions'

type Props = {
  phone: string
  text: string
  auditContext?: string
  entityId?: string
  className?: string
  'data-testid'?: string
  children: React.ReactNode
}

export default function WhatsAppAutoSendButton({
  phone,
  text,
  auditContext,
  entityId,
  className,
  'data-testid': dataTestId,
  children,
}: Props) {
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleClick() {
    setBusy(true)
    try {
      const res = await sendWhatsAppTextMessage({
        phone,
        text,
        auditContext,
        entityId,
      })
      if (res.sent) {
        setSent(true)
        return
      }
      if (res.fallbackWaUrl) {
        window.open(res.fallbackWaUrl, '_blank', 'noopener,noreferrer')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      disabled={busy || sent}
      onClick={() => void handleClick()}
      className={className}
      data-testid={dataTestId}
    >
      {sent ? '✓ Enviado por WhatsApp' : busy ? 'Enviando…' : children}
    </button>
  )
}
