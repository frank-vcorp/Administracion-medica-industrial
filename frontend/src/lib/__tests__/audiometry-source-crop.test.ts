import { describe, it, expect } from 'vitest'
import { PNG } from 'pngjs'
import {
  AUDIOMETRY_DD65_AUDIOGRAM_Y0_RATIO,
  AUDIOMETRY_DD65_AUDIOGRAM_Y1_RATIO,
} from '@/lib/audiometry-dd65-clip'
import {
  audiogramBandFromSourcePng,
  extractDd65AudiogramBandFromFullPagePng,
} from '@/lib/audiometry-source-crop'

describe('audiometry-source-crop (DD65 audiogram band)', () => {
  it('extractDd65AudiogramBandFromFullPagePng recorta banda vertical esperada', () => {
    const full = PNG.sync.write(
      new PNG({ width: 100, height: 200, filterType: -1 }),
    )
    const band = extractDd65AudiogramBandFromFullPagePng(full)
    const parsed = PNG.sync.read(band)
    const expectedHeight =
      Math.ceil(200 * AUDIOMETRY_DD65_AUDIOGRAM_Y1_RATIO) -
      Math.floor(200 * AUDIOMETRY_DD65_AUDIOGRAM_Y0_RATIO)
    expect(parsed.width).toBe(100)
    expect(parsed.height).toBe(expectedHeight)
  })

  it('audiogramBandFromSourcePng devuelve data URL y aspect ratio', () => {
    const full = PNG.sync.write(
      new PNG({ width: 120, height: 240, filterType: -1 }),
    )
    const crop = audiogramBandFromSourcePng(full)
    expect(crop.dataUrl.startsWith('data:image/png;base64,')).toBe(true)
    expect(crop.aspectRatio).toBeGreaterThan(0)
  })
})
