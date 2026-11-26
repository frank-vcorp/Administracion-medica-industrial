import { createElement } from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { describe, expect, it } from 'vitest'
import { EcgValidatedPDF } from '@/components/pdf/EcgValidatedPDF'
import { ECG_PARAMETERS_SCHEMA_VERSION } from '@/lib/clinical/ecg-parameters'
import {
  buildEcgNarrativeParagraph,
  parseEcgDiagnosisItems,
  parseEcgFromExtraction,
} from '@/lib/clinical/ecg-report'

const TINY_PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

describe('EcgValidatedPDF — formato institucional SME', () => {
  it('renderiza un buffer PDF válido con el layout SME ELECTROCARDIOGRAMA EN REPOSO', async () => {
    const extracted = parseEcgFromExtraction({
      extracted_data: {
        ritmicidad: 'rítmico',
        ritmo: 'Sinusal',
        frecuencia_bpm: 72,
        duracion_p_ms: 80,
        morfologia_p: 'positiva en todas las derivaciones menos en aVR',
        intervalo_pr_ms: 160,
        duracion_qrs_ms: 80,
        eje_electrico: 'Normal',
        eje_grados: 45,
        qtc_ms: 394,
        segmento_st: 'isoeléctrico, sin alteraciones significativas',
        onda_t: 'positiva en todas las derivaciones excepto en aVR',
        onda_q_patologica: 'No presencia de onda Q patológica',
      },
    })

    const savedContext = {
      schemaVersion: ECG_PARAMETERS_SCHEMA_VERSION,
      frecuencia_bpm: 70,
      eje_grados: 50,
    }

    const element = createElement(EcgValidatedPDF, {
      data: {
        reviewId: 'ecg-review-sme-1',
        signedAt: '2026-11-26T16:30:00.000Z',
        studyName: 'ELECTROCARDIOGRAMA EN REPOSO',
        studyType: 'Electrocardiograma',
        doctorStatus: 'REVIEWED_ACCEPTED',
        patient: {
          fullName: 'VERDIN LEZAMA JAVIER ALEJANDRO',
          universalId: 'ECG-0001',
          companyName: 'EMPRESA PRUEBA SA DE CV',
          sexLabel: 'Masculino',
          ageLabel: '32 años',
          attentionDate: '26/11/2026',
          weightLabel: null,
          heightLabel: null,
          temperatureLabel: null,
          heartRateLabel: null,
          bloodPressureLabel: null,
          workAreaLabel: null,
          tenureInAreaLabel: null,
        },
        narrativeParagraph: buildEcgNarrativeParagraph(extracted, null, savedContext),
        diagnosisItems: parseEcgDiagnosisItems(
          'Electrocardiograma en reposo con ritmo sinusal y sin otros datos patológicos al momento del estudio.',
        ),
        recommendations: 'Correlacionar con antecedentes cardiovasculares en valoración periódica.',
        medico: {
          fullName: 'Dra. Jaqueline Ramirez Gonzalez',
          professionalLicense: '11985716',
          signatureImageUrl: TINY_PNG_DATA_URL,
        },
        logoUrl: TINY_PNG_DATA_URL,
      },
    }) as Parameters<typeof renderToBuffer>[0]

    const buffer = await renderToBuffer(element)

    expect(Buffer.isBuffer(buffer)).toBe(true)
    expect(buffer.byteLength).toBeGreaterThan(1500)
    expect(buffer.subarray(0, 4).toString()).toBe('%PDF')
  })
})
