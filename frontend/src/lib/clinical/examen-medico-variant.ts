/**
 * Resolución de variante de Examen Médico a partir del nombre de prueba
 * en catálogo / `EventTest.testNameSnapshot`.
 *
 * Catálogo esperado:
 *   - Examen Médico AMI
 *   - Examen Médico Sodexo
 *   - Examen Médico Flowserve
 */

export type ExamenMedicoVariant = 'AMI' | 'SODEXO' | 'FLOWSERVE'

export const EXAMEN_MEDICO_CATALOG_NAMES = {
  AMI: 'Examen Médico AMI',
  SODEXO: 'Examen Médico Sodexo',
  FLOWSERVE: 'Examen Médico Flowserve',
} as const

export const EXAMEN_MEDICO_CATALOG_CODES = {
  AMI: 'GEN-EM-AMI',
  SODEXO: 'GEN-EM-SOD',
  FLOWSERVE: 'GEN-EM-FLO',
} as const

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
  if (persistedVariant === 'SODEXO' || persistedVariant === 'FLOWSERVE' || persistedVariant === 'AMI') {
    return persistedVariant
  }
  const lower = (testNameSnapshot ?? '').toLowerCase()
  if (lower.includes('flowserve')) return 'FLOWSERVE'
  if (lower.includes('sodexo')) return 'SODEXO'
  return 'AMI'
}

export function examenMedicoVariantLabel(variant: ExamenMedicoVariant): string {
  switch (variant) {
    case 'FLOWSERVE':
      return 'Flowserve'
    case 'SODEXO':
      return 'Sodexo'
    default:
      return 'AMI'
  }
}
