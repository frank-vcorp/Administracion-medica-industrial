import { describe, expect, it } from 'vitest'
import {
  buildPbProfileNameFromTests,
  ensurePbProfileName,
  testAbbreviation,
} from '@/lib/public-general-profile-name'

describe('public-general-profile-name', () => {
  it('genera abreviatura de 3 letras desde código', () => {
    expect(
      testAbbreviation({ id: '1', code: 'AUD-01', name: 'Audiometría' })
    ).toBe('AUD')
  })

  it('arma nombre PB ordenado por abreviatura', () => {
    const name = buildPbProfileNameFromTests([
      { id: 'b', code: 'ESP-01', name: 'Espirometría' },
      { id: 'a', code: 'AUD-01', name: 'Audiometría' },
    ])
    expect(name).toBe('PB AUD-ESP')
  })

  it('trunca con +N cuando hay muchas pruebas', () => {
    const tests = ['AUD', 'ESP', 'SOM', 'LAB', 'HEM'].map((code, i) => ({
      id: String(i),
      code,
      name: code,
    }))
    expect(buildPbProfileNameFromTests(tests)).toBe('PB AUD-ESP-HEM-LAB +1')
  })

  it('usa nombre auto si el usuario no escribe nada', () => {
    expect(ensurePbProfileName('', 'PB AUD-ESP')).toBe('PB AUD-ESP')
  })

  it('prefija PB al nombre custom', () => {
    expect(ensurePbProfileName('Examen mostrador', 'PB AUD')).toBe(
      'PB Examen mostrador'
    )
  })
})
