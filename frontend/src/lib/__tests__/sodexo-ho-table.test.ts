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

  it('una fila sin es_actual se trata como empleo actual', () => {
    const ext = {
      ...emptySodexoExtension(),
      historia_ocupacional_filas: [
        { empresa_area: 'Systron', ocupacion: 'Ayudante', anios: '1', meses: '1' },
      ],
    }
    const ui = hoTableForUi(ext)
    expect(ui.actual.empresa_area).toBe('Systron')
    expect(ui.actual.ocupacion).toBe('Ayudante')
    expect(ui.historico[0].empresa_area).toBe('')
  })

  it('matriz admite varias columnas por factor y legacy string', () => {
    expect(normalizeMatrizFactorValue('3')).toEqual(['3'])
    let m = toggleMatrizFactorColumn(null, 'ruido', '1', true)
    m = toggleMatrizFactorColumn(m, 'ruido', 'A', true)
    expect(m?.ruido).toEqual(['1', 'A'])
  })
})
