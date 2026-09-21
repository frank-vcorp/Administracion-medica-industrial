/**
 * Recorte de banda vertical en PNG (p. ej. sólo gráficas espirométricas).
 */
import { PNG } from 'pngjs'

/** Extrae una franja vertical entre startRatio (inclusive) y endRatio (exclusive). */
export function cropPngBand(
  pngBuffer: Buffer,
  startRatio: number,
  endRatio: number,
): Buffer {
  const src = PNG.sync.read(pngBuffer)
  const { width, height, data } = src
  if (width <= 0 || height <= 0) {
    throw new Error('No se pudo leer dimensiones del PNG fuente')
  }

  const y0 = Math.max(0, Math.min(height - 1, Math.floor(height * startRatio)))
  const y1 = Math.max(y0 + 1, Math.min(height, Math.ceil(height * endRatio)))
  const bandHeight = y1 - y0
  const dst = new PNG({ width, height: bandHeight })
  const rowBytes = width << 2

  for (let y = 0; y < bandHeight; y++) {
    const srcStart = (y0 + y) * rowBytes
    const dstStart = y * rowBytes
    data.copy(dst.data, dstStart, srcStart, srcStart + rowBytes)
  }

  return PNG.sync.write(dst)
}
