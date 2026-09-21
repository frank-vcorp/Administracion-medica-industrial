import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'node:fs'
import path from 'node:path'
import {
  cropEspirometrySourceTopFromPdfLocal,
  detectTableGraphsBandStart,
  extractTableAndGraphsFromSourceCropPng,
  extractGraphsFromSourceCropPng,
  extractBottomHalfFromSourceCropPng,
  bottomHalfCropFromSourcePng,
  graphsCropFromSourcePng,
  stripSibelmedBrandFromPng,
  SIBELMED_TABLE_GRAPHS_BAND_START_COMPACT,
  SIBELMED_TABLE_GRAPHS_BAND_START_LOGO,
} from '@/lib/espirometry-source-crop'

const SAMPLE_PDF = path.join(
  process.cwd(),
  '..',
  'context',
  'PACIENTES',
  '167555 - CARRAZCO SUAREZ ALVARO RX0001',
  'espiro.pdf',
)
const SAMPLE_PDF_LOGO = path.join(
  process.cwd(),
  '..',
  'context',
  'datos AMI',
  'Espirometria-OEXJ-19860808-M-AMI-CLI.pdf',
)

function hasPdftoppm(): boolean {
  try {
    execFileSync('which', ['pdftoppm'])
    return true
  } catch {
    return false
  }
}

function ocrContainsSibelmed(pngBuffer: Buffer): boolean {
  const tmp = `/tmp/ami-espiro-mask-${process.pid}.png`
  const out = `/tmp/ami-espiro-mask-${process.pid}`
  try {
    writeFileSync(tmp, pngBuffer)
    execFileSync('tesseract', [tmp, out, '-l', 'spa+eng'], { stdio: 'ignore' })
    const text = readFileSync(`${out}.txt`, 'utf8').toUpperCase()
    return text.includes('SIBELMED')
  } catch {
    return false
  } finally {
    try {
      unlinkSync(tmp)
      unlinkSync(`${out}.txt`)
    } catch {
      // ignore
    }
  }
}

describe('stripSibelmedBrandFromPng', () => {
  it.skipIf(!hasPdftoppm() || !existsSync(SAMPLE_PDF))(
    'elimina texto SIBELMED de un PDF real',
    async () => {
      const pdfBytes = readFileSync(SAMPLE_PDF)
      const cropped = await cropEspirometrySourceTopFromPdfLocal(pdfBytes)
      expect(ocrContainsSibelmed(cropped)).toBe(false)
    },
  )

  it.skipIf(!hasPdftoppm() || !existsSync(SAMPLE_PDF))(
    'detectTableGraphsBandStart elige layout compacto',
    async () => {
      const pdfBytes = readFileSync(SAMPLE_PDF)
      const cropped = await cropEspirometrySourceTopFromPdfLocal(pdfBytes)
      expect(detectTableGraphsBandStart(cropped)).toBe(
        SIBELMED_TABLE_GRAPHS_BAND_START_COMPACT,
      )
    },
  )

  it.skipIf(!hasPdftoppm() || !existsSync(SAMPLE_PDF_LOGO))(
    'detectTableGraphsBandStart elige layout con logo grande',
    async () => {
      const pdfBytes = readFileSync(SAMPLE_PDF_LOGO)
      const cropped = await cropEspirometrySourceTopFromPdfLocal(pdfBytes)
      expect(detectTableGraphsBandStart(cropped)).toBe(
        SIBELMED_TABLE_GRAPHS_BAND_START_LOGO,
      )
    },
  )

  it.skipIf(!hasPdftoppm() || !existsSync(SAMPLE_PDF))(
    'extractTableAndGraphsFromSourceCropPng recorta banda más ancha que alta',
    async () => {
      const pdfBytes = readFileSync(SAMPLE_PDF)
      const cropped = await cropEspirometrySourceTopFromPdfLocal(pdfBytes)
      const band = extractTableAndGraphsFromSourceCropPng(cropped)
      const { PNG } = await import('pngjs')
      const full = PNG.sync.read(cropped)
      const parsed = PNG.sync.read(band)
      expect(parsed.width / parsed.height).toBeGreaterThan(1.5)
      expect(parsed.height).toBeLessThan(full.height)
    },
  )

  it.skipIf(!hasPdftoppm() || !existsSync(SAMPLE_PDF))(
    'extractBottomHalfFromSourceCropPng toma la mitad inferior del recorte',
    async () => {
      const pdfBytes = readFileSync(SAMPLE_PDF)
      const cropped = await cropEspirometrySourceTopFromPdfLocal(pdfBytes)
      const bottom = extractBottomHalfFromSourceCropPng(cropped)
      const { PNG } = await import('pngjs')
      const full = PNG.sync.read(cropped)
      const parsed = PNG.sync.read(bottom)
      expect(parsed.width).toBe(full.width)
      expect(parsed.height).toBe(Math.floor(full.height / 2))
      const crop = bottomHalfCropFromSourcePng(cropped)
      expect(crop.dataUrl.startsWith('data:image/png;base64,')).toBe(true)
    },
  )

  it.skipIf(!hasPdftoppm() || !existsSync(SAMPLE_PDF))(
    'extractGraphsFromSourceCropPng deja banda ancha con ambas curvas',
    async () => {
      const pdfBytes = readFileSync(SAMPLE_PDF)
      const cropped = await cropEspirometrySourceTopFromPdfLocal(pdfBytes)
      const band = extractGraphsFromSourceCropPng(cropped)
      const { PNG } = await import('pngjs')
      const parsed = PNG.sync.read(band)
      expect(parsed.width / parsed.height).toBeGreaterThan(2)
      const crop = graphsCropFromSourcePng(cropped)
      expect(crop.aspectRatio).toBeGreaterThan(2)
      expect(crop.dataUrl.startsWith('data:image/png;base64,')).toBe(true)
    },
  )

  it('stripSibelmedBrandFromPng es idempotente', () => {
    const input = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    )
    const once = stripSibelmedBrandFromPng(input)
    const twice = stripSibelmedBrandFromPng(once)
    expect(twice.equals(once)).toBe(true)
  })
})
