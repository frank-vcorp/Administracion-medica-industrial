import { describe, it, expect } from 'vitest'
import {
  generateTemporaryPortalPassword,
  validatePortalPassword,
} from '@/lib/portal-access-password'

describe('portal-access-password', () => {
  it('genera contraseña de 12 caracteres', () => {
    expect(generateTemporaryPortalPassword()).toHaveLength(12)
  })

  it('valida longitud y complejidad mínima', () => {
    expect(validatePortalPassword('short1')).toMatch(/10/)
    expect(validatePortalPassword('allletterslong')).toMatch(/números/)
    expect(validatePortalPassword('1234567890')).toMatch(/letras/)
    expect(validatePortalPassword('SecurePass1')).toBeNull()
  })
})
