/** §9.1 Cabeza y cuello — rejilla REG-SO-01 (órgano | hallazgos). */

export const SODEXO_EXAMEN_FISICO_91_GROUPS = [
  'Cráneo',
  'Ojos',
  'Oídos',
  'Orofaringe',
  'Nariz',
  'Cuello',
  'Dentadura / Prótesis',
] as const

export type SodexoEf91Group = (typeof SODEXO_EXAMEN_FISICO_91_GROUPS)[number]

/** Columna izquierda del impreso Sodexo. */
export const SODEXO_EXAMEN_FISICO_91_COLUMN_LEFT: SodexoEf91Group[] = [
  'Cráneo',
  'Ojos',
  'Oídos',
  'Orofaringe',
]

/** Columna derecha del impreso Sodexo. */
export const SODEXO_EXAMEN_FISICO_91_COLUMN_RIGHT: SodexoEf91Group[] = [
  'Nariz',
  'Cuello',
  'Dentadura / Prótesis',
]

/** Fila «Orofaringe» en impreso sin casilla AcroForm en plantilla digital. */
export const SODEXO_91_OROFARINGE_SIN_ACROFORM = true
