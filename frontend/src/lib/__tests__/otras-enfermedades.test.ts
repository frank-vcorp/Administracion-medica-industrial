import { describe, expect, it } from 'vitest'
import { PatologicosSchema } from '@/schemas/clinical/history.schema'
import {
  coerceOtrasEnfermedadesList,
  hydrateOtrasEnfermedadesFromPatologicos,
  otrasEnfermedadesForPersist,
} from '@/lib/otras-enfermedades'

describe('otras_enfermedades (APP — múltiples texto libre)', () => {
  it('coerce: string único legacy → array de uno', () => {
    expect(coerceOtrasEnfermedadesList('Lupus')).toEqual(['Lupus'])
    expect(coerceOtrasEnfermedadesList('  ')).toEqual([])
  })

  it('hydrate: prioriza otras_enfermedades; fallback a especificacion', () => {
    expect(
      hydrateOtrasEnfermedadesFromPatologicos({
        otras_enfermedades: ['A', 'B'],
        otras: { estado: 'SI', detalle: { especificacion: 'Legacy' } },
      }),
    ).toEqual(['A', 'B'])

    expect(
      hydrateOtrasEnfermedadesFromPatologicos({
        otras: {
          estado: 'SI',
          detalle: { especificacion: 'Solo legacy' },
        },
      }),
    ).toEqual(['Solo legacy'])
  })

  it('otrasEnfermedadesForPersist filtra vacíos', () => {
    expect(otrasEnfermedadesForPersist([' A ', '', 'B'])).toEqual(['A', 'B'])
  })

  it('PatologicosSchema: guarda múltiples y sincroniza primera en especificacion', () => {
    const parsed = PatologicosSchema.parse({
      otras: {
        estado: 'SI',
        detalle: {
          desde_cuando: '2020',
          tratamiento: '',
          observaciones: '',
          especificacion: '',
        },
      },
      otras_enfermedades: ['Fibromialgia', 'Síndrome de Raynaud'],
    })
    expect(parsed.otras_enfermedades).toEqual(['Fibromialgia', 'Síndrome de Raynaud'])
    expect(parsed.otras.detalle?.especificacion).toBe('Fibromialgia')
    expect(parsed.otras.detalle?.desde_cuando).toBe('2020')
  })

  it('PatologicosSchema: legacy solo especificacion → otras_enfermedades', () => {
    const parsed = PatologicosSchema.parse({
      otras: {
        estado: 'SI',
        detalle: { especificacion: 'Ulcera péptica' },
      },
    })
    expect(parsed.otras_enfermedades).toEqual(['Ulcera péptica'])
  })
})
