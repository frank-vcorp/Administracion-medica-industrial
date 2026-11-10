import { describe, expect, it } from 'vitest'
import { suggestAntecedentesConsultaFromProfile } from '@/lib/clinical/consulta-antecedentes-resumen'

describe('suggestAntecedentesConsultaFromProfile', () => {
  it('agrupa patológicos y toxicomanías en los 6 rubros', () => {
    const res = suggestAntecedentesConsultaFromProfile({
      patologicos: {
        diabetes: { estado: 'SI', detalle: { observaciones: 'Metformina' } },
        alergias: { estado: 'SI', detalle: { observaciones: 'Penicilina' } },
        cirugias: { estado: 'SI', detalle: { observaciones: 'Apendicectomía' } },
      },
      no_patologicos: {
        tabaco: 'SI',
        tabaco_especifique: '5 cig/día',
      },
    })
    expect(res.cronico_degenerativos).toContain('Diabetes')
    expect(res.alergicos).toContain('Penicilina')
    expect(res.quirurgicos).toContain('Apendicectomía')
    expect(res.toxicomanias).toContain('Tabaco')
  })
})
