'use client'

import { applySentenceCase } from '@/lib/text/sentence-case'
import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react'

function normalizeOnBlur(value: string, onChange: (next: string) => void) {
  const next = applySentenceCase(value)
  if (next !== value) onChange(next)
}

type ClinicalTextareaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'> & {
  value: string
  onChange: (value: string) => void
}

/** Textarea clínico: al salir del campo, MAYÚSCULAS → formato oración (F-26). */
export function ClinicalTextarea({ value, onChange, onBlur, spellCheck = true, ...rest }: ClinicalTextareaProps) {
  return (
    <textarea
      {...rest}
      spellCheck={spellCheck}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={(e) => {
        normalizeOnBlur(value, onChange)
        onBlur?.(e)
      }}
    />
  )
}

type ClinicalFreeTextInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  value: string
  onChange: (value: string) => void
}

/** Input de texto libre clínico con la misma normalización al blur que {@link ClinicalTextarea}. */
export function ClinicalFreeTextInput({ value, onChange, onBlur, spellCheck = true, ...rest }: ClinicalFreeTextInputProps) {
  return (
    <input
      {...rest}
      spellCheck={spellCheck}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={(e) => {
        normalizeOnBlur(value, onChange)
        onBlur?.(e)
      }}
    />
  )
}
