import { describe, expect, it } from 'vitest'
import { getCheckoutEligibility, isCheckoutEnabled } from '../reception-checkout'

describe('reception-checkout (SPEC ARCH-20260921-01 §4.4)', () => {
  it('habilita checkout cuando todos los estudios tienen paso 1+', () => {
    expect(
      isCheckoutEnabled({
        dischargedAt: null,
        eventTests: [
          { id: 'a', status: 'IN_PROGRESS' },
          { id: 'b', status: 'SAMPLE_TAKEN' },
        ],
      }),
    ).toBe(true)
  })

  it('bloquea si algún estudio sigue en PENDING', () => {
    expect(
      getCheckoutEligibility({
        dischargedAt: null,
        eventTests: [
          { id: 'a', status: 'IN_PROGRESS' },
          { id: 'b', status: 'PENDING' },
        ],
      }),
    ).toEqual({ eligible: false, reason: 'pending_studies' })
  })

  it('bloquea SKIPPED sin incidencia', () => {
    expect(
      getCheckoutEligibility({
        dischargedAt: null,
        eventTests: [{ id: 'a', status: 'SKIPPED' }],
      }),
    ).toEqual({ eligible: false, reason: 'invalid_skipped' })
  })

  it('acepta SKIPPED con incidencia ligada', () => {
    expect(
      isCheckoutEnabled(
        {
          dischargedAt: null,
          eventTests: [
            { id: 'a', status: 'IN_PROGRESS' },
            { id: 'b', status: 'SKIPPED' },
          ],
        },
        new Set(['b']),
      ),
    ).toBe(true)
  })

  it('bloquea si ya tiene dischargedAt', () => {
    expect(
      getCheckoutEligibility({
        dischargedAt: new Date(),
        eventTests: [{ id: 'a', status: 'COMPLETED' }],
      }),
    ).toEqual({ eligible: false, reason: 'already_discharged' })
  })
})
