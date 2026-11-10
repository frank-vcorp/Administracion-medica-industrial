import { describe, expect, it } from 'vitest'
import {
  findCie10ByCode,
  formatCie10Unified,
  getCie10CatalogSize,
  listCie10CatalogPreview,
  parseDiagnosticoUnificadoStored,
  searchCie10Catalog,
} from '@/lib/clinical/cie-10-catalog'
import { formatCie10Code } from '@/lib/clinical/cie-10-format'

describe('cie-10-catalog', () => {
  it('carga el catálogo oficial (sin códigos inventados en tests)', () => {
    expect(getCie10CatalogSize()).toBeGreaterThan(8000)
  })

  it('normaliza código con punto para presentación', () => {
    expect(formatCie10Code('G130')).toBe('G13.0')
    expect(formatCie10Code('J069')).toBe('J06.9')
  })

  it('resuelve un código conocido del catálogo', () => {
    const entry = findCie10ByCode('J069')
    expect(entry).not.toBeNull()
    expect(entry?.description.length).toBeGreaterThan(5)
  })

  it('busca por prefijo de código y por texto', () => {
    const preview = listCie10CatalogPreview(10)
    expect(preview.length).toBe(10)

    const byCode = searchCie10Catalog('J06', 5)
    expect(byCode.length).toBeGreaterThan(0)
    expect(byCode.every((e) => e.code.startsWith('J06'))).toBe(true)

    const byText = searchCie10Catalog('diabetes', 5)
    expect(byText.length).toBeGreaterThan(0)
    expect(byText.some((e) => e.description.toLowerCase().includes('diabetes'))).toBe(true)
  })

  it('formatea y parsea diagnóstico unificado persistido', () => {
    const entry = findCie10ByCode('J069')
    expect(entry).not.toBeNull()
    if (!entry) return
    const stored = formatCie10Unified(entry)
    const parsed = parseDiagnosticoUnificadoStored(stored)
    expect(parsed?.code).toBe(entry.code)
    expect(parsed?.description).toBe(entry.description)
  })
})
