/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it, vi } from 'vitest'
import {
  applySentenceCaseToControl,
  shouldApplySentenceCaseOnBlur,
} from '@/lib/dom/sentence-case-blur'

describe('shouldApplySentenceCaseOnBlur', () => {
  it('aplica en textarea de texto libre', () => {
    const el = document.createElement('textarea')
    expect(shouldApplySentenceCaseOnBlur(el)).toBe(true)
  })

  it('aplica en input type=text', () => {
    const el = document.createElement('input')
    el.type = 'text'
    expect(shouldApplySentenceCaseOnBlur(el)).toBe(true)
  })

  it('omite search, password y data-spellcheck=off (CIE)', () => {
    const search = document.createElement('input')
    search.type = 'search'
    expect(shouldApplySentenceCaseOnBlur(search)).toBe(false)

    const pwd = document.createElement('input')
    pwd.type = 'password'
    expect(shouldApplySentenceCaseOnBlur(pwd)).toBe(false)

    const cie = document.createElement('input')
    cie.type = 'text'
    cie.dataset.spellcheck = 'off'
    expect(shouldApplySentenceCaseOnBlur(cie)).toBe(false)
  })

  it('omite readonly', () => {
    const el = document.createElement('textarea')
    el.readOnly = true
    expect(shouldApplySentenceCaseOnBlur(el)).toBe(false)
  })

  it('omite controles clínicos React (data-sentence-case-managed)', () => {
    const el = document.createElement('textarea')
    el.dataset.sentenceCaseManaged = 'react'
    expect(shouldApplySentenceCaseOnBlur(el)).toBe(false)
  })
})

describe('applySentenceCaseToControl', () => {
  it('normaliza MAYÚSCULAS y dispara input', () => {
    const el = document.createElement('textarea')
    el.value = 'DOLOR DE CABEZA'
    const onInput = vi.fn()
    el.addEventListener('input', onInput)

    applySentenceCaseToControl(el)

    expect(el.value).toBe('Dolor de cabeza')
    expect(onInput).toHaveBeenCalled()
  })

  it('normaliza mezcla de mayúsculas', () => {
    const el = document.createElement('textarea')
    el.value = 'hello WORLD'
    applySentenceCaseToControl(el)
    expect(el.value).toBe('Hello world')
  })

  it('no modifica ni dispara si no hay cambio', () => {
    const el = document.createElement('textarea')
    el.value = 'Dolor leve'
    const onInput = vi.fn()
    el.addEventListener('input', onInput)

    applySentenceCaseToControl(el)

    expect(el.value).toBe('Dolor leve')
    expect(onInput).not.toHaveBeenCalled()
  })

  it('es idempotente tras segunda aplicación', () => {
    const el = document.createElement('input')
    el.type = 'text'
    el.value = 'MARÍA GÓMEZ'
    applySentenceCaseToControl(el)
    applySentenceCaseToControl(el)
    expect(el.value).toBe('María gómez')
  })
})
