import { describe, expect, it } from 'vitest'
import { shouldEnableSpellCheck } from '@/lib/dom/spell-check'

describe('shouldEnableSpellCheck', () => {
  it('habilita textarea de texto libre', () => {
    const el = document.createElement('textarea')
    expect(shouldEnableSpellCheck(el)).toBe(true)
  })

  it('omite password y campos con data-spellcheck=off', () => {
    const pwd = document.createElement('input')
    pwd.type = 'password'
    expect(shouldEnableSpellCheck(pwd)).toBe(false)

    const cie = document.createElement('input')
    cie.type = 'text'
    cie.dataset.spellcheck = 'off'
    expect(shouldEnableSpellCheck(cie)).toBe(false)
  })

  it('omite readonly', () => {
    const el = document.createElement('input')
    el.readOnly = true
    expect(shouldEnableSpellCheck(el)).toBe(false)
  })
})
