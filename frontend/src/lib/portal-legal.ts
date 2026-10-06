/** Versión vigente de T&C + aviso de privacidad del portal B2B empresa. */
export const PORTAL_LEGAL_VERSION = '2026-10-06'

export const PORTAL_TERMS_PATH = '/legal/terminos-portal'
export const PORTAL_PRIVACY_PATH = '/legal/privacidad-portal'

export function isPortalLegalCurrent(
  acceptedAt: Date | null | undefined,
  acceptedVersion: string | null | undefined,
): boolean {
  if (!acceptedAt || !acceptedVersion) return false
  return acceptedVersion === PORTAL_LEGAL_VERSION
}

export function portalOnboardingRequired(user: {
  mustChangePassword: boolean
  portalLegalAcceptedAt: Date | null
  portalLegalVersion: string | null
}): boolean {
  return user.mustChangePassword || !isPortalLegalCurrent(user.portalLegalAcceptedAt, user.portalLegalVersion)
}
