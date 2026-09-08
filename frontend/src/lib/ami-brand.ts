import { readFile } from 'node:fs/promises'
import path from 'node:path'
import prisma from '@/lib/prisma'
import {
  APP_CONFIG_BRANDING_LOGO_KEY,
  BrandingLogoConfigSchema,
  type BrandingLogoConfig,
} from '@/schemas/branding.schema'
import {
  SME_LOGO_FILENAME,
  BRANDING_LOGO_API_PATH,
  AMI_LOGO_URL,
} from '@/lib/brand-constants'

export {
  SME_BRAND_LINE,
  SME_LOGO_FALLBACK_TEXT,
  SME_LOGO_FILENAME,
  SME_LOGO_PUBLIC_PATH,
  BRANDING_LOGO_API_PATH,
  AMI_LOGO_URL,
} from '@/lib/brand-constants'

const REPO_UPLOAD_DIR = path.join(process.cwd(), '..', 'uploads')

let smeLogoCache: string | null = null
let smeLogoCacheKey: string | null = null

export function invalidateSmeLogoCache(): void {
  smeLogoCache = null
  smeLogoCacheKey = null
}

async function loadBrandingLogoConfig(): Promise<BrandingLogoConfig | null> {
  try {
    const row = await prisma.appConfig.findUnique({
      where: { key: APP_CONFIG_BRANDING_LOGO_KEY },
    })
    if (!row?.value) return null
    const parsed = BrandingLogoConfigSchema.safeParse(row.value)
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

async function readBytesFromUploads(fileKey: string): Promise<Buffer | null> {
  try {
    return await readFile(path.join(REPO_UPLOAD_DIR, fileKey))
  } catch {
    return null
  }
}

async function readBytesFromBackend(fileKey: string): Promise<Buffer | null> {
  const base = process.env.NEXT_PUBLIC_API_URL
  if (!base) return null
  try {
    const res = await fetch(`${base}/api/files/${encodeURIComponent(fileKey)}`, {
      cache: 'no-store',
    })
    if (!res.ok) return null
    return Buffer.from(await res.arrayBuffer())
  } catch {
    return null
  }
}

async function readDefaultBundledLogo(): Promise<Buffer | null> {
  try {
    return await readFile(path.join(process.cwd(), 'public', 'branding', SME_LOGO_FILENAME))
  } catch {
    return null
  }
}

function mimeFromKey(fileKey: string): string {
  const lower = fileKey.toLowerCase()
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
  if (lower.endsWith('.webp')) return 'image/webp'
  return 'image/png'
}

export async function resolveBrandingLogoBytes(): Promise<{
  buffer: Buffer | null
  mime: string
  cacheKey: string
}> {
  const config = await loadBrandingLogoConfig()
  if (config?.fileKey) {
    const fromDisk = await readBytesFromUploads(config.fileKey)
    if (fromDisk) {
      return { buffer: fromDisk, mime: mimeFromKey(config.fileKey), cacheKey: config.updatedAt }
    }
    const fromBackend = await readBytesFromBackend(config.fileKey)
    if (fromBackend) {
      return { buffer: fromBackend, mime: mimeFromKey(config.fileKey), cacheKey: config.updatedAt }
    }
  }

  const bundled = await readDefaultBundledLogo()
  return { buffer: bundled, mime: 'image/png', cacheKey: 'default' }
}

export async function resolveSmeLogoDataUrl(): Promise<string | null> {
  const { buffer, mime, cacheKey } = await resolveBrandingLogoBytes()
  if (cacheKey === smeLogoCacheKey && smeLogoCache !== null) {
    return smeLogoCache
  }
  if (!buffer) {
    smeLogoCache = null
    smeLogoCacheKey = cacheKey
    return null
  }
  smeLogoCache = `data:${mime};base64,${buffer.toString('base64')}`
  smeLogoCacheKey = cacheKey
  return smeLogoCache
}

export const resolveAmiLogoDataUrl = resolveSmeLogoDataUrl
