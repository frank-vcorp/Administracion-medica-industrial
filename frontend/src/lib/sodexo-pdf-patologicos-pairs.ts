/**
 * Pares Niega/Sí §5 — calibrados por geometría AcroForm (página 2 del PDF).
 */
import type { SodexoNoSiPair } from '@/lib/sodexo-pdf-acroform'

/** Columna izquierda (traumáticos, ORL, osteomuscular, infecciosas, etc.). */
export const SODEXO_PATOLOGICOS_PAIRS_LEFT: SodexoNoSiPair[] = [
  { no: 'Check Box439', si: 'Check Box443' },
  { no: 'Check Box438', si: 'Check Box442' },
  { no: 'Check Box437', si: 'Check Box441' },
  { no: 'Check Box436', si: 'Check Box440' },
  { no: 'Check Box434', si: 'Check Box435' },
  { no: 'Check Box432', si: 'Check Box433' },
  { no: 'Check Box428', si: 'Check Box429' },
  { no: 'Check Box426', si: 'Check Box427' },
  { no: 'Check Box424', si: 'Check Box425' },
  { no: 'Check Box422', si: 'Check Box423' },
  { no: 'Check Box420', si: 'Check Box421' },
  { no: 'Check Box418', si: 'Check Box419' },
  { no: 'Check Box416', si: 'Check Box417' },
  { no: 'Check Box414', si: 'Check Box415' },
]

/** Columna derecha (alérgicos, endocrino, digestivas, CV, etc.). */
export const SODEXO_PATOLOGICOS_PAIRS_RIGHT: SodexoNoSiPair[] = [
  { no: 'Check Box396', si: 'Check Box399' },
  { no: 'Check Box395', si: 'Check Box398' },
  { no: 'Check Box394', si: 'Check Box397' },
  { no: 'Check Box392', si: 'Check Box393' },
  { no: 'Check Box390', si: 'Check Box391' },
  { no: 'Check Box386', si: 'Check Box387' },
  { no: 'Check Box384', si: 'Check Box385' },
  { no: 'Check Box382', si: 'Check Box383' },
  { no: 'Check Box380', si: 'Check Box381' },
  { no: 'Check Box378', si: 'Check Box379' },
  { no: 'Check Box376', si: 'Check Box377' },
  { no: 'Check Box372', si: 'Check Box375' },
  { no: 'Check Box371', si: 'Check Box374' },
  { no: 'Check Box370', si: 'Check Box373' },
  { no: 'Check Box368', si: 'Check Box369' },
  { no: 'Check Box367', si: 'Check Box363' },
]

export const SODEXO_PATOLOGICOS_ALL_PAIRS: SodexoNoSiPair[] = [
  ...SODEXO_PATOLOGICOS_PAIRS_LEFT,
  ...SODEXO_PATOLOGICOS_PAIRS_RIGHT,
]
