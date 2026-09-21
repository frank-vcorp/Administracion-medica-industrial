/**
 * Enmascara una región rectangular en PNG (p. ej. quitar marca Sibelmed).
 */
import { PNG } from 'pngjs'

export type PngMaskRect = {
  leftRatio: number
  topRatio: number
  widthRatio: number
  heightRatio: number
}

/** Oculta la marca "SIBELMED W20s" en informes W20s rasterizados. */
export const SIBELMED_BRAND_MASK: PngMaskRect = {
  leftRatio: 0.58,
  topRatio: 0.11,
  widthRatio: 0.4,
  heightRatio: 0.045,
}

export function maskPngRect(
  pngBuffer: Buffer,
  region: PngMaskRect,
  fill: { r: number; g: number; b: number; a?: number } = { r: 255, g: 255, b: 255, a: 255 },
): Buffer {
  const src = PNG.sync.read(pngBuffer)
  const { width, height, data } = src

  const x0 = Math.max(0, Math.floor(width * region.leftRatio))
  const y0 = Math.max(0, Math.floor(height * region.topRatio))
  const x1 = Math.min(width, Math.ceil(x0 + width * region.widthRatio))
  const y1 = Math.min(height, Math.ceil(y0 + height * region.heightRatio))
  const alpha = fill.a ?? 255

  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const idx = (width * y + x) << 2
      data[idx] = fill.r
      data[idx + 1] = fill.g
      data[idx + 2] = fill.b
      data[idx + 3] = alpha
    }
  }

  return PNG.sync.write(src)
}
