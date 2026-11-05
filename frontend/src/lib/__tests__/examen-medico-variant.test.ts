import { describe, expect, it } from 'vitest'
import {
  resolveExamenMedicoVariant,
  isExamenMedicoTestName,
  EXAMEN_MEDICO_CATALOG_NAMES,
  LEGACY_EXAMEN_MEDICO_VARIANT_AMI,
} from '@/lib/clinical/examen-medico-variant'

describe('examen-medico-variant', () => {
  it('detects examen medico test names', () => {
    expect(isExamenMedicoTestName('Examen Médico General')).toBe(true)
    expect(isExamenMedicoTestName('Examen Médico AMI')).toBe(true)
    expect(isExamenMedicoTestName('EXAMEN MEDICO SODEXO')).toBe(true)
    expect(isExamenMedicoTestName('Audiometría')).toBe(false)
  })

  it('resolves variant from catalog name', () => {
    expect(resolveExamenMedicoVariant(EXAMEN_MEDICO_CATALOG_NAMES.FLOWSERVE)).toBe('FLOWSERVE')
    expect(resolveExamenMedicoVariant(EXAMEN_MEDICO_CATALOG_NAMES.SODEXO)).toBe('SODEXO')
    expect(resolveExamenMedicoVariant(EXAMEN_MEDICO_CATALOG_NAMES.SME)).toBe('SME')
    expect(resolveExamenMedicoVariant('Examen Médico General')).toBe('SME')
  })

  it('normalizes legacy persisted AMI variant to SME', () => {
    expect(resolveExamenMedicoVariant('Examen Médico Sodexo', LEGACY_EXAMEN_MEDICO_VARIANT_AMI)).toBe(
      'SME',
    )
  })

  it('prefers persisted variant over name', () => {
    expect(resolveExamenMedicoVariant('Examen Médico General', 'SODEXO')).toBe('SODEXO')
  })
})
