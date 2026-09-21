/**
 * Recorte fijo mitad inferior del PDF fuente Sibelmed — carta 612×792 pt.
 * Clip: (0, 396) → (612, 792), ancho completo.
 * Producción: Railway /api/v2/event-tests/espirometry-source-crop (poppler).
 * Desarrollo local: pdftoppm + pngjs.
 */
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, writeFile, rm, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import type { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { PNG } from 'pngjs'
import { cropPngBand } from '@/lib/png-crop-band'
import { resolveBackendFileUrl } from '@/lib/zip-cierre-clinico'
import {
  ESPIROMETRY_LETTER_BOTTOM_Y0_RATIO,
  ESPIROMETRY_LETTER_BOTTOM_Y1_RATIO,
  ESPIROMETRY_SOURCE_CROP_TEMPLATE_ID,
} from '@/lib/espirometry-letter-clip'

const execFileAsync = promisify(execFile)

/** @deprecated Recorte legacy 67% superior — ya no se usa en PDF validado. */
export const SIBELMED_W20S_TOP_CROP_RATIO = 0.67

export type EspirometrySourceImageCrop = {
  dataUrl: string
  aspectRatio: number
}

export const ESPIROMETRY_CROP_SUBDIR = 'espirometry-crops'
const REPO_UPLOAD_DIR = path.join(process.cwd(), '..', 'uploads')
const ESPIROMETRY_RENDER_DPI = 150

export type EspirometrySourceCropMeta = {
  relativePath: string
  fileUrl?: string
  templateId:
    | 'sibelmed-w20s'
    | 'sibelmed-w20s-v2'
    | 'sibelmed-letter-bottom-v1'
  generatedAt: string
}

/** Mitad inferior de una página carta ya rasterizada (ancho intacto). */
export function extractLetterBottomHalfFromFullPagePng(pngBuffer: Buffer): Buffer {
  return cropPngBand(
    pngBuffer,
    ESPIROMETRY_LETTER_BOTTOM_Y0_RATIO,
    ESPIROMETRY_LETTER_BOTTOM_Y1_RATIO,
  )
}

function toSourceImageCrop(band: Buffer, fallbackAspect = 1.55): EspirometrySourceImageCrop {
  const parsed = PNG.sync.read(band)
  const aspectRatio =
    parsed.height > 0 ? parsed.width / parsed.height : fallbackAspect
  return {
    dataUrl: `data:image/png;base64,${band.toString('base64')}`,
    aspectRatio,
  }
}

async function readSourceCropPngBuffer(
  meta: Pick<EspirometrySourceCropMeta, 'relativePath' | 'fileUrl'>,
): Promise<Buffer | null> {
  try {
    const abs = path.join(REPO_UPLOAD_DIR, meta.relativePath)
    return await readFile(abs)
  } catch {
    // Producción: PNG remoto
  }

  const fileRef = meta.fileUrl ?? `/api/files/${meta.relativePath}`
  const remoteUrl = resolveBackendFileUrl(fileRef)
  if (!remoteUrl) return null

  try {
    const resp = await fetch(remoteUrl, {
      headers: { 'User-Agent': 'AMI-Espirometry-Crop/1.0' },
    })
    if (!resp.ok) return null
    return Buffer.from(await resp.arrayBuffer())
  } catch {
    return null
  }
}

function resolveLocalUploadPath(fileUrl: string): string | null {
  const trimmed = fileUrl.trim()
  if (!trimmed || trimmed.includes('..')) return null
  if (trimmed.startsWith('/api/files/')) {
    return path.join(REPO_UPLOAD_DIR, trimmed.slice('/api/files/'.length))
  }
  if (trimmed.startsWith('/uploads/')) {
    return path.join(REPO_UPLOAD_DIR, trimmed.slice('/uploads/'.length))
  }
  if (!trimmed.startsWith('/')) {
    return path.join(REPO_UPLOAD_DIR, trimmed)
  }
  return null
}

export async function readEventTestSourcePdfBytes(
  fileUrl: string,
): Promise<Buffer | null> {
  const localPath = resolveLocalUploadPath(fileUrl)
  if (localPath) {
    try {
      return await readFile(localPath)
    } catch {
      // fallback HTTP
    }
  }

  const remoteUrl = resolveBackendFileUrl(fileUrl)
  if (!remoteUrl) return null

  try {
    const resp = await fetch(remoteUrl, {
      headers: { 'User-Agent': 'AMI-Espirometry-Crop/1.0' },
    })
    if (!resp.ok) return null
    const ct = resp.headers.get('content-type') ?? ''
    if (!ct.includes('pdf') && !fileUrl.toLowerCase().endsWith('.pdf')) {
      return null
    }
    return Buffer.from(await resp.arrayBuffer())
  } catch {
    return null
  }
}

/** Rasteriza página 1 completa y recorta (0,396)→(612,792) pt. */
export async function cropEspirometryLetterBottomHalfFromPdfLocal(
  pdfBuffer: Buffer,
): Promise<Buffer> {
  const tempDir = await mkdtemp(path.join(tmpdir(), 'ami-espiro-crop-'))
  const pdfPath = path.join(tempDir, 'source.pdf')
  const prefix = path.join(tempDir, 'page')

  try {
    await writeFile(pdfPath, pdfBuffer)
    await execFileAsync('pdftoppm', [
      '-png',
      '-r',
      String(ESPIROMETRY_RENDER_DPI),
      '-f',
      '1',
      '-l',
      '1',
      pdfPath,
      prefix,
    ])

    const pngPath = `${prefix}-1.png`
    const fullPage = await readFile(pngPath)
    return extractLetterBottomHalfFromFullPagePng(fullPage)
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
}

/** @deprecated Usar cropEspirometryLetterBottomHalfFromPdfLocal. */
export const cropEspirometrySourceTopFromPdfLocal =
  cropEspirometryLetterBottomHalfFromPdfLocal

async function cropViaBackend(
  eventTestId: string,
  fileUrl: string,
): Promise<EspirometrySourceCropMeta | null> {
  const apiBase =
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.BACKEND_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    ''

  const endpoint = apiBase
    ? `${apiBase.replace(/\/+$/, '')}/api/v2/event-tests/espirometry-source-crop`
    : '/api/v2/event-tests/espirometry-source-crop'

  try {
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'AMI-Espirometry-Crop/1.0',
      },
      body: JSON.stringify({
        event_test_id: eventTestId,
        file_url: fileUrl,
      }),
    })

    if (!resp.ok) {
      console.warn(
        '[espirometry-crop] Backend respondió',
        resp.status,
        await resp.text().catch(() => ''),
      )
      return null
    }

    const payload = (await resp.json()) as {
      status?: string
      relative_path?: string
      file_url?: string
      template_id?: string
      generated_at?: string
    }

    if (payload.status !== 'success' || !payload.relative_path) {
      return null
    }

    return {
      relativePath: payload.relative_path,
      fileUrl: payload.file_url ?? `/api/files/${payload.relative_path}`,
      templateId: ESPIROMETRY_SOURCE_CROP_TEMPLATE_ID,
      generatedAt: payload.generated_at ?? new Date().toISOString(),
    }
  } catch (err) {
    console.warn('[espirometry-crop] Backend no disponible:', err)
    return null
  }
}

