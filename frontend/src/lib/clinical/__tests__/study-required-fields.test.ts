import { describe, expect, it } from 'vitest'
import {
  formatStudyMissingFieldsSpanish,
  resolveStudyCaptureKind,
  validateStudyCaptureForComplete,
} from '../study-required-fields'

describe('study-required-fields', () => {
  it('resolveStudyCaptureKind identifica somatometría y agudeza', () => {
    expect(
      resolveStudyCaptureKind({ testNameSnapshot: 'Somatometría y signos vitales' }),
    ).toBe('Somatometria')
    expect(resolveStudyCaptureKind({ testNameSnapshot: 'Agudeza Visual' })).toBe(
      'AgudezaVisual',
    )
    expect(
      resolveStudyCaptureKind({
        testNameSnapshot: 'Campimetría',
        canonicalStudyType: 'Campimetria',
      }),
    ).toBe('Campimetria')
  })

  it('Somatometria: bloquea completar sin peso, talla o signos vitales', () => {
    const empty = validateStudyCaptureForComplete('Somatometria', {})
    expect(empty.ok).toBe(false)
    if (!empty.ok) {
      expect(formatStudyMissingFieldsSpanish(empty.missing)).toMatch(/Falta:/)
      expect(formatStudyMissingFieldsSpanish(empty.missing)).toMatch(/peso/)
    }

    const onlyPeso = validateStudyCaptureForComplete('Somatometria', {
      peso_kg: 80,
      talla_m: 1.75,
    })
    expect(onlyPeso.ok).toBe(false)

    const complete = validateStudyCaptureForComplete('Somatometria', {
      peso_kg: 80,
      talla_m: 1.75,
      ta_sistolica: 120,
    })
    expect(complete.ok).toBe(true)
  })

  it('AgudezaVisual: exige visión lejana OD/OI', () => {
    const bad = validateStudyCaptureForComplete('AgudezaVisual', {
      vision_lejana_od: '',
      vision_lejana_oi: '20/20',
    })
    expect(bad.ok).toBe(false)

    const ok = validateStudyCaptureForComplete('AgudezaVisual', {
      vision_lejana_od: '20/20',
      vision_lejana_oi: '20/25',
    })
    expect(ok.ok).toBe(true)
  })

  it('formatStudyMissingFieldsSpanish une etiquetas en español', () => {
    expect(
      formatStudyMissingFieldsSpanish([
        { label: 'resultado OD' },
        { label: 'fecha de estudio' },
      ]),
    ).toBe('Falta: resultado OD, fecha de estudio.')
  })

  it('Campimetria: confrontación bilateral obligatoria al completar', () => {
    const bad = validateStudyCaptureForComplete('Campimetria', {
      confrontacion: { ojo_derecho: '', ojo_izquierdo: '' },
    })
    expect(bad.ok).toBe(false)

    const ok = validateStudyCaptureForComplete('Campimetria', {
      confrontacion: {
        ojo_derecho: 'CAMPOS VISUALES DENTRO DE PARAMETROS NORMALES',
        ojo_izquierdo: 'CAMPOS VISUALES DENTRO DE PARAMETROS NORMALES',
      },
    })
    expect(ok.ok).toBe(true)
  })
})
