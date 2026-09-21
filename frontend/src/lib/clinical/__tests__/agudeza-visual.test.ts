import { describe, it, expect } from 'vitest'
import {
  deriveAgudezaVisualResumen,
  parseSnellenDenominator,
} from '@/lib/clinical/agudeza-visual'

describe('agudeza-visual (R-08)', () => {
  it('parseSnellenDenominator: ignora NO APLICA y vacío', () => {
    expect(parseSnellenDenominator('NO APLICA')).toBeNull()
    expect(parseSnellenDenominator('')).toBeNull()
    expect(parseSnellenDenominator('20/20')).toBe(20)
  })

  it('deriveAgudezaVisualResumen: normal / disminuida / intermedio / ausente', () => {
    expect(deriveAgudezaVisualResumen('20/20', '20/20')).toBe('NORMAL')
    expect(deriveAgudezaVisualResumen('20/25', '20/25')).toBe('NORMAL')
    expect(deriveAgudezaVisualResumen('20/20', '20/40')).toBe('DISMINUIDA')
    expect(deriveAgudezaVisualResumen('20/30', '20/30')).toBe(
      'BAJA AL MOMENTO DE LA TOMA',
    )
    expect(deriveAgudezaVisualResumen('', '')).toBe('')
    expect(deriveAgudezaVisualResumen('NO APLICA', 'NO APLICA')).toBe('')
  })
})
