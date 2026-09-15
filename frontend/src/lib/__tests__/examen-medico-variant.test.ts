import { describe, expect, it } from 'vitest'
import {
  resolveExamenMedicoVariant,
  isExamenMedicoTestName,
  EXAMEN_MEDICO_CATALOG_NAMES,
} from '@/lib/clinical/examen-medico-variant'

describe('examen-medico-variant', () => {
  it('detects examen medico test names', () => {
    expect(isExamenMedicoTestName('Examen Médico AMI')).toBe(true)
    expect(isExamenMedicoTestName('EXAMEN MEDICO SODEXO')).toBe(true)
    expect(isExamenMedicoTestName('Audiometría')).toBe(false)
  })

  it('resolves variant from catalog name', () => {
    expect(resolveExamenMedicoVariant(EXAMEN_MEDICO_CATALOG_NAMES.FLOWSERVE)).toBe('FLOWSERVE')
    expect(resolveExamenMedicoVariant(EXAMEN_MEDICO_CATALOG_NAMES.SODEXO)).toBe('SODEXO')
    expect(resolveExamenMedicoVariant(EXAMEN_MEDICO_CATALOG_NAMES.AMI)).toBe('AMI')
    expect(resolveExamenMedicoVariant('Examen Médico General')).toBe('AMI')
  })

  it('prefers persisted variant over name', () => {
    expect(resolveExamenMedicoVariant('Examen Médico AMI', 'SODEXO')).toBe('SODEXO')
  })
})
