import { describe, expect, it } from 'vitest'
import {
  parseHeredoFamiliaresMulti,
  serializeHeredoFamiliaresMulti,
  toggleHeredoFamiliaresMulti,
} from '../heredofamiliares-zin'
import { formatHeredoFamiliaresValor } from '../antecedentes-fields'

describe('heredofamiliares-zin multiselect', () => {
  it('serializa y parsea múltiples parentescos', () => {
    const stored = serializeHeredoFamiliaresMulti(['PADRE', 'MADRE'])
    expect(stored).toBe('PADRE|MADRE')
    expect(parseHeredoFamiliaresMulti(stored)).toEqual(['PADRE', 'MADRE'])
  })

  it('legacy valor único sigue parseando', () => {
    expect(parseHeredoFamiliaresMulti('AB PATERNO')).toEqual(['AB PATERNO'])
  })

  it('toggle agrega y quita opciones', () => {
    const afterAdd = toggleHeredoFamiliaresMulti('', 'PADRE', true)
    expect(afterAdd).toBe('PADRE')
    const afterSecond = toggleHeredoFamiliaresMulti(afterAdd, 'MADRE', true)
    expect(parseHeredoFamiliaresMulti(afterSecond)).toEqual(['PADRE', 'MADRE'])
    const afterRemove = toggleHeredoFamiliaresMulti(afterSecond, 'PADRE', false)
    expect(afterRemove).toBe('MADRE')
  })

  it('format display une multiselect', () => {
    expect(formatHeredoFamiliaresValor('PADRE|MADRE', '')).toBe('PADRE, MADRE')
  })
})
