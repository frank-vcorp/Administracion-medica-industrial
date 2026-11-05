/**
 * Resolución de variante de Examen Médico a partir del nombre de prueba
 * en catálogo / `EventTest.testNameSnapshot`.
 *
 * Catálogo esperado:
 *   - Examen Médico General (SME)
 *   - Examen Médico Sodexo
 *   - Examen Médico Flowserve
 */

export type ExamenMedicoVariant = 'SME' | 'SODEXO' | 'FLOWSERVE'

/** Variante persistida legada en JSON (`exam_variant`). */
export const LEGACY_EXAMEN_MEDICO_VARIANT_AMI = 'AMI' as const

export const EXAMEN_MEDICO_CATALOG_NAMES = {
  SME: 'Examen Médico General',
  SODEXO: 'Examen Médico Sodexo',
  FLOWSERVE: 'Examen Médico Flowserve',
} as const

export const EXAMEN_MEDICO_CATALOG_CODES = {
  SME: 'GEN-EM-AMI',
  SODEXO: 'GEN-EM-SOD',
  FLOWSERVE: 'GEN-EM-FLO',
} as const

/** @deprecated Usar `EXAMEN_MEDICO_CATALOG_NAMES.SME`. */
export const EXAMEN_MEDICO_CATALOG_NAMES_LEGACY = {
  AMI: EXAMEN_MEDICO_CATALOG_NAMES.SME,
} as const

function normalizePersistedVariant(
  persistedVariant?: string | null,
): ExamenMedicoVariant | null {
  if (!persistedVariant) return null
  if (persistedVariant === LEGACY_EXAMEN_MEDICO_VARIANT_AMI || persistedVariant === 'SME') {
    return 'SME'
  }
  if (persistedVariant === 'SODEXO' || persistedVariant === 'FLOWSERVE') {
    return persistedVariant
  }
  return null
}

/** Detecta si un EventTest corresponde a examen médico (cualquier variante). */
export function isExamenMedicoTestName(name: string): boolean {
  const lower = name.toLowerCase().trim()
  return lower.includes('examen medico') || lower.includes('examen médico')
}

/** Resuelve variante desde nombre de prueba o snapshot persistido. */
export function resolveExamenMedicoVariant(
  testNameSnapshot?: string | null,
  persistedVariant?: string | null,
): ExamenMedicoVariant {
  const persisted = normalizePersistedVariant(persistedVariant)
  if (persisted) return persisted

  const lower = (testNameSnapshot ?? '').toLowerCase()
  if (lower.includes('flowserve')) return 'FLOWSERVE'
  if (lower.includes('sodexo')) return 'SODEXO'
  return 'SME'
}

export function examenMedicoVariantLabel(variant: ExamenMedicoVariant): string {
  switch (variant) {
    case 'FLOWSERVE':
      return 'Flowserve'
    case 'SODEXO':
      return 'Sodexo'
    default:
      return 'General'
  }
}

export function isDefaultExamenMedicoVariant(
  variant:
    | ExamenMedicoVariant
    | typeof LEGACY_EXAMEN_MEDICO_VARIANT_AMI
    | string
    | null
    | undefined,
): boolean {
  return (
    !variant ||
    variant === 'SME' ||
    variant === LEGACY_EXAMEN_MEDICO_VARIANT_AMI
  )
}
