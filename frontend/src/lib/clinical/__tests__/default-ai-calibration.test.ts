import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import {
  readStoredAiCalibrationFromTestOptions,
  resolveAiCalibrationForUpload,
} from '@/lib/clinical/default-ai-calibration'

describe('default-ai-calibration (única fuente de verdad en BD)', () => {
  it('NO inyecta prompt hardcodeado para Electrocardiograma cuando falta en BD', () => {
    expect(resolveAiCalibrationForUpload(null, 'Electrocardiograma')).toBeNull()
    expect(resolveAiCalibrationForUpload(null, 'ECG')).toBeNull()
  })

  it('NO inyecta prompt hardcodeado para Espirometría cuando falta en BD', () => {
    expect(resolveAiCalibrationForUpload(null, 'Espirometria')).toBeNull()
  })

  it('NO inyecta prompt hardcodeado para Rayos_X cuando falta en BD', () => {
    expect(resolveAiCalibrationForUpload(null, 'Rayos_X')).toBeNull()
  })

  it('preserva exactamente la calibración leída de BD sin sobrescribir', () => {
    const resolved = resolveAiCalibrationForUpload(
      {
        extraction: { prompt: 'Prompt personalizado BD', version: 'custom-v1' },
      },
      'Electrocardiograma',
    )
    const ext = resolved?.extraction as { prompt?: string; version?: string }
    expect(ext.prompt).toBe('Prompt personalizado BD')
    expect(ext.version).toBe('custom-v1')
  })

  it('lee prompt y clinicalCriteria desde publishedVersions V3', () => {
    const stored = readStoredAiCalibrationFromTestOptions({
      aiCalibration: {
        schemaVersion: 'V3',
        currentPublishedVersionId: 'v1',
        publishedVersions: [
          {
            versionId: 'v1',
            status: 'published',
            enabled: true,
            canonicalStudyType: 'Rayos_X',
            extraction: { enabled: true, prompt: 'Prompt RX publicado', version: 'rx-v1' },
            fieldDefinitions: [],
            clinicalCriteria: {
              prediagnosisEnabled: true,
              requiredParams: ['hallazgos'],
              confidenceThreshold: 0.5,
              prompt: 'Prompt clínico RX',
              promptVersion: 'rx-dx-v1',
            },
            presentation: { enabled: false, schema: null },
          },
        ],
        familyTemplateId: null,
        draft: null,
        legacyV1V2Snapshot: null,
      },
    })
    const ext = stored?.extraction as { prompt?: string }
    const cc = stored?.clinicalCriteria as { prompt?: string }
    expect(ext.prompt).toBe('Prompt RX publicado')
    expect(cc.prompt).toBe('Prompt clínico RX')
  })

  it('V3 publicada deshabilitada NO cae a legacyV1V2Snapshot ni draft', () => {
    const stored = readStoredAiCalibrationFromTestOptions({
      aiCalibration: {
        schemaVersion: 'V3',
        currentPublishedVersionId: 'v1',
        publishedVersions: [
          {
            versionId: 'v1',
            status: 'published',
            enabled: false,
            canonicalStudyType: 'Espirometria',
            extraction: { enabled: false, prompt: '', version: 'empty' },
            fieldDefinitions: [],
            clinicalCriteria: null,
            presentation: { enabled: false, schema: null },
          },
        ],
        familyTemplateId: null,
        draft: {
          status: 'draft',
          label: 'draft',
          enabled: true,
          canonicalStudyType: 'Espirometria',
          extraction: { enabled: true, prompt: 'Draft no publicado' },
          fieldDefinitions: [],
          clinicalCriteria: null,
          presentation: { enabled: false, schema: null },
        },
        legacyV1V2Snapshot: {
          snapshot: {
            extraction: { prompt: 'Prompt legacy espiro', version: 'legacy-v6' },
          },
          migratedAt: '2026-01-01',
          migratedBy: null,
          sourceSchemaVersion: 'V2',
        },
      },
    })
    expect(stored?.enabled).toBe(false)
    const ext = stored?.extraction as { prompt?: string }
    expect(ext.prompt).toBe('')
  })

  it('el módulo default-ai-calibration.ts no contiene prompts ni bootstrap en código', () => {
    const src = readFileSync(
      path.resolve(process.cwd(), 'src/lib/clinical/default-ai-calibration.ts'),
      'utf8',
    )
    expect(src).not.toContain('ECG_EXTRACTION_PROMPT')
    expect(src).not.toContain('ESPIRO_EXTRACTION_PROMPT')
    expect(src).not.toContain('bootstrapForStudyType')
    expect(src).not.toContain('update-espirometria-extraction-prompt')
  })
})
