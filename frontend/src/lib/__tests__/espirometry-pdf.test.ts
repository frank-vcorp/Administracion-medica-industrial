/**
 * @file Tests focales (V1) para los helpers puros del PDF de Espirometría.
 * @id IMPL-FEATURE-20260825-01 / QA-20260825-01 P2-D + P3-F
 * @backup context/SPECs/SPEC-FEATURE-20260825-01-PDF-ESPIROMETRIA-VALIDADA.md
 *
 * Cobertura:
 *  - `extractValidatedRecommendationsFromPredx` unifica los 3 campos
 *    del prediagnóstico (P3-F) y respeta el contrato: sólo ACCEPTED
 *    incluye recomendaciones; EDITED las omite.
 *  - `extractRepetibilidadFromExtraction` extrae la repetibilidad real
 *    del snapshot (P2-D): si el snapshot tiene `calidad.repetibilidad_*_ml`
 *    y/o `parametros[]` canónicos, los valores se exponen al PDF.
 *  - `resolveRepetibilidadForPdf` devuelve siempre un objeto cuando
 *    hay datos (antes devolvía `null` y la sección II nunca se renderizaba).
 *  - `buildEspirometryPdfData` integra todo: action y route generan el
 *    mismo payload → mismo hash.
 */
import { describe, it, expect } from 'vitest'
import {
  extractValidatedRecommendationsFromPredx,
  resolveValidatedRecommendations,
  extractRepetibilidadFromExtraction,
  resolveRepetibilidadForPdf,
  buildEspirometryPdfData,
} from '@/lib/espirometry-pdf'

describe('extractValidatedRecommendationsFromPredx — QA-20260825-01 P3-F', () => {
  it('une los 3 campos del contrato vigente (singular + arrays)', () => {
    const out = extractValidatedRecommendationsFromPredx(
      {
        recommendation: 'Reposo 24 h.',
        recommendations: ['Control en 1 semana.', 'Evitar ejercicio intenso.'],
        recommended_actions: ['Notificar a RH.'],
      },
      'REVIEWED_ACCEPTED',
    )
    expect(out).toEqual([
      'Reposo 24 h.',
      'Control en 1 semana.',
      'Evitar ejercicio intenso.',
      'Notificar a RH.',
    ])
  })

  it('EDITED NO incluye recomendaciones del snapshot (el médico sólo firma lo suyo)', () => {
    const out = extractValidatedRecommendationsFromPredx(
      {
        recommendation: 'IA sugerencia que el médico descartó.',
        recommendations: ['IA sugerencia array.'],
      },
      'REVIEWED_EDITED',
    )
    expect(out).toEqual([])
  })

  it('deduplica preservando orden', () => {
    const out = extractValidatedRecommendationsFromPredx(
      {
        recommendation: 'A',
        recommendations: ['A', 'B', 'C'],
        recommended_actions: ['B', 'D'],
      },
      'REVIEWED_ACCEPTED',
    )
    expect(out).toEqual(['A', 'B', 'C', 'D'])
  })

  it('ignora entradas no-string o vacías', () => {
    const out = extractValidatedRecommendationsFromPredx(
      {
        recommendation: '  real  ',
        recommendations: ['', '  ', 'válido', 42, null, undefined],
        recommended_actions: ['  '],
      },
      'REVIEWED_ACCEPTED',
    )
    expect(out).toEqual(['real', 'válido'])
  })

  it('snapshot vacío no rompe', () => {
    expect(extractValidatedRecommendationsFromPredx(null, 'REVIEWED_ACCEPTED')).toEqual([])
    expect(extractValidatedRecommendationsFromPredx({}, 'REVIEWED_ACCEPTED')).toEqual([])
  })
})

describe('resolveValidatedRecommendations — recomendaciones del médico', () => {
  it('prioriza texto del médico sobre snapshot IA', () => {
    const out = resolveValidatedRecommendations(
      { recommendation: 'Sugerencia IA' },
      'REVIEWED_ACCEPTED',
      'Control en 2 semanas.\nEvitar polvo.',
    )
    expect(out).toEqual(['Control en 2 semanas.', 'Evitar polvo.'])
  })

  it('EDITED usa recomendaciones del médico aunque IA tenga sugerencias', () => {
    const out = resolveValidatedRecommendations(
      { recommendation: 'Sugerencia IA descartada' },
      'REVIEWED_EDITED',
      'Seguimiento ocupacional en 6 meses.',
    )
    expect(out).toEqual(['Seguimiento ocupacional en 6 meses.'])
  })

  it('sin texto médico conserva fallback IA en ACCEPTED', () => {
    const out = resolveValidatedRecommendations(
      { recommendation: 'Reposo relativo.' },
      'REVIEWED_ACCEPTED',
      '',
    )
    expect(out).toEqual(['Reposo relativo.'])
  })
})

