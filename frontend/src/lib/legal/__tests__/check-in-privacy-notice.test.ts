import { describe, expect, it } from 'vitest'
import {
  CHECK_IN_PRIVACY_NOTICE,
  resolveCheckInPrivacyNoticeKey,
} from '@/lib/legal/check-in-privacy-notice'
import { EXAMEN_MEDICO_CATALOG_CODES } from '@/lib/clinical/examen-medico-variant'
import { getInformedConsentPrivacyParagraphs } from '@/lib/informed-consent-content'

describe('check-in-privacy-notice', () => {
  it('defaults to SME razón social', () => {
    expect(resolveCheckInPrivacyNoticeKey({})).toBe('SME')
    expect(CHECK_IN_PRIVACY_NOTICE.SME.legalName).toContain('Soluciones Médico Empresariales')
    expect(CHECK_IN_PRIVACY_NOTICE.SME.integralPdf).toBeNull()
  })

  it('selects SODEXO when perfil or prueba Sodexo está presente', () => {
    expect(
      resolveCheckInPrivacyNoticeKey({
        medicalProfileName: 'Paquete Examen Médico Sodexo',
      }),
    ).toBe('SODEXO')
    expect(
      resolveCheckInPrivacyNoticeKey({
        testCodes: [EXAMEN_MEDICO_CATALOG_CODES.SODEXO],
      }),
    ).toBe('SODEXO')
  })

  it('selects REALSO cuando el nombre del perfil o empresa lo indica', () => {
    expect(
      resolveCheckInPrivacyNoticeKey({
        companyName: 'Operaciones Realso Norte',
      }),
    ).toBe('REALSO')
  })

  it('SODEXO takes priority over REALSO when both signals exist', () => {
    expect(
      resolveCheckInPrivacyNoticeKey({
        companyName: 'Realso',
        testNames: ['Examen Médico Sodexo'],
      }),
    ).toBe('SODEXO')
  })

  it('privacy paragraphs embed the legal name for each key', () => {
    const smeIntro = getInformedConsentPrivacyParagraphs('SME')[0]
    const sodexoIntro = getInformedConsentPrivacyParagraphs('SODEXO')[0]
    expect(smeIntro).toContain(CHECK_IN_PRIVACY_NOTICE.SME.legalName)
    expect(sodexoIntro).toContain(CHECK_IN_PRIVACY_NOTICE.SODEXO.legalName)
    expect(smeIntro).not.toContain('Sodexo')
  })
})
