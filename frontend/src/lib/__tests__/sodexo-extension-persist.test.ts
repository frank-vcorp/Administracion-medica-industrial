import { describe, expect, it } from 'vitest'
import {
  deepMergeJson,
  mergeVariantExtensionsForPersist,
  sodexoExtensionLooksPersisted,
} from '@/lib/sodexo-extension-persist'

describe('sodexo-extension-persist', () => {
  it('deepMerge conserva arrays previos si incoming viene vacío', () => {
    const prior = { filas: [{ empresa: 'A' }] }
    const incoming = { filas: [] }
    expect(deepMergeJson(prior, incoming)).toEqual(prior)
  })

  it('detecta extensión con captura previa', () => {
    expect(sodexoExtensionLooksPersisted({ tipo_examen: 'PERIODICA' })).toBe(true)
    expect(sodexoExtensionLooksPersisted({})).toBe(false)
  })

  it('no deja que autosave vacíe SODEXO con datos previos', () => {
    const prior = {
      SODEXO: {
        tipo_examen: 'PERIODICA',
        contacto_emergencia: 'María',
        telefono_emergencia: '4421111111',
        patologicos_sodexo: { fracturas: { estado: 'SI', descripcion: '2020' } },
      },
    }
    const incoming = {
      SODEXO: {
        tipo_examen: null,
        contacto_emergencia: '',
        patologicos_sodexo: { fracturas: { estado: 'NEGADO' } },
      },
    }
    const out = mergeVariantExtensionsForPersist(prior, incoming)!
    const sodexo = out.SODEXO as Record<string, unknown>
    expect(sodexo.contacto_emergencia).toBe('María')
    expect(sodexo.tipo_examen).toBe('PERIODICA')
    const pat = sodexo.patologicos_sodexo as Record<string, unknown>
    expect((pat.fracturas as { estado: string; descripcion: string }).estado).toBe('SI')
    expect((pat.fracturas as { descripcion: string }).descripcion).toBe('2020')
  })
})
