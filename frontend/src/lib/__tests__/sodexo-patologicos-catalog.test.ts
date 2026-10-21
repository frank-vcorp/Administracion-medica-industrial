import { describe, expect, it } from 'vitest'
import { SODEXO_PATOLOGICOS_CATALOG } from '@/lib/sodexo-patologicos-catalog'
import { prefillPatologicosSodexoFromAmi } from '@/lib/sodexo-patologicos-prefill'

describe('sodexo-patologicos-catalog', () => {
  it('incluye las 46 filas del §5 (23 + 23)', () => {
    const left = SODEXO_PATOLOGICOS_CATALOG.filter((r) => r.column === 'left')
    const right = SODEXO_PATOLOGICOS_CATALOG.filter((r) => r.column === 'right')
    expect(left).toHaveLength(23)
    expect(right).toHaveLength(23)
  })

  it('prefill mapea fracturas y diabetes', () => {
    const map = prefillPatologicosSodexoFromAmi({
      fracturas: 'NEGADO',
      diabetes: { estado: 'SI', detalle: { observaciones: 'control' } },
    })
    expect(map.fracturas?.estado).toBe('NEGADO')
    expect(map.diabetes?.estado).toBe('SI')
    expect(map.diabetes?.descripcion).toContain('control')
  })
})
