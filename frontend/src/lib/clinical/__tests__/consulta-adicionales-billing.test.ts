import { describe, expect, it } from 'vitest'
import { consultaAdicionalesBillingLines, sumConsultaAdicionalesPrecios } from '@/lib/clinical/consulta-adicionales-billing'

describe('consultaAdicionalesBillingLines', () => {
  it('returns lines only for precio > 0', () => {
    const lines = consultaAdicionalesBillingLines({
      adicionales_consulta: {
        ferula: { detalle: 'muñeca', precio: 100 },
        medicamento_aplicacion: { precio: 0 },
        otros: { detalle: 'curación' },
      },
    })
    expect(lines).toHaveLength(1)
    expect(lines[0].unitPrice).toBe(100)
    expect(lines[0].testName).toContain('férula')
    expect(lines[0].testName).toContain('muñeca')
  })

  it('sums adicionales', () => {
    expect(
      sumConsultaAdicionalesPrecios({
        adicionales_consulta: {
          ferula: { precio: 50.25 },
          otros: { precio: 10 },
        },
      }),
    ).toBe(60.25)
  })
})
