import { describe, expect, it } from 'vitest'
import {
  buildAppointmentCheckInUrl,
  parseAppointmentQrExpedientId,
  parseDataUrlBase64,
} from '@/lib/appointment-qr'

describe('appointment-qr', () => {
  it('buildAppointmentCheckInUrl construye URL limpia hacia /appointments?checkin=...', () => {
    expect(
      buildAppointmentCheckInUrl('EXP-2026045', 'https://administracion-medica-industrial.vercel.app/'),
    ).toBe('https://administracion-medica-industrial.vercel.app/appointments?checkin=EXP-2026045')
  })

  it('parseAppointmentQrExpedientId extrae folio desde URL, JSON legado y folio directo', () => {
    expect(
      parseAppointmentQrExpedientId(
        'https://administracion-medica-industrial.vercel.app/appointments?checkin=EXP-2026045',
      ),
    ).toBe('EXP-2026045')
    expect(parseAppointmentQrExpedientId('/appointments?exp=EXP-2026046')).toBe('EXP-2026046')
    expect(
      parseAppointmentQrExpedientId('{"exp":"EXP-2026047","uid":"w-1","date":"2026-11-26"}'),
    ).toBe('EXP-2026047')
    expect(parseAppointmentQrExpedientId('  EXP-2026048  ')).toBe('EXP-2026048')
    expect(parseAppointmentQrExpedientId('no-valido')).toBeNull()
    expect(parseAppointmentQrExpedientId('https://example.com/appointments?checkin=bad')).toBeNull()
  })

  it('parseDataUrlBase64 extrae mimetype y payload base64 válidos', () => {
    expect(parseDataUrlBase64('data:image/png;base64,iVBORw0KGgo=')).toEqual({
      mimetype: 'image/png',
      dataBase64: 'iVBORw0KGgo=',
    })
    expect(parseDataUrlBase64('')).toBeNull()
    expect(parseDataUrlBase64('no-es-data-url')).toBeNull()
  })
})
