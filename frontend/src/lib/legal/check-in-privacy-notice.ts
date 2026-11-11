import { EXAMEN_MEDICO_CATALOG_CODES } from '@/lib/clinical/examen-medico-variant'
import { SME_LEGAL_NAME_FULL } from '@/lib/brand-constants'

/**
 * Responsable del aviso de privacidad / veracidad mostrado en check-in (recepción).
 * Distinto de la variante de captura REG-SO-01 en clínica.
 */
export type CheckInPrivacyNoticeKey = 'SME' | 'SODEXO' | 'REALSO'

export type CheckInPrivacyNoticeConfig = {
  key: CheckInPrivacyNoticeKey
  /** Razón social mostrada en el texto del consentimiento (aviso corto). */
  legalName: string
  /** PDF integral de salud ocupacional, si aplica (p. ej. FY27 Sodexo). */
  integralPdf: { url: string; filename: string } | null
  /** Microcopy del bloque PDF en UI de check-in. */
  integralPdfBlurb: string
}

export const SODEXO_OCCUPATIONAL_PRIVACY_PDF = {
  url: '/legal/aviso-privacidad-salud-ocupacional-fy27.pdf',
  filename: 'aviso-privacidad-salud-ocupacional-fy27.pdf',
} as const

/** Catálogo por tenant/cliente — ampliar cuando exista PDF insumo (p. ej. Realso). */
export const CHECK_IN_PRIVACY_NOTICE: Record<CheckInPrivacyNoticeKey, CheckInPrivacyNoticeConfig> = {
  SME: {
    key: 'SME',
    legalName: SME_LEGAL_NAME_FULL,
    integralPdf: null,
    integralPdfBlurb:
      'El aviso de privacidad integral de Soluciones Médico Empresariales (SME) se declara en el texto de este consentimiento. La veracidad de los datos clínicos queda asentada en las casillas y firma de este documento.',
  },
  SODEXO: {
    key: 'SODEXO',
    legalName: 'Sodexo México, S.A. de C.V.',
    integralPdf: SODEXO_OCCUPATIONAL_PRIVACY_PDF,
    integralPdfBlurb:
      'Aviso de privacidad integral para salud ocupacional Sodexo (FY27). La veracidad de los datos clínicos se declara en el consentimiento informado firmado en recepción.',
  },
  REALSO: {
    key: 'REALSO',
    legalName: 'Realso, S.A. de C.V.',
    integralPdf: null,
    integralPdfBlurb:
      'El aviso de privacidad integral de Realso se declara en el texto de este consentimiento hasta contar con PDF formal en el sistema. La veracidad de los datos clínicos queda en las casillas y firma de este documento.',
  },
}

export function getCheckInPrivacyNoticeConfig(
  key: CheckInPrivacyNoticeKey = 'SME',
): CheckInPrivacyNoticeConfig {
  return CHECK_IN_PRIVACY_NOTICE[key] ?? CHECK_IN_PRIVACY_NOTICE.SME
}

export type CheckInPrivacyNoticeResolveInput = {
  medicalProfileName?: string | null
  serviceProfileName?: string | null
  testNames?: string[] | null
  testCodes?: string[] | null
  companyName?: string | null
}

function haystackFrom(input: CheckInPrivacyNoticeResolveInput): string {
  return [
    input.medicalProfileName,
    input.serviceProfileName,
    input.companyName,
    ...(input.testNames ?? []),
    ...(input.testCodes ?? []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

/**
 * Selecciona el aviso de veracidad/privacidad para check-in.
 * Prioridad: Sodexo (perfil o prueba REG-SO-01) → Realso (nombre en perfil/empresa) → SME (despliegue Frank).
 */
export function resolveCheckInPrivacyNoticeKey(
  input: CheckInPrivacyNoticeResolveInput = {},
): CheckInPrivacyNoticeKey {
  const haystack = haystackFrom(input)
  const codes = new Set((input.testCodes ?? []).map((c) => c.toUpperCase()))

  if (
    codes.has(EXAMEN_MEDICO_CATALOG_CODES.SODEXO) ||
    haystack.includes('sodexo') ||
    haystack.includes('reg-so-01')
  ) {
    return 'SODEXO'
  }

  if (/\brealso\b/.test(haystack)) {
    return 'REALSO'
  }

  return 'SME'
}
