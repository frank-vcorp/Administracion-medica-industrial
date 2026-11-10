import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { mapSaveClinicalFailure, mapUserFacingError } from '@/lib/user-facing-error'

describe('mapUserFacingError', () => {
  it('clasifica ZodError como validación con lista legible', () => {
    const err = z
      .object({ peso_kg: z.string().min(1, 'Indica el peso') })
      .safeParse({}).error as z.ZodError
    const out = mapUserFacingError({ error: err })
    expect(out.kind).toBe('validation')
    expect(out.userMessage).toContain('Peso (kg)')
    expect(out.userMessage.toLowerCase()).toContain('peso')
  })

  it('mensajes de uso (incompleto) mantienen tipo usage', () => {
    const out = mapUserFacingError({
      message: 'Completa agudeza visual antes de cerrar la captura.',
    })
    expect(out.kind).toBe('usage')
    expect(out.title).toBe('Acción no permitida o datos incompletos')
  })

  it('fallo técnico usa resumen corto y detalle separado', () => {
    const out = mapUserFacingError({
      message: 'No se pudo guardar por un problema del servidor o de red.',
      serverTechnicalDetail: 'ECONNRESET',
      context: 'prueba',
    })
    expect(out.kind).toBe('technical')
    expect(out.userMessage.length).toBeGreaterThan(10)
    expect(out.technicalDetail).toContain('ECONNRESET')
    expect(out.technicalDetail).toContain('[prueba]')
  })

  it('HTTP 503 aporta mensaje amigable', () => {
    const out = mapUserFacingError({ httpStatus: 503 })
    expect(out.kind).toBe('technical')
    expect(out.userMessage).toMatch(/no está disponible|servicio/i)
  })
})

describe('mapSaveClinicalFailure', () => {
  it('une error de servidor y fieldErrors en validación', () => {
    const out = mapSaveClinicalFailure(
      {
        success: false,
        error: 'Revisa el formulario.',
        fieldErrors: { medico_cedula: ['Indica la cédula'] },
      },
      { context: 'certificado' },
    )
    expect(out.kind).toBe('validation')
    expect(out.userMessage).toContain('Cédula profesional del médico')
  })
})
