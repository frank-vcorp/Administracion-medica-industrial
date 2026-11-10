import { describe, expect, it } from 'vitest'
import {
  mapExamenMedicoGateError,
  resolveNavigationForFieldKey,
} from '@/lib/clinical/examen-medico-save-errors'

describe('examen-medico-save-errors', () => {
  it('navega a somatometría cuando falta peso/talla', () => {
    const mapped = mapExamenMedicoGateError(
      'Completa somatometría (peso y talla) antes de cerrar la captura.',
    )
    expect(mapped.navigation.outerTab).toBe('somatometria')
    expect(mapped.fieldErrors.peso_kg?.[0]).toMatch(/somatometr/i)
  })

  it('navega a impresión para impresión diagnóstica', () => {
    const nav = resolveNavigationForFieldKey('impresion_diagnostica')
    expect(nav.outerTab).toBe('examen_medico')
    expect(nav.innerTab).toBe('impresion')
  })
})
