import { describe, expect, it } from 'vitest'
import {
  examenMedicoNavSectionFromTabs,
  parseExamenMedicoNavSection,
  patchPapeletaSearchParams,
} from '@/lib/clinical/papeleta-navigation'

describe('papeleta-navigation', () => {
  it('parsea inner tab como bloque clínico', () => {
    expect(parseExamenMedicoNavSection('extension')).toEqual({
      outerTab: 'examen_medico',
      innerTab: 'extension',
    })
  })

  it('parsea outer tab', () => {
    expect(parseExamenMedicoNavSection('signos_vitales')).toEqual({
      outerTab: 'signos_vitales',
      innerTab: 'antecedentes',
    })
  })

  it('serializa pestaña activa para URL', () => {
    expect(
      examenMedicoNavSectionFromTabs('examen_medico', 'impresion'),
    ).toBe('impresion')
    expect(examenMedicoNavSectionFromTabs('agudeza_visual', 'antecedentes')).toBe(
      'agudeza_visual',
    )
  })

  it('patch mantiene view y actualiza eventTest', () => {
    const base = new URLSearchParams('view=IN_PROGRESS&foo=1')
    const next = patchPapeletaSearchParams(base, {
      eventTest: 'abc-123',
      emSection: 'extension',
    })
    expect(next.get('view')).toBe('IN_PROGRESS')
    expect(next.get('foo')).toBe('1')
    expect(next.get('eventTest')).toBe('abc-123')
    expect(next.get('emSection')).toBe('extension')
  })
})
