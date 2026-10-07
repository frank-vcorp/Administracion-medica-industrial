'use client'

import { useEffect, useRef } from 'react'
import { sendWhatsAppTextMessage } from '@/actions/whatsapp-send.actions'

export function useAutoWhatsAppOnMount(args: {
  enabled: boolean
  phone: string
  text: string
  auditContext?: string
  entityId?: string
  onSent?: () => void
  onFallback?: (url: string) => void
}) {
  const attempted = useRef(false)

  useEffect(() => {
    if (!args.enabled || attempted.current || !args.phone?.trim()) return
    attempted.current = true
    void sendWhatsAppTextMessage({
      phone: args.phone,
      text: args.text,
      auditContext: args.auditContext,
      entityId: args.entityId,
    }).then((res) => {
      if (res.sent) args.onSent?.()
      else if (res.fallbackWaUrl) args.onFallback?.(res.fallbackWaUrl)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- callbacks estables del padre
  }, [args.enabled, args.phone, args.text, args.auditContext, args.entityId])
}
