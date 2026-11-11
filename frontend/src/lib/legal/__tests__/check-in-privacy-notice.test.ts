import { describe, expect, it } from 'vitest'
import {
  CHECK_IN_PRIVACY_LEGAL_NAME,
  CHECK_IN_PRIVACY_VERACITY_BLURB,
  SODEXO_OCCUPATIONAL_PRIVACY_PDF,
} from '@/lib/legal/check-in-privacy-notice'
import { getInformedConsentPrivacyParagraphs } from '@/lib/informed-consent-content'
import { SME_LEGAL_NAME_FULL } from '@/lib/brand-constants'

describe('check-in-privacy-notice', () => {
  it('siempre usa razón social SME en check-in', () => {
    expect(CHECK_IN_PRIVACY_LEGAL_NAME).toBe(SME_LEGAL_NAME_FULL)
    expect(CHECK_IN_PRIVACY_LEGAL_NAME).toContain('Soluciones Médico Empresariales')
    expect(CHECK_IN_PRIVACY_VERACITY_BLURB.toLowerCase()).not.toContain('sodexo')
    expect(CHECK_IN_PRIVACY_VERACITY_BLURB.toLowerCase()).not.toContain('realso')
  })

  it('párrafos de privacidad del consentimiento solo mencionan SME', () => {
    const intro = getInformedConsentPrivacyParagraphs()[0]
    expect(intro).toContain(SME_LEGAL_NAME_FULL)
    expect(intro.toLowerCase()).not.toContain('sodexo')
    expect(intro.toLowerCase()).not.toContain('realso')
  })

  it('PDF FY27 Sodexo queda exportado solo para clínica, no check-in', () => {
    expect(SODEXO_OCCUPATIONAL_PRIVACY_PDF.url).toContain('fy27')
  })
})
