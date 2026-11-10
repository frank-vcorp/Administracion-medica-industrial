import { describe, expect, it } from 'vitest'
import {
  patologiaEspecificacionPlaceholder,
  patologiaRequiresEspecificacion,
} from '@/lib/patologia-especificacion-fields'

describe('patologiaRequiresEspecificacion', () => {
  it('requiere especificación en exantemáticas, psiquiátricas y otras', () => {
    expect(patologiaRequiresEspecificacion('exantematicas')).toBe(true)
    expect(patologiaRequiresEspecificacion('psiquiatricas')).toBe(true)
    expect(patologiaRequiresEspecificacion('otras')).toBe(true)
  })

  it('no requiere especificación en el resto de patológicos', () => {
    expect(patologiaRequiresEspecificacion('diabetes')).toBe(false)
    expect(patologiaRequiresEspecificacion('alergias')).toBe(false)
  })
})

describe('patologiaEspecificacionPlaceholder', () => {
  it('devuelve texto distinto para otras', () => {
    expect(patologiaEspecificacionPlaceholder('otras')).toContain('enfermedad')
  })
})
