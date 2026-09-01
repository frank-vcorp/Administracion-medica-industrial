/**
 * Recorte superior de PNG sin dependencias nativas (compatible Vercel).
 */
import { PNG } from 'pngjs'

/** Devuelve los bytes PNG recortados desde y=0 hasta cropRatio * height. */
export function cropPngTop(pngBuffer: Buffer, cropRatio: number): Buffer {
  const src = PNG.sync.read(pngBuffer)
  const width = src.width
  const height = src.height
  if (width <= 0 || height <= 0) {
    throw new Error('No se pudo leer dimensiones del PNG fuente')
  }

  const cropHeight = Math.max(1, Math.round(height * cropRatio))
  const dst = new PNG({ width, height: cropHeight })

  for (let y = 0; y < cropHeight; y++) {
    const rowBytes = width << 2
    const srcStart = y * rowBytes
    const dstStart = y * rowBytes
    src.data.copy(dst.data, dstStart, srcStart, srcStart + rowBytes)
  }

  return PNG.sync.write(dst)
}
