import { describe, expect, it } from 'vitest'
import { isCertificadoMedicoTestName } from '@/lib/clinical/certificado-medico'
import { buildVitalesLine } from '@/lib/clinical/certificado-medico-narrative'

describe('isCertificadoMedicoTestName', () => {
  it('matches catalog name', () => {
    expect(isCertificadoMedicoTestName('CERTIFICADO MEDICO')).toBe(true)
    expect(isCertificadoMedicoTestName('Certificado Médico')).toBe(true)
  })

  it('rejects digital certificate wording', () => {
    expect(isCertificadoMedicoTestName('Certificado Digital')).toBe(false)
  })
})

describe('buildVitalesLine', () => {
  it('includes SpO2 and agudeza', () => {
    const line = buildVitalesLine({
      peso_kg: '70',
      spo2_pct: '98',
      agudeza_vl: '20/20',
    })
    expect(line).toContain('SpO₂')
    expect(line).toContain('98')
    expect(line).toContain('Agudeza visual')
  })
})
