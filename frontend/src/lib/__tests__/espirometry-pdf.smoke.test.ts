/**
 * Smoke test local: genera PDF híbrido con recorte de referencia RD2026.
 * Ejecutar: npm test -- --run src/lib/__tests__/espirometry-pdf.smoke.test.ts
 */
import { describe, it, expect } from 'vitest'
import { readFile, writeFile, mkdir, access } from 'node:fs/promises'
import path from 'node:path'
import { PDFDocument } from 'pdf-lib'
import {
  buildEspirometryPdfData,
  generateEspirometryValidatedPdf,
} from '@/lib/espirometry-pdf'
import { cropEspirometryLetterBottomHalfFromPdfLocal } from '@/lib/espirometry-source-crop'

const SAMPLE_PDF = path.join(
  process.cwd(),
  '..',
  'context',
  'PACIENTES',
  '167555 - CARRAZCO SUAREZ ALVARO RX0001',
  'espiro.pdf',
)
const OUT_PATH = path.join(
  process.cwd(),
  '..',
  'uploads',
  '_test-crop',
  'espirometry-hybrid-test.pdf',
)

describe('espirometry PDF smoke — layout híbrido', () => {
  it('genera PDF con recorte Sibelmed + bloque AMI', async () => {
    let bottomHalfCrop: { dataUrl: string; aspectRatio: number }
    try {
      await access(SAMPLE_PDF)
      const pdfBuf = await readFile(SAMPLE_PDF)
      const pngBuf = await cropEspirometryLetterBottomHalfFromPdfLocal(pdfBuf)
      bottomHalfCrop = {
        dataUrl: `data:image/png;base64,${pngBuf.toString('base64')}`,
        aspectRatio: 612 / 407,
      }
    } catch {
      bottomHalfCrop = {
        dataUrl:
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
        aspectRatio: 1,
      }
    }
    const data = buildEspirometryPdfData({
      reviewId: 'smoke-hybrid',
      doctorStatus: 'REVIEWED_ACCEPTED',
      doctorDiagnosis: 'Patrón espirométrico normal.',
      doctorNotes: null,
      doctorRecommendations: 'Control en 12 meses.',
      reviewCreatedAt: new Date('2026-09-01T17:00:00.000Z'),
      prediagnosisData: { recommendation: 'Control en 12 meses.' },
      extractionStructuredData: {
        extracted_data: {
          calidad: {
            repetibilidad_fvc_ml: 30,
            repetibilidad_fev1_ml: 40,
            pico_maximo: 'SI',
            calidad: 'A',
          },
        },
      },
      studyName: 'Espirometría',
      studyType: 'Espirometria',
      patient: {
        firstName: 'Patricio',
        lastName: 'Peña',
        universalId: 'SMOKE-001',
        companyName: 'AMI',
      },
      medico: {
        fullName: 'Dr. Prueba',
        professionalLicense: '1234567',
        signatureImageUrl:
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      },
      logoDataUrl: null,
      sourceCropDataUrl: bottomHalfCrop.dataUrl,
      sourceCropAspectRatio: bottomHalfCrop.aspectRatio,
    })

    const result = await generateEspirometryValidatedPdf({
      reviewId: 'smoke-hybrid',
      data,
    })

    expect(result.buffer.length).toBeGreaterThan(1000)
    expect(result.hash).toMatch(/^sha256:/)
    const pdf = await PDFDocument.load(result.buffer)
    expect(pdf.getPageCount()).toBe(1)

    await mkdir(path.dirname(OUT_PATH), { recursive: true })
    await writeFile(OUT_PATH, result.buffer)
    console.log(`[smoke] PDF escrito en ${OUT_PATH} (${result.buffer.length} bytes)`)
  })
})
