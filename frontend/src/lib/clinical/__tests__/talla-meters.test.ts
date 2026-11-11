import { describe, expect, it } from 'vitest'
import { SomatometriaVitalesSchema } from '@/schemas/clinical/exam.schema'
import {
  computeBmi,
  formatTallaMetersForDisplay,
  formatTallaMetersWhileTyping,
  normalizeTallaMetersToNumber,
} from '../talla-meters'

describe('formatTallaMetersWhileTyping', () => {
  it('formatea dígitos sin punto como metros', () => {
    expect(formatTallaMetersWhileTyping('198')).toBe('1.98')
    expect(formatTallaMetersWhileTyping('175')).toBe('1.75')
    expect(formatTallaMetersWhileTyping('17')).toBe('1.7')
    expect(formatTallaMetersWhileTyping('1')).toBe('1')
  })

  it('respeta punto o coma decimal explícito', () => {
    expect(formatTallaMetersWhileTyping('1.75')).toBe('1.75')
    expect(formatTallaMetersWhileTyping('1,98')).toBe('1.98')
  })
})

describe('normalizeTallaMetersToNumber', () => {
  it('interpreta metros y cm enteros', () => {
    expect(normalizeTallaMetersToNumber('1.75')).toBe(1.75)
    expect(normalizeTallaMetersToNumber('175')).toBe(1.75)
    expect(normalizeTallaMetersToNumber(198)).toBe(1.98)
    expect(normalizeTallaMetersToNumber('198')).toBe(1.98)
  })

  it('rechaza valores imposibles', () => {
    expect(normalizeTallaMetersToNumber('')).toBeUndefined()
    expect(normalizeTallaMetersToNumber('0')).toBeUndefined()
    expect(normalizeTallaMetersToNumber('400')).toBeUndefined()
  })
})

describe('computeBmi', () => {
  it('IMC con talla en metros', () => {
    const r = computeBmi(70, '1.75')
    expect(r.tallaM).toBe(1.75)
    expect(r.imc).toBe('22.86')
  })

  it('IMC cuando talla se captura como cm (198)', () => {
    const r = computeBmi(80, '198')
    expect(r.tallaM).toBe(1.98)
    expect(r.imc).toBe('20.41')
  })

  it('IMC cuando talla es 175 sin punto', () => {
    const r = computeBmi(75, '175')
    expect(r.tallaM).toBe(1.75)
    expect(r.imc).toBe('24.49')
  })
})

describe('formatTallaMetersForDisplay', () => {
  it('muestra dos decimales normalizados', () => {
    expect(formatTallaMetersForDisplay('198')).toBe('1.98')
    expect(formatTallaMetersForDisplay('1.75')).toBe('1.75')
  })
})

describe('SomatometriaVitalesSchema', () => {
  it('normaliza talla cm y recalcula IMC al guardar', () => {
    const parsed = SomatometriaVitalesSchema.parse({
      peso_kg: '80',
      talla_m: '198',
      imc: 0,
    })
    expect(parsed.talla_m).toBe(1.98)
    expect(parsed.imc).toBeCloseTo(20.41, 2)
  })
})
