'use server'

import { getServerSession } from 'next-auth/next'
import { revalidatePath } from 'next/cache'
import { authOptions } from '@/auth'
import { isAdminLike } from '@/lib/auth/roles'
import prisma from '@/lib/prisma'
import {
  APP_CONFIG_BRANDING_LOGO_KEY,
  BrandingLogoConfigSchema,
  BRANDING_LOGO_UPLOAD_KEY,
} from '@/schemas/branding.schema'
import { invalidateSmeLogoCache } from '@/lib/ami-brand'

const ALLOWED_LOGO_MIME = new Set(['image/png', 'image/jpeg', 'image/webp'])
const MAX_LOGO_BYTES = 2 * 1024 * 1024

function extForMime(mime: string): string {
  if (mime === 'image/jpeg') return 'jpg'
  if (mime === 'image/webp') return 'webp'
  return 'png'
}

export type BrandingLogoSettings = {
  source: 'default' | 'upload'
  logoUrl: string
  fileKey: string | null
  updatedAt: string | null
  originalFilename: string | null
}

export async function getBrandingLogoSettings(): Promise<{
  success: boolean
  settings?: BrandingLogoSettings
  error?: string
}> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return { success: false, error: 'No autenticado' }
  if (!isAdminLike(session.user.role)) {
    return { success: false, error: 'Se requiere rol ADMIN o SUPERADMIN' }
  }

  const row = await prisma.appConfig.findUnique({
    where: { key: APP_CONFIG_BRANDING_LOGO_KEY },
  })

  if (!row?.value) {
    return {
      success: true,
      settings: {
        source: 'default',
        logoUrl: '/api/branding/logo',
        fileKey: null,
        updatedAt: null,
        originalFilename: null,
      },
    }
  }

  const parsed = BrandingLogoConfigSchema.safeParse(row.value)
  if (!parsed.success) {
    return {
      success: true,
      settings: {
        source: 'default',
        logoUrl: '/api/branding/logo',
        fileKey: null,
        updatedAt: null,
        originalFilename: null,
      },
    }
  }

  return {
    success: true,
    settings: {
      source: 'upload',
      logoUrl: `/api/branding/logo?v=${encodeURIComponent(parsed.data.updatedAt)}`,
      fileKey: parsed.data.fileKey,
      updatedAt: parsed.data.updatedAt,
      originalFilename: parsed.data.originalFilename ?? null,
    },
  }
}

export async function uploadBrandingLogo(formData: FormData): Promise<{
  success: boolean
  settings?: BrandingLogoSettings
  error?: string
}> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { success: false, error: 'No autenticado' }
  if (!isAdminLike(session.user.role)) {
    return { success: false, error: 'Se requiere rol ADMIN o SUPERADMIN' }
  }

  const file = formData.get('logo')
  if (!(file instanceof File) || file.size === 0) {
    return { success: false, error: 'Selecciona un archivo de imagen' }
  }
  if (!ALLOWED_LOGO_MIME.has(file.type)) {
    return { success: false, error: 'Formato no permitido. Usa PNG, JPG o WebP.' }
  }
  if (file.size > MAX_LOGO_BYTES) {
    return { success: false, error: 'El archivo supera 2 MB' }
  }

  const ext = extForMime(file.type)
  const fileKey = `${BRANDING_LOGO_UPLOAD_KEY}.${ext}`

  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
  const uploadForm = new FormData()
  uploadForm.append('file', file, file.name)
  uploadForm.append('key', fileKey)

  let uploadOk = false
  try {
    const res = await fetch(`${apiBase}/api/v1/upload-only`, {
      method: 'POST',
      body: uploadForm,
    })
    if (res.ok) {
      const json = (await res.json()) as { status?: string; key?: string }
      uploadOk = json.status === 'success' && !!json.key
    }
  } catch {
    uploadOk = false
  }

  if (!uploadOk) {
    return {
      success: false,
      error: 'No se pudo guardar el logo en almacenamiento. Verifica que el backend esté activo.',
    }
  }

  const updatedAt = new Date().toISOString()
  const value = {
    fileKey,
    updatedAt,
    originalFilename: file.name,
  }

  await prisma.appConfig.upsert({
    where: { key: APP_CONFIG_BRANDING_LOGO_KEY },
    create: {
      key: APP_CONFIG_BRANDING_LOGO_KEY,
      value,
      updatedBy: session.user.id,
    },
    update: {
      value,
      updatedBy: session.user.id,
    },
  })

  invalidateSmeLogoCache()
  revalidatePath('/admin/settings')
  revalidatePath('/login')

  return {
    success: true,
    settings: {
      source: 'upload',
      logoUrl: `/api/branding/logo?v=${encodeURIComponent(updatedAt)}`,
      fileKey,
      updatedAt,
      originalFilename: file.name,
    },
  }
}

export async function resetBrandingLogo(): Promise<{
  success: boolean
  settings?: BrandingLogoSettings
  error?: string
}> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { success: false, error: 'No autenticado' }
  if (!isAdminLike(session.user.role)) {
    return { success: false, error: 'Se requiere rol ADMIN o SUPERADMIN' }
  }

  await prisma.appConfig.deleteMany({
    where: { key: APP_CONFIG_BRANDING_LOGO_KEY },
  })

  invalidateSmeLogoCache()
  revalidatePath('/admin/settings')
  revalidatePath('/login')

  return {
    success: true,
    settings: {
      source: 'default',
      logoUrl: '/api/branding/logo',
      fileKey: null,
      updatedAt: null,
      originalFilename: null,
    },
  }
}
