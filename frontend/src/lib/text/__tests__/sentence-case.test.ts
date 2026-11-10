import { describe, expect, it } from 'vitest'
import {
  applySentenceCaseIfAllCaps,
  isAllCapsUserText,
} from '@/lib/text/sentence-case'

describe('isAllCapsUserText', () => {
  it('detecta MAYÚSCULAS con acentos', () => {
    expect(isAllCapsUserText('DOLOR DE CABEZA')).toBe(true)
    expect(isAllCapsUserText('MARÍA')).toBe(true)
  })

  it('ignora cadenas mixtas o minúsculas', () => {
    expect(isAllCapsUserText('Dolor de cabeza')).toBe(false)
    expect(isAllCapsUserText('McDonald')).toBe(false)
    expect(isAllCapsUserText('Covid-19')).toBe(false)
  })

  it('trata acrónimo todo en mayúsculas como convertible', () => {
    expect(isAllCapsUserText('COVID-19')).toBe(true)
    expect(applySentenceCaseIfAllCaps('COVID-19')).toBe('Covid-19')
  })

  it('ignora solo números o vacío', () => {
    expect(isAllCapsUserText('120/80')).toBe(false)
    expect(isAllCapsUserText('')).toBe(false)
  })
})

describe('applySentenceCaseIfAllCaps', () => {
  it('convierte todo MAYÚSCULAS a oración preservando acentos', () => {
    expect(applySentenceCaseIfAllCaps('DOLOR DE CABEZA')).toBe('Dolor de cabeza')
    expect(applySentenceCaseIfAllCaps('  MARÍA GÓMEZ  ')).toBe('María gómez')
  })

  it('no altera texto ya mixto', () => {
    expect(applySentenceCaseIfAllCaps('iPhone')).toBe('iPhone')
    expect(applySentenceCaseIfAllCaps('Dolor leve')).toBe('Dolor leve')
  })

  it('respeta espacios iniciales del valor original cuando no transforma', () => {
    expect(applySentenceCaseIfAllCaps('  mixto Case')).toBe('  mixto Case')
  })

  it('capitaliza tras prefijo no alfabético', () => {
    expect(applySentenceCaseIfAllCaps('123 ABC')).toBe('123 Abc')
  })
})
