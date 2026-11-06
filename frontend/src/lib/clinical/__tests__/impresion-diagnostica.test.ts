import { describe, expect, it } from 'vitest'
import {
  buildImpresionDiagnosticaFromAntecedentesYExamen,
  hasPatologicoSi,
} from '@/lib/clinical/impresion-diagnostica'

describe('buildImpresionDiagnosticaFromAntecedentesYExamen (F04)', () => {
  it('no genera texto si no hay patológicos SÍ', () => {
    expect(
      buildImpresionDiagnosticaFromAntecedentesYExamen({
        antecedentes: {
          patologicos: { diabetes: { estado: 'NEGADO' } },
        },
        exam: { estado_nutricional: 'SOBREPESO' },
      }),
    ).toBe('')
    expect(hasPatologicoSi({ patologicos: { has: { estado: 'NEGADO' } } })).toBe(false)
  })

  it('combina APP SÍ con hallazgos del resumen clínico', () => {
    const text = buildImpresionDiagnosticaFromAntecedentesYExamen({
      antecedentes: {
        patologicos: {
          diabetes: {
            estado: 'SI',
            detalle: { tratamiento: 'Metformina', desde_cuando: '2018' },
          },
        },
      },
      exam: {
        estado_nutricional: 'SOBREPESO',
        agudeza_visual_resumen: 'DISMINUIDA',
        salud_bucal: 'NORMAL',
        presion_arterial_resumen: 'NORMAL AL MOMENTO DE LA TOMA',
      },
    })
    expect(text).toContain('Diabetes')
    expect(text).toContain('Metformina')
    expect(text).toContain('Sobrepeso')
    expect(text).toContain('Disminución agudeza visual')
    expect(hasPatologicoSi({ patologicos: { diabetes: { estado: 'SI' } } })).toBe(true)
  })

  it('acepta patológicos legacy en string SÍ', () => {
    const text = buildImpresionDiagnosticaFromAntecedentesYExamen({
      antecedentes: { patologicos: { has: 'SI — controlado' } },
      exam: { presion_arterial_resumen: 'ALTA' },
    })
    expect(text).toContain('Hipertensión Arterial')
    expect(text).toContain('Hipertensión arterial')
  })

  it('incluye especifique positivos de exploración', () => {
    const text = buildImpresionDiagnosticaFromAntecedentesYExamen({
      antecedentes: { patologicos: { varices: { estado: 'SI' } } },
      exam: {},
      especifiquePositivos: 'Edema maleolar leve',
    })
    expect(text).toContain('Varices')
    expect(text).toContain('Edema maleolar leve')
  })
})
