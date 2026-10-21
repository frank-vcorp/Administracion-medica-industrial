import { describe, expect, it } from 'vitest'
import {
  hoTableForUi,
  matrizColumnHeaders,
  normalizeMatrizFactorValue,
  toggleMatrizFactorColumn,
} from '@/lib/sodexo-ho-table'
import { emptySodexoExtension } from '@/schemas/clinical/examen-medico-variant.schema'

describe('sodexo-ho-table', () => {
  it('activa columnas de matriz según filas HO', () => {
    const ext = {
      ...emptySodexoExtension(),
      historia_ocupacional_filas: [
        { empresa_area: 'Empresa Uno', ocupacion: 'Op', es_actual: false },
        { empresa_area: 'Actual SA', ocupacion: 'Jefe', es_actual: true },
      ],
    }
    const headers = matrizColumnHeaders(hoTableForUi(ext))
    expect(headers[0].active).toBe(true)
    expect(headers[0].subtitle).toContain('Empresa Uno')
    expect(headers[4].active).toBe(false)
    expect(headers[5].key).toBe('A')
    expect(headers[5].active).toBe(true)
  })

  it('matriz admite varias columnas por factor y legacy string', () => {
    expect(normalizeMatrizFactorValue('3')).toEqual(['3'])
    let m = toggleMatrizFactorColumn(null, 'ruido', '1', true)
    m = toggleMatrizFactorColumn(m, 'ruido', 'A', true)
    expect(m?.ruido).toEqual(['1', 'A'])
  })
})
