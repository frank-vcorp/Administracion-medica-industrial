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
import { extractGraphsFromSourceCropPng } from '@/lib/espirometry-source-crop'

const CROP_PATH = path.join(
  process.cwd(),
  '..',
  'uploads',
  '_test-crop',
  'espirometry-top.png',
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
    let cropBuf: Buffer
    try {
      await access(CROP_PATH)
      cropBuf = await readFile(CROP_PATH)
    } catch {
      // Generar recorte mínimo si no existe (CI sin pdftoppm)
      cropBuf = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
        'base64',
      )
    }

    const graphsBuf = extractGraphsFromSourceCropPng(cropBuf)
    const graphsCropDataUrl = `data:image/png;base64,${graphsBuf.toString('base64')}`
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
          paciente: { nombre_completo: 'Patricio Peña', edad_anios: 34 },
          calidad: {
            repetibilidad_fvc_ml: 30,
            repetibilidad_fev1_ml: 40,
            pico_maximo: 'SI',
            calidad: 'A',
          },
          parametros: [
            {
              label: 'FVC',
              key: 'fvc_l',
              m1: 2.3,
              m2: 2.33,
              m3: 2.26,
              ref: 3.32,
              lln: 2.69,
            },
          ],
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
      graphsCropDataUrl,
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
