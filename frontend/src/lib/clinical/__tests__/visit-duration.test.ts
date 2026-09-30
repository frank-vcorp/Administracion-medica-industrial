import { formatVisitDuration, visitDurationMinutes } from '../visit-duration'

describe('visit-duration', () => {
  it('calcula minutos entre ingreso y salida', () => {
    const checkIn = new Date('2026-09-30T10:00:00')
    const out = new Date('2026-09-30T12:30:00')
    expect(visitDurationMinutes(checkIn, out)).toBe(150)
    expect(formatVisitDuration(checkIn, out)).toBe('2 h 30 min')
  })

  it('devuelve null sin check-in', () => {
    expect(formatVisitDuration(null, new Date())).toBeNull()
  })
})
