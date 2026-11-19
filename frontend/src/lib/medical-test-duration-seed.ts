/**
 * Mapeo idempotente de tiempos teóricos UMM (`tiempos-de-pruebas-umm.pdf`)
 * para precargar `MedicalTest.theoreticalDurationMinutes`.
 */

const EXAMEN_MEDICO_CODES = new Set([
  'GEN-015',
  'MED-01',
  'GEN-EM-AMI',
  'GEN-EM-SOD',
  'GEN-EM-FLO',
])

const ECG_CODES = new Set(['GEN-012', 'CARD-ECG'])

const QUINCE_MIN_CODES = new Set([
  'GEN-013',
  'ESPIRO-01',
  'GEN-003',
  'AUDIO-01',
  'GEN-004',
  'OFT-CAMP',
])

const RX_DIEZ_MIN_CODES = new Set([
  'IMG-002',
  'IMG-015',
  'RX-COL-01',
  'IMG-012',
  'IMG-013',
  'RX-TX-01',
])

export function normalizeCatalogLabel(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
}

/**
 * Devuelve la duración teórica precargada (en minutos) según la tabla UMM,
 * o `null` cuando la prueba no tiene tiempo definido en el PDF.
 */
export function resolveUmmTheoreticalDurationMinutes(
  code: string,
  name: string,
): number | null {
  const cleanCode = code.trim().toUpperCase()
  const normName = normalizeCatalogLabel(name)

  if (EXAMEN_MEDICO_CODES.has(cleanCode) || normName.startsWith('EXAMEN MEDICO')) {
    return 30
  }

  if (ECG_CODES.has(cleanCode) || normName.includes('ELECTROCARDIOGRAMA')) {
    return 25
  }

  if (
    QUINCE_MIN_CODES.has(cleanCode) ||
    normName === 'ESPIROMETRIA' ||
    normName === 'AUDIOMETRIA' ||
    normName === 'AUDIOMETRIA TONAL' ||
    normName === 'CAMPIMETRIA'
  ) {
    return 15
  }

  if (
    RX_DIEZ_MIN_CODES.has(cleanCode) ||
    normName.includes('RX DE COLUMNA') ||
    normName.includes('RADIOGRAFIA DE COLUMNA') ||
    normName.includes('TELE DE TORAX') ||
    normName.includes('RX DE TORAX') ||
    normName.includes('RADIOGRAFIA DE TORAX')
  ) {
    return 10
  }

  return null
}
