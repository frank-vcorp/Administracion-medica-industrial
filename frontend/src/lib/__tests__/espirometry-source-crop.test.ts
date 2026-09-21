import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { PNG } from 'pngjs'
import {
  ESPIROMETRY_LETTER_BOTTOM_Y0_RATIO,
  ESPIROMETRY_LETTER_HEIGHT_PT,
  ESPIROMETRY_LETTER_BOTTOM_CLIP_PT,
} from '@/lib/espirometry-letter-clip'
import {
  cropEspirometryLetterBottomHalfFromPdfLocal,
  extractLetterBottomHalfFromFullPagePng,
  bottomHalfCropFromSourcePng,
} from '@/lib/espirometry-source-crop'

const SAMPLE_PDF = path.join(
  process.cwd(),
  '..',
  'context',
  'PACIENTES',
  '167555 - CARRAZCO SUAREZ ALVARO RX0001',
  'espiro.pdf',
)

function hasPdftoppm(): boolean {
  try {
    execFileSync('which', ['pdftoppm'])
    return true
  } catch {
    return false
  }
}

describe('espirometry letter bottom clip', () => {
  it('constantes carta mitad inferior 396→792 pt', () => {
    expect(ESPIROMETRY_LETTER_BOTTOM_CLIP_PT).toEqual({
      x0: 0,
      y0: 396,
      x1: 612,
      y1: 792,
    })
    expect(ESPIROMETRY_LETTER_BOTTOM_Y0_RATIO).toBe(396 / ESPIROMETRY_LETTER_HEIGHT_PT)
  })

  it.skipIf(!hasPdftoppm() || !existsSync(SAMPLE_PDF))(
    'cropEspirometryLetterBottomHalfFromPdfLocal recorta mitad inferior ancho completo',
    async () => {
      const pdfBytes = readFileSync(SAMPLE_PDF)
      const bottom = await cropEspirometryLetterBottomHalfFromPdfLocal(pdfBytes)
      const parsed = PNG.sync.read(bottom)

      const tempDir = require('node:fs').mkdtempSync('/tmp/ami-espiro-full-')
      const pdfPath = `${tempDir}/s.pdf`
      const prefix = `${tempDir}/p`
      require('node:fs').writeFileSync(pdfPath, pdfBytes)
      execFileSync('pdftoppm', ['-png', '-r', '150', '-f', '1', '-l', '1', pdfPath, prefix])
      const full = PNG.sync.read(readFileSync(`${prefix}-1.png`))

      expect(parsed.width).toBe(full.width)
      expect(parsed.height).toBe(Math.floor(full.height / 2))
      expect(parsed.width / parsed.height).toBeCloseTo(612 / 396, 1)
    },
  )

  it('extractLetterBottomHalfFromFullPagePng conserva ancho', () => {
    const src = new PNG({ width: 612, height: 792 })
    for (let i = 0; i < src.data.length; i += 4) {
      src.data[i] = 10
      src.data[i + 1] = 20
      src.data[i + 2] = 30
      src.data[i + 3] = 255
    }
    const input = PNG.sync.write(src)
    const out = extractLetterBottomHalfFromFullPagePng(input)
    const parsed = PNG.sync.read(out)
    expect(parsed.width).toBe(612)
    expect(parsed.height).toBe(396)
  })

  it('bottomHalfCropFromSourcePng devuelve data URL', () => {
    const src = new PNG({ width: 100, height: 200 })
    const input = PNG.sync.write(src)
    const crop = bottomHalfCropFromSourcePng(input)
    expect(crop.dataUrl.startsWith('data:image/png;base64,')).toBe(true)
    expect(crop.aspectRatio).toBeCloseTo(100 / 100, 5)
  })
})
