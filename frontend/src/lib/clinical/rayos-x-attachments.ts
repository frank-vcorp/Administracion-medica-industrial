/**
 * Esquema Zod y helpers puros para adjuntos múltiples de Rayos X (multiproyección).
 * Módulo puro sin `'use server'` — reutilizable en cliente, server actions y rutas PDF.
 */
import { z } from 'zod'

export const RAYOS_X_ATTACHMENTS_SCHEMA_VERSION = 'rayos-x-attachments-v1' as const
export const RAYOS_X_MAX_FILES = 6
export const RAYOS_X_PROJECTION_PRESETS = [
  'AP',
  'LAT',
  'PA',
  'Oblicua',
  'Flexión',
  'Extensión',
  'Axial',
] as const

/** Verifica que una URL de archivo pertenezca al almacenamiento esperado (/api/files/ o /uploads/). */
export function isSafeUploadedFileUrl(url: string): boolean {
  if (typeof url !== 'string') return false
  const trimmed = url.trim()
  if (!trimmed) return false
  if (trimmed.includes('..') || trimmed.includes('\\')) return false
  if (/[\s\x00-\x1f\x7f?#]/.test(trimmed)) return false
  return (
    (trimmed.startsWith('/api/files/') && trimmed.length > '/api/files/'.length) ||
    (trimmed.startsWith('/uploads/') && trimmed.length > '/uploads/'.length)
  )
}

export const rayosXAttachmentItemSchema = z.object({
  url: z.string().min(1).refine(isSafeUploadedFileUrl, {
    message: 'URL de placa radiográfica inválida',
  }),
  fileName: z.string().trim().min(1).max(255),
  projectionLabel: z.string().trim().max(60).nullable().optional(),
  addedAt: z.string().optional(),
})

export const rayosXAttachmentsContextSchema = z.object({
  schemaVersion: z.literal(RAYOS_X_ATTACHMENTS_SCHEMA_VERSION),
  files: z
    .array(rayosXAttachmentItemSchema)
    .min(1)
    .max(RAYOS_X_MAX_FILES),
})

export type RayosXAttachmentItem = z.infer<typeof rayosXAttachmentItemSchema>
export type RayosXAttachmentsContext = z.infer<typeof rayosXAttachmentsContextSchema>

const PROJECTION_TOKEN_MAP: Record<string, string> = {
  AP: 'AP',
  PA: 'PA',
  LAT: 'LAT',
  LATERAL: 'LAT',
  OBL: 'Oblicua',
  OBLICUA: 'Oblicua',
  OBLICUO: 'Oblicua',
  FLEX: 'Flexión',
  FLEXION: 'Flexión',
  EXT: 'Extensión',
  EXTENSION: 'Extensión',
  AXIAL: 'Axial',
}

/**
 * Infiere la etiqueta de proyección desde el nombre del archivo cuando aparece
 * exactamente una proyección inequívoca (si hay 0 o 2+ distintas, retorna null).
 */
export function inferRayosXProjectionLabel(fileName: string): string | null {
  if (typeof fileName !== 'string' || !fileName.trim()) return null
  const baseName = fileName.split('/').pop() ?? fileName
  const withoutExt = baseName.replace(/\.[^.]+$/, '')
  const normalized = withoutExt
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
  const tokens = normalized.split(/[^A-Z0-9]+/).filter(Boolean)

  const matched: string[] = []
  for (const token of tokens) {
    const mapped = PROJECTION_TOKEN_MAP[token]
    if (mapped && !matched.includes(mapped)) {
      matched.push(mapped)
    }
  }
  return matched.length === 1 ? matched[0] : null
}

/** Type guard seguro para distinguir adjuntos Rayos X de otros clinicalContext (cuestionarios). */
export function isRayosXAttachmentsContext(
  value: unknown,
): value is RayosXAttachmentsContext {
  return rayosXAttachmentsContextSchema.safeParse(value).success
}

/**
 * Lee los adjuntos de Rayos X desde `clinicalContext` o, por compatibilidad con
 * estudios históricos de una sola placa, reconstruye la lista desde `fallbackFileUrl`.
 */
export function parseRayosXAttachments(
  clinicalContext: unknown,
  fallbackFileUrl?: string | null,
): RayosXAttachmentItem[] {
  const parsed = rayosXAttachmentsContextSchema.safeParse(clinicalContext)
  if (parsed.success) {
    const seen = new Set<string>()
    const deduped: RayosXAttachmentItem[] = []
    for (const item of parsed.data.files) {
      if (seen.has(item.url)) continue
      seen.add(item.url)
      deduped.push({
        url: item.url,
        fileName: item.fileName,
        projectionLabel: item.projectionLabel?.trim() || null,
        addedAt: item.addedAt,
      })
    }
    if (deduped.length > 0) return deduped
  }

  if (typeof fallbackFileUrl === 'string' && isSafeUploadedFileUrl(fallbackFileUrl.trim())) {
    const cleanUrl = fallbackFileUrl.trim()
    const rawName = cleanUrl.split('/').pop() || 'radiografia'
    return [
      {
        url: cleanUrl,
        fileName: rawName,
        projectionLabel: inferRayosXProjectionLabel(rawName),
      },
    ]
  }

  return []
}

/** Construye el payload versionado para `EventTest.clinicalContext`, o `null` si queda vacío. */
export function buildRayosXAttachmentsContext(
  files: RayosXAttachmentItem[],
): RayosXAttachmentsContext | null {
  if (!Array.isArray(files) || files.length === 0) return null
  const seen = new Set<string>()
  const cleaned: RayosXAttachmentItem[] = []
  for (const f of files) {
    if (!f || !isSafeUploadedFileUrl(f.url)) continue
    if (seen.has(f.url)) continue
    seen.add(f.url)
    const label = typeof f.projectionLabel === 'string' ? f.projectionLabel.trim() : null
    cleaned.push({
      url: f.url.trim(),
      fileName: f.fileName.trim() || f.url.split('/').pop() || 'radiografia',
      projectionLabel: label || null,
      ...(f.addedAt ? { addedAt: f.addedAt } : {}),
    })
    if (cleaned.length >= RAYOS_X_MAX_FILES) break
  }
  if (cleaned.length === 0) return null
  return {
    schemaVersion: RAYOS_X_ATTACHMENTS_SCHEMA_VERSION,
    files: cleaned,
  }
}

/** Resume las etiquetas de proyección únicas no vacías en orden de carga (ej. `'AP, LAT'`). */
export function formatRayosXProjectionsSummary(
  files: RayosXAttachmentItem[],
): string | null {
  if (!Array.isArray(files) || files.length === 0) return null
  const seen = new Set<string>()
  const labels: string[] = []
  for (const item of files) {
    const raw = item.projectionLabel?.trim()
    if (!raw) continue
    const key = raw.toUpperCase()
    if (seen.has(key)) continue
    seen.add(key)
    labels.push(raw)
  }
  return labels.length > 0 ? labels.join(', ') : null
}
