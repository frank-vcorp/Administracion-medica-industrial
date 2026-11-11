/// <reference types="vitest/globals" />

import {
  clinicalCaptureReadonlyBannerText,
  computePapeletaReadonly,
  resolveClinicalStudyReadonly,
} from '@/lib/clinical/papeleta-readonly'

describe('computePapeletaReadonly', () => {
  it('paso ≤3 → editable para todos', () => {
    expect(
      computePapeletaReadonly({
        currentStep: 3,
        activeView: 'IN_PROGRESS',
        userRole: 'RECEPTIONIST',
      }),
    ).toBe(false)
  })

  it('paso >3 + recepción → solo lectura', () => {
    expect(
      computePapeletaReadonly({
        currentStep: 4,
        activeView: 'VALIDATING',
        userRole: 'RECEPTIONIST',
      }),
    ).toBe(true)
  })

  it('paso >3 + médico en vista papeleta → editable', () => {
    expect(
      computePapeletaReadonly({
        currentStep: 5,
        activeView: 'VALIDATING',
        userRole: 'DOCTOR_GENERAL',
      }),
    ).toBe(false)
  })

  it('paso >3 + admin en CHECKED_IN → editable', () => {
    expect(
      computePapeletaReadonly({
        currentStep: 4,
        activeView: 'CHECKED_IN',
        userRole: 'ADMIN',
      }),
    ).toBe(false)
  })
})

describe('resolveClinicalStudyReadonly', () => {
  it('captura cerrada bloquea recepción aunque el expediente siga en captura', () => {
    expect(resolveClinicalStudyReadonly(false, true, 'RECEPTIONIST')).toBe(true)
  })

  it('captura cerrada permite doctor con expediente en captura', () => {
    expect(resolveClinicalStudyReadonly(false, true, 'DOCTOR_VALIDATOR')).toBe(false)
  })
})

describe('clinicalCaptureReadonlyBannerText', () => {
  it('médico con captura cerrada ve hint de borrador', () => {
    expect(clinicalCaptureReadonlyBannerText(false, true, 'DOCTOR_GENERAL')).toBe(
      'Puedes corregir texto; guarda borrador.',
    )
  })
})