export async function persistEspirometrySourceCropPng(
  eventTestId: string,
  pngBuffer: Buffer,
): Promise<EspirometrySourceCropMeta> {
  const dir = path.join(REPO_UPLOAD_DIR, ESPIROMETRY_CROP_SUBDIR)
  await mkdir(dir, { recursive: true })
  const filename = `${eventTestId}.png`
  await writeFile(path.join(dir, filename), pngBuffer)
  const relativePath = `${ESPIROMETRY_CROP_SUBDIR}/${filename}`
  return {
    relativePath,
    fileUrl: `/api/files/${relativePath}`,
    templateId: ESPIROMETRY_SOURCE_CROP_TEMPLATE_ID,
    generatedAt: new Date().toISOString(),
  }
}

/** PNG persistido = mitad inferior lista para el PDF validado. */
export async function loadEspirometryBottomHalfCrop(
  meta: Pick<EspirometrySourceCropMeta, 'relativePath' | 'fileUrl'>,
): Promise<EspirometrySourceImageCrop | null> {
  const buf = await readSourceCropPngBuffer(meta)
  if (!buf) return null
  return toSourceImageCrop(buf)
}

export function bottomHalfCropFromSourcePng(fullPagePng: Buffer): EspirometrySourceImageCrop {
  return toSourceImageCrop(extractLetterBottomHalfFromFullPagePng(fullPagePng))
}

function mergeClinicalContext(
  existing: unknown,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const base =
    existing && typeof existing === 'object' && !Array.isArray(existing)
      ? (existing as Record<string, unknown>)
      : {}
  return { ...base, ...patch }
}

/** Genera y persiste el recorte inferior si hay PDF fuente de espirometría. */
export async function ensureEspirometrySourceCrop(
  eventTestId: string,
  options?: { force?: boolean },
): Promise<EspirometrySourceCropMeta | null> {
  const eventTest = await prisma.eventTest.findUnique({
    where: { id: eventTestId },
    select: {
      id: true,
      fileUrl: true,
      clinicalContext: true,
    },
  })

  if (!eventTest?.fileUrl) return null

  const ctx = eventTest.clinicalContext as Record<string, unknown> | null
  const existing = ctx?.espirometrySourceCrop as EspirometrySourceCropMeta | undefined
  const needsRegenerate =
    existing?.templateId !== ESPIROMETRY_SOURCE_CROP_TEMPLATE_ID ||
    options?.force === true
  if (existing?.relativePath && !needsRegenerate) {
    const preview = await loadEspirometryBottomHalfCrop(existing)
    if (preview) return existing
  }

  const fileUrl = eventTest.fileUrl
  if (!fileUrl.toLowerCase().includes('.pdf') && !fileUrl.includes('pdf')) {
    return null
  }

  let meta =
    (await cropViaBackend(eventTestId, fileUrl)) ??
    (await (async () => {
      const pdfBytes = await readEventTestSourcePdfBytes(fileUrl)
      if (!pdfBytes) return null
      try {
        const pngBuffer = await cropEspirometryLetterBottomHalfFromPdfLocal(pdfBytes)
        return await persistEspirometrySourceCropPng(eventTestId, pngBuffer)
      } catch (err) {
        console.warn('[espirometry-crop] Recorte local falló:', err)
        return null
      }
    })())

  if (!meta) return null

  await prisma.eventTest.update({
    where: { id: eventTestId },
    data: {
      clinicalContext: mergeClinicalContext(eventTest.clinicalContext, {
        espirometrySourceCrop: meta,
      }) as Prisma.InputJsonValue,
    },
  })

  return meta
}
