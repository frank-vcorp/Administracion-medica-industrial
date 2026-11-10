import { describe, expect, it } from 'vitest'
import { isConsultaMedicaTestName } from '@/lib/clinical/consulta-medica'
import { consultaDerivadoAuditMatches } from '@/lib/clinical/consulta-derivados'

/** Lógica espejo de filtro en getConsultaDerivadosCatalog (pure). */
function filterDerivadosCatalog(
  catalog: { id: string; name: string }[],
  onEventIds: Set<string>,
): { id: string; name: string }[] {
  return catalog.filter((t) => !onEventIds.has(t.id) && !isConsultaMedicaTestName(t.name))
}

describe('consulta derivados catalog filter', () => {
  it('excluye pruebas ya en evento y consulta médica', () => {
    const catalog = [
      { id: 'a', name: 'RADIOGRAFIA DE TORAX' },
      { id: 'b', name: 'Consulta médica' },
      { id: 'c', name: 'GLUCOSA' },
    ]
    const onEvent = new Set(['a'])
    const out = filterDerivadosCatalog(catalog, onEvent)
    expect(out.map((t) => t.id)).toEqual(['c'])
  })
})

describe('consulta derivado audit match', () => {
  it('acepta solo el alta de esta consulta', () => {
    expect(
      consultaDerivadoAuditMatches(
        {
          source: 'consulta_derivados',
          eventId: 'evt-1',
          consultaEventTestId: 'consulta-1',
        },
        'evt-1',
        'consulta-1',
      ),
    ).toBe(true)
  })

  it('rechaza un estudio de otra consulta o del check-in', () => {
    expect(
      consultaDerivadoAuditMatches(
        {
          source: 'consulta_derivados',
          eventId: 'evt-1',
          consultaEventTestId: 'consulta-2',
        },
        'evt-1',
        'consulta-1',
      ),
    ).toBe(false)
    expect(
      consultaDerivadoAuditMatches({ source: 'check_in', eventId: 'evt-1' }, 'evt-1', 'consulta-1'),
    ).toBe(false)
    expect(consultaDerivadoAuditMatches(null, 'evt-1', 'consulta-1')).toBe(false)
  })
})
