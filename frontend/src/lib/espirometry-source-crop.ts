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
import { cropPngTop } from '@/lib/png-crop-top'
import { resolveBackendFileUrl } from '@/lib/zip-cierre-clinico'

const execFileAsync = promisify(execFile)

export const SIBELMED_W20S_TOP_CROP_RATIO = 0.67
export const ESPIROMETRY_CROP_SUBDIR = 'espirometry-crops'
const REPO_UPLOAD_DIR = path.join(process.cwd(), '..', 'uploads')

export type EspirometrySourceCropMeta = {
  relativePath: string
  fileUrl?: string
  templateId: 'sibelmed-w20s'
  generatedAt: string
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
    return cropPngTop(fullPage, cropRatio)
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
      templateId: 'sibelmed-w20s',
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
    templateId: 'sibelmed-w20s',
    generatedAt: new Date().toISOString(),
  }
}

export async function loadEspirometrySourceCropDataUrl(
  meta: Pick<EspirometrySourceCropMeta, 'relativePath' | 'fileUrl'>,
): Promise<string | null> {
  try {
    const abs = path.join(REPO_UPLOAD_DIR, meta.relativePath)
    const buf = await readFile(abs)
    return `data:image/png;base64,${buf.toString('base64')}`
  } catch {
    // Producción: PNG en Railway/S3
  }

  const fileRef = meta.fileUrl ?? `/api/files/${meta.relativePath}`
  const remoteUrl = resolveBackendFileUrl(fileRef)
  if (!remoteUrl) return null

  try {
    const resp = await fetch(remoteUrl, {
      headers: { 'User-Agent': 'AMI-Espirometry-Crop/1.0' },
    })
    if (!resp.ok) return null
    const buf = Buffer.from(await resp.arrayBuffer())
    return `data:image/png;base64,${buf.toString('base64')}`
  } catch {
    return null
  }
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
  if (existing?.relativePath && !options?.force) {
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
