import { describe, it, expect } from 'vitest'
import { readBasicVitalsForPatientPdf } from '../patient-identification'

describe('readBasicVitalsForPatientPdf', () => {
  it('arma peso, talla, T°, FC y TA desde somatometría', () => {
    const v = readBasicVitalsForPatientPdf({
      somatometryData: {
        peso_kg: '82',
        talla_m: '1.72',
        temperatura: '36.5',
        fc_min: '72',
        ta_sistolica: '118',
        ta_diastolica: '76',
      },
      vitalSignsData: null,
      physicalExamData: null,
    })
    expect(v.weightLabel).toBe('82 kg')
    expect(v.heightLabel).toBe('1.72 m')
    expect(v.temperatureLabel).toBe('36.5 °C')
    expect(v.heartRateLabel).toBe('72 lpm')
    expect(v.bloodPressureLabel).toBe('118/76 mmHg')
  })

  it('usa TA libre del examen físico si no hay componentes', () => {
    const v = readBasicVitalsForPatientPdf({
      somatometryData: {},
      vitalSignsData: {},
      physicalExamData: { ta: '120/80' },
    })
    expect(v.bloodPressureLabel).toBe('120/80 mmHg')
  })
})
