/**
 * Recorte del audiograma tonal (DD65 V2 PDF) para el PDF validado AMI.
 * Misma estrategia que espirometría: persistir PNG en uploads + clinicalContext.
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
import {
  AUDIOMETRY_DD65_AUDIOGRAM_Y0_RATIO,
  AUDIOMETRY_DD65_AUDIOGRAM_Y1_RATIO,
  AUDIOMETRY_RENDER_DPI,
  AUDIOMETRY_SOURCE_CROP_TEMPLATE_ID,
} from '@/lib/audiometry-dd65-clip'
import { readEventTestSourcePdfBytes } from '@/lib/espirometry-source-crop'
import { tryReadSourceFromBackend } from '@/lib/clinical/backend-file-read'

const execFileAsync = promisify(execFile)

export type AudiometrySourceImageCrop = {
  dataUrl: string
  aspectRatio: number
}

export type AudiometrySourceCropMeta = {
  relativePath: string
  fileUrl?: string
  templateId: typeof AUDIOMETRY_SOURCE_CROP_TEMPLATE_ID
  generatedAt: string
}

/** PNG recién generado por Railway; solo en memoria del request actual. */
export type AudiometrySourceCropResult = AudiometrySourceCropMeta & {
  previewDataUrl?: string | null
}

export const AUDIOMETRY_CROP_SUBDIR = 'audiometry-crops'
const REPO_UPLOAD_DIR = path.join(process.cwd(), '..', 'uploads')

export function extractDd65AudiogramBandFromFullPagePng(pngBuffer: Buffer): Buffer {
  return cropPngBand(
    pngBuffer,
    AUDIOMETRY_DD65_AUDIOGRAM_Y0_RATIO,
    AUDIOMETRY_DD65_AUDIOGRAM_Y1_RATIO,
  )
}

function toSourceImageCrop(band: Buffer, fallbackAspect = 2.4): AudiometrySourceImageCrop {
  const parsed = PNG.sync.read(band)
  const aspectRatio =
    parsed.height > 0 ? parsed.width / parsed.height : fallbackAspect
  return {
    dataUrl: `data:image/png;base64,${band.toString('base64')}`,
    aspectRatio,
  }
}

async function readSourceCropPngBuffer(
  meta: Pick<AudiometrySourceCropMeta, 'relativePath' | 'fileUrl'>,
): Promise<Buffer | null> {
  try {
    const abs = path.join(REPO_UPLOAD_DIR, meta.relativePath)
    return await readFile(abs)
  } catch {
    // Producción: PNG remoto
  }

  const fileRef = meta.fileUrl ?? `/api/files/${meta.relativePath}`
  const bytes = await tryReadSourceFromBackend(fileRef)
  if (!bytes) return null
  return Buffer.from(bytes)
}

async function cropViaBackend(
  eventTestId: string,
  fileUrl: string,
): Promise<AudiometrySourceCropResult | null> {
  const apiBase =
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.BACKEND_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    ''

  const endpoint = apiBase
    ? `${apiBase.replace(/\/+$/, '')}/api/v2/event-tests/audiometry-source-crop`
    : '/api/v2/event-tests/audiometry-source-crop'

  try {
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'AMI-Audiometry-Crop/1.0',
      },
      body: JSON.stringify({
        event_test_id: eventTestId,
        file_url: fileUrl,
      }),
    })

    if (!resp.ok) {
      console.warn(
        '[audiometry-crop] Backend respondió',
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
      png_base64?: string
    }

    if (payload.status !== 'success' || !payload.relative_path) {
      return null
    }

    const previewDataUrl =
      typeof payload.png_base64 === 'string' && payload.png_base64.length > 0
        ? `data:image/png;base64,${payload.png_base64}`
        : null

    return {
      relativePath: payload.relative_path,
      fileUrl: payload.file_url ?? `/api/files/${payload.relative_path}`,
      templateId: AUDIOMETRY_SOURCE_CROP_TEMPLATE_ID,
      generatedAt: payload.generated_at ?? new Date().toISOString(),
      previewDataUrl,
    }
  } catch (err) {
    console.warn('[audiometry-crop] Backend no disponible:', err)
    return null
  }
}

