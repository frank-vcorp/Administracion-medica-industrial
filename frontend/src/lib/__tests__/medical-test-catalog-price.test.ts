import { describe, expect, it } from 'vitest'
import { readCatalogPriceFromOptions } from '@/lib/medical-test-catalog-price'

describe('readCatalogPriceFromOptions', () => {
  it('reads options.price', () => {
    expect(readCatalogPriceFromOptions({ price: 450 })).toBe(450)
  })

  it('falls back to basePrice', () => {
    expect(readCatalogPriceFromOptions({ basePrice: 300 })).toBe(300)
  })

  it('returns 0 for missing or invalid', () => {
    expect(readCatalogPriceFromOptions(null)).toBe(0)
    expect(readCatalogPriceFromOptions({ price: 0 })).toBe(0)
    expect(readCatalogPriceFromOptions({ price: -1 })).toBe(0)
  })
})
