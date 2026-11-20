import { describe, expect, it } from 'vitest'
import { normalizeWhatsAppPhone } from '@/lib/whatsapp-phone'

describe('normalizeWhatsAppPhone', () => {
  it('agrega 521 a un celular mexicano de 10 dígitos', () => {
    expect(normalizeWhatsAppPhone('4424532415')).toBe('5214424532415')
  })

  it('corrige un 52 sin el 1 de celular', () => {
    expect(normalizeWhatsAppPhone('524424532415')).toBe('5214424532415')
  })

  it('conserva el número que ya trae 521', () => {
    expect(normalizeWhatsAppPhone('+521 442 453 2415')).toBe('5214424532415')
  })
})
