import { describe, expect, it } from 'vitest'
import {
  buildInitialEcgParametersFromExtraction,
  ECG_PARAMETERS_SCHEMA_VERSION,
  isEcgParametersContext,
  mergeEcgExtractionWithSavedParameters,
} from '../ecg-parameters'
import {
  buildEcgNarrativeParagraph,
  parseEcgDiagnosisItems,
  parseEcgFromExtraction,
} from '../ecg-report'

describe('ecg-report & ecg-parameters', () => {
  it('parseEcgFromExtraction lee campos extendidos incluyendo eje con signo y grado', () => {
    const ecg = parseEcgFromExtraction({
      extracted_data: {
        ritmicidad: 'rítmico',
        ritmo: 'Sinusal',
        frecuencia_bpm: '73 lpm',
        duracion_p_ms: 80,
        morfologia_p: 'positiva en todas las derivaciones menos en aVR',
        intervalo_pr_ms: 164,
        duracion_qrs_ms: 75,
        qtc_ms: 389,
        eje_electrico: 'Normal (+19°)',
        segmento_st: 'isoeléctrico, sin alteraciones significativas',
        onda_t: 'positiva en todas las derivaciones excepto en aVR',
        onda_q_patologica: 'No presencia de onda Q patológica',
        origen_mediciones: 'cuadricula_visual',
      },
    })

    expect(ecg?.frecuencia_bpm).toBe(73)
    expect(ecg?.qtc_ms).toBe(389)
    expect(ecg?.eje_grados).toBe(19)
    expect(ecg?.segmento_st).toContain('isoeléctrico')
    expect(ecg?.origen_mediciones).toBe('cuadricula_visual')
  })

  it('buildEcgNarrativeParagraph genera formato oficial SME y prioriza parámetros confirmados', () => {
    const extracted = {
      ritmicidad: 'rítmico',
      ritmo: 'Sinusal',
      frecuencia_bpm: 72,
      duracion_p_ms: 80,
      morfologia_p: 'positiva en todas las derivaciones menos en aVR',
      intervalo_pr_ms: 160,
      duracion_qrs_ms: 80,
      eje_electrico: 'Normal',
      eje_grados: 45,
      qtc_ms: 400,
      segmento_st: 'isoeléctrico, sin alteraciones significativas',
      onda_t: 'positiva en todas las derivaciones excepto en aVR',
      onda_q_patologica: 'No presencia de onda Q patológica',
    }

    const saved = buildInitialEcgParametersFromExtraction(extracted, {
      schemaVersion: ECG_PARAMETERS_SCHEMA_VERSION,
      frecuencia_bpm: 68,
      eje_grados: 60,
      intervalo_pr_ms: 160,
      duracion_qrs_ms: 80,
      qtc_ms: 400,
    })

    expect(isEcgParametersContext(saved)).toBe(true)
    const text = buildEcgNarrativeParagraph(extracted, null, saved)
    expect(text).toContain('Electrocardiograma rítmico, en Ritmo Sinusal')
    expect(text).toContain('Frecuencia Cardiaca de 68 lpm')
    expect(text).toContain('Onda P de 80 mseg')
    expect(text).toContain('seguidas de QRS de 80 mseg')
    expect(text).toContain('Eje Cardiaco normal a 60°')
    expect(text).toContain('Intervalo PR de 160 mseg')
    expect(text).toContain('QT corregido de 400 mseg')
    expect(text).toContain('No presencia de onda Q patológica.')
  })

  it('buildEcgNarrativeParagraph usa notas manuales del médico si existen y conserva merge nulo', () => {
    const text = buildEcgNarrativeParagraph(
      { ritmo: 'Sinusal', frecuencia_bpm: 60 },
      'Párrafo morfológico del médico.',
    )
    expect(text).toBe('Párrafo morfológico del médico.')

    const merged = mergeEcgExtractionWithSavedParameters(
      { frecuencia_bpm: 72, qtc_ms: 410 },
      {
        schemaVersion: ECG_PARAMETERS_SCHEMA_VERSION,
        frecuencia_bpm: 65,
        qtc_ms: null,
      },
    )
    expect(merged?.frecuencia_bpm).toBe(65)
    expect(merged?.qtc_ms).toBeNull()
  })

  it('parseEcgDiagnosisItems añade corroborar con clínica sin duplicar si ya está', () => {
    const items = parseEcgDiagnosisItems('Sin datos de anormalidad.')
    expect(items.length).toBeGreaterThanOrEqual(2)
    expect(items.some((i) => /corroborar con cl/i.test(i))).toBe(true)

    const noDup = parseEcgDiagnosisItems(
      '1.- Electrocardiograma en reposo normal.\n2.- Corroborar con clínica.',
    )
    expect(noDup).toHaveLength(2)
  })
})
