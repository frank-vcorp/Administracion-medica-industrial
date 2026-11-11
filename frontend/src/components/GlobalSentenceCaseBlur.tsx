'use client'

import {
  applySentenceCaseToControl,
  clearSentenceCaseDebounce,
  isSentenceCaseBlurTarget,
  scheduleSentenceCaseOnInput,
} from '@/lib/dom/sentence-case-blur'
import { useEffect } from 'react'

/**
 * Texto libre: modo oración con debounce al escribir y al salir del campo.
 * Opt-out: mismas reglas que {@link GlobalSpellCheck}.
 */
export default function GlobalSentenceCaseBlur() {
  useEffect(() => {
    const onInput = (event: Event) => {
      if (!isSentenceCaseBlurTarget(event.target)) return
      scheduleSentenceCaseOnInput(event.target)
    }

    const onFocusOut = (event: FocusEvent) => {
      if (!isSentenceCaseBlurTarget(event.target)) return
      clearSentenceCaseDebounce(event.target)
      applySentenceCaseToControl(event.target)
    }

    document.addEventListener('input', onInput)
    document.addEventListener('focusout', onFocusOut)
    return () => {
      document.removeEventListener('input', onInput)
      document.removeEventListener('focusout', onFocusOut)
    }
  }, [])

  return null
}
