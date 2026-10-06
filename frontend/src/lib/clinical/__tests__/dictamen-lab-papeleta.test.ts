import { describe, it, expect } from 'vitest'
import {
  buildDictamenLabClinicalContext,
  filterServiceEntriesForDictamenGeneral,
  isDictamenOptionalLabTest,
  readIncludeInDictamenGeneral,
} from '../dictamen-lab-papeleta'

describe('dictamen-lab-papeleta', () => {
  it('detecta PIE y PRUEBA ESPECIAL', () => {
    expect(isDictamenOptionalLabTest('PIE ORINA')).toBe(true)
    expect(isDictamenOptionalLabTest('pie sangre')).toBe(true)
    expect(isDictamenOptionalLabTest('PRUEBA ESPECIAL')).toBe(true)
    expect(isDictamenOptionalLabTest('BIOMETRIA HEMATICA')).toBe(false)
  })

  it('default incluir si no hay contexto', () => {
    expect(readIncludeInDictamenGeneral('PIE ORINA', null)).toBe(true)
  })

  it('respeta includeInDictamenGeneral false', () => {
    const ctx = buildDictamenLabClinicalContext(false)
    expect(readIncludeInDictamenGeneral('PIE ORINA', ctx)).toBe(false)
  })

  it('filtra labs excluidos del dictamen', () => {
    const filtered = filterServiceEntriesForDictamenGeneral(
      [
        { serviceName: 'PIE ORINA', x: 1 },
        { serviceName: 'BIOMETRIA', x: 2 },
      ],
      [
        {
          testNameSnapshot: 'PIE ORINA',
          clinicalContext: buildDictamenLabClinicalContext(false),
        },
      ],
    )
    expect(filtered.map((r) => r.serviceName)).toEqual(['BIOMETRIA'])
  })
})
