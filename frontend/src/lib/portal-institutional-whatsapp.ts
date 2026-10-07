import prisma from '@/lib/prisma'
import { callWhatsAppGateway } from '@/lib/whatsapp-gateway-client'
import { isValidWhatsAppPhone, normalizeWhatsAppPhone } from '@/lib/whatsapp-phone'

const ROW_ID = 'default'

export async function isPortalInstitutionalWhatsAppActive(): Promise<boolean> {
  const row = await prisma.whatsAppBaileysConfig.findUnique({ where: { id: ROW_ID } })
  return Boolean(row?.enabled)
}

/** Envío por línea AMI (Baileys); sin wa.me ni texto al cliente. */
export async function sendInstitutionalWhatsAppMessage(args: {
  toPhone: string
  text: string
  actorUserId: string
  actorRole: string
}): Promise<{ sent: boolean; error?: string }> {
  if (!(await isPortalInstitutionalWhatsAppActive())) {
    return { sent: false, error: 'WhatsApp institucional no activo' }
  }

  const phone = normalizeWhatsAppPhone(args.toPhone)
  if (!isValidWhatsAppPhone(phone)) {
    return { sent: false, error: 'Teléfono destino inválido' }
  }

  const live = await callWhatsAppGateway({
    path: '/v1/messages/send',
    method: 'POST',
    role: args.actorRole,
    userId: args.actorUserId,
    body: { to: phone, text: args.text },
  })

  if (live.ok && live.data && (live.data as { sent?: boolean }).sent) {
    return { sent: true }
  }
  return { sent: false, error: live.error ?? 'Envío fallido' }
}
