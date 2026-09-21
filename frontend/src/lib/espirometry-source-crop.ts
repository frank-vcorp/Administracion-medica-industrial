/**
 * Recorte fijo de la zona superior del PDF Sibelmed W20s (tabla + gráficas).
 * Producción: Railway vía /api/v2/event-tests/espirometry-source-crop (poppler).
 * Desarrollo local: fallback con pdftoppm + pngjs.
 */
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, writeFile, rm, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import type { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { PNG } from 'pngjs'
import { cropPngTop } from '@/lib/png-crop-top'
import { cropPngBand } from '@/lib/png-crop-band'
import { maskPngRects, SIBELMED_BRAND_MASKS } from '@/lib/png-mask-rect'
import { resolveBackendFileUrl } from '@/lib/zip-cierre-clinico'

const execFileAsync = promisify(execFile)

export const SIBELMED_W20S_TOP_CROP_RATIO = 0.67
/** Banda inferior del recorte Sibelmed donde están flujo-volumen y volumen-tiempo. */
export const SIBELMED_GRAPHS_BAND_START = 0.48
export const SIBELMED_GRAPHS_BAND_END = 0.98
/** Banda tabla + gráficas (sin cabecera de paciente) — layout compacto Sibelmed. */
export const SIBELMED_TABLE_GRAPHS_BAND_START_COMPACT = 0.32
/** Banda tabla + gráficas — layout con logo grande arriba. */
export const SIBELMED_TABLE_GRAPHS_BAND_START_LOGO = 0.48
export const SIBELMED_TABLE_GRAPHS_BAND_END = 0.99

export type EspirometryTableGraphsCrop = {
  dataUrl: string
  aspectRatio: number
}
export const ESPIROMETRY_CROP_SUBDIR = 'espirometry-crops'
const REPO_UPLOAD_DIR = path.join(process.cwd(), '..', 'uploads')

export type EspirometrySourceCropMeta = {
  relativePath: string
  fileUrl?: string
  templateId: 'sibelmed-w20s' | 'sibelmed-w20s-v2'
  generatedAt: string
}

export function stripSibelmedBrandFromPng(pngBuffer: Buffer): Buffer {
  return maskPngRects(pngBuffer, SIBELMED_BRAND_MASKS)
}

export function extractGraphsFromSourceCropPng(pngBuffer: Buffer): Buffer {
  return cropPngBand(
    pngBuffer,
    SIBELMED_GRAPHS_BAND_START,
    SIBELMED_GRAPHS_BAND_END,
  )
}

function rowInkDensity(png: PNG, yRatio: number, heightRatio = 0.03): number {
  const { width, height, data } = png
  const y0 = Math.max(0, Math.floor(height * yRatio))
  const y1 = Math.min(height, Math.ceil(height * (yRatio + heightRatio)))
  let dark = 0
  let total = 0
  for (let y = y0; y < y1; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (width * y + x) << 2
      if (data[idx] < 240 || data[idx + 1] < 240 || data[idx + 2] < 240) dark++
      total++
    }
  }
  return total > 0 ? dark / total : 0
}

/** Detecta inicio de tabla según layout compacto vs. logo grande arriba. */
export function detectTableGraphsBandStart(pngBuffer: Buffer): number {
  const png = PNG.sync.read(pngBuffer)
  const upperBlock = rowInkDensity(png, 0.3)
  const gapBeforeTable = rowInkDensity(png, 0.48)
  if (upperBlock > 0.08 && gapBeforeTable < 0.05) {
    return SIBELMED_TABLE_GRAPHS_BAND_START_LOGO
  }
  return SIBELMED_TABLE_GRAPHS_BAND_START_COMPACT
}

/** Tabla de parámetros + repetibilidad ATS/ERS + ambas gráficas (como foto 2). */
export function extractTableAndGraphsFromSourceCropPng(pngBuffer: Buffer): Buffer {
  const start = detectTableGraphsBandStart(pngBuffer)
  return cropPngBand(pngBuffer, start, SIBELMED_TABLE_GRAPHS_BAND_END)
}

function toTableGraphsCrop(masked: Buffer): EspirometryTableGraphsCrop {
  const band = extractTableAndGraphsFromSourceCropPng(masked)
  const parsed = PNG.sync.read(band)
  const aspectRatio =
    parsed.height > 0 ? parsed.width / parsed.height : 1.72
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

/** Recorte local (solo dev / entornos con pdftoppm). */
export async function cropEspirometrySourceTopFromPdfLocal(
  pdfBuffer: Buffer,
  cropRatio = SIBELMED_W20S_TOP_CROP_RATIO,
): Promise<Buffer> {
  const tempDir = await mkdtemp(path.join(tmpdir(), 'ami-espiro-crop-'))
  const pdfPath = path.join(tempDir, 'source.pdf')
  const prefix = path.join(tempDir, 'page')

  try {
    await writeFile(pdfPath, pdfBuffer)
    await execFileAsync('pdftoppm', [
      '-png',
      '-r',
      '150',
      '-f',
      '1',
      '-l',
      '1',
      pdfPath,
      prefix,
    ])

    const pngPath = `${prefix}-1.png`
    const fullPage = await readFile(pngPath)
    const cropped = cropPngTop(fullPage, cropRatio)
    return stripSibelmedBrandFromPng(cropped)
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
}

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
      templateId: 'sibelmed-w20s-v2',
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
    templateId: 'sibelmed-w20s-v2',
    generatedAt: new Date().toISOString(),
  }
}

export async function loadEspirometrySourceCropDataUrl(
  meta: Pick<EspirometrySourceCropMeta, 'relativePath' | 'fileUrl'>,
): Promise<string | null> {
  const buf = await readSourceCropPngBuffer(meta)
  if (!buf) return null
  const masked = stripSibelmedBrandFromPng(buf)
  return `data:image/png;base64,${masked.toString('base64')}`
}

/** Gráficas flujo-volumen / volumen-tiempo recortadas del PDF fuente (sin marca Sibelmed). */
export async function loadEspirometryGraphsCropDataUrl(
  meta: Pick<EspirometrySourceCropMeta, 'relativePath' | 'fileUrl'>,
): Promise<string | null> {
  const buf = await readSourceCropPngBuffer(meta)
  if (!buf) return null
  const masked = stripSibelmedBrandFromPng(buf)
  const graphs = extractGraphsFromSourceCropPng(masked)
  return `data:image/png;base64,${graphs.toString('base64')}`
}

/** Tabla + gráficas del informe fuente, sin cabecera de paciente ni marca Sibelmed. */
export async function loadEspirometryTableGraphsCrop(
  meta: Pick<EspirometrySourceCropMeta, 'relativePath' | 'fileUrl'>,
): Promise<EspirometryTableGraphsCrop | null> {
  const buf = await readSourceCropPngBuffer(meta)
  if (!buf) return null
  const masked = stripSibelmedBrandFromPng(buf)
  return toTableGraphsCrop(masked)
}

export function tableGraphsCropFromSourcePng(pngBuffer: Buffer): EspirometryTableGraphsCrop {
  return toTableGraphsCrop(stripSibelmedBrandFromPng(pngBuffer))
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

/** Genera y persiste el recorte superior si hay PDF fuente de espirometría. */
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
    existing?.templateId !== 'sibelmed-w20s-v2' || options?.force === true
  if (existing?.relativePath && !needsRegenerate) {
    const preview = await loadEspirometrySourceCropDataUrl(existing)
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
        const pngBuffer = await cropEspirometrySourceTopFromPdfLocal(pdfBytes)
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
