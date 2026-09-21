import { describe, expect, it } from 'vitest'
import { getValidationStage } from '../validation-stage'

describe('validation-stage (SPEC ARCH-20260921-01 §5.2)', () => {
  it('V1 cuando hay estudio en paso 1 o 2', () => {
    expect(
      getValidationStage([
        { id: 'a', status: 'COMPLETED' },
        { id: 'b', status: 'SAMPLE_TAKEN' },
      ]),
    ).toBe('V1')
  })

  it('V2 cuando todos tienen resultado pero falta interpretación', () => {
    expect(
      getValidationStage([
        { id: 'a', status: 'COMPLETED' },
        { id: 'b', status: 'RESULT_REGISTERED' },
      ]),
    ).toBe('V2')
  })

  it('V3 cuando todos en paso 3 o E', () => {
    expect(
      getValidationStage(
        [
          { id: 'a', status: 'COMPLETED' },
          { id: 'b', status: 'SKIPPED' },
        ],
        new Set(['b']),
      ),
    ).toBe('V3')
  })
})
