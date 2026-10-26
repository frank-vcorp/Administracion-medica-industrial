import { describe, expect, it } from 'vitest'
import { loadSodexoExtensionFromStorage } from '@/lib/sodexo-extension-validation'

describe('loadSodexoExtensionFromStorage', () => {
  it('devuelve vacío si no hay objeto', () => {
    expect(loadSodexoExtensionFromStorage(null).contacto_emergencia).toBe('')
    expect(loadSodexoExtensionFromStorage(undefined).tipo_examen).toBeNull()
  })

  it('parsea JSON válido', () => {
    const out = loadSodexoExtensionFromStorage({
      tipo_examen: 'PREINGRESO',
      contacto_emergencia: 'María',
      telefono_emergencia: '555',
    })
    expect(out.tipo_examen).toBe('PREINGRESO')
    expect(out.contacto_emergencia).toBe('María')
  })

  it('conserva campos cuando Zod rechaza el objeto completo', () => {
    const raw = {
      tipo_examen: 'PREINGRESO',
      contacto_emergencia: 'Juan Pérez',
      telefono_emergencia: '5512345678',
      examen_fisico_sodexo: {
        '91_craneo': { resultado: 'NOT_A_VALID_ENUM' },
      },
    }
    const out = loadSodexoExtensionFromStorage(raw)
    expect(out.contacto_emergencia).toBe('Juan Pérez')
    expect(out.telefono_emergencia).toBe('5512345678')
    expect(out.examen_fisico_sodexo).toEqual(raw.examen_fisico_sodexo)
  })
})
