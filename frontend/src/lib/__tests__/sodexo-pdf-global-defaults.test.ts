import { describe, expect, it } from 'vitest'
import { detectSodexoCheckboxPairs } from '@/lib/sodexo-pdf-global-defaults'

describe('sodexo-pdf-global-defaults', () => {
  it('detecta cientos de pares Niega/Normal por geometría', () => {
    const pairs = detectSodexoCheckboxPairs()
    expect(pairs.length).toBeGreaterThan(80)
    expect(pairs.some((p) => p.kind === 'niega')).toBe(true)
    expect(pairs.some((p) => p.kind === 'normal')).toBe(true)
  })
})
