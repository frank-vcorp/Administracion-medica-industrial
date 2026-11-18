import { describe, expect, it } from 'vitest'
import {
  isCertificadoMedicoTestName,
  parseCertificadoMedicoClinicalContext,
  parseCertificadoMedicoDraftContext,
} from '@/lib/clinical/certificado-medico'
import { buildVitalesLine } from '@/lib/clinical/certificado-medico-narrative'
import { ANTECEDENTES_SECTION_LEGEND } from '@/lib/antecedentes-section-ui'

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

describe('parseCertificadoMedicoDraftContext', () => {
  it('preserva borradores parciales sin cerrar aunque falte integración diagnóstica', () => {
    const draft = {
      schemaVersion: 'certificado-medico-v1',
      exploracion_fisica: 'Consciente y orientado.',
      integracion_diagnostica: '',
      dictamen_laboral: 'APTO',
      dictamen_laboral_texto: 'Apto para labores.',
    }
    expect(parseCertificadoMedicoClinicalContext(draft)).toBeNull()
    const parsedDraft = parseCertificadoMedicoDraftContext(draft)
    expect(parsedDraft?.exploracion_fisica).toBe('Consciente y orientado.')
    expect(parsedDraft?.cerrada_at).toBeUndefined()
  })
})

describe('ANTECEDENTES_SECTION_LEGEND', () => {
  it('usa nombres médicos completos sin abreviaturas', () => {
    expect(ANTECEDENTES_SECTION_LEGEND.heredo_familiares).toBe('Antecedentes heredofamiliares')
    expect(ANTECEDENTES_SECTION_LEGEND.no_patologicos).toBe(
      'Antecedentes personales no patológicos',
    )
    expect(ANTECEDENTES_SECTION_LEGEND.patologicos).toBe('Antecedentes personales patológicos')
  })
})