export async function cropAudiometryAudiogramFromPdfLocal(
  pdfBuffer: Buffer,
): Promise<Buffer> {
  const tempDir = await mkdtemp(path.join(tmpdir(), 'ami-audio-crop-'))
  const pdfPath = path.join(tempDir, 'source.pdf')
  const prefix = path.join(tempDir, 'page')

  try {
    await writeFile(pdfPath, pdfBuffer)
    await execFileAsync('pdftoppm', [
      '-png',
      '-r',
      String(AUDIOMETRY_RENDER_DPI),
      '-f',
      '1',
      '-l',
      '1',
      pdfPath,
      prefix,
    ])

    const pngPath = `${prefix}-1.png`
    const fullPage = await readFile(pngPath)
    return extractDd65AudiogramBandFromFullPagePng(fullPage)
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
}

export async function persistAudiometrySourceCropPng(
  eventTestId: string,
  pngBuffer: Buffer,
): Promise<AudiometrySourceCropMeta> {
  const dir = path.join(REPO_UPLOAD_DIR, AUDIOMETRY_CROP_SUBDIR)
  await mkdir(dir, { recursive: true })
  const filename = `${eventTestId}.png`
  await writeFile(path.join(dir, filename), pngBuffer)
  const relativePath = `${AUDIOMETRY_CROP_SUBDIR}/${filename}`
  return {
    relativePath,
    fileUrl: `/api/files/${relativePath}`,
    templateId: AUDIOMETRY_SOURCE_CROP_TEMPLATE_ID,
    generatedAt: new Date().toISOString(),
  }
}

export async function loadAudiometrySourceCrop(
  meta: Pick<AudiometrySourceCropMeta, 'relativePath' | 'fileUrl'>,
): Promise<AudiometrySourceImageCrop | null> {
  const buf = await readSourceCropPngBuffer(meta)
  if (!buf) return null
  return toSourceImageCrop(buf)
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

export async function ensureAudiometrySourceCrop(
  eventTestId: string,
  options?: { force?: boolean },
): Promise<AudiometrySourceCropResult | null> {
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
  const existing = ctx?.audiometrySourceCrop as AudiometrySourceCropMeta | undefined
  const needsRegenerate =
    existing?.templateId !== AUDIOMETRY_SOURCE_CROP_TEMPLATE_ID ||
    options?.force === true
  if (existing?.relativePath && !needsRegenerate) {
    const preview = await loadAudiometrySourceCrop(existing)
    if (preview) return existing
  }

  const fileUrl = eventTest.fileUrl
  if (!fileUrl.toLowerCase().includes('.pdf') && !fileUrl.includes('pdf')) {
    return null
  }

  let meta: AudiometrySourceCropResult | null =
    (await cropViaBackend(eventTestId, fileUrl)) ??
    (await (async (): Promise<AudiometrySourceCropResult | null> => {
      const pdfBytes = await readEventTestSourcePdfBytes(fileUrl)
      if (!pdfBytes) return null
      try {
        const pngBuffer = await cropAudiometryAudiogramFromPdfLocal(pdfBytes)
        const persisted = await persistAudiometrySourceCropPng(eventTestId, pngBuffer)
        return {
          ...persisted,
          previewDataUrl: `data:image/png;base64,${pngBuffer.toString('base64')}`,
        }
      } catch (err) {
        console.warn('[audiometry-crop] Recorte local falló:', err)
        return null
      }
    })())

  if (!meta) return null

  const { previewDataUrl, ...persistedMeta } = meta

  await prisma.eventTest.update({
    where: { id: eventTestId },
    data: {
      clinicalContext: mergeClinicalContext(eventTest.clinicalContext, {
        audiometrySourceCrop: persistedMeta,
      }) as Prisma.InputJsonValue,
    },
  })

  return { ...persistedMeta, previewDataUrl }
}

function aspectRatioFromDataUrl(dataUrl: string): number | null {
  try {
    const idx = dataUrl.indexOf(',')
    if (idx < 0) return null
    const buf = Buffer.from(dataUrl.slice(idx + 1), 'base64')
    const parsed = PNG.sync.read(buf)
    return parsed.height > 0 ? parsed.width / parsed.height : null
  } catch {
    return null
  }
}

export async function resolveAudiometryCropMeta(input: {
  eventTestId?: string | null
  clinicalContext?: unknown
  forceRegenerate?: boolean
}): Promise<AudiometrySourceCropResult | null> {
  const ctx = input.clinicalContext as Record<string, unknown> | null | undefined
  const fromCtx = ctx?.audiometrySourceCrop as AudiometrySourceCropMeta | undefined
  if (fromCtx?.relativePath && !input.forceRegenerate) {
    const preview = await loadAudiometrySourceCrop(fromCtx)
    if (preview) return fromCtx
  }

  if (!input.eventTestId) return null

  try {
    const meta = await ensureAudiometrySourceCrop(input.eventTestId, {
      force: input.forceRegenerate === true,
    })
    return meta?.relativePath ? meta : null
  } catch (err) {
    console.warn('[audiometry-pdf] No se pudo generar recorte fuente:', err)
    return null
  }
}

export async function resolveAudiometrySourceCropForPdf(input: {
  eventTestId?: string | null
  clinicalContext?: unknown
  sourceCropDataUrl?: string | null
  sourceCropAspectRatio?: number | null
  forceRegenerate?: boolean
}): Promise<{ dataUrl: string | null; aspectRatio: number | null }> {
  if (input.sourceCropDataUrl) {
    return {
      dataUrl: input.sourceCropDataUrl,
      aspectRatio: input.sourceCropAspectRatio ?? null,
    }
  }

  const cropResult = await resolveAudiometryCropMeta({
    eventTestId: input.eventTestId,
    clinicalContext: input.clinicalContext,
    forceRegenerate: input.forceRegenerate,
  })
  if (!cropResult) return { dataUrl: null, aspectRatio: null }

  if (cropResult.previewDataUrl) {
    return {
      dataUrl: cropResult.previewDataUrl,
      aspectRatio: aspectRatioFromDataUrl(cropResult.previewDataUrl),
    }
  }

  const crop = await loadAudiometrySourceCrop(cropResult)
  return {
    dataUrl: crop?.dataUrl ?? null,
    aspectRatio: crop?.aspectRatio ?? null,
  }
}

export function audiogramBandFromSourcePng(fullPagePng: Buffer): AudiometrySourceImageCrop {
  return toSourceImageCrop(extractDd65AudiogramBandFromFullPagePng(fullPagePng))
}
