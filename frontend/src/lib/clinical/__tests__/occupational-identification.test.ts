import { describe, expect, it } from 'vitest'
import {
  formatTenureInAreaLabel,
  resolveOccupationalIdentification,
} from '../occupational-identification'

describe('occupational-identification', () => {
  it('formatTenureInAreaLabel arma años y meses', () => {
    expect(formatTenureInAreaLabel(3, 6)).toBe('3 años 6 meses')
    expect(formatTenureInAreaLabel(1, 1)).toBe('1 año 1 mes')
    expect(formatTenureInAreaLabel(0, 0)).toBeNull()
  })

  it('resolveOccupationalIdentification prioriza snapshot de la cita', () => {
    const resolved = resolveOccupationalIdentification([
      {
        antecedentes_captured: {
          datos_personales: {
            puesto_actual: 'Soldador',
            area_departamento: 'Línea 2',
            antiguedad_anios: 3,
            antiguedad_meses: 6,
          },
        },
      },
      {
        datos_personales: {
          area_departamento: 'Otro',
          antiguedad_anios: 1,
        },
      },
    ])
    expect(resolved.position).toBe('Soldador')
    expect(resolved.workArea).toBe('Línea 2')
    expect(resolved.tenureLabel).toBe('3 años 6 meses')
  })
})
