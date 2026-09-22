import { describe, expect, it } from 'vitest'
import {
  getStudyVisibleStep,
  isStep1DoneForCheckout,
  isStudyInStep1Pending,
} from '../study-step'

describe('study-step (SPEC ARCH-20260921-01)', () => {
  it('mapea pipeline a pasos 1/2/3', () => {
    expect(getStudyVisibleStep({ status: 'PENDING' })).toBe('1')
    expect(getStudyVisibleStep({ status: 'IN_PROGRESS' })).toBe('1')
    expect(getStudyVisibleStep({ status: 'SAMPLE_TAKEN' })).toBe('2')
    expect(getStudyVisibleStep({ status: 'RESULT_REGISTERED' })).toBe('2')
    expect(getStudyVisibleStep({ status: 'COMPLETED' })).toBe('2')
  })

  it('RESULT_REGISTERED o COMPLETED interpretado cuenta como paso 3', () => {
    expect(
      getStudyVisibleStep({
        status: 'RESULT_REGISTERED',
        interpretation: { doctorStatus: 'REVIEWED_ACCEPTED' },
      }),
    ).toBe('3')
    expect(
      getStudyVisibleStep({
        status: 'COMPLETED',
        interpretation: { doctorStatus: 'REVIEWED_ACCEPTED' },
      }),
    ).toBe('3')
  })

  it('SKIPPED sin incidencia es INVALID', () => {
    expect(getStudyVisibleStep({ status: 'SKIPPED' })).toBe('INVALID')
  })

  it('SKIPPED con incidencia es E', () => {
    expect(
      getStudyVisibleStep({ status: 'SKIPPED', hasNotPerformedIncidence: true }),
    ).toBe('E')
  })

  it('paso 1 pendiente solo en PENDING/IN_PROGRESS', () => {
    expect(isStudyInStep1Pending({ status: 'PENDING' })).toBe(true)
    expect(isStudyInStep1Pending({ status: 'IN_PROGRESS' })).toBe(true)
    expect(isStudyInStep1Pending({ status: 'SAMPLE_TAKEN' })).toBe(false)
  })

  it('checkout requiere paso 1 hecho (IN_PROGRESS+ en pipeline)', () => {
    expect(isStep1DoneForCheckout({ status: 'PENDING' })).toBe(false)
    expect(isStep1DoneForCheckout({ status: 'IN_PROGRESS' })).toBe(true)
    expect(isStep1DoneForCheckout({ status: 'SAMPLE_TAKEN' })).toBe(true)
    expect(
      isStep1DoneForCheckout({ status: 'SKIPPED', hasNotPerformedIncidence: true }),
    ).toBe(true)
    expect(isStep1DoneForCheckout({ status: 'SKIPPED' })).toBe(false)
  })
})
