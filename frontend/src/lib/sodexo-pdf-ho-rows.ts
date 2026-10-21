/**
 * AcroForm §3 tabla historia ocupacional (4 filas impreso: 1, 2, 3, Actual).
 * Casillas por fila: Ing / Peri / Ret / No | RT No/Sí | Secuelas No/Sí | Indemn. No/Sí + fecha.
 */
export type SodexoHoPdfRow = {
  empresa: string
  ocupacion: string
  tiempo: string
  indemn_fecha: string
  examen: readonly [string, string, string, string]
  rt: readonly [string, string]
  secuelas: readonly [string, string]
  indemnizado: readonly [string, string]
}

export const SODEXO_HO_PDF_ROWS: readonly SodexoHoPdfRow[] = [
  {
    empresa: 'Texto75',
    ocupacion: 'Texto119',
    tiempo: 'Texto123',
    indemn_fecha: 'Texto127',
    examen: ['Check Box99', 'Check Box103', 'Check Box107', 'Check Box95'],
    rt: ['Check Box79', 'Check Box89'],
    secuelas: ['Check Box90', 'Check Box91'],
    indemnizado: ['Check Box111', 'Check Box115'],
  },
  {
    empresa: 'Texto30',
    ocupacion: 'Texto118',
    tiempo: 'Texto122',
    indemn_fecha: 'Texto126',
    examen: ['Check Box98', 'Check Box102', 'Check Box106', 'Check Box94'],
    rt: ['Check Box78', 'Check Box86'],
    secuelas: ['Check Box87', 'Check Box88'],
    indemnizado: ['Check Box110', 'Check Box114'],
  },
  {
    empresa: 'Texto33',
    ocupacion: 'Texto117',
    tiempo: 'Texto121',
    indemn_fecha: 'Texto125',
    examen: ['Check Box97', 'Check Box101', 'Check Box105', 'Check Box93'],
    rt: ['Check Box77', 'Check Box83'],
    secuelas: ['Check Box84', 'Check Box85'],
    indemnizado: ['Check Box109', 'Check Box113'],
  },
  {
    empresa: 'Texto29',
    ocupacion: 'Texto32',
    tiempo: 'Texto120',
    indemn_fecha: 'Texto124',
    examen: ['Check Box96', 'Check Box100', 'Check Box104', 'Check Box92'],
    rt: ['Check Box76', 'Check Box80'],
    secuelas: ['Check Box81', 'Check Box82'],
    indemnizado: ['Check Box108', 'Check Box112'],
  },
] as const

/** Narrativa RT / accidentes bajo la tabla. */
export const SODEXO_HO_ACCIDENTES_TEXT = 'Texto128'
