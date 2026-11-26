import { createElement } from 'react'
import { describe, expect, it } from 'vitest'
import { renderToBuffer } from '@react-pdf/renderer'
import {
  buildRayosXFindingsParagraphs,
  formatRayosXLongDateEsMx,
  parseRayosXFromExtraction,
  parseRayosXImpressionItems,
  resolveRayosXStudyTypeLabel,
} from '@/lib/clinical/rayos-x-report'
import { RayosXValidatedPDF } from '@/components/pdf/RayosXValidatedPDF'

const TINY_PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

describe('rayos-x-report helpers y plantilla PDF SME', () => {
  it('parseRayosXFromExtraction separa hallazgos en enunciados limpios', () => {
    const parsed = parseRayosXFromExtraction({
      extracted_data: {
        hallazgos:
          'Estudio radiografico de columna lumbar en proyeccion lateral, Cifosis lumbar leve, Espacios discales intervertebrales lumbares con altura conservada, Sin fracturas ni alteraciones osteoarticulares evidentes',
        localizacion: 'Columna lumbar lateral (L SPINE)',
        fecha_estudio: '2025 Apr 01',
      },
    })

    expect(parsed).not.toBeNull()
    expect(parsed?.localizacion).toBe('Columna lumbar lateral (L SPINE)')
    expect(parsed?.hallazgos.length).toBeGreaterThanOrEqual(3)
    expect(parsed?.hallazgos[0]).toMatch(/\.$/u)
  })

  it('resolveRayosXStudyTypeLabel prioriza nombre del estudio y cae a localización', () => {
    expect(
      resolveRayosXStudyTypeLabel('RX de columna cervical ap y lat', {
        hallazgos: [],
        localizacion: 'Columna cervical',
        radiologista: null,
        fecha_estudio: null,
        notas_calidad: null,
      }),
    ).toBe('RX DE COLUMNA CERVICAL AP Y LAT')

    expect(
      resolveRayosXStudyTypeLabel(null, {
        hallazgos: [],
        localizacion: 'Tele de torax PA',
        radiologista: null,
        fecha_estudio: null,
        notas_calidad: null,
      }),
    ).toBe('TELE DE TORAX PA')
  })

  it('buildRayosXFindingsParagraphs usa hallazgos, notas del médico y fallback', () => {
    const paragraphs = buildRayosXFindingsParagraphs({
      extracted: {
        hallazgos: ['Desviación dextroconvexa lumbosacra.', 'Espacios intersomáticos conservados.'],
        localizacion: 'Columna lumbar',
        radiologista: null,
        fecha_estudio: null,
        notas_calidad: null,
      },
      doctorNotes: 'Desnivel pélvico derecho de 2.0 cm.',
    })
    expect(paragraphs).toEqual([
      'Desviación dextroconvexa lumbosacra.',
      'Espacios intersomáticos conservados.',
      'Desnivel pélvico derecho de 2.0 cm.',
    ])

    const fallback = buildRayosXFindingsParagraphs({
      extracted: null,
      prediagnosisData: {
        summary: 'Tórax radiológicamente normal, sin patología aguda pleuropulmonar.',
      },
    })
    expect(fallback).toEqual([
      'Tórax radiológicamente normal, sin patología aguda pleuropulmonar.',
    ])
  })

  it('parseRayosXImpressionItems y formatRayosXLongDateEsMx formatean según muestra SME', () => {
    const items = parseRayosXImpressionItems(
      '• Desviación dextroconvexa lumbosacra (4°)\n• No se identifican fracturas ni tumoraciones.',
    )
    expect(items).toEqual([
      'DESVIACIÓN DEXTROCONVEXA LUMBOSACRA (4°)',
      'NO SE IDENTIFICAN FRACTURAS NI TUMORACIONES.',
    ])

    const dateLabel = formatRayosXLongDateEsMx('2025-12-15T18:00:00.000Z')
    expect(dateLabel).toContain('2025')
    expect(dateLabel).toContain('diciembre')
  })

  it('renderiza buffers PDF válidos para Columna y Tele de Tórax PA', async () => {
    for (const studyTypeLabel of [
      'COLUMNA LUMBAR AP Y LATERAL',
      'TELE DE TORAX PA',
    ]) {
      const element = createElement(RayosXValidatedPDF, {
        data: {
          reviewId: 'rx-review-1',
          signedAt: '2025-12-15T18:00:00.000Z',
          studyTypeLabel,
          patientName: 'CARRAZCO SUAREZ ALVARO',
          companyName: 'VALIANT',
          universalId: 'RX-0001',
          findingsParagraphs: [
            'Estructuras óseas y articulares evaluadas con densidad y morfología conservadas.',
            'Sin evidencia de fracturas ni lesiones neoplásicas en la proyección evaluada.',
          ],
          impressionItems: [
            'ESTUDIO RADIOGRÁFICO SIN ALTERACIONES OSTEOMUSCULARES AGUDAS EVIDENTES.',
          ],
          recommendations: null,
          medico: {
            fullName: 'Dr. José Antonio Gómez Jardon',
            professionalLicense: 'AECEM-23687',
            signatureImageUrl: TINY_PNG_DATA_URL,
          },
          logoUrl: TINY_PNG_DATA_URL,
        },
      }) as Parameters<typeof renderToBuffer>[0]

      const buffer = await renderToBuffer(element)
      expect(buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-')
      expect(buffer.length).toBeGreaterThan(1000)
    }
  })
})
