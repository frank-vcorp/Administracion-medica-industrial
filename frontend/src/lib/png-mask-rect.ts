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

/**
 * Regiones a enmascarar en informes Sibelmed W20s rasterizados (150 DPI, crop 67%).
 * Calibrado con PDFs reales: logo superior derecho + texto "SIBELMED W20s" en tabla.
 */
export const SIBELMED_BRAND_MASKS: PngMaskRect[] = [
  /** Logo / wordmark Sibelmed (óvalo azul, esquina superior derecha). */
  {
    leftRatio: 0.6,
    topRatio: 0,
    widthRatio: 0.4,
    heightRatio: 0.22,
  },
  /** Texto "SIBELMED W20s" — fila de título ~34% altura (layout compacto). */
  {
    leftRatio: 0.5,
    topRatio: 0.325,
    widthRatio: 0.5,
    heightRatio: 0.035,
  },
  /** Texto "SIBELMED W20s" — fila de título ~51% altura (layout con logo grande). */
  {
    leftRatio: 0.55,
    topRatio: 0.495,
    widthRatio: 0.45,
    heightRatio: 0.035,
  },
]

/** @deprecated Preferir `SIBELMED_BRAND_MASKS`. */
export const SIBELMED_BRAND_MASK: PngMaskRect = SIBELMED_BRAND_MASKS[1]

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

export function maskPngRects(
  pngBuffer: Buffer,
  regions: PngMaskRect[],
  fill: { r: number; g: number; b: number; a?: number } = { r: 255, g: 255, b: 255, a: 255 },
): Buffer {
  return regions.reduce(
    (buf, region) => maskPngRect(buf, region, fill),
    pngBuffer,
  )
}
