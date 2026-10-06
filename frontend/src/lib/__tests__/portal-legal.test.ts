import { describe, it, expect } from 'vitest'
import {
  isPortalLegalCurrent,
  portalOnboardingRequired,
  PORTAL_LEGAL_VERSION,
} from '@/lib/portal-legal'

describe('portal-legal', () => {
  it('legal vigente cuando versión coincide', () => {
    expect(
      isPortalLegalCurrent(new Date(), PORTAL_LEGAL_VERSION),
    ).toBe(true)
  })

  it('onboarding requerido sin legal ni cambio de pwd', () => {
    expect(
      portalOnboardingRequired({
        mustChangePassword: false,
        portalLegalAcceptedAt: null,
        portalLegalVersion: null,
      }),
    ).toBe(true)
  })

  it('onboarding no requerido cuando todo ok', () => {
    expect(
      portalOnboardingRequired({
        mustChangePassword: false,
        portalLegalAcceptedAt: new Date(),
        portalLegalVersion: PORTAL_LEGAL_VERSION,
      }),
    ).toBe(false)
  })
})
