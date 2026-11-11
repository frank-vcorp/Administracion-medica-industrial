import { SME_LEGAL_NAME_FULL } from '@/lib/brand-constants'

/**
 * Aviso de privacidad / veracidad en check-in (recepción).
 * Frank (autoritativo): siempre responsable SME — sin variante Sodexo/Realso ni PDF FY27 aquí.
 * El PDF Sodexo FY27 solo aplica en clínica (`SodexoPrivacyNoticePanel`), no en ingreso.
 */
export const CHECK_IN_PRIVACY_LEGAL_NAME = SME_LEGAL_NAME_FULL

export const CHECK_IN_PRIVACY_VERACITY_BLURB =
  'El aviso de privacidad integral de Soluciones Médico Empresariales (SME) se declara en el texto de este consentimiento. La veracidad de los datos clínicos queda asentada en las casillas y firma de este documento.'

/** PDF integral Sodexo (REG-SO-01 / extensión clínica — no usar en check-in). */
export const SODEXO_OCCUPATIONAL_PRIVACY_PDF = {
  url: '/legal/aviso-privacidad-salud-ocupacional-fy27.pdf',
  filename: 'aviso-privacidad-salud-ocupacional-fy27.pdf',
} as const
