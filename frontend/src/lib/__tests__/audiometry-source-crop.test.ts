import { describe, expect, it, vi } from 'vitest'
import { PNG } from 'pngjs'
import {
  AUDIOMETRY_DD65_AUDIOGRAM_Y0_RATIO,
  AUDIOMETRY_DD65_AUDIOGRAM_Y1_RATIO,
} from '@/lib/audiometry-dd65-clip'
import {
  audiogramBandFromSourcePng,
  extractDd65AudiogramBandFromFullPagePng,
  loadAudiometrySourceCrop,
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

  it('carga el PNG desde /uploads cuando /api/files no entrega la imagen', async () => {
    const png = PNG.sync.write(new PNG({ width: 12, height: 8, filterType: -1 }))
    const previous = process.env.NEXT_PUBLIC_API_URL
    process.env.NEXT_PUBLIC_API_URL = 'https://backend.test'
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes('/uploads/audiometry-crops/')) {
        return {
          ok: true,
          arrayBuffer: async () =>
            png.buffer.slice(png.byteOffset, png.byteOffset + png.byteLength),
        }
      }
      return { ok: false, status: 403, arrayBuffer: async () => new ArrayBuffer(0) }
    })
    vi.stubGlobal('fetch', fetchMock)
    try {
      const crop = await loadAudiometrySourceCrop({
        relativePath: 'audiometry-crops/et-uploads.png',
        fileUrl: '/api/files/audiometry-crops/et-uploads.png',
      })
      expect(crop?.dataUrl.startsWith('data:image/png;base64,')).toBe(true)
      expect(String(fetchMock.mock.calls[0][0])).toBe(
        'https://backend.test/uploads/audiometry-crops/et-uploads.png',
      )
    } finally {
      vi.unstubAllGlobals()
      if (previous === undefined) delete process.env.NEXT_PUBLIC_API_URL
      else process.env.NEXT_PUBLIC_API_URL = previous
    }
  })
})
