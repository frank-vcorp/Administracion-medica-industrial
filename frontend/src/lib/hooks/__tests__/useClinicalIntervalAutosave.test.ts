/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import {
  CLINICAL_AUTOSAVE_INTERVAL_MS,
  useClinicalIntervalAutosave,
} from '@/lib/hooks/useClinicalIntervalAutosave'

describe('useClinicalIntervalAutosave', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('guarda cuando hay cambios tras el intervalo', async () => {
    const save = vi.fn().mockResolvedValue(true)
    let snapshot = '{"a":1}'

    const { rerender } = renderHook(
      ({ key }) =>
        useClinicalIntervalAutosave({
          enabled: true,
          snapshotKey: key,
          save,
          intervalMs: CLINICAL_AUTOSAVE_INTERVAL_MS,
        }),
      { initialProps: { key: snapshot } },
    )

    snapshot = '{"a":2}'
    rerender({ key: snapshot })

    await act(async () => {
      vi.advanceTimersByTime(CLINICAL_AUTOSAVE_INTERVAL_MS)
      await Promise.resolve()
    })

    expect(save).toHaveBeenCalledTimes(1)
  })

  it('no guarda si el snapshot no cambió', async () => {
    const save = vi.fn().mockResolvedValue(true)

    renderHook(() =>
      useClinicalIntervalAutosave({
        enabled: true,
        snapshotKey: '{"stable":true}',
        save,
        intervalMs: CLINICAL_AUTOSAVE_INTERVAL_MS,
      }),
    )

    await act(async () => {
      vi.advanceTimersByTime(CLINICAL_AUTOSAVE_INTERVAL_MS * 2)
      await Promise.resolve()
    })

    expect(save).not.toHaveBeenCalled()
  })
})
