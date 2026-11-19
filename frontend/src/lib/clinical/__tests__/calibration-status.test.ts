import { describe, expect, it } from 'vitest'
import { getMedicalTestCalibrationStatus } from '@/lib/clinical/calibration-status'

describe('getMedicalTestCalibrationStatus (modo oración)', () => {
  it('detecta prueba sin calibración (p. ej. RX con options=[] o null)', () => {
    for (const raw of [[], null, {}, { price: 400 }]) {
      const status = getMedicalTestCalibrationStatus(raw)
      expect(status.kind).toBe('missing')
      expect(status.label).toBe('Falta calibrar')
      expect(status.needsCalibration).toBe(true)
      expect(status.hasExtractionPrompt).toBe(false)
      expect(status.hasClinicalPrompt).toBe(false)
    }
  })

  it('detecta calibración V1/V2 completa (extracción y prediagnóstico)', () => {
    const status = getMedicalTestCalibrationStatus({
      aiCalibration: {
        enabled: true,
        canonicalStudyType: 'Espirometria',
        extraction: { prompt: 'Prompt extracción' },
        diagnosis: { prompt: 'Prompt prediagnóstico' },
      },
    })
    expect(status.kind).toBe('calibrated')
    expect(status.label).toBe('Calibrada (extracción y prediagnóstico)')
    expect(status.needsCalibration).toBe(false)
    expect(status.hasExtractionPrompt).toBe(true)
    expect(status.hasClinicalPrompt).toBe(true)
  })

  it('detecta calibración parcial cuando falta uno de los dos prompts', () => {
    const onlyExt = getMedicalTestCalibrationStatus({
      aiCalibration: {
        enabled: true,
        extraction: { prompt: 'Prompt extracción' },
      },
    })
    expect(onlyExt.kind).toBe('partial')
    expect(onlyExt.label).toBe('Solo extracción configurada')
    expect(onlyExt.needsCalibration).toBe(true)

    const onlyDiag = getMedicalTestCalibrationStatus({
      aiCalibration: {
        enabled: true,
        diagnosis: { prompt: 'Prompt prediagnóstico' },
      },
    })
    expect(onlyDiag.kind).toBe('partial')
    expect(onlyDiag.label).toBe('Solo prediagnóstico configurado')
    expect(onlyDiag.needsCalibration).toBe(true)
  })

  it('detecta borrador V3 pendiente de publicar', () => {
    const status = getMedicalTestCalibrationStatus({
      operationMode: 'clinical_interpretation',
      aiCalibration: {
        schemaVersion: 'V3',
        currentPublishedVersionId: null,
        publishedVersions: [],
        draft: {
          status: 'tested',
          label: 'draft',
          enabled: true,
          canonicalStudyType: 'Rayos_X',
          extraction: { enabled: true, prompt: 'Prompt RX' },
          fieldDefinitions: [],
          clinicalCriteria: {
            prediagnosisEnabled: true,
            requiredParams: [],
            confidenceThreshold: null,
            prompt: 'Prompt clínico RX',
          },
          presentation: { enabled: false, schema: null },
        },
        legacyV1V2Snapshot: null,
      },
    })
    expect(status.kind).toBe('draft_only')
    expect(status.label).toBe('Borrador pendiente de publicar')
    expect(status.needsCalibration).toBe(true)
  })

  it('detecta V3 publicada completa y document_extraction solo extracción', () => {
    const pubFull = getMedicalTestCalibrationStatus({
      operationMode: 'clinical_interpretation',
      aiCalibration: {
        schemaVersion: 'V3',
        currentPublishedVersionId: 'v1',
        publishedVersions: [
          {
            versionId: 'v1',
            versionNumber: 1,
            label: 'v1',
            status: 'published',
            publishedAt: '2026-11-19T00:00:00Z',
            publishedBy: 'u1',
            enabled: true,
            canonicalStudyType: 'Rayos_X',
            extraction: { enabled: true, prompt: 'Ext' },
            fieldDefinitions: [],
            clinicalCriteria: {
              prediagnosisEnabled: true,
              requiredParams: [],
              confidenceThreshold: 0.5,
              prompt: 'Dx',
            },
            presentation: { enabled: false, schema: null },
          },
        ],
        draft: null,
        legacyV1V2Snapshot: null,
      },
    })
    expect(pubFull.kind).toBe('calibrated')
    expect(pubFull.needsCalibration).toBe(false)

    const docOnly = getMedicalTestCalibrationStatus({
      operationMode: 'document_extraction',
      aiCalibration: {
        schemaVersion: 'V3',
        currentPublishedVersionId: 'v1',
        publishedVersions: [
          {
            versionId: 'v1',
            versionNumber: 1,
            label: 'v1',
            status: 'published',
            publishedAt: '2026-11-19T00:00:00Z',
            publishedBy: 'u1',
            enabled: true,
            canonicalStudyType: null,
            extraction: { enabled: true, prompt: 'Ext' },
            fieldDefinitions: [],
            clinicalCriteria: null,
            presentation: { enabled: false, schema: null },
          },
        ],
        draft: null,
        legacyV1V2Snapshot: null,
      },
    })
    expect(docOnly.kind).toBe('calibrated')
    expect(docOnly.label).toBe('Calibrada (solo extracción)')
    expect(docOnly.needsCalibration).toBe(false)
  })

  it('detecta servicio manual y calibración deshabilitada en modo oración', () => {
    const manual = getMedicalTestCalibrationStatus({ operationMode: 'manual_service' })
    expect(manual.kind).toBe('manual_service')
    expect(manual.label).toBe('Servicio manual sin IA')
    expect(manual.needsCalibration).toBe(false)

    const disabled = getMedicalTestCalibrationStatus({
      aiCalibration: { enabled: false, extraction: { prompt: 'x' } },
    })
    expect(disabled.kind).toBe('disabled')
    expect(disabled.label).toBe('Calibración deshabilitada')
    expect(disabled.needsCalibration).toBe(false)
  })
})
