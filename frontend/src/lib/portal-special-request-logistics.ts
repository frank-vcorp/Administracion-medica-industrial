/**
 * Carga configuración desde AppConfig y resuelve destinos para el portal.
 */
import prisma from '@/lib/prisma'
import { resolvePortalSpecialRequestLogisticsPhones } from '@/lib/portal-special-request-logistics-resolve'
import {
  PORTAL_SPECIAL_REQUEST_WHATSAPP_CONFIG_KEY,
  PortalSpecialRequestWhatsAppConfigSchema,
  type PortalSpecialRequestWhatsAppConfig,
} from '@/schemas/portal-special-request-whatsapp.schema'

export { resolvePortalSpecialRequestLogisticsPhones } from '@/lib/portal-special-request-logistics-resolve'

export async function getPortalSpecialRequestRouting(): Promise<{
  logisticsPhones: string[]
  copyToSeller: boolean
}> {
  const row = await prisma.appConfig.findUnique({
    where: { key: PORTAL_SPECIAL_REQUEST_WHATSAPP_CONFIG_KEY },
  })
  let config: PortalSpecialRequestWhatsAppConfig | null = null
  if (row?.value) {
    const parsed = PortalSpecialRequestWhatsAppConfigSchema.safeParse(row.value)
    if (parsed.success) config = parsed.data
  }
  const { phones, copyToSeller } = resolvePortalSpecialRequestLogisticsPhones(
    config,
    process.env.PORTAL_LOGISTICS_WHATSAPP,
  )
  return { logisticsPhones: phones, copyToSeller }
}
