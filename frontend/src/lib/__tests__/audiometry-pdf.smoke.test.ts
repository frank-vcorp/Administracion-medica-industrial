/**
 * El PDF institucional cabe en una hoja. Las gráficas sólo entran si
 * llega el recorte del archivo subido; no se redibujan.
 */
import { describe, it, expect } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import {
  buildAudiometriaPdfData,
  generateAudiometriaValidatedPdf,
} from '@/lib/audiometry-pdf'

const TINY_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

const estudio = {
  reviewId: 'smoke-audio',
  doctorStatus: 'REVIEWED_ACCEPTED' as const,
  doctorDiagnosis: 'Umbrales dentro de lo esperado.',
  doctorNotes: null,
  doctorRecommendations: 'Nuevo estudio en un año.',
  reviewCreatedAt: new Date('2026-03-02T15:00:00.000Z'),
  prediagnosisData: {},
  extractionStructuredData: {
    estudio: { fecha_estudio: '02/03/2026' },
    oido_derecho: { va: { 500: 20, 1000: 20, 2000: 20, 3000: 20 } },
    oido_izquierdo: { va: { 500: 10, 1000: 10, 2000: 10, 3000: 10 } },
  },
  studyName: 'Audiometría',
  studyType: 'Audiometria',
  patient: {
    firstName: 'Ana',
    lastName: 'López',
    universalId: 'TRAB-100',
    companyName: 'Norte Industrial',
  },
  medico: {
    fullName: 'Dra. Marta Ruiz',
    professionalLicense: '9988776',
    signatureImageUrl: TINY_PNG,
  },
  logoDataUrl: null,
}

describe('audiometry PDF smoke — formato institucional', () => {
  it('sin recorte no inventa gráficas y cabe en una carta', async () => {
    const data = buildAudiometriaPdfData(estudio)
    expect(data.sourceCropDataUrl).toBeNull()
    const result = await generateAudiometriaValidatedPdf({
      reviewId: 'smoke-audio',
      data,
    })
    expect(result.buffer.subarray(0, 5).toString()).toBe('%PDF-')
    const pdf = await PDFDocument.load(result.buffer)
    expect(pdf.getPageCount()).toBe(1)
    expect(result.buffer.toString('latin1')).not.toContain('Cervantes')
  })

  it('inserta el recorte recibido y cabe en una carta', async () => {
    const data = buildAudiometriaPdfData({
      ...estudio,
      reviewId: 'smoke-audio-crop',
      sourceCropDataUrl: TINY_PNG,
      sourceCropAspectRatio: 2.1,
    })
    expect(data.sourceCropDataUrl).toBe(TINY_PNG)
    const result = await generateAudiometriaValidatedPdf({
      reviewId: 'smoke-audio-crop',
      data,
    })
    const pdf = await PDFDocument.load(result.buffer)
    expect(pdf.getPageCount()).toBe(1)
    expect(result.buffer.length).toBeGreaterThan(1000)
  })
})