describe('extractRepetibilidadFromExtraction — QA-20260825-01 P2-D', () => {
  it('extrae repetibilidad del campo calidad.repetibilidad_*_ml', () => {
    const out = extractRepetibilidadFromExtraction({
      extracted_data: {
        calidad: {
          repetibilidad_fvc_ml: 30,
          repetibilidad_fev1_ml: 40,
        },
      },
    })
    expect(out.repetibilidadFvcMl).toBe(30)
    expect(out.repetibilidadFev1Ml).toBe(40)
    expect(out.cumpleRepetibilidadFvc).toBe(true)
    expect(out.cumpleRepetibilidadFev1).toBe(true)
    expect(out.umbralMl).toBe(150)
    expect(out.fuente).toBe('extracted')
  })

  it('deriva booleanos ≤150 desde el numérico (regla AMI)', () => {
    const out = extractRepetibilidadFromExtraction({
      extracted_data: {
        calidad: {
          repetibilidad_fvc_ml: 200, // > 150 → NO
          repetibilidad_fev1_ml: 50, // ≤ 150 → SI
        },
      },
    })
    expect(out.cumpleRepetibilidadFvc).toBe(false)
    expect(out.cumpleRepetibilidadFev1).toBe(true)
  })

  it('soporta root estructuradoData con calidad directa (no requiere extracted_data)', () => {
    const out = extractRepetibilidadFromExtraction({
      calidad: { repetibilidad_fvc_ml: 30 },
    })
    expect(out.repetibilidadFvcMl).toBe(30)
  })

  it('devuelve nulls cuando el snapshot está vacío', () => {
    const out = extractRepetibilidadFromExtraction({})
    expect(out.repetibilidadFvcMl).toBeNull()
    expect(out.repetibilidadFev1Ml).toBeNull()
    expect(out.cumpleRepetibilidadFvc).toBeNull()
    expect(out.cumpleRepetibilidadFev1).toBeNull()
  })
})

describe('resolveRepetibilidadForPdf — siempre devuelve objeto', () => {
  it('construye la sección II cuando hay al menos un valor', () => {
    const out = resolveRepetibilidadForPdf({
      repetibilidadFvcMl: 30,
      cumpleRepetibilidadFvc: true,
    })
    expect(out).not.toBeNull()
    expect(out!.fvc.diferenciaMl).toBe(30)
    expect(out!.fvc.cumple).toBe(true)
    expect(out!.umbralMl).toBe(150)
  })

  it('incluye la sección II aunque los valores sean null (antes se omitía)', () => {
    const out = resolveRepetibilidadForPdf({})
    expect(out).not.toBeNull()
    expect(out!.fvc.diferenciaMl).toBeNull()
    expect(out!.fev1.diferenciaMl).toBeNull()
  })
})

describe('buildEspirometryPdfData — integración P3-F + P2-D', () => {
  it('para REVIEWED_ACCEPTED incluye recomendaciones y repetibilidad del snapshot', () => {
    const data = buildEspirometryPdfData({
      reviewId: 'r-1',
      doctorStatus: 'REVIEWED_ACCEPTED',
      doctorDiagnosis: 'Patrón normal.',
      doctorNotes: null,
      reviewCreatedAt: new Date('2026-08-25T12:00:00.000Z'),
      prediagnosisData: {
        recommendation: 'Reposo 24 h.',
      },
      extractionStructuredData: {
        extracted_data: {
          calidad: {
            repetibilidad_fvc_ml: 30,
            repetibilidad_fev1_ml: 40,
          },
        },
      },
      studyName: 'Espirometría',
      studyType: 'Espirometria',
      patient: {
        firstName: 'Juan',
        lastName: 'Pérez',
        universalId: 'U-1',
        companyName: 'ACME',
      },
      medico: {
        fullName: 'Dra. Sesión',
        professionalLicense: '1234567',
        signatureImageUrl: 'data:image/png;base64,XXX',
      },
      logoDataUrl: null,
    })
    expect(data.recomendacionesValidadas).toEqual(['Reposo 24 h.'])
    expect(data.amiSection.repetibilidadFvcMl).toBe(30)
    expect(data.amiSection.repetibilidadFev1Ml).toBe(40)
    expect(data.amiSection.repetibilidadFvcMenor200).toBe('SI')
    expect(data.amiSection.repetibilidadFev1Menor200).toBe('SI')
  })

  it('para REVIEWED_EDITED omite recomendaciones IA aunque el snapshot las tenga', () => {
    const data = buildEspirometryPdfData({
      reviewId: 'r-2',
      doctorStatus: 'REVIEWED_EDITED',
      doctorDiagnosis: 'Cambio el diagnóstico.',
      doctorNotes: null,
      reviewCreatedAt: new Date(),
      prediagnosisData: {
        recommendation: 'Texto IA que el médico descartó',
      },
      extractionStructuredData: {},
      studyName: 'Espirometría',
      studyType: 'Espirometria',
      patient: { firstName: 'A', lastName: 'B' },
      medico: {
        fullName: 'Dr. M',
        professionalLicense: '9',
        signatureImageUrl: 'data:image/png;base64,Y',
      },
      logoDataUrl: null,
    })
    expect(data.recomendacionesValidadas).toEqual([])
    expect(data.doctorDiagnosis).toBe('Cambio el diagnóstico.')
  })

  it('paciente sin nombre no rompe y cae al placeholder —', () => {
    const data = buildEspirometryPdfData({
      reviewId: 'r-3',
      doctorStatus: 'REVIEWED_ACCEPTED',
      doctorDiagnosis: null,
      doctorNotes: null,
      reviewCreatedAt: new Date(),
      prediagnosisData: null,
      extractionStructuredData: null,
      studyName: null,
      studyType: null,
      patient: { firstName: '', lastName: '' },
      medico: {
        fullName: 'Dr. M',
        professionalLicense: '9',
        signatureImageUrl: 'data:image/png;base64,Y',
      },
      logoDataUrl: null,
    })
    expect(data.patient.fullName).toBe('—')
    expect(data.doctorDiagnosis).toBe('Aceptado sin diagnóstico adicional explícito.')
    expect(data.studyName).toBe('Espirometría')
    expect(data.studyType).toBe('Espirometria')
  })
})
