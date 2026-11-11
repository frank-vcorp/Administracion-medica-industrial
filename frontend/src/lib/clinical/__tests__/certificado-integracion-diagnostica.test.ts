import { describe, expect, it } from 'vitest'
import { emptySignosVitalesCertificado } from '@/schemas/clinical/certificado-medico.schema'
import {
  buildIntegracionDiagnosticaCertificado,
  examForHallazgosFromCertificadoSignos,
  hasAntecedenteSiForCertificadoIntegracion,
  hasHeredofamiliarSi,
} from '@/lib/clinical/certificado-integracion-diagnostica'

describe('certificado integración diagnóstica (SME-127)', () => {
  it('no genera texto sin APP ni AHF en SÍ', () => {
    expect(
      buildIntegracionDiagnosticaCertificado({
        antecedentes: { patologicos: { diabetes: { estado: 'NEGADO' } } },
        signos: emptySignosVitalesCertificado(),
      }),
    ).toBe('')
    expect(hasAntecedenteSiForCertificadoIntegracion({ patologicos: { has: { estado: 'NEGADO' } } })).toBe(
      false,
    )
  })

  it('combina APP SÍ con hallazgos de signos vitales', () => {
    const text = buildIntegracionDiagnosticaCertificado({
      antecedentes: {
        patologicos: {
          diabetes: { estado: 'SI', detalle: { tratamiento: 'Metformina' } },
        },
      },
      signos: {
        ...emptySignosVitalesCertificado(),
        complexion: 'SOBREPESO',
        ta_sistolica: '120',
        ta_diastolica: '80',
      },
    })
    expect(text).toContain('Diabetes')
    expect(text).toContain('Metformina')
    expect(text).toContain('Sobrepeso')
  })

  it('incluye heredo-familiares en SÍ aunque APP esté negado', () => {
    expect(
      hasHeredofamiliarSi({
        heredo_familiares: { diabetes: 'PADRE' },
      }),
    ).toBe(true)
    const text = buildIntegracionDiagnosticaCertificado({
      antecedentes: {
        patologicos: { diabetes: { estado: 'NEGADO' } },
        heredo_familiares: { diabetes: 'PADRE' },
      },
      signos: emptySignosVitalesCertificado(),
    })
    expect(text).toContain('heredo-familiares')
    expect(text).toContain('Diabetes')
    expect(text).toContain('Padre')
  })

  it('deriva presión y agudeza desde signos del certificado', () => {
    const exam = examForHallazgosFromCertificadoSignos({
      ...emptySignosVitalesCertificado(),
      ta_sistolica: '150',
      ta_diastolica: '95',
      agudeza_vl: '20/20 OD / 20/40 OI',
      complexion: 'NORMAL',
    })
    expect(exam.presion_arterial_resumen).toBe('ALTA')
    expect(exam.agudeza_visual_resumen).toBe('DISMINUIDA')
  })
})
