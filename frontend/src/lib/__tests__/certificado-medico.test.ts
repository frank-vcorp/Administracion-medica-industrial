import { describe, expect, it } from 'vitest'
import {
  isCertificadoMedicoTestName,
  parseCertificadoMedicoClinicalContext,
  parseCertificadoMedicoDraftContext,
} from '@/lib/clinical/certificado-medico'
import { buildAntecedentesNarratives, buildVitalesLine } from '@/lib/clinical/certificado-medico-narrative'
import { ANTECEDENTES_SECTION_LEGEND } from '@/lib/antecedentes-section-ui'

describe('buildAntecedentesNarratives', () => {
  it('formatea correctamente antecedentes heredofamiliares positivos y omite negados', () => {
    const narr = buildAntecedentesNarratives({
      heredo_familiares: {
        diabetes: 'NEGADOS',
        has: 'NEGADOS',
        cancer: 'MADRE',
        mentales: 'OTROS',
        mentales_especifique: 'Esquizofrenia',
      } as any,
    } as any)
    expect(narr.heredoFamiliares).toContain('Cáncer: Madre.')
    expect(narr.heredoFamiliares).toContain('Trastornos mentales: Esquizofrenia.')
    expect(narr.heredoFamiliares).not.toContain('Diabetes')
    expect(narr.heredoFamiliares).not.toContain('Hipertensión')
  })

  it('formatea correctamente antecedentes personales patológicos con detalles', () => {
    const narr = buildAntecedentesNarratives({
      patologicos: {
        cirugias: {
          estado: 'SI',
          detalle: {
            desde_cuando: 'hace 5 años',
            observaciones: 'Apendicectomía sin complicaciones',
          },
        },
        diabetes: { estado: 'NEGADO' },
      } as any,
    } as any)
    expect(narr.patologicos).toContain('Quirúrgicos / Cirugías: Sí (desde hace hace 5 años, Apendicectomía sin complicaciones).')
    expect(narr.patologicos).not.toContain('Diabetes')
  })

  it('retorna texto canónico cuando todos los antecedentes están negados', () => {
    const narr = buildAntecedentesNarratives({
      heredo_familiares: { diabetes: 'NEGADOS', has: 'NEGADOS' } as any,
      patologicos: { diabetes: { estado: 'NEGADO' } } as any,
      no_patologicos: { alcohol: 'NEGADO', tabaco: 'NEGADO' } as any,
    } as any)
    expect(narr.heredoFamiliares).toBe(
      'Interrogados y negados. Sin antecedentes heredofamiliares de importancia referidos.',
    )
    expect(narr.patologicos).toBe(
      'Crónico-degenerativos, quirúrgicos, traumáticos y alérgicos interrogados y negados.',
    )
    expect(narr.noPatologicos).toContain(
      'Toxicomanías (alcohol, tabaco, drogas) interrogadas y negadas.',
    )
  })
})

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
