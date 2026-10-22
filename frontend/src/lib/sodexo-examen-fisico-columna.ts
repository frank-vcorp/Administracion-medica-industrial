/**
 * §9.6 Columna vertebral — rejillas del impreso REG-SO-01.
 */

export type SodexoColumnaNad = 'N' | 'A' | 'D'

export type SodexoColumnaRegion = {
  id: 'cervical' | 'dorsal' | 'lumbar'
  label: string
}

export type SodexoColumnaCurvaRow = {
  id: 'cifosis' | 'lordosis'
  label: string
}

export const SODEXO_COLUMNA_REGIONES: SodexoColumnaRegion[] = [
  { id: 'cervical', label: 'Cervical' },
  { id: 'dorsal', label: 'Dorsal' },
  { id: 'lumbar', label: 'Lumbar' },
]

export const SODEXO_COLUMNA_CURVAS: SodexoColumnaCurvaRow[] = [
  { id: 'cifosis', label: 'Cifosis' },
  { id: 'lordosis', label: 'Lordosis' },
]

export const SODEXO_COLUMNA_NAD_LABELS: Record<SodexoColumnaNad, string> = {
  N: 'Normal',
  A: 'Aumentada',
  D: 'Disminuida',
}

export function sodexoColumnaCurvaKey(curva: string, region: string): string {
  return `curva:${curva}:${region}`
}

export type SodexoColumnaArcoMov = {
  id: string
  label: string
}

export const SODEXO_COLUMNA_ARCO_MOVIMIENTOS: SodexoColumnaArcoMov[] = [
  { id: 'flexion', label: 'Flexión' },
  { id: 'extension', label: 'Extensión' },
  { id: 'rotacion', label: 'Rotación' },
  { id: 'inclinacion_lateral', label: 'Inclinación lateral' },
]

export function sodexoColumnaArcoKey(mov: string, region: string): string {
  return `arco:${mov}:${region}`
}

/** Alineado con `SodexoExtensionSchema.examen_fisico_columna_sodexo`. */
export type SodexoColumnaExtension = {
  /** `curva:cifosis|cervical` → N | A | D */
  curvas?: Record<string, SodexoColumnaNad> | null
  escoliosis?: 'DERECHA' | 'IZQUIERDA' | null
  /** `arco:flexion:cervical` → NORMAL | ANORMAL */
  arcos?: Record<string, 'NORMAL' | 'ANORMAL'> | null
  dolor?: 'SI' | 'NO' | null
  espasmo?: 'SI' | 'NO' | null
  observaciones?: string | null
}

export function sodexoColumnaIsEmpty(data: SodexoColumnaExtension | null | undefined): boolean {
  if (!data) return true
  if ((data.observaciones ?? '').trim()) return false
  if (data.escoliosis) return false
  if (data.dolor === 'SI' || data.espasmo === 'SI') return false
  if (data.curvas && Object.values(data.curvas).some((v) => v === 'N' || v === 'A' || v === 'D')) {
    return false
  }
  if (
    data.arcos &&
    Object.values(data.arcos).some((v) => v === 'NORMAL' || v === 'ANORMAL')
  ) {
    return false
  }
  return true
}

/** AcroForm: una casilla por opción N/A/D (inventario §9.6 curvas). */
export const SODEXO_COLUMNA_CURVA_PDF: Record<
  string,
  Partial<Record<SodexoColumnaNad, string>>
> = {
  [sodexoColumnaCurvaKey('cifosis', 'cervical')]: {
    N: 'Check Box777',
    A: 'Check Box781',
    D: 'Check Box783',
  },
  [sodexoColumnaCurvaKey('cifosis', 'dorsal')]: {
    N: 'Check Box778',
    A: 'Check Box784',
    D: 'Check Box786',
  },
  [sodexoColumnaCurvaKey('cifosis', 'lumbar')]: {
    N: 'Check Box779',
    A: 'Check Box787',
    D: 'Check Box789',
  },
  [sodexoColumnaCurvaKey('lordosis', 'cervical')]: {
    N: 'Check Box740',
    A: 'Check Box743',
    D: 'Check Box745',
  },
  [sodexoColumnaCurvaKey('lordosis', 'dorsal')]: {
    N: 'Check Box746',
    A: 'Check Box747',
    D: 'Check Box748',
  },
  [sodexoColumnaCurvaKey('lordosis', 'lumbar')]: {
    N: 'Check Box749',
    A: 'Check Box750',
    D: 'Check Box751',
  },
}

export const SODEXO_COLUMNA_ESCOLIOSIS_PDF: Record<'DERECHA' | 'IZQUIERDA', string> = {
  DERECHA: 'Check Box755',
  IZQUIERDA: 'Check Box757',
}

export const SODEXO_COLUMNA_ARCO_PDF: Record<string, { normal: string; abnormal: string }> = {
  [sodexoColumnaArcoKey('flexion', 'cervical')]: { normal: 'Check Box744', abnormal: 'Check Box745' },
  [sodexoColumnaArcoKey('flexion', 'dorsal')]: { normal: 'Check Box761', abnormal: 'Check Box762' },
  [sodexoColumnaArcoKey('flexion', 'lumbar')]: { normal: 'Check Box763', abnormal: 'Check Box764' },
  [sodexoColumnaArcoKey('extension', 'cervical')]: { normal: 'Check Box805', abnormal: 'Check Box807' },
  [sodexoColumnaArcoKey('extension', 'dorsal')]: { normal: 'Check Box809', abnormal: 'Check Box810' },
}

export const SODEXO_COLUMNA_DOLOR_PDF = { SI: 'Check Box752', NO: 'Check Box754' }
export const SODEXO_COLUMNA_ESPASMO_PDF = { SI: 'Check Box753', NO: 'Check Box756' }
