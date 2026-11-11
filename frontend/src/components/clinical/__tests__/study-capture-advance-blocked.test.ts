/**
 * Avance bloqueado: la validación de completar no debe pasar con captura vacía.
 */
import { describe, expect, it } from 'vitest'
import {
  formatStudyMissingFieldsSpanish,
  validateStudyCaptureForComplete,
} from '@/lib/clinical/study-required-fields'

describe('study capture — advance blocked when incomplete', () => {
  it('no permite marcar somatometría completada sin datos mínimos', () => {
    const gate = validateStudyCaptureForComplete('Somatometria', {
      peso_kg: '',
      talla_m: '',
    })
    expect(gate.ok).toBe(false)
    if (!gate.ok) {
      const banner = formatStudyMissingFieldsSpanish(gate.missing)
      expect(banner).toContain('Falta:')
      expect(banner.length).toBeGreaterThan(10)
    }
  })

  it('no permite marcar agudeza completada sin lejana bilateral', () => {
    const gate = validateStudyCaptureForComplete('AgudezaVisual', {})
    expect(gate.ok).toBe(false)
    if (!gate.ok) {
      expect(gate.missing.some((m) => m.field === 'vision_lejana_od')).toBe(true)
    }
  })
})
