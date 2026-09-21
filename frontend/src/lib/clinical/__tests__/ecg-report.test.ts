import { describe, expect, it } from 'vitest'
import {
  buildEcgNarrativeParagraph,
  parseEcgDiagnosisItems,
  parseEcgFromExtraction,
} from '../ecg-report'

describe('ecg-report', () => {
  it('parseEcgFromExtraction lee extracted_data', () => {
    const ecg = parseEcgFromExtraction({
      extracted_data: {
        ritmo: 'Sinusal',
        frecuencia_bpm: 73,
        intervalo_pr_ms: 164,
        duracion_qrs_ms: 75,
        qtc_ms: 389,
        eje_electrico: '19',
      },
    })
    expect(ecg?.frecuencia_bpm).toBe(73)
    expect(ecg?.qtc_ms).toBe(389)
  })

  it('buildEcgNarrativeParagraph usa notas del médico si existen', () => {
    const text = buildEcgNarrativeParagraph(
      { ritmo: 'Sinusal', frecuencia_bpm: 60 },
      'Párrafo morfológico del médico.',
    )
    expect(text).toBe('Párrafo morfológico del médico.')
  })

  it('parseEcgDiagnosisItems añade corroborar con clínica', () => {
    const items = parseEcgDiagnosisItems('Sin datos de anormalidad.')
    expect(items.length).toBeGreaterThanOrEqual(2)
    expect(items.some(i => /corroborar con cl/i.test(i))).toBe(true)
  })
})
