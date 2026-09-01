/**
 * Recorte fijo de la zona superior del PDF Sibelmed W20s (tabla + gráficas).
 * @see context/RD2026/ESPIROMETRIA.pdf
 */
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, writeFile, rm, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import sharp from 'sharp'
import type { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import {
  resolveBackendFileUrl,
} from '@/lib/zip-cierre-clinico'

const execFileAsync = promisify(execFile)

export const SIBELMED_W20S_TOP_CROP_RATIO = 0.67
export const ESPIROMETRY_CROP_SUBDIR = 'espirometry-crops'
const REPO_UPLOAD_DIR = path.join(process.cwd(), '..', 'uploads')

export type EspirometrySourceCropMeta = {
  relativePath: string
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

/** Recorta la parte superior (equipo) de la primera página del PDF fuente. */
export async function cropEspirometrySourceTopFromPdf(
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
    const meta = await sharp(fullPage).metadata()
    const width = meta.width ?? 0
    const height = meta.height ?? 0
    if (width <= 0 || height <= 0) {
      throw new Error('No se pudo leer la página del PDF fuente')
    }

    const cropHeight = Math.max(1, Math.round(height * cropRatio))
    return await sharp(fullPage)
      .extract({ left: 0, top: 0, width, height: cropHeight })
      .png()
      .toBuffer()
  } finally {
    await rm(tempDir, { recursive: true, force: true })
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
  return {
    relativePath: `${ESPIROMETRY_CROP_SUBDIR}/${filename}`,
    templateId: 'sibelmed-w20s',
    generatedAt: new Date().toISOString(),
  }
}

export async function loadEspirometrySourceCropDataUrl(
  relativePath: string,
): Promise<string | null> {
  try {
    const abs = path.join(REPO_UPLOAD_DIR, relativePath)
    const buf = await readFile(abs)
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
): Promise<EspirometrySourceCropMeta | null> {
  const eventTest = await prisma.eventTest.findUnique({
    where: { id: eventTestId },
    select: {
      id: true,
      fileUrl: true,
      clinicalContext: true,
      testNameSnapshot: true,
      test: { select: { code: true, category: { select: { name: true } } } },
    },
  })

  if (!eventTest?.fileUrl) return null

  const ctx = eventTest.clinicalContext as Record<string, unknown> | null
  const existing = ctx?.espirometrySourceCrop as EspirometrySourceCropMeta | undefined
  if (existing?.relativePath) {
    return existing
  }

  const fileUrl = eventTest.fileUrl
  if (!fileUrl.toLowerCase().includes('.pdf') && !fileUrl.includes('pdf')) {
    return null
  }

  const pdfBytes = await readEventTestSourcePdfBytes(fileUrl)
  if (!pdfBytes) return null

  const pngBuffer = await cropEspirometrySourceTopFromPdf(pdfBytes)
  const meta = await persistEspirometrySourceCropPng(eventTestId, pngBuffer)

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
