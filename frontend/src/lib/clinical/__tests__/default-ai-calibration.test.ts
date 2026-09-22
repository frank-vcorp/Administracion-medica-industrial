import { describe, expect, it } from 'vitest'
import {
  ECG_EXTRACTION_VERSION,
  readStoredAiCalibrationFromTestOptions,
  resolveAiCalibrationForUpload,
} from '@/lib/clinical/default-ai-calibration'

describe('default-ai-calibration', () => {
  it('inyecta extracción ECG cuando falta prompt en catálogo', () => {
    const resolved = resolveAiCalibrationForUpload(null, 'Electrocardiograma')
    expect(resolved).not.toBeNull()
    const ext = resolved?.extraction as { prompt?: string; version?: string }
    expect(ext.prompt?.length).toBeGreaterThan(100)
    expect(ext.version).toBe(ECG_EXTRACTION_VERSION)
  })

  it('no sobrescribe prompt existente en catálogo', () => {
    const resolved = resolveAiCalibrationForUpload(
      {
        extraction: { prompt: 'Prompt personalizado', version: 'custom-v1' },
      },
      'Electrocardiograma',
    )
    const ext = resolved?.extraction as { prompt?: string; version?: string }
    expect(ext.prompt).toBe('Prompt personalizado')
    expect(ext.version).toBe('custom-v1')
  })

  it('bootstrap ECG con alias V3 canonicalStudyType', () => {
    const resolved = resolveAiCalibrationForUpload(null, 'ECG')
    expect(resolved?.extraction).toBeTruthy()
  })

  it('lee prompt desde publishedVersions V3', () => {
    const stored = readStoredAiCalibrationFromTestOptions({
      aiCalibration: {
        schemaVersion: 'V3',
        currentPublishedVersionId: 'v1',
        publishedVersions: [
          {
            versionId: 'v1',
            status: 'published',
            enabled: true,
            canonicalStudyType: 'ECG',
            extraction: { prompt: 'Prompt V3 publicado', version: 'v3-1' },
            fieldDefinitions: [],
            clinicalCriteria: null,
            presentation: { schema: {} },
          },
        ],
        familyTemplateId: null,
        draft: null,
        legacyV1V2Snapshot: null,
      },
    })
    const ext = stored?.extraction as { prompt?: string }
    expect(ext.prompt).toBe('Prompt V3 publicado')
  })

  it('no bootstrap para tipos sin plantilla', () => {
    expect(resolveAiCalibrationForUpload(null, 'Rayos_X')).toBeNull()
  })
})
