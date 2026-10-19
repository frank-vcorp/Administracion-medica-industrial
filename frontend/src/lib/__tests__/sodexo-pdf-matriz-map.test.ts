import { describe, expect, it } from 'vitest'
import { SODEXO_MATRIZ_FACTOR_LEVELS_GENERATED } from '@/lib/sodexo-pdf-matriz-map.generated'

describe('sodexo matriz map generated', () => {
  it('define 36 factores con 6 casillas cada uno', () => {
    expect(Object.keys(SODEXO_MATRIZ_FACTOR_LEVELS_GENERATED)).toHaveLength(36)
    for (const boxes of Object.values(SODEXO_MATRIZ_FACTOR_LEVELS_GENERATED)) {
      expect(boxes).toHaveLength(6)
    }
  })
})
