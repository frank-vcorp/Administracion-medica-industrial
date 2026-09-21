import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'node:fs'
import path from 'node:path'
import {
  cropEspirometrySourceTopFromPdfLocal,
  stripSibelmedBrandFromPng,
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
