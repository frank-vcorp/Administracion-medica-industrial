import { describe, expect, it } from 'vitest'
import { isConsultaMedicaTestName } from '@/lib/clinical/consulta-medica'

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
