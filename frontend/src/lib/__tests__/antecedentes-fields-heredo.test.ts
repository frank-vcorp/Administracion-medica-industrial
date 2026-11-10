import { describe, expect, it } from 'vitest'
import {
  formatHeredoFamiliaresValor,
  heredoFamiliaresEspecifiqueKey,
  readHeredoFamiliaresDisplay,
  readTatuajesDisplay,
  readTratamientoMedicoActualDisplay,
} from '../antecedentes-fields'
import { HeredoFamiliaresSchema } from '@/schemas/clinical/history.schema'

describe('heredo-familiares multiselect (F-23)', () => {
  it('genera key especifique por campo', () => {
    expect(heredoFamiliaresEspecifiqueKey('cancer')).toBe('cancer_especifique')
  })

  it('formatea varios parentescos para PDF', () => {
    expect(formatHeredoFamiliaresValor('PADRE, HERMANOS', '')).toBe('PADRE, HERMANOS')
    expect(formatHeredoFamiliaresValor('PADRE', '')).toBe('PADRE')
  })

  it('formatea mentales SI con especificación', () => {
    expect(formatHeredoFamiliaresValor('SI', 'depresión materna')).toBe('SI (depresión materna)')
  })

  it('lee display desde snapshot multiselect', () => {
    const text = readHeredoFamiliaresDisplay({ cancer: 'PADRE, AB MATERNO' }, 'cancer')
    expect(text).toBe('PADRE, AB MATERNO')
  })

  it('schema acepta cancer multiselect', () => {
    const parsed = HeredoFamiliaresSchema.parse({
      cancer: 'PADRE, HERMANOS',
    })
    expect(parsed.cancer).toBe('PADRE, HERMANOS')
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
