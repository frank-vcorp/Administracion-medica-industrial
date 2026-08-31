import { describe, expect, it } from 'vitest'
import { evaluateVitalSignsPrediagnosis } from '../vital-signs-prediagnosis'

describe('evaluateVitalSignsPrediagnosis', () => {
  it('sin datos → hasData false', () => {
    const r = evaluateVitalSignsPrediagnosis({})
    expect(r.hasData).toBe(false)
    expect(r.findings).toHaveLength(0)
  })

  it('TA 90/80 y FC 95 → normal (caso captura usuario)', () => {
    const r = evaluateVitalSignsPrediagnosis({
      ta_sistolica: '90',
      ta_diastolica: '80',
      fc_min: '95',
    })
    expect(r.overall).toBe('normal')
    expect(r.findings.some(f => f.id === 'ta_normal')).toBe(true)
    expect(r.findings.some(f => f.id === 'fc_normal')).toBe(true)
  })

  it('TA 150/95 → alert hipertensión', () => {
    const r = evaluateVitalSignsPrediagnosis({
      ta_sistolica: 150,
      ta_diastolica: 95,
    })
    expect(r.overall).toBe('alert')
    expect(r.findings.some(f => f.id === 'ta_high')).toBe(true)
  })

  it('TA 130/85 → warning límite alto', () => {
    const r = evaluateVitalSignsPrediagnosis({
      ta_sistolica: 130,
      ta_diastolica: 85,
    })
    expect(r.overall).toBe('warning')
    expect(r.findings.some(f => f.id === 'ta_elevated')).toBe(true)
  })

  it('FC 110 → warning taquicardia', () => {
    const r = evaluateVitalSignsPrediagnosis({
      fc_min: '110',
    })
    expect(r.overall).toBe('warning')
    expect(r.findings.some(f => f.id === 'fc_tachy')).toBe(true)
  })

  it('temperatura 38.2 → alert fiebre', () => {
    const r = evaluateVitalSignsPrediagnosis({ temperatura: '38.2' })
    expect(r.overall).toBe('alert')
    expect(r.findings.some(f => f.id === 'temp_fever')).toBe(true)
  })

  it('FR 24 → alert taquipnea', () => {
    const r = evaluateVitalSignsPrediagnosis({ fr_min: 24 })
    expect(r.overall).toBe('alert')
    expect(r.findings.some(f => f.id === 'fr_tachy')).toBe(true)
  })
})
