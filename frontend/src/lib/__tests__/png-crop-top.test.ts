import { describe, it, expect } from 'vitest'
import { PNG } from 'pngjs'
import { cropPngTop } from '@/lib/png-crop-top'

describe('cropPngTop', () => {
  it('recorta la fracción superior del PNG', () => {
    const src = new PNG({ width: 4, height: 4 })
    for (let i = 0; i < src.data.length; i += 4) {
      src.data[i] = 255
      src.data[i + 1] = 0
      src.data[i + 2] = 0
      src.data[i + 3] = 255
    }
    const input = PNG.sync.write(src)
    const out = cropPngTop(input, 0.5)
    const cropped = PNG.sync.read(out)
    expect(cropped.width).toBe(4)
    expect(cropped.height).toBe(2)
  })
})
