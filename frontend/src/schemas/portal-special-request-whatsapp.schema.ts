/**
 * Configuración UI para números WhatsApp que reciben solicitudes de
 * atención personalizada desde el portal B2B (capacidad agotada / volumen).
 */
import { z } from 'zod'

/** Clave única en `AppConfig`. */
export const PORTAL_SPECIAL_REQUEST_WHATSAPP_CONFIG_KEY =
  'portal.special_request_whatsapp' as const

export const PortalSpecialRequestWhatsAppConfigSchema = z.object({
  /** Hasta 5 números (10 dígitos MX o con prefijo); se normalizan al guardar. */
  phones: z.array(z.string()).max(5).default([]),
  /** Duplicar mensaje al vendedor de la empresa (comportamiento previo). */
  copyToSeller: z.boolean().default(true),
})

export type PortalSpecialRequestWhatsAppConfig = z.infer<
  typeof PortalSpecialRequestWhatsAppConfigSchema
>
