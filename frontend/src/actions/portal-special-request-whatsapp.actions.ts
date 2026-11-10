'use server'

import { getServerSession } from 'next-auth/next'
import { revalidatePath } from 'next/cache'
import { authOptions } from '@/auth'
import { isAdminLike } from '@/lib/auth/roles'
import prisma from '@/lib/prisma'
import { normalizeWhatsAppPhone, isValidWhatsAppPhone } from '@/lib/whatsapp-phone'
import {
  PORTAL_SPECIAL_REQUEST_WHATSAPP_CONFIG_KEY,
  PortalSpecialRequestWhatsAppConfigSchema,
  type PortalSpecialRequestWhatsAppConfig,
} from '@/schemas/portal-special-request-whatsapp.schema'

export type PortalSpecialRequestWhatsAppPublicSettings = {
  phones: string[]
  copyToSeller: boolean
  /** Origen efectivo para la UI: vacío = usar env/default al enviar. */
  effectiveLogisticsCount: number
  updatedAt: string | null
}

function emptyDefaults(): PortalSpecialRequestWhatsAppPublicSettings {
  return {
    phones: [],
    copyToSeller: true,
    effectiveLogisticsCount: 0,
    updatedAt: null,
  }
}

function normalizePhoneList(raw: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const r of raw) {
    const trimmed = String(r ?? '').trim()
    if (!trimmed) continue
    const n = normalizeWhatsAppPhone(trimmed)
    if (!isValidWhatsAppPhone(n)) continue
    if (seen.has(n)) continue
    seen.add(n)
    out.push(trimmed.replace(/\s+/g, ''))
  }
  return out
}

export async function getPortalSpecialRequestWhatsAppSettings(): Promise<{
  success: boolean
  settings?: PortalSpecialRequestWhatsAppPublicSettings
  error?: string
}> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return { success: false, error: 'No autenticado' }
  if (!isAdminLike(session.user.role)) {
    return { success: false, error: 'Se requiere rol ADMIN o SUPERADMIN' }
  }

  const row = await prisma.appConfig.findUnique({
    where: { key: PORTAL_SPECIAL_REQUEST_WHATSAPP_CONFIG_KEY },
  })

  if (!row?.value) {
    return { success: true, settings: emptyDefaults() }
  }

  const parsed = PortalSpecialRequestWhatsAppConfigSchema.safeParse(row.value)
  if (!parsed.success) {
    return { success: true, settings: emptyDefaults() }
  }

  const phones = normalizePhoneList(parsed.data.phones)
  return {
    success: true,
    settings: {
      phones,
      copyToSeller: parsed.data.copyToSeller,
      effectiveLogisticsCount: phones.length,
      updatedAt: row.updatedAt?.toISOString() ?? null,
    },
  }
}

export async function savePortalSpecialRequestWhatsAppSettings(input: {
  phones: string[]
  copyToSeller: boolean
}): Promise<{
  success: boolean
  settings?: PortalSpecialRequestWhatsAppPublicSettings
  error?: string
}> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { success: false, error: 'No autenticado' }
  if (!isAdminLike(session.user.role)) {
    return { success: false, error: 'Se requiere rol ADMIN o SUPERADMIN' }
  }

  const phones = normalizePhoneList(input.phones)
  const payload: PortalSpecialRequestWhatsAppConfig = {
    phones,
    copyToSeller: input.copyToSeller,
  }

  const check = PortalSpecialRequestWhatsAppConfigSchema.safeParse(payload)
  if (!check.success) {
    return { success: false, error: 'Datos inválidos: revise los números (10 dígitos mínimo).' }
  }

  await prisma.appConfig.upsert({
    where: { key: PORTAL_SPECIAL_REQUEST_WHATSAPP_CONFIG_KEY },
    create: {
      key: PORTAL_SPECIAL_REQUEST_WHATSAPP_CONFIG_KEY,
      value: check.data,
      updatedBy: session.user.id,
    },
    update: {
      value: check.data,
      updatedBy: session.user.id,
    },
  })

  revalidatePath('/admin/settings')

  const row = await prisma.appConfig.findUnique({
    where: { key: PORTAL_SPECIAL_REQUEST_WHATSAPP_CONFIG_KEY },
  })

  return {
    success: true,
    settings: {
      phones: check.data.phones,
      copyToSeller: check.data.copyToSeller,
      effectiveLogisticsCount: check.data.phones.length,
      updatedAt: row?.updatedAt?.toISOString() ?? null,
    },
  }
}
