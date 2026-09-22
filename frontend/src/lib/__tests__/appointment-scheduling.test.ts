import { describe, expect, it } from 'vitest'
import {
  appointmentAgendaHour,
  formatAppointmentAgendaDateString,
  parseAppointmentLocalDateTime,
} from '@/lib/appointment-scheduling'

describe('appointment-scheduling', () => {
  it('parsea 08:00 CDMX como hora de agenda 8 en México', () => {
    const at = parseAppointmentLocalDateTime('2026-09-22', '08:00')
    expect(formatAppointmentAgendaDateString(at)).toBe('2026-09-22')
    expect(appointmentAgendaHour(at)).toBe(8)
  })
})
