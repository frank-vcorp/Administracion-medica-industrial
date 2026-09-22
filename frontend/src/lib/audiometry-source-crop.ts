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
import { resolveBackendFileUrl } from '@/lib/zip-cierre-clinico'

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
  const remoteUrl = resolveBackendFileUrl(fileRef)
  if (!remoteUrl) return null

  try {
    const resp = await fetch(remoteUrl, {
      headers: { 'User-Agent': 'AMI-Audiometry-Crop/1.0' },
    })
    if (!resp.ok) return null
    return Buffer.from(await resp.arrayBuffer())
  } catch {
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
): Promise<AudiometrySourceCropMeta | null> {
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

  const pdfBytes = await readEventTestSourcePdfBytes(fileUrl)
  if (!pdfBytes) return null

  let meta: AudiometrySourceCropMeta | null = null
  try {
    const pngBuffer = await cropAudiometryAudiogramFromPdfLocal(pdfBytes)
    meta = await persistAudiometrySourceCropPng(eventTestId, pngBuffer)
  } catch (err) {
    console.warn('[audiometry-crop] Recorte local falló:', err)
    return null
  }

  await prisma.eventTest.update({
    where: { id: eventTestId },
    data: {
      clinicalContext: mergeClinicalContext(eventTest.clinicalContext, {
        audiometrySourceCrop: meta,
      }) as Prisma.InputJsonValue,
    },
  })

  return meta
}

export async function resolveAudiometryCropMeta(input: {
  eventTestId?: string | null
  clinicalContext?: unknown
}): Promise<AudiometrySourceCropMeta | null> {
  const ctx = input.clinicalContext as Record<string, unknown> | null | undefined
  const fromCtx = ctx?.audiometrySourceCrop as AudiometrySourceCropMeta | undefined
  if (fromCtx?.relativePath) {
    const preview = await loadAudiometrySourceCrop(fromCtx)
    if (preview) return fromCtx
  }

  if (!input.eventTestId) return null

  try {
    const meta = await ensureAudiometrySourceCrop(input.eventTestId)
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
}): Promise<{ dataUrl: string | null; aspectRatio: number | null }> {
  if (input.sourceCropDataUrl) {
    return {
      dataUrl: input.sourceCropDataUrl,
      aspectRatio: input.sourceCropAspectRatio ?? null,
    }
  }

  const meta = await resolveAudiometryCropMeta({
    eventTestId: input.eventTestId,
    clinicalContext: input.clinicalContext,
  })
  if (!meta) return { dataUrl: null, aspectRatio: null }
  const crop = await loadAudiometrySourceCrop(meta)
  return {
    dataUrl: crop?.dataUrl ?? null,
    aspectRatio: crop?.aspectRatio ?? null,
  }
}

export function audiogramBandFromSourcePng(fullPagePng: Buffer): AudiometrySourceImageCrop {
  return toSourceImageCrop(extractDd65AudiogramBandFromFullPagePng(fullPagePng))
}
