import { describe, expect, it } from 'vitest'
import {
  addAgendaDays,
  agendaDayUtcRange,
  agendaWeekUtcRange,
  appointmentAgendaHour,
  formatAppointmentAgendaDateString,
  getAgendaWeekStartMonday,
  parseAppointmentLocalDateTime,
} from '@/lib/appointment-scheduling'

describe('appointment-scheduling', () => {
  it('parsea 08:00 CDMX como hora de agenda 8 en México', () => {
    const at = parseAppointmentLocalDateTime('2026-09-22', '08:00')
    expect(formatAppointmentAgendaDateString(at)).toBe('2026-09-22')
    expect(appointmentAgendaHour(at)).toBe(8)
  })

  it('agendaDayUtcRange incluye check-in vespertino del mismo día calendario MX', () => {
    const { gte, lte } = agendaDayUtcRange('2026-09-21')
    const checkInEveningMx = new Date('2026-09-22T01:32:00.000Z')
    expect(checkInEveningMx.getTime()).toBeGreaterThanOrEqual(gte.getTime())
    expect(checkInEveningMx.getTime()).toBeLessThanOrEqual(lte.getTime())
  })

  it('getAgendaWeekStartMonday y agendaWeekUtcRange alinean semana Lun–Dom MX', () => {
    const monday = getAgendaWeekStartMonday('2026-09-24')
    expect(monday).toBe('2026-09-21')
    const sunday = addAgendaDays(monday, 6)
    expect(sunday).toBe('2026-09-27')
    const { gte, lte } = agendaWeekUtcRange(monday)
    const wedMorning = parseAppointmentLocalDateTime('2026-09-24', '09:00')
    expect(wedMorning.getTime()).toBeGreaterThanOrEqual(gte.getTime())
    expect(wedMorning.getTime()).toBeLessThanOrEqual(lte.getTime())
  })
})
