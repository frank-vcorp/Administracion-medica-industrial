import { describe, expect, it, vi } from 'vitest'
import {
  normalizeClinicalFreeTextValue,
  scheduleClinicalFreeTextNormalize,
} from '@/lib/dom/clinical-free-text-handlers'

describe('normalizeClinicalFreeTextValue', () => {
  it('convierte mezcla de mayúsculas (P0 certificado VI)', () => {
    expect(normalizeClinicalFreeTextValue('hOLA COMO ESTAS')).toBe('Hola como estas')
  })

  it('es idempotente en texto ya normalizado', () => {
    expect(normalizeClinicalFreeTextValue('Hola como estas')).toBe('Hola como estas')
  })
})

describe('scheduleClinicalFreeTextNormalize', () => {
  it('aplica transform tras el debounce', () => {
    vi.useFakeTimers()
    let current = 'hOLA COMO ESTAS'
    const onNormalized = vi.fn()

    const cancel = scheduleClinicalFreeTextNormalize(
      () => current,
      (next) => {
        current = next
        onNormalized(next)
      },
      400,
    )

    vi.advanceTimersByTime(399)
    expect(onNormalized).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(onNormalized).toHaveBeenCalledWith('Hola como estas')
    cancel()
    vi.useRealTimers()
  })
})
