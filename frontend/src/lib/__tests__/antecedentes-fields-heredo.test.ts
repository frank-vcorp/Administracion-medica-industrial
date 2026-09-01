import { describe, expect, it } from 'vitest'
import {
  formatHeredoFamiliaresValor,
  heredoFamiliaresEspecifiqueKey,
  readHeredoFamiliaresDisplay,
  readTatuajesDisplay,
  readTratamientoMedicoActualDisplay,
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

describe('tratamiento médico actual en No Patológicos', () => {
  it('lee SI con especifique', () => {
    expect(
      readTratamientoMedicoActualDisplay({
        tratamiento_medico_actual: 'SI',
        tratamiento_medico_actual_especifique: 'Metformina 850 mg',
      }),
    ).toBe('SI — Metformina 850 mg')
  })

  it('NEGADO por defecto', () => {
    expect(readTratamientoMedicoActualDisplay({})).toBe('NEGADO')
  })
})

describe('tatuajes en No Patológicos', () => {
  it('lee SI con ubicación desde tatuajes_especifique', () => {
    expect(
      readTatuajesDisplay({ tatuajes: 'SI', tatuajes_especifique: 'Brazo derecho' }),
    ).toBe('SI — Brazo derecho')
  })

  it('SI sin ubicación', () => {
    expect(readTatuajesDisplay({ tatuajes: 'SI' })).toBe('SI')
  })

  it('NEGADO por defecto sin datos', () => {
    expect(readTatuajesDisplay({})).toBe('NEGADO')
  })
})
