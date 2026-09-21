import { describe, it, expect } from 'vitest'
import { PNG } from 'pngjs'
import { maskPngRect, SIBELMED_BRAND_MASKS } from '@/lib/png-mask-rect'

describe('maskPngRect', () => {
  it('pinta blanco la región indicada', () => {
    const src = new PNG({ width: 100, height: 100 })
    for (let i = 0; i < src.data.length; i += 4) {
      src.data[i] = 10
      src.data[i + 1] = 20
      src.data[i + 2] = 30
      src.data[i + 3] = 255
    }
    const input = PNG.sync.write(src)
    const out = maskPngRect(input, {
      leftRatio: 0.5,
      topRatio: 0.5,
      widthRatio: 0.2,
      heightRatio: 0.2,
    })
    const masked = PNG.sync.read(out)
    const idx = (100 * 55 + 55) << 2
    expect(masked.data[idx]).toBe(255)
    expect(masked.data[idx + 1]).toBe(255)
    expect(masked.data[idx + 2]).toBe(255)
    expect(masked.data[0]).toBe(10)
  })

  it('exporta máscaras Sibelmed con ratios válidos', () => {
    expect(SIBELMED_BRAND_MASKS.length).toBeGreaterThanOrEqual(2)
    for (const mask of SIBELMED_BRAND_MASKS) {
      expect(mask.leftRatio).toBeGreaterThanOrEqual(0)
      expect(mask.topRatio).toBeGreaterThanOrEqual(0)
      expect(mask.widthRatio).toBeGreaterThan(0)
      expect(mask.heightRatio).toBeGreaterThan(0)
    }
  })
})
