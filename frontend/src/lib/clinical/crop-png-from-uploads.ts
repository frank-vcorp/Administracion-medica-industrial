/**
 * PNG de recorte servido por el volumen estático de Railway.
 * `/api/files/...` redirige a una URL firmada que responde 403
 * (SignatureDoesNotMatch) y no sirve para embeber la gráfica.
 */
export function isPngBuffer(buf: Buffer): boolean {
  return (
    buf.length > 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  )
}

export function cropUploadsUrl(relativePath: string): string | null {
  const base = (
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.BACKEND_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    ''
  ).replace(/\/+$/, '')
  const trimmed = relativePath.trim().replace(/^\/+/, '')
  if (!base || !trimmed || trimmed.includes('..')) return null
  return `${base}/uploads/${trimmed.split('/').map(encodeURIComponent).join('/')}`
}

export async function readCropPngFromUploads(
  relativePath: string,
  userAgent = 'AMI-Crop/1.0',
): Promise<Buffer | null> {
  const url = cropUploadsUrl(relativePath)
  if (!url) return null
  try {
    const resp = await fetch(url, {
      cache: 'no-store',
      redirect: 'manual',
      headers: { 'User-Agent': userAgent },
    })
    if (!resp.ok) return null
    const buf = Buffer.from(await resp.arrayBuffer())
    return isPngBuffer(buf) ? buf : null
  } catch {
    return null
  }
}
