import { describe, expect, it } from 'vitest'
import {
  formatHeredoFamiliaresValor,
  heredoFamiliaresEspecifiqueKey,
  readHeredoFamiliaresDisplay,
} from '../antecedentes-fields'
import { HeredoFamiliaresSchema } from '@/schemas/clinical/history.schema'

describe('heredo-familiares OTROS + especifique', () => {
  it('genera key especifique por campo', () => {
    expect(heredoFamiliaresEspecifiqueKey('cancer')).toBe('cancer_especifique')
  })

  it('formatea OTROS con detalle para PDF', () => {
    expect(formatHeredoFamiliaresValor('OTROS', 'TÍO PATERNO')).toBe('OTROS (TÍO PATERNO)')
    expect(formatHeredoFamiliaresValor('PADRE', '')).toBe('PADRE')
  })

  it('lee display desde snapshot con cancer_especifique', () => {
    const text = readHeredoFamiliaresDisplay(
      { cancer: 'OTROS', cancer_especifique: 'Mama — abuela materna' },
      'cancer',
    )
    expect(text).toBe('OTROS (Mama — abuela materna)')
  })

  it('schema acepta cancer_especifique independiente del select', () => {
    const parsed = HeredoFamiliaresSchema.parse({
      cancer: 'OTROS',
      cancer_especifique: 'Próstata — padre',
    })
    expect(parsed.cancer).toBe('OTROS')
    expect(parsed.cancer_especifique).toBe('Próstata — padre')
  })
})
