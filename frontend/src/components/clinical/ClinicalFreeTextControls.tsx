'use client'

import {
  normalizeClinicalFreeTextValue,
  scheduleClinicalFreeTextNormalize,
} from '@/lib/dom/clinical-free-text-handlers'
import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { useCallback, useEffect, useRef } from 'react'

const SENTENCE_CASE_MANAGED = { 'data-sentence-case-managed': 'react' } as const

function useClinicalFreeTextControl(value: string, onChange: (next: string) => void) {
  const valueRef = useRef(value)
  const cancelDebounceRef = useRef<(() => void) | undefined>(undefined)

  useEffect(() => {
    valueRef.current = value
  }, [value])

  useEffect(
    () => () => {
      cancelDebounceRef.current?.()
    },
    [],
  )

  const clearDebounce = useCallback(() => {
    cancelDebounceRef.current?.()
    cancelDebounceRef.current = undefined
  }, [])

  const scheduleNormalize = useCallback(() => {
    clearDebounce()
    cancelDebounceRef.current = scheduleClinicalFreeTextNormalize(
      () => valueRef.current,
      (next) => onChange(next),
    )
  }, [clearDebounce, onChange])

  const handleChange = useCallback(
    (next: string) => {
      valueRef.current = next
      onChange(next)
      scheduleNormalize()
    },
    [onChange, scheduleNormalize],
  )

  const handleBlur = useCallback(
    (raw: string) => {
      clearDebounce()
      const next = normalizeClinicalFreeTextValue(raw)
      valueRef.current = next
      if (next !== raw) onChange(next)
    },
    [clearDebounce, onChange],
  )

  return { handleChange, handleBlur }
}

type ClinicalTextareaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'> & {
  value: string
  onChange: (value: string) => void
}

/** Textarea clínico controlado: modo oración con debounce al escribir y al salir del campo. */
export function ClinicalTextarea({ value, onChange, onBlur, spellCheck = true, ...rest }: ClinicalTextareaProps) {
  const { handleChange, handleBlur } = useClinicalFreeTextControl(value, onChange)

  return (
    <textarea
      {...rest}
      {...SENTENCE_CASE_MANAGED}
      spellCheck={spellCheck}
      value={value}
      onChange={(e) => handleChange(e.target.value)}
      onBlur={(e) => {
        handleBlur(e.target.value)
        onBlur?.(e)
      }}
    />
  )
}

type ClinicalFreeTextInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  value: string
  onChange: (value: string) => void
}

/** Input de texto libre clínico con la misma normalización que {@link ClinicalTextarea}. */
export function ClinicalFreeTextInput({ value, onChange, onBlur, spellCheck = true, ...rest }: ClinicalFreeTextInputProps) {
  const { handleChange, handleBlur } = useClinicalFreeTextControl(value, onChange)

  return (
    <input
      {...rest}
      {...SENTENCE_CASE_MANAGED}
      spellCheck={spellCheck}
      value={value}
      onChange={(e) => handleChange(e.target.value)}
      onBlur={(e) => {
        handleBlur(e.target.value)
        onBlur?.(e)
      }}
    />
  )
}
