import { describe, expect, it } from 'vitest'
import {
  ECG_EXTRACTION_VERSION,
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

  it('no bootstrap para tipos sin plantilla', () => {
    expect(resolveAiCalibrationForUpload(null, 'Rayos_X')).toBeNull()
  })
})
