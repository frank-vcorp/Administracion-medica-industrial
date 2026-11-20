/**
 * Genera el PDF «ESTUDIO DE AUDIOMETRIA» y comprueba que cabe en una hoja.
 * Sin recorte, el PDF dibuja las dos gráficas a partir de los umbrales.
 */
import { describe, it, expect } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import {
  buildAudiometriaPdfData,
  generateAudiometriaValidatedPdf,
} from '@/lib/audiometry-pdf'

const TINY_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

describe('audiometry PDF smoke — formato de referencia', () => {
  it('sin recorte dibuja las gráficas y cabe en una carta', async () => {
    const data = buildAudiometriaPdfData({
      reviewId: 'smoke-audio',
      doctorStatus: 'REVIEWED_ACCEPTED',
      doctorDiagnosis: 'CAÍDA DEL UMBRAL DE AUDICIÓN BILATERAL EN 4000 HZ',
      doctorNotes: null,
      doctorRecommendations: 'Audiometría de seguimiento cada año',
      reviewCreatedAt: new Date('2025-11-26T20:39:00.000Z'),
      prediagnosisData: {},
      extractionStructuredData: {
        oido_derecho: { va: { 500: 15, 1000: 15, 2000: 10, 3000: 20, 4000: 35 } },
        oido_izquierdo: { va: { 500: 10, 1000: 5, 2000: 15, 3000: 30, 4000: 25 } },
        campos_fuente: {
          faringe: 'Sin datos patológicos',
          cad: 'permeable',
          cai: 'permeable',
          mtd: 'íntegra, aspecto normal',
          mti: 'íntegra, aspecto normal',
        },
        diagnostico_nosologico_od: 'Hipoacusia Neurosensorial',
        diagnostico_nosologico_oi: 'Hipoacusia Neurosensorial',
        diagnostico_etiologico: 'Secundario a Trauma Acústico crónico por ruido',
        clasificacion_hipoacusia_od: 'Leve',
        clasificacion_hipoacusia_oi: 'Leve',
      },
      studyName: 'Audiometría',
      studyType: 'Audiometria',
      patient: {
        firstName: 'Damián',
        lastName: 'Cervante Celedón',
        universalId: 'VALIANT29',
      },
      medico: {
        fullName: 'Erika Rodríguez López',
        professionalLicense: '4039862',
        signatureImageUrl: TINY_PNG,
      },
      logoDataUrl: null,
    })

    expect(data.sourceCropDataUrl).toBeNull()
    const result = await generateAudiometriaValidatedPdf({
      reviewId: 'smoke-audio',
      data,
    })
    expect(result.buffer.subarray(0, 5).toString()).toBe('%PDF-')
    const pdf = await PDFDocument.load(result.buffer)
    expect(pdf.getPageCount()).toBe(1)
  })

  it('con recorte del audiograma también cabe en una carta', async () => {
    const data = buildAudiometriaPdfData({
      reviewId: 'smoke-audio-crop',
      doctorStatus: 'REVIEWED_ACCEPTED',
      doctorDiagnosis: 'Audición dentro de rango.',
      doctorNotes: null,
      reviewCreatedAt: new Date('2025-11-26T20:39:00.000Z'),
      prediagnosisData: {},
      extractionStructuredData: {
        oido_derecho: { va: { 500: 10, 1000: 5, 2000: 10, 3000: 15 } },
        oido_izquierdo: { va: { 500: 10, 1000: 10, 2000: 5, 3000: 10 } },
      },
      studyName: 'Audiometría',
      studyType: 'Audiometria',
      patient: { firstName: 'Francisco', lastName: 'Saavedra' },
      medico: {
        fullName: 'Erika Rodríguez López',
        professionalLicense: '4039862',
        signatureImageUrl: '',
      },
      logoDataUrl: null,
      sourceCropDataUrl: TINY_PNG,
      sourceCropAspectRatio: 2.1,
    })
    const result = await generateAudiometriaValidatedPdf({
      reviewId: 'smoke-audio-crop',
      data,
    })
    const pdf = await PDFDocument.load(result.buffer)
    expect(pdf.getPageCount()).toBe(1)
    expect(result.buffer.length).toBeGreaterThan(1000)
  })
})
