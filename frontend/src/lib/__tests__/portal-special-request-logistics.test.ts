import { describe, expect, it, afterEach } from 'vitest'
import { resolvePortalSpecialRequestLogisticsPhones } from '@/lib/portal-special-request-logistics-resolve'

describe('resolvePortalSpecialRequestLogisticsPhones', () => {
  const OLD_ENV = process.env.PORTAL_LOGISTICS_WHATSAPP

  afterEach(() => {
    process.env.PORTAL_LOGISTICS_WHATSAPP = OLD_ENV
  })

  it('usa solo los números de AppConfig deduplicados', () => {
    const r = resolvePortalSpecialRequestLogisticsPhones(
      { phones: ['4421234567', '4421234567', '55 11 99999 9999'], copyToSeller: false },
      undefined,
    )
    expect(r.phones).toHaveLength(2)
    expect(r.phones[0]).toBe('524421234567')
    expect(r.copyToSeller).toBe(false)
  })

  it('cae a PORTAL_LOGISTICS_WHATSAPP si config vacío', () => {
    process.env.PORTAL_LOGISTICS_WHATSAPP = '3331234567'
    const r = resolvePortalSpecialRequestLogisticsPhones(null, process.env.PORTAL_LOGISTICS_WHATSAPP)
    expect(r.phones).toEqual(['523331234567'])
    expect(r.copyToSeller).toBe(true)
  })

  it('cae al default 4421144615 sin config ni env', () => {
    delete process.env.PORTAL_LOGISTICS_WHATSAPP
    const r = resolvePortalSpecialRequestLogisticsPhones(null, undefined)
    expect(r.phones).toEqual(['524421144615'])
  })

  it('copyToSeller por defecto true si config null', () => {
    delete process.env.PORTAL_LOGISTICS_WHATSAPP
    const r = resolvePortalSpecialRequestLogisticsPhones(null, undefined)
    expect(r.copyToSeller).toBe(true)
  })
})
