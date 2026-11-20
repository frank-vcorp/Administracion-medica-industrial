import { describe, it, expect } from 'vitest'
import { audiometrySignerFromAccount } from '@/lib/audiometry-signer'

describe('audiometrySignerFromAccount', () => {
  it('toma nombre, cédula y firma del perfil', () => {
    const firma = 'data:image/png;base64,FIRMADECUENTA'
    const signer = audiometrySignerFromAccount({
      fullName: '  Prueba Cuenta Audiometria  ',
      professionalLicense: ' 5544332 ',
      signatureImageUrl: firma,
    })
    expect(signer).toEqual({
      fullName: 'Prueba Cuenta Audiometria',
      professionalLicense: '5544332',
      signatureImageUrl: firma,
    })
  })

  it('sin cédula deja — y sin imagen deja la firma vacía', () => {
    const signer = audiometrySignerFromAccount({
      fullName: 'Prueba Cuenta Audiometria',
      professionalLicense: null,
      signatureImageUrl: null,
    })
    expect(signer).toEqual({
      fullName: 'Prueba Cuenta Audiometria',
      professionalLicense: '—',
      signatureImageUrl: '',
    })
  })

  it('no acepta un trazo o un nombre de ejemplo como firma', () => {
    const signer = audiometrySignerFromAccount({
      fullName: 'Prueba Cuenta Audiometria',
      professionalLicense: '',
      signatureImageUrl: 'Marta Ruiz',
    })
    expect(signer?.signatureImageUrl).toBe('')
    expect(signer?.fullName).toBe('Prueba Cuenta Audiometria')
  })

  it('rechaza una cuenta sin nombre', () => {
    expect(audiometrySignerFromAccount({ fullName: '  ' })).toBeNull()
    expect(audiometrySignerFromAccount(null)).toBeNull()
  })
})
