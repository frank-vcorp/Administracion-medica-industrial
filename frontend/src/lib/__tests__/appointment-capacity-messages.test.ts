import { describe, expect, it } from 'vitest'
import { appointmentCapacityUserMessage } from '@/lib/appointment-capacity'

describe('appointmentCapacityUserMessage', () => {
  it('describe hora fuera de operación', () => {
    expect(
      appointmentCapacityUserMessage({
        ok: false,
        count: 0,
        capacity: 15,
        reason: 'OUTSIDE_HOURS',
      }),
    ).toMatch(/fuera del horario operativo/i)
  })

  it('describe cupo lleno', () => {
    expect(
      appointmentCapacityUserMessage({ ok: false, count: 15, capacity: 15 }),
    ).toMatch(/cupo/i)
  })
})
