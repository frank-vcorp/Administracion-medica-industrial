import { describe, expect, it } from 'vitest'
import {
  parseHeredoFamiliaresSelection,
  serializeHeredoFamiliaresSelection,
  toggleHeredoFamiliaresOption,
} from '@/lib/heredo-familiares-multiselect'

describe('heredo-familiares multiselect', () => {
  it('parsea legacy de una sola opción', () => {
    expect(parseHeredoFamiliaresSelection('PADRE')).toEqual(['PADRE'])
  })

  it('parsea varias opciones separadas por coma', () => {
    expect(parseHeredoFamiliaresSelection('PADRE, HERMANOS')).toEqual(['PADRE', 'HERMANOS'])
  })

  it('serializa en orden ZIN', () => {
    expect(serializeHeredoFamiliaresSelection(['HERMANOS', 'PADRE'])).toBe('PADRE, HERMANOS')
  })

  it('NEGADOS es exclusivo', () => {
    expect(toggleHeredoFamiliaresOption(['PADRE'], 'NEGADOS')).toEqual(['NEGADOS'])
    expect(toggleHeredoFamiliaresOption(['NEGADOS'], 'MADRE')).toEqual(['MADRE'])
  })
})
