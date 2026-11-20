/**
 * Resuelve el PDF de entrega por EventTest para el ZIP de cierre clínico.
 */
import { promises as fs } from 'fs'
import path from 'path'
import { tryReadSourceFromBackend } from '@/lib/clinical/backend-file-read'
import { isExamenMedicoTestName } from '@/lib/clinical/examen-medico-variant'

const REPO_UPLOAD_DIR = path.join(process.cwd(), '..', 'uploads')

export type EventTestForZipPdf = {
  id: string
  status: string
  testNameSnapshot: string | null
  fileUrl: string | null
  /** PDF que el médico subió para el análisis. */
  sourceFileUrl: string | null
  sourceFileName: string | null
  validatedPdfUrl: string | null
}

function sanitizeFilenamePart(value: string): string {
  return value.replace(/[^\w.\-áéíóúñÁÉÍÓÚÑ ]+/gi, '_').slice(0, 80)
}

async function readPersistedPdfBytes(relativePath: string): Promise<Uint8Array | null> {
  const rel = relativePath.replace(/^\/+/, '')
  const abs = path.join(REPO_UPLOAD_DIR, rel)
  try {
    const buf = await fs.readFile(abs)
    return new Uint8Array(buf)
  } catch {
    const viaUploads = `/uploads/${rel}`
    const viaFiles = rel.includes('/') ? `/api/files/${rel}` : `/api/files/${rel}`
    return (
      (await tryReadSourceFromBackend(viaUploads)) ??
      (await tryReadSourceFromBackend(viaFiles))
    )
  }
}

/**
 * PDF validado por estudio. El dictamen general va aparte en `01_Dictamen_General/`.
 */
export async function resolveEventTestPdfForZip(
  test: EventTestForZipPdf,
): Promise<{ filename: string; data: Uint8Array } | null> {
  if (test.status === 'CANCELLED') return null

  const label = sanitizeFilenamePart(test.testNameSnapshot ?? 'estudio')
  const name = test.testNameSnapshot ?? ''

  // Examen médico largo: `resolveExamenMedicoEntregablePdfForEvent` en el ZIP
  // (no mezclar con el PDF de resumen/dictamen en `01_Dictamen_General/`).
  if (isExamenMedicoTestName(name)) {
    return null
  }

  if (test.validatedPdfUrl) {
    const data = await readPersistedPdfBytes(test.validatedPdfUrl)
    if (data) {
      const base = path.basename(test.validatedPdfUrl)
      const filename = base.toLowerCase().endsWith('.pdf') ? base : `${label}.pdf`
      return { filename, data }
    }
  }

  if (test.fileUrl) {
    const bytes = await tryReadSourceFromBackend(test.fileUrl)
    if (bytes) {
      const ext = test.fileUrl.split('.').pop()?.toLowerCase()
      const suffix =
        ext && ['pdf', 'xml'].includes(ext) ? `.${ext}` : '.pdf'
      return { filename: `${label}${suffix}`, data: bytes }
    }

    const trimmed = test.fileUrl.trim()
    if (trimmed.startsWith('/uploads/')) {
      try {
        const abs = path.join(REPO_UPLOAD_DIR, trimmed.slice('/uploads/'.length))
        const buf = await fs.readFile(abs)
        return { filename: `${label}.pdf`, data: new Uint8Array(buf) }
      } catch {
        return null
      }
    }
  }

  return null
}

function sourceFilename(test: EventTestForZipPdf, label: string): string {
  const raw = (test.sourceFileName || '').trim()
  if (raw) {
    const base = path.basename(raw)
    if (base) return `fuente-${sanitizeFilenamePart(base)}`
  }
  const fromUrl = (test.sourceFileUrl || test.fileUrl || '').split('?')[0]
  const base = path.basename(fromUrl)
  if (base && base.includes('.')) return `fuente-${sanitizeFilenamePart(base)}`
  return `fuente-${label}.pdf`
}

/** Informe generado y, aparte, el archivo que se subió para analizarlo. */
export async function resolveEventTestFilesForZip(
  test: EventTestForZipPdf,
): Promise<Array<{ filename: string; data: Uint8Array }>> {
  const generated = await resolveEventTestPdfForZip(test)
  const files: Array<{ filename: string; data: Uint8Array }> = []
  if (generated) {
    files.push({
      filename: generated.filename.startsWith('fuente-')
        ? generated.filename
        : `informe-${generated.filename}`,
      data: generated.data,
    })
  }

  const sourceUrl = (test.sourceFileUrl || '').trim() || (test.fileUrl || '').trim()
  if (!sourceUrl || sourceUrl === (test.validatedPdfUrl || '').trim()) return files

  const label = sanitizeFilenamePart(test.testNameSnapshot ?? 'estudio')
  const bytes =
    (await tryReadSourceFromBackend(sourceUrl)) ??
    (sourceUrl.startsWith('/uploads/')
      ? await readPersistedPdfBytes(sourceUrl.slice('/uploads/'.length))
      : null)
  if (bytes && bytes.length > 0) {
    files.push({ filename: sourceFilename(test, label), data: bytes })
  }
  return files
}
