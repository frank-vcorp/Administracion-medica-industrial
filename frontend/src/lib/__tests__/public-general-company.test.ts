import { describe, expect, it } from 'vitest'
import {
  PUBLIC_GENERAL_COMPANY_NAME,
  isPublicGeneralCompany,
} from '../public-general-company'

describe('public-general-company', () => {
  it('reconoce nombre canónico Público General', () => {
    expect(isPublicGeneralCompany({ name: PUBLIC_GENERAL_COMPANY_NAME })).toBe(true)
  })

  it('reconoce legacy PÚBLICO EN GENERAL y RFC fijo', () => {
    expect(isPublicGeneralCompany({ name: 'PÚBLICO EN GENERAL' })).toBe(true)
    expect(isPublicGeneralCompany({ name: 'x', rfc: 'PG010101XXX' })).toBe(true)
  })

  it('rechaza empresas cliente normales', () => {
    expect(isPublicGeneralCompany({ name: 'Servicios Robles S.A. de C.V.' })).toBe(false)
  })
})
