import { describe, expect, it } from 'vitest'
import {
  formatCatalogEnumListDisplay,
  getCatalogEnumDisplayLabel,
} from '@/lib/clinical/enum-display-labels'

describe('getCatalogEnumDisplayLabel', () => {
  it('convierte catálogos clínicos frecuentes', () => {
    expect(getCatalogEnumDisplayLabel('MATUTINO')).toBe('Matutino')
    expect(getCatalogEnumDisplayLabel('SOLTERO')).toBe('Soltero/a')
    expect(getCatalogEnumDisplayLabel('NEGADOS')).toBe('Negados')
    expect(getCatalogEnumDisplayLabel('PADRE')).toBe('Padre')
    expect(getCatalogEnumDisplayLabel('AB PATERNO')).toBe('Ab paterno')
    expect(getCatalogEnumDisplayLabel('SI')).toBe('Sí')
    expect(getCatalogEnumDisplayLabel('NO APLICA')).toBe('No aplica')
  })

  it('aplica modo oración a frases ZIN largas', () => {
    expect(getCatalogEnumDisplayLabel('PRESENTES Y NORMALES')).toBe(
      'Presentes y normales',
    )
  })

  it('deja códigos mixtos intactos', () => {
    expect(getCatalogEnumDisplayLabel('O+')).toBe('O+')
  })
})

describe('formatCatalogEnumListDisplay', () => {
  it('formatea multiselect heredo-familiares', () => {
    expect(formatCatalogEnumListDisplay('PADRE, HERMANOS')).toBe('Padre, Hermanos')
  })
})
