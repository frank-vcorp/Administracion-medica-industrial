/**
 * Lectura de archivos clínicos vía backend `/api/files` (Vercel-safe).
 * Extraído de zip-cierre-clinico para reutilizar en ZIP y adjuntos.
 */
import { dictamenBackendUrl } from '@/lib/dictamen-pdf'

export function resolveBackendFileUrl(
  fileUrl: string | null | undefined,
  baseUrl: string = dictamenBackendUrl(),
): string | null {
  if (!fileUrl || typeof fileUrl !== 'string') return null
  const trimmed = fileUrl.trim()
  if (trimmed.length === 0) return null

  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return null
  if (trimmed.includes('..')) return null

  const base = baseUrl.replace(/\/+$/, '')

  if (trimmed.startsWith('/api/files/')) {
    return `${base}${trimmed}`
  }
  if (trimmed.startsWith('/uploads/')) {
    const key = trimmed.slice('/uploads/'.length)
    return `${base}/api/files/${key}`
  }
  if (trimmed.startsWith('/')) {
    return null
  }
  return `${base}/api/files/${trimmed}`
}

export async function tryReadSourceFromBackend(
  fileUrl: string | null | undefined,
  baseUrl: string = dictamenBackendUrl(),
  fetchImpl: typeof fetch = (...args) => globalThis.fetch(...args),
): Promise<Uint8Array | null> {
  const url = resolveBackendFileUrl(fileUrl, baseUrl)
  if (!url) return null
  try {
    const res = await fetchImpl(url, { cache: 'no-store' })
    if (!res.ok) return null
    const buf = await res.arrayBuffer()
    return new Uint8Array(buf)
  } catch {
    return null
  }
}
