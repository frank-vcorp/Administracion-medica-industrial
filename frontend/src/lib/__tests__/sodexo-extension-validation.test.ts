import { describe, expect, it } from 'vitest'
import { validateSodexoExtensionForClinicalClose } from '@/lib/sodexo-extension-validation'
import { emptySodexoExtension } from '@/schemas/clinical/examen-medico-variant.schema'

describe('sodexo-extension-validation', () => {
  it('rechaza extensión mínima vacía', () => {
    const r = validateSodexoExtensionForClinicalClose(emptySodexoExtension())
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors.length).toBeGreaterThan(2)
  })

  it('acepta extensión periódica completa', () => {
    const ext = {
      ...emptySodexoExtension(),
      tipo_examen: 'PERIODICA' as const,
      contacto_emergencia: 'Juan',
      telefono_emergencia: '4420000000',
      actividades_cargo: 'Operador',
      fecha_ingreso_actividades: '01/01/2020',
    }
    expect(validateSodexoExtensionForClinicalClose(ext).ok).toBe(true)
  })

})
