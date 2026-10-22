/**
 * §9.6 Columna vertebral — rejillas del impreso REG-SO-01.
 */

export type SodexoColumnaNad = 'N' | 'A' | 'D'
export type SodexoColumnaSiNo = 'SI' | 'NO'
export type SodexoColumnaLado = 'derecha' | 'izquierda'

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

export const SODEXO_COLUMNA_ESCOLIOSIS_LADOS: { id: SodexoColumnaLado; label: string }[] = [
  { id: 'derecha', label: 'Derecha' },
  { id: 'izquierda', label: 'Izquierda' },
]

export function sodexoColumnaCurvaKey(curva: string, region: string): string {
  return `curva:${curva}:${region}`
}

export function sodexoColumnaEscoliosisKey(lado: SodexoColumnaLado, region: string): string {
  return `escoliosis:${lado}:${region}`
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

/** Columnas de la rejilla «Arcos de movimiento» (no confundir con regiones de curva). */
export const SODEXO_COLUMNA_ARCO_REGIONES: { id: 'cervical' | 'dorsolumbar'; label: string }[] = [
  { id: 'cervical', label: 'Cervical' },
  { id: 'dorsolumbar', label: 'Dorsolumbar' },
]

export function sodexoColumnaArcoKey(mov: string, aspect: string): string {
  return `arco:${mov}:${aspect}`
}

/** Alineado con `SodexoExtensionSchema.examen_fisico_columna_sodexo`. */
export type SodexoColumnaExtension = {
  /** `curva:cifosis|cervical` → N | A | D */
  curvas?: Record<string, SodexoColumnaNad> | null
  /** `escoliosis:derecha|cervical` → NO | SI */
  escoliosis?: Record<string, SodexoColumnaSiNo> | null
  /**
   * `arco:flexion:cervical` → NORMAL | ANORMAL;
   * `arco:flexion:dolor` / `arco:flexion:espasmo` → NO | SI.
   */
  arcos?: Record<string, 'NORMAL' | 'ANORMAL' | SodexoColumnaSiNo> | null
  observaciones?: string | null
}

export function sodexoColumnaIsEmpty(data: SodexoColumnaExtension | null | undefined): boolean {
  if (!data) return true
  if ((data.observaciones ?? '').trim()) return false
  if (data.escoliosis && Object.values(data.escoliosis).some((v) => v === 'SI' || v === 'NO')) {
    return false
  }
  if (data.curvas && Object.values(data.curvas).some((v) => v === 'N' || v === 'A' || v === 'D')) {
    return false
  }
  if (
    data.arcos &&
    Object.values(data.arcos).some(
      (v) => v === 'NORMAL' || v === 'ANORMAL' || v === 'SI' || v === 'NO',
    )
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
    N: 'Check Box781',
    A: 'Check Box784',
    D: 'Check Box787',
  },
}

/** Escoliosis: lado × región × No/Sí (impreso §9.6). */
export const SODEXO_COLUMNA_ESCOLIOSIS_PDF: Record<string, { NO: string; SI: string }> = {
  [sodexoColumnaEscoliosisKey('derecha', 'cervical')]: {
    NO: 'Check Box749',
    SI: 'Check Box750',
  },
  [sodexoColumnaEscoliosisKey('derecha', 'dorsal')]: {
    NO: 'Check Box753',
    SI: 'Check Box755',
  },
  [sodexoColumnaEscoliosisKey('derecha', 'lumbar')]: {
    NO: 'Check Box757',
    SI: 'Check Box759',
  },
  [sodexoColumnaEscoliosisKey('izquierda', 'cervical')]: {
    NO: 'Check Box751',
    SI: 'Check Box752',
  },
  [sodexoColumnaEscoliosisKey('izquierda', 'dorsal')]: {
    NO: 'Check Box754',
    SI: 'Check Box756',
  },
  [sodexoColumnaEscoliosisKey('izquierda', 'lumbar')]: {
    NO: 'Check Box758',
    SI: 'Check Box760',
  },
}

export const SODEXO_COLUMNA_ARCO_PDF: Record<string, { normal: string; abnormal: string }> = {
  [sodexoColumnaArcoKey('flexion', 'cervical')]: {
    normal: 'Check Box761',
    abnormal: 'Check Box762',
  },
  [sodexoColumnaArcoKey('flexion', 'dorsolumbar')]: {
    normal: 'Check Box763',
    abnormal: 'Check Box764',
  },
  [sodexoColumnaArcoKey('extension', 'cervical')]: {
    normal: 'Check Box794',
    abnormal: 'Check Box797',
  },
  [sodexoColumnaArcoKey('extension', 'dorsolumbar')]: {
    normal: 'Check Box800',
    abnormal: 'Check Box803',
  },
  [sodexoColumnaArcoKey('rotacion', 'cervical')]: {
    normal: 'Check Box805',
    abnormal: 'Check Box806',
  },
  [sodexoColumnaArcoKey('rotacion', 'dorsolumbar')]: {
    normal: 'Check Box807',
    abnormal: 'Check Box808',
  },
  [sodexoColumnaArcoKey('inclinacion_lateral', 'cervical')]: {
    normal: 'Check Box809',
    abnormal: 'Check Box810',
  },
  [sodexoColumnaArcoKey('inclinacion_lateral', 'dorsolumbar')]: {
    normal: 'Check Box811',
    abnormal: 'Check Box812',
  },
}

export const SODEXO_COLUMNA_ARCO_SINTOMA_PDF: Record<
  string,
  { NO: string; SI: string }
> = {
  [sodexoColumnaArcoKey('flexion', 'dolor')]: { NO: 'Check Box793', SI: 'Check Box796' },
  [sodexoColumnaArcoKey('flexion', 'espasmo')]: { NO: 'Check Box799', SI: 'Check Box802' },
  [sodexoColumnaArcoKey('extension', 'dolor')]: { NO: 'Check Box795', SI: 'Check Box798' },
  [sodexoColumnaArcoKey('extension', 'espasmo')]: { NO: 'Check Box801', SI: 'Check Box804' },
  [sodexoColumnaArcoKey('rotacion', 'dolor')]: { NO: 'Check Box813', SI: 'Check Box814' },
  [sodexoColumnaArcoKey('rotacion', 'espasmo')]: { NO: 'Check Box815', SI: 'Check Box816' },
  [sodexoColumnaArcoKey('inclinacion_lateral', 'dolor')]: { NO: 'Check Box817', SI: 'Check Box818' },
}
