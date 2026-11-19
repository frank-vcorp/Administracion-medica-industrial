import { describe, expect, it } from 'vitest'
import {
  readPublishedV3GatesFromTestOptions,
  shouldOmitMedicalTestIdForLegacyPrediagnosis,
} from '../calibration-v3-gates'

describe('calibration-v3-gates', () => {
  it('detecta bloqueo cuando enabled=false en versión vigente', () => {
    const gates = readPublishedV3GatesFromTestOptions({
      aiCalibration: {
        schemaVersion: 'V3',
        publishedVersions: [
          {
            versionId: 'v1',
            versionNumber: 1,
            status: 'published',
            enabled: false,
            clinicalCriteria: { prediagnosisEnabled: true, requiredParams: [], confidenceThreshold: 0.5, prompt: 'x' },
          },
        ],
        currentPublishedVersionId: 'v1',
      },
    })
    expect(gates?.blocksPrediagnosisResolver).toBe(true)
  })

  it('nunca omite medical_test_id aunque V3 deshabilite prediagnóstico (fuente única BD)', () => {
    const options = {
      aiCalibration: {
        schemaVersion: 'V3',
        publishedVersions: [
          {
            versionId: 'v1',
            versionNumber: 1,
            status: 'published',
            enabled: true,
            clinicalCriteria: {
              prediagnosisEnabled: false,
              requiredParams: [],
              confidenceThreshold: 0.5,
              prompt: '',
            },
          },
        ],
        currentPublishedVersionId: 'v1',
      },
    }
    expect(shouldOmitMedicalTestIdForLegacyPrediagnosis(options)).toBe(false)
  })
})
